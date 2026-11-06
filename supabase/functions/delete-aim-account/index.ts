// AimRoutine Cloud V7 — server-side deletion, verified user JWT only.
import { withSupabase } from "npm:@supabase/server@1.9.2";
const json=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export default {
 fetch:withSupabase({auth:"user"},async(request,ctx)=>{
  if(request.method!=="POST")return json({error:"method_not_allowed"},405);
  let payload:unknown;
  try{payload=await request.json()}catch{return json({error:"invalid_json"},400)}
  if(!payload||typeof payload!=="object"||
      (payload as Record<string,unknown>).action!=="delete_my_account"||
      (payload as Record<string,unknown>).confirmation!=="SUPPRIMER"){
    return json({error:"confirmation_required"},400);
  }
  const header=request.headers.get("authorization")||"";
  const accessToken=header.replace(/^Bearer\s+/i,"").trim();
  if(!accessToken||accessToken===header)return json({error:"authentication_required"},401);
  const {data,error:verifyError}=await ctx.supabase.auth.getUser(accessToken);
  if(verifyError||!data?.user||data.user.id!==ctx.userClaims?.id)return json({error:"authentication_required"},401);
  // A Google-linked account can be erased after a signed-in owner types SUPPRIMER.
  // This is deliberately less strict than step-up OAuth; the user requested no
  // second Google login. The owner ID is NEVER taken from the request body.
  // Password-only accounts still require a fresh password sign-in.
  const googleIdentity=Array.isArray(data.user.identities)&&
    data.user.identities.some(identity=>identity?.provider==="google");
  if(!googleIdentity){
    const age=Date.now()-Date.parse(data.user.last_sign_in_at||"");
    if(!Number.isFinite(age)||age< -60_000||age>300_000){
      return json({error:"recent_reauthentication_required"},403);
    }
  }
  const {error:deleted}=await ctx.supabaseAdmin.auth.admin.deleteUser(data.user.id);
  if(deleted){console.error("Account deletion refused by Supabase Auth");return json({error:"account_deletion_failed"},500)}
  return json({deleted:true});
 })
};
