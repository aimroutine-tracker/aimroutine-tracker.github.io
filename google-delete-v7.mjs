/* Pure helpers for a two-step OAuth identity check before account deletion.
   This is only UX state. The Supabase Edge Function is the authority. */
export const GOOGLE_DELETE_MARKER='aimroutine_google_delete_reeauth_v1';
export const REAUTH_WINDOW_MS=5*60*1000;
export function hasGoogleIdentity(user){
 if(!user)return false;
 return Boolean(user.identities?.some(x=>x?.provider==='google')||
    user.app_metadata?.provider==='google'||
    user.app_metadata?.providers?.includes('google'));
}
export function isGoogleDeleteVerified(user,marker,now=Date.now()){
 if(!hasGoogleIdentity(user)||!marker||typeof marker!=='object'||marker.uid!==user.id)return false;
 const started=Number(marker.startedAt);
 if(!Number.isFinite(started)||started<=0||now-started<0||now-started>REAUTH_WINDOW_MS)return false;
 const lastSignIn=Date.parse(user.last_sign_in_at||'');
 if(!Number.isFinite(lastSignIn)||now-lastSignIn< -60_000||now-lastSignIn>REAUTH_WINDOW_MS)return false;
 // Supabase must have registered a fresh sign-in after user initiated reauth.
 return lastSignIn>=started-15_000;
}
export function readGoogleDeleteMarker(store){
 try{const raw=store?.getItem(GOOGLE_DELETE_MARKER);const obj=JSON.parse(raw||'null');
  if(!obj||typeof obj.uid!=='string'||!Number.isFinite(obj.startedAt))return null;
  return {uid:obj.uid,startedAt:obj.startedAt};
 }catch{return null}
}
