/* Single global logout action: Supabase Auth revokes all refresh tokens. */
export async function signOutEverywhere(auth){
 if(!auth||typeof auth.signOut!=='function')throw Error('Service de connexion indisponible.');
 const {error}=await auth.signOut({scope:'global'});
 if(error)throw error;
 return true;
}
// Use the Auth server's verified identity, never an optimistic cached session,
// before any destructive action. Missing/malformed Auth responses fail closed.
export function verifiedAuthUser(response,expectedUid){
 const user=response?.data?.user;
 return !response?.error&&user?.id===expectedUid?user:null;
}
