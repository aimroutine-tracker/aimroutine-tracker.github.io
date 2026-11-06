/* Public project URL + publishable key ONLY. This file contains no server secrets. */
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.119.0?bundle';
export const PROJECT_URL='https://lmzswtzboobpokumxzhy.supabase.co';
export const PUBLISHABLE_KEY='sb_publishable_MOgYz3C7nIZS1cCWt8Bk7A_prARv0fa';
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase=createClient(PROJECT_URL,PUBLISHABLE_KEY,{
  auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'implicit'},
  global:{headers:{'X-Client-Info':'aimroutine-web-v7'}}
});
