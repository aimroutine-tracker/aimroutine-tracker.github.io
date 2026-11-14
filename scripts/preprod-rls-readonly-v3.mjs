/* Private V3 preproduction RLS smoke — GET only; never point at production.
 * This helper cannot establish full account deletion/reset safety. It checks
 * that two independently verified, disposable QA identities see only their
 * own pre-seeded rows across all four owner-only tables.
 * Do NOT store bearer tokens, anon keys or user IDs in the repository. */
import {fileURLToPath} from 'node:url';

const LIVE_REF='lmzswtzboobpokumxzhy';
const TABLES=['aim_sessions','aim_presets','aim_profiles','aim_preferences'];
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertStagingOrigin(raw){
 let url;
 try{url=new URL(raw)}catch{throw Error('Adresse Supabase de préproduction invalide.')}
 if(url.protocol!=='https:'||url.username||url.password||url.port||
    url.pathname!=='/'||url.search||url.hash||
    !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)){
  throw Error('Utilise uniquement la racine HTTPS d’un projet Supabase indépendant.');
 }
 if(url.hostname===LIVE_REF+'.supabase.co')
  throw Error('Projet de production interdit pour cette recette : aucun accès effectué.');
 return url.origin;
}

function required(value,name){
 if(typeof value!=='string'||!value.trim())throw Error('Variable QA manquante : '+name);
 return value.trim();
}
function readConfig(env){
 const origin=assertStagingOrigin(required(env.AIM_QA_SUPABASE_URL,'AIM_QA_SUPABASE_URL'));
 const key=required(env.AIM_QA_SUPABASE_ANON_KEY,'AIM_QA_SUPABASE_ANON_KEY');
 const a={uid:required(env.AIM_QA_UID_A,'AIM_QA_UID_A'),
  token:required(env.AIM_QA_JWT_A,'AIM_QA_JWT_A')};
 const b={uid:required(env.AIM_QA_UID_B,'AIM_QA_UID_B'),
  token:required(env.AIM_QA_JWT_B,'AIM_QA_JWT_B')};
 if(!UID.test(a.uid)||!UID.test(b.uid)||a.uid.toLowerCase()===b.uid.toLowerCase())
  throw Error('Deux identifiants QA distincts et valides sont obligatoires.');
 if(a.token===b.token)throw Error('Deux sessions QA indépendantes sont obligatoires.');
 return {origin,key,a,b};
}

async function checkedGet(fetchImpl,origin,path,key,token){
 const res=await fetchImpl(origin+path,{
  method:'GET',headers:{apikey:key,Authorization:'Bearer '+token,Accept:'application/json'},
  redirect:'error',cache:'no-store'
 });
 if(!res||res.ok!==true)throw Error('Lecture Supabase QA refusée : HTTP '+(res?.status??'?'));
 return res.json();
}

export async function runPreprodRlsReadOnly({env=process.env,fetchImpl=fetch}={}){
 // Validate *all* configuration before the first network request.
 const {origin,key,a,b}=readConfig(env);
 for(const account of [a,b]){
  const auth=await checkedGet(fetchImpl,origin,'/auth/v1/user',key,account.token);
  if(auth?.id?.toLowerCase()!==account.uid.toLowerCase())
   throw Error('JWT QA différent de l’identité attendue : arrêt avant les tests RLS.');
 }
 const results=[];
 for(const table of TABLES){
  for(const [viewer,owner,allowed] of [[a,a,true],[b,b,true],[a,b,false],[b,a,false]]){
   const params=new URLSearchParams({select:'user_id',user_id:'eq.'+owner.uid,limit:'2'});
   const rows=await checkedGet(fetchImpl,origin,'/rest/v1/'+table+'?'+params,key,viewer.token);
   if(!Array.isArray(rows)||rows.some(row=>row?.user_id?.toLowerCase()!==owner.uid.toLowerCase()))
    throw Error('Réponse RLS QA inattendue sur '+table+' ; aucune donnée affichée.');
   if(allowed&&rows.length===0)
    throw Error('Fixture QA absente sur '+table+' : contrôle RLS non probant.');
   if(!allowed&&rows.length>0)
    throw Error('RLS QA : isolation A/B non respectée sur '+table+'.');
  }
  results.push({table,ownRead:true,crossAccountBlocked:true});
 }
 return {stagingVerified:true,tables:results};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const result=await runPreprodRlsReadOnly();
  for(const {table} of result.tables)process.stdout.write('PASS RLS (préproduction) : '+table+'\n');
  process.stdout.write('PASS : deux comptes QA distincts, lecture seule, quatre tables isolées.\n');
 }catch(error){
  process.stderr.write('BLOCKED RLS QA : '+error.message+'\n');
  process.exitCode=1;
 }
}
