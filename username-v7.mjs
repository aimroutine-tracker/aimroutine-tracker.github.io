/* Display nickname, stored in Supabase Auth user metadata. NOT for authorization. */
export const USERNAME_PATTERN=/^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/;
export const normalizeUsername=value=>typeof value==='string'?value.trim():'';
export function validateUsername(value){
 const username=normalizeUsername(value);
 if(!USERNAME_PATTERN.test(username))throw Error('Pseudo obligatoire : 3 à 24 caractères, lettres, chiffres, _ ou -, sans espace.');
 return username;
}
export function usernameFromUser(user){
 const username=normalizeUsername(user?.user_metadata?.aim_username);
 return USERNAME_PATTERN.test(username)?username:null;
}
export async function saveUsername(auth,uid,value){
 const username=validateUsername(value);
 if(!auth||typeof auth.getUser!=='function'||typeof auth.updateUser!=='function')throw Error('Service de connexion indisponible.');
 const first=await auth.getUser();
 if(first.error||!first.data?.user||first.data.user.id!==uid)throw Error('Session non validée. Reconnecte-toi.');
 if(usernameFromUser(first.data.user))return first.data.user; // Already chosen on another device.
 const response=await auth.updateUser({data:{aim_username:username}});
 if(response.error)throw response.error;
 if(response.data?.user?.id!==uid)throw Error('Pseudo non confirmé.');
 const check=await auth.getUser();
 if(check.error||check.data?.user?.id!==uid||usernameFromUser(check.data.user)!==username){
  throw Error('Pseudo non confirmé par Supabase. Réessaie.');
 }
 return check.data.user;
}
