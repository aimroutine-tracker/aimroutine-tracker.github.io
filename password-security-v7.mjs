/* AimRoutine Cloud V7 browser-only password selection screening.
 * Free Have I Been Pwned Pwned Passwords API (k-anonymity).
 * No raw password, full SHA-1 or email is ever sent to the API.
 * Advisory UX defense: Supabase Free does not enforce this server-side.
 */
export const MIN_PASSWORD_LENGTH=12;
export function checkPasswordLength(password){
 if(typeof password!=='string'||password.length<MIN_PASSWORD_LENGTH){
  return {ok:false,message:'Choisis un mot de passe de 12 caractères minimum.'};
 }
 // Prevent trivially repetitive passwords without demanding arbitrary classes.
 if(new Set(password).size<5)return {ok:false,message:'Mot de passe trop répétitif. Choisis une phrase de passe plus variée.'};
 return {ok:true,message:''};
}
export function findHashSuffix(body,suffix){
 if(typeof body!=='string'||!/^[0-9A-F]{35}$/.test(suffix))throw Error('Réponse de sécurité invalide.');
 const lines=body.split(/\r?\n/);
 for(const line of lines){
  const delim=line.indexOf(':');
  if(delim<0)continue;
  const hash=line.slice(0,delim).trim().toUpperCase();
  if(hash===suffix){
   const count=Number.parseInt(line.slice(delim+1).trim(),10);
   if(!Number.isFinite(count)||count<0)throw Error('Réponse de sécurité invalide.');
   return count;
  }
 }
 return 0;
}
export async function checkLeakedPassword(password,{request=fetch,subtle=crypto.subtle}={}){
 const policy=checkPasswordLength(password);
 if(!policy.ok)throw Error(policy.message);
 if(!subtle||typeof subtle.digest!=='function')throw Error('Vérification cryptographique indisponible.');
 const digest=new Uint8Array(await subtle.digest('SHA-1',new TextEncoder().encode(password)));
 const hash=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
 const prefix=hash.slice(0,5);
 const suffix=hash.slice(5);
 let response;
 try{
  response=await request('https://api.pwnedpasswords.com/range/'+prefix,{
   method:'GET',mode:'cors',cache:'no-store',headers:{'Add-Padding':'true'}
  });
 }catch{
  throw Error('Vérification des mots de passe indisponible. Réessaie avec une connexion Internet.');
 }
 if(!response?.ok)throw Error('Service de vérification des mots de passe temporairement indisponible.');
 const count=findHashSuffix(await response.text(),suffix);
 return {safe:count===0,exposureCount:count};
}
