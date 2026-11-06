/* Display-only provider detection. Account ownership is verified by Supabase Auth. */
export function hasGoogleIdentity(user){
 if(!user)return false;
 return Boolean(user.identities?.some(identity=>identity?.provider==='google')||
   user.app_metadata?.provider==='google'||
   user.app_metadata?.providers?.includes('google'));
}
