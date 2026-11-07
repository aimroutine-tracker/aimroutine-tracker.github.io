/* Single global logout action: Supabase Auth revokes all refresh tokens. */
export async function signOutEverywhere(auth){
 if(!auth||typeof auth.signOut!=='function')throw Error('Service de connexion indisponible.');
 const {error}=await auth.signOut({scope:'global'});
 if(error)throw error;
 return true;
}
