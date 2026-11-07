/* Supabase Auth session scopes. Credentials never leave Supabase Auth. */
export const SCOPE_ALL='global';
export const SCOPE_OTHER_DEVICES='others';
export async function signOutSessions(auth,scope){
 if(scope!==SCOPE_ALL&&scope!==SCOPE_OTHER_DEVICES)throw Error('Portée de déconnexion invalide.');
 if(!auth||typeof auth.signOut!=='function')throw Error('Service de connexion indisponible.');
 const {error}=await auth.signOut({scope});
 if(error)throw error;
 return true;
}
