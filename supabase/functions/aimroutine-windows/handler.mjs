const site = 'https://aimroutine-tracker.github.io';
const maximumBytes = 20 * 1024 * 1024;
const resultKeys = [
  'id', 'date', 'createdAt', 'software', 'exercise', 'durationSeconds',
  'score', 'accuracy', 'headshot', 'notes', 'mood'
];
const software = new Set(["Kovaak's", 'Aim Lab', 'Valorant', 'Oblivity']);
const siteActions = new Set(['approve', 'devices', 'results', 'revoke']);
const deviceActions = new Set(['status', 'sync', 'disconnect']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/;

function allowedOrigin(origin) {
  return origin === site || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(origin);
}

async function parseBody(request) {
  if (Number(request.headers.get('content-length')) > maximumBytes) throw new RangeError();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const decoded = [];
  let size = 0;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new RangeError();
    }
    decoded.push(decoder.decode(value, {stream:true}));
  }
  decoded.push(decoder.decode());
  return JSON.parse(decoded.join(''));
}

function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value);
  return Number.isFinite(day.valueOf()) && day.toISOString().slice(0, 10) === value;
}

function isText(value, max, allowBlank = false) {
  return typeof value === 'string' && value.length <= max && !value.includes('\0') &&
    (allowBlank || Boolean(value.trim()));
}

function isInteger(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function nullableNumber(value, max) {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= max);
}

function isTimestamp(value) {
  return isText(value,100) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    isDay(value.slice(0,10)) && Number.isFinite(Date.parse(value));
}

function validResults(results) {
  if (!Array.isArray(results) || results.length > 100000) return false;
  const ids = new Set();
  for (const row of results) {
    if (!row || typeof row !== 'object' || Object.keys(row).length !== resultKeys.length ||
        !resultKeys.every(key => Object.hasOwn(row, key)) ||
        !isText(row.id,200) || ids.has(row.id) || !isDay(row.date) || !isTimestamp(row.createdAt) ||
        !software.has(row.software) || !isText(row.exercise,300) ||
        !isInteger(row.durationSeconds,1,86400) || !nullableNumber(row.score,1e12) ||
        !nullableNumber(row.accuracy,100) || !nullableNumber(row.headshot,100) ||
        !isText(row.notes,10000,true) || !isInteger(row.mood,1,5)) return false;
    ids.add(row.id);
  }
  return true;
}

function numericField(value) {
  return typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
}

function webSession(row) {
  const tools = ['VALORANT','Aim Lab','KovaaK’s','Oblivity'];
  const ranks = ['iron','silver','diamond','immortal'];
  const focuses = ['flick','micro','tracking','control'];
  const minutes = numericField(row?.minutes);
  if (!row || !isText(row.id,100) || !isText(row.date,100) ||
      !Number.isFinite(Date.parse(row.date)) || !ranks.includes(row.rank) ||
      !focuses.includes(row.focus) || !isInteger(minutes,1,120) ||
      !nullableNumber(row.accuracy,100) || !['good','ok','hard'].includes(row.feeling) ||
      !isText(row.notes,240,true)) return null;
  const breakSeconds = numericField(row.breakSeconds);
  return {
    id:row.id, date:new Date(row.date).toISOString(), rank:row.rank, focus:row.focus,
    minutes, accuracy:row.accuracy, feeling:row.feeling, notes:row.notes,
    tool:tools.includes(row.tool) ? row.tool : 'Non précisé',
    scenario:typeof row.scenario === 'string' ? row.scenario.slice(0,90) : '',
    breakSeconds:isInteger(breakSeconds,0,120) ? breakSeconds : 0,
  };
}
async function hashDevice(device) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(device));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}

export async function handleWindows(request, backend) {
  const origin = request.headers.get('origin');
  const headers = {
    'Cache-Control':'no-store',
    'Vary':'Origin',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-aim-device',
  };
  if (origin && allowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const json = (body, status = 200) => Response.json(body, {status, headers});
  if (origin && !allowedOrigin(origin)) return json({error:'origin_not_allowed'},403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return json({error:'method_not_allowed'},405);

  let body;
  try {
    body = await parseBody(request);
  } catch (error) {
    if (error instanceof RangeError) return json({error:'payload_too_large'},413);
    return json({error:'invalid_json'},400);
  }

  const action = body?.action;
  const offset = body?.offset === undefined ? 0 : body.offset;
  if (!siteActions.has(action) && !deviceActions.has(action)) return json({error:'invalid_action'},400);
  if ((action === 'results' || action === 'sync') && !isInteger(offset,0,100000)) {
    return json({error:'invalid_offset'},400);
  }
  try {
    let args;
    if (siteActions.has(action)) {
      const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
      const account = token && await backend.verify(token);
      if (!account) return json({error:'authentication_required'},401);
      args = {uid:account.id};
      if (action === 'approve') {
        if (typeof body.challenge !== 'string' || !digestPattern.test(body.challenge)) {
          return json({error:'invalid_challenge'},400);
        }
        Object.assign(args,{digest:body.challenge,label:account.label});
      }
      if (action === 'results' || action === 'revoke') {
        if (typeof body.id !== 'string' || !uuid.test(body.id)) return json({error:'invalid_device'},400);
        args.id = body.id;
      }
      if (action === 'results') args.offset = offset;
    } else {
      const device = request.headers.get('x-aim-device');
      if (!device || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(device)) {
        return json({error:'device_authentication_required'},401);
      }
      args = {digest:await hashDevice(device)};
      if (action === 'sync') {
        if (Object.hasOwn(body,'results') && !validResults(body.results)) {
          return json({error:'invalid_results'},400);
        }
        Object.assign(args,{offset,results:body.results ?? null});
      }
    }
    const data = await backend.call(action,args);
    if (data.error === 'challenge_already_used' || data.error === 'device_limit') return json(data,409);
    if (data.error === 'device_not_found') return json(data,404);
    if (action === 'sync' && data.state === 'linked') {
      return json({...data,sessions:data.sessions.map(webSession).filter(Boolean)});
    }
    return json(data);
  } catch {
    console.error('AimRoutine Windows operation failed');
    return json({error:'operation_failed'},500);
  }
}
