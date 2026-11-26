const RANKS = [
  ['Fer','Iron'], ['Bronze','Bronze'], ['Argent','Silver'], ['Or','Gold'],
  ['Platine','Platinum'], ['Diamant','Diamond'], ['Ascendant','Ascendant'],
  ['Immortel','Immortal'], ['Radiant','Radiant'],
];
const lists = {
  owned: [["Valorant","VALORANT"],["Kovaak's","KovaaK’s"],['Aim Lab','Aim Lab'],['Oblivity','Oblivity']],
  goals: [
    ['Static Clicking','Cibles immobiles','Static clicking'], ['Dynamic Clicking','Cibles mobiles','Dynamic clicking'],
    ['Micro Flicks','Micro-ajustements','Micro flicks'], ['Wide Flicks','Grands flicks','Wide flicks'],
    ['Precision','Précision','Precision'], ['Smooth Tracking','Tracking fluide','Smooth tracking'],
    ['Reactive Tracking','Tracking réactif','Reactive tracking'], ['Target Switching','Transitions de cibles','Target switching'],
    ['Click Timing','Timing du clic','Click timing'], ['Crosshair Placement','Placement du viseur','Crosshair placement'],
    ['Movement + Shooting','Déplacement et tir','Movement and shooting'], ['Peek Training','Prise d’angle','Peek training'],
  ],
  weaknesses: [
    ['overshoot','Je dépasse les cibles','Overshooting targets'], ['mobile','Cibles mobiles difficiles','Difficulty with moving targets'],
    ['slow','Précis mais trop lent','Accurate but slow'], ['consistency','Manque de régularité','Inconsistent aim'],
  ],
  trainingDays: [
    [1,'Lun.','Mon'], [2,'Mar.','Tue'], [3,'Mer.','Wed'], [4,'Jeu.','Thu'],
    [5,'Ven.','Fri'], [6,'Sam.','Sat'], [0,'Dim.','Sun'],
  ],
};
const rankNames = new Map(RANKS);
const legacyRank = new Map([['iron','Fer'],['silver','Argent'],['diamond','Diamant'],['immortal','Immortel']]);
const legacyTool = new Map([['VALORANT','Valorant'],['KovaaK’s',"Kovaak's"],['Aim Lab','Aim Lab'],['Oblivity','Oblivity']]);
const numbers = ['mechanicalLevel','fatigue','dpi','sensitivity','pollingRate','minutes'];
const imagePrefix = 'data:image/png;base64,';
const formatters = {fr:new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}), en:new Intl.NumberFormat('en',{maximumFractionDigits:3})};
const notices = {
  saved: ['Profil enregistré. Le logiciel récupérera ces changements automatiquement.','Profile saved. The Windows app will pick up these changes automatically.'],
  saving: ['Enregistrement du profil…','Saving your profile…'],
  conflict: ['Le profil a changé entre-temps sur un autre appareil. Vérifie tes modifications avant de les enregistrer à nouveau.','Your profile changed on another device. Review your changes before saving again.'],
  error: ['Enregistrement impossible. Tes modifications sont toujours dans le formulaire.','Could not save your profile. Your changes are still in the form.'],
  session: ['La session a expiré. Reconnecte-toi pour enregistrer ton profil.','Your session expired. Sign in again to save your profile.'],
  blank: ['Saisis un pseudo.','Enter a nickname.'],
  imageType: ['Choisis une image PNG, JPG ou WebP de 5 Mo maximum.','Choose a PNG, JPG or WebP image up to 5 MB.'],
  imageDimensions: ['Choisis une image de 16 mégapixels maximum, avec des côtés de 8 192 pixels maximum.','Choose an image up to 16 megapixels with sides no longer than 8,192 pixels.'],
  imageRead: ['Image illisible. Essaie avec un autre fichier.','Could not read the image. Try another file.'],
  imageWorking: ['Préparation de l’image…','Preparing your image…'],
};

const avatarUrl = value => typeof value === 'string' && value.length <= 100000 &&
  /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
const isProfileName = value => typeof value === 'string' && value.trim().length > 0;
const equal = (left,right) => JSON.stringify(left) === JSON.stringify(right);

function hasLegacyProfile(profile) {
  return Boolean(profile?.nickname || profile?.mouse || profile?.goal || profile?.dpi != null ||
    profile?.sensitivity != null || legacyRank.has(profile?.rank) && profile.rank !== 'silver' ||
    legacyTool.has(profile?.tool) && profile.tool !== 'VALORANT');
}

export function initialPlayerProfile(name, legacy) {
  const previous = hasLegacyProfile(legacy) ? legacy : {};
  const validDpi = Number.isInteger(previous.dpi) && previous.dpi >= 50 && previous.dpi <= 50000;
  const validSensitivity = Number.isFinite(previous.sensitivity) && previous.sensitivity >= .001 && previous.sensitivity <= 20;
  const tool = legacyTool.get(previous.tool);
  return {
    onboarded:true,
    name:String(previous.nickname?.trim() || name || 'Joueur').slice(0,80),
    rank:legacyRank.get(previous.rank) ?? 'Fer',
    division:1,
    owned:tool && tool !== 'Valorant' ? ['Valorant',tool] : [],
    avatarDataUrl:null,
    goals:['Precision','Micro Flicks'],
    weaknesses:[],
    mechanicalLevel:1,
    fatigue:2,
    dpi:validDpi ? previous.dpi : 800,
    sensitivity:validSensitivity ? previous.sensitivity : .4,
    pollingRate:1000,
    minutes:30,
    trainingDays:[1,2,3,4,5],
  };
}

// Preserve other devices' edits to fields that were untouched in this form.
export function mergePlayerDraft(original, draft, latest) {
  const next = {...latest};
  for (const key of Object.keys(draft)) if (!equal(original[key],draft[key])) next[key] = draft[key];
  if (original.rank !== draft.rank || original.division !== draft.division) {
    next.rank = draft.rank;
    next.division = draft.division;
  }
  return next;
}

function checkImageDimensions(width,height) {
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16000000) throw Error('imageDimensions');
}

async function prepareAvatar(file) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw Error('imageType');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.subarray(0,4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8,12)) === 'WEBP';
  if (!png && !jpeg && !webp) throw Error('imageType');
  if (png && bytes.length >= 24) {
    const header = new DataView(bytes.buffer);
    checkImageDimensions(header.getUint32(16),header.getUint32(20));
  }
  const blob = new Blob([bytes],{type:png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp'});
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    checkImageDimensions(image.naturalWidth,image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw Error('imageRead');
    const crop = Math.min(image.naturalWidth,image.naturalHeight);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image,(image.naturalWidth-crop)/2,(image.naturalHeight-crop)/2,crop,crop,0,0,128,128);
    // Keep only the rendered image chunks. Some browsers add a colour profile.
    const encoded = canvas.toDataURL('image/png');
    if (!encoded.startsWith(imagePrefix)) throw Error('imageRead');
    const binary = atob(encoded.slice(imagePrefix.length));
    const view = new DataView(Uint8Array.from(binary,char=>char.charCodeAt(0)).buffer);
    const chunks = [binary.slice(0,8)];
    for (let offset = 8; offset + 12 <= binary.length;) {
      const end = offset + 12 + view.getUint32(offset);
      if (end > binary.length) throw Error('imageRead');
      const type = binary.slice(offset+4,offset+8);
      if (['IHDR','IDAT','IEND'].includes(type)) chunks.push(binary.slice(offset,end));
      offset = end;
    }
    const avatar = avatarUrl(imagePrefix + btoa(chunks.join('')));
    if (!avatar) throw Error('imageRead');
    return avatar;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function attachAccountPlayer(client,{readLocalProfile} = {}) {
  const section = document.getElementById('account-player');
  const find = selector => section.querySelector(selector);
  const edit = find('#account-player-edit');
  const retry = find('#account-player-retry');
  const form = find('#account-player-form');
  const fields = find('[data-player-fields]');
  const field = name => form.elements.namedItem(name);
  const imageInput = field('avatar');
  const removeAvatar = find('#account-player-remove-avatar');
  const statusMessage = find('#account-player-feedback');
  const summary = find('#account-player-summary');
  const statusView = find('#account-player-status');
  const anchors = ['#account-player-edit'];
  let current = null;

  for (const [key,choices] of Object.entries(lists)) {
    const group = find('[data-choices="' + key + '"]');
    for (const [value,fr,en=fr] of choices) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = String(value);
      input.name = key;
      const label = document.createElement('label');
      const french = document.createElement('span');
      french.className = 'fr';
      french.textContent = fr;
      const english = document.createElement('span');
      english.className = 'en';
      english.textContent = en;
      label.append(input,french,english);
      group.append(label);
    }
  }
  for (const [rank] of RANKS) {
    const option = document.createElement('option');
    option.value = rank;
    field('rank').append(option);
  }
  const language = () => document.documentElement.lang === 'en' ? 'en' : 'fr';
  const formatEdpi = (dpi,sens,lang) => Number.isFinite(dpi*sens) ? formatters[lang].format(dpi*sens) : '—';

  function showNotice(code) {
    if (current) current.notice = code;
    statusMessage.textContent = notices[code]?.[language()==='en' ? 1 : 0] ?? '';
    statusMessage.dataset.state = code ?? '';
  }

  function setStatus(status) {
    statusView.hidden = !status;
    for (const state of ['loading','empty','error']) find('.ar7-player-'+state).hidden = state !== status;
    retry.hidden = status !== 'error';
  }

  function setAvatar(prefix,name,source) {
    const image = find('#' + prefix + '-avatar');
    find('#' + prefix + '-initials').textContent = Array.from(name).slice(0,2).join('').toUpperCase();
    const url = avatarUrl(source);
    if (url) {
      if (image.getAttribute('src') !== url) {
        image.src = url;
        image.hidden = false;
      }
    } else {
      image.hidden = true;
      image.removeAttribute('src');
    }
  }
  for (const prefix of ['account-player','account-player-draft']) {
    find('#'+prefix+'-avatar').addEventListener('error',event=>{event.currentTarget.hidden=true});
  }

  function renderSummary(profile) {
    if (!profile?.onboarded || !isProfileName(profile.name)) {
      summary.hidden = true;
      find('#account-player-name').textContent = '';
      setAvatar('account-player','',null);
      for (const key of ['rank-fr','rank-en','edpi-fr','edpi-en']) find('#account-player-'+key).textContent = '';
      setStatus('empty');
      return;
    }
    const name = profile.name.trim().slice(0,80);
    const rank = rankNames.get(profile.rank);
    const division = [1,2,3].includes(profile.division) ? ' '+profile.division : '';
    find('#account-player-name').textContent = name;
    find('#account-player-rank-fr').textContent = rank ? profile.rank+division : '—';
    find('#account-player-rank-en').textContent = rank ? rank+division : '—';
    for (const lang of ['fr','en']) find('#account-player-edpi-'+lang).textContent = formatEdpi(profile.dpi,profile.sensitivity,lang);
    setAvatar('account-player',name,profile.avatarDataUrl);
    setStatus(null);
    summary.hidden = false;
  }

  function updateEditLabel() {
    const exists = current?.record?.profile?.onboarded;
    edit.querySelector('.fr').textContent = exists ? 'Modifier mon profil' : 'Créer mon profil';
    edit.querySelector('.en').textContent = exists ? 'Edit my profile' : 'Create my profile';
  }

  function renderDraft() {
    const radiant = field('rank').value === 'Radiant';
    find('[data-player-division]').hidden = radiant;
    field('division').disabled = radiant;
    const dpi = field('dpi').valueAsNumber;
    const sens = field('sensitivity').valueAsNumber;
    find('#account-player-draft-edpi').textContent = formatEdpi(dpi,sens,language());
    setAvatar('account-player-draft',field('name').value.trim(),current.avatar);
    removeAvatar.hidden = !current.avatar;
  }

  function updateLanguage() {
    for (const option of field('rank').options) option.textContent = language() === 'en' ? rankNames.get(option.value) : option.value;
    showNotice(current?.notice);
    if (current?.editing) renderDraft();
  }
  new MutationObserver(updateLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  updateLanguage();

  function populate(profile) {
    for (const key of ['name','rank','division',...numbers]) field(key).value = profile[key] ?? 1;
    for (const key of Object.keys(lists)) {
      for (const checkbox of form.querySelectorAll('input[name="'+key+'"]')) {
        const value = key === 'trainingDays' ? Number(checkbox.value) : checkbox.value;
        checkbox.checked = profile[key].includes(value);
      }
    }
    current.avatar = avatarUrl(profile.avatarDataUrl);
    imageInput.value = '';
    renderDraft();
  }

  function formProfile(state) {
    const draft = {
      ...state.base,
      onboarded:true,
      name:field('name').value.trim(),
      rank:field('rank').value,
      division:field('rank').value === 'Radiant' ? null : Number(field('division').value),
      avatarDataUrl:state.avatar,
    };
    for (const key of numbers) draft[key] = field(key).valueAsNumber;
    for (const key of Object.keys(lists)) {
      const values = [...form.querySelectorAll('input[name="'+key+'"]:checked')]
        .map(input=>key === 'trainingDays' ? Number(input.value) : input.value);
      const previous = state.base[key];
      draft[key] = values.length === previous.length && values.every(value=>previous.includes(value)) ? previous : values;
    }
    return draft;
  }

  function beginEdit() {
    if (!current?.record || current.editing) return;
    current.editing = true;
    current.base = current.record.profile ?? current.initial;
    current.imageRequest = null;
    populate(current.base);
    showNotice(null);
    edit.hidden = true;
    form.hidden = false;
    field('name').focus();
  }

  function openLinkedEditor() {
    if (!current?.record || current.linkOpened || !anchors.includes(location.hash)) return;
    current.linkOpened = true;
    beginEdit();
  }

  async function readProfile(id) {
    const {data,error} = await client.from('aim_account_player_profiles').select('profile,revision').eq('user_id',id).maybeSingle();
    if (error) throw error;
    if (!data) return {profile:null,revision:0};
    if (!Number.isInteger(data.revision) || data.revision < 1 || !isProfileName(data.profile?.name)) throw Error('Unrecognized profile');
    return data;
  }

  async function readLegacy(state) {
    const local = readLocalProfile?.(state.id);
    if (hasLegacyProfile(local)) return local;
    try {
      const {data,error} = await client.from('aim_profiles').select('profile').eq('user_id',state.id).maybeSingle();
      if (!error) return data?.profile?.profile;
    } catch {}
    return local;
  }

  async function refresh(state) {
    if (!state || state.reading || state.editing || state.saving) return;
    state.reading = true;
    try {
      const record = await readProfile(state.id);
      if (state !== current || state.editing) return;
      if (!record.profile && !state.initial) {
        const legacy = await readLegacy(state);
        if (state !== current || state.editing) return;
        state.initial = initialPlayerProfile(state.name,legacy);
      }
      state.record = record;
      renderSummary(record.profile);
      updateEditLabel();
      edit.hidden = false;
      openLinkedEditor();
    } catch {
      if (state === current && !state.record && !state.editing) setStatus('error');
    } finally {
      state.reading = false;
    }
  }

  function closeEditor() {
    if (!current) return;
    current.editing = false;
    current.imageRequest = null;
    fields.disabled = false;
    form.reset();
    imageInput.disabled = false;
    removeAvatar.disabled = false;
    find('#account-player-save').disabled = false;
    field('name').setCustomValidity('');
    form.hidden = true;
    setAvatar('account-player-draft','',null);
    edit.hidden = !current.record;
  }

  function setAccount(id,name) {
    if ((current?.id ?? null) !== id) {
      closeEditor();
      current = id ? {id,name} : null;
      section.hidden = !current;
      renderSummary(null);
      edit.hidden = true;
      showNotice(null);
      setStatus(current ? 'loading' : null);
    }
    void refresh(current);
  }

  async function commit(state,draft) {
    const {data:sessionData,error:sessionError} = await client.auth.getSession();
    const session = sessionData?.session;
    if (state !== current) return;
    if (sessionError || session?.user?.id !== state.id || !session.access_token) {
      showNotice('session');
      return;
    }
    const {data,error,response} = await client.functions.invoke('aimroutine-windows',{
      body:{action:'save-profile',revision:state.record.revision,profile:draft},
      headers:{Authorization:'Bearer '+session.access_token},
    });
    if (state !== current) return;
    if (error) {
      const status = response?.status ?? error.context?.status;
      if (status !== 409) throw error;
      const latest = await readProfile(state.id);
      if (state !== current) return;
      const base = latest.profile ?? state.initial ?? initialPlayerProfile(state.name);
      const merged = mergePlayerDraft(state.base,draft,base);
      state.record = latest;
      state.base = base;
      renderSummary(latest.profile);
      populate(merged);
      showNotice('conflict');
      return;
    }
    if (data?.accountId !== state.id || !Number.isInteger(data.revision) ||
        data.revision < 1 || !isProfileName(data.profile?.name)) throw Error('Unrecognized profile response');
    state.record = {profile:data.profile,revision:data.revision};
    closeEditor();
    renderSummary(data.profile);
    updateEditLabel();
    showNotice('saved');
    edit.focus();
    window.dispatchEvent(new CustomEvent('aim-account-player-changed',{detail:{id:state.id,profile:data.profile}}));
  }

  edit.addEventListener('click',beginEdit);
  retry.addEventListener('click',()=>void refresh(current));
  window.addEventListener('hashchange',()=>{
    if (!current) return;
    current.linkOpened = false;
    openLinkedEditor();
  });
  find('#account-player-cancel').addEventListener('click',()=>{
    closeEditor();
    showNotice(null);
    edit.focus();
    void refresh(current);
  });
  form.addEventListener('input',()=>{
    if (current?.editing) {
      field('name').setCustomValidity('');
      renderDraft();
    }
  });
  field('rank').addEventListener('change',()=>{
    field('division').value = '1';
    if (current?.editing) renderDraft();
  });
  imageInput.addEventListener('change',async()=>{
    const state = current;
    const file = imageInput.files?.[0];
    if (!state?.editing || state.saving || !file) return;
    const request = {};
    state.imageRequest = request;
    imageInput.value = '';
    imageInput.disabled = true;
    removeAvatar.disabled = true;
    find('#account-player-save').disabled = true;
    showNotice('imageWorking');
    try {
      const avatar = await prepareAvatar(file);
      if (state !== current || state.imageRequest !== request) return;
      state.avatar = avatar;
      renderDraft();
      showNotice(null);
    } catch (error) {
      if (state === current && state.imageRequest === request) {
        showNotice(['imageType','imageDimensions'].includes(error.message) ? error.message : 'imageRead');
      }
    } finally {
      if (state === current && state.imageRequest === request) {
        state.imageRequest = null;
        imageInput.disabled = false;
        removeAvatar.disabled = false;
        find('#account-player-save').disabled = false;
      }
    }
  });
  removeAvatar.addEventListener('click',()=>{
    if (!current?.editing) return;
    current.avatar = null;
    renderDraft();
    showNotice(null);
  });

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const state = current;
    if (!state?.editing || state.saving || state.imageRequest) return;
    const draft = formProfile(state);
    if (!draft.name) {
      field('name').setCustomValidity(notices.blank[language()==='en' ? 1 : 0]);
      field('name').reportValidity();
      return;
    }
    state.saving = true;
    fields.disabled = true;
    showNotice('saving');
    try { await commit(state,draft); }
    catch { if (state === current) showNotice('error'); }
    finally {
      state.saving = false;
      if (state === current) fields.disabled = false;
    }
  });

  return {setAccount};
}
