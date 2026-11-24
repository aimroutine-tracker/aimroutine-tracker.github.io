import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { handleWindows } from './handler.mjs';

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) throw new Error('Missing Supabase server configuration');

const client = createClient(url, key, {
  auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false},
});
const backend = {
  async verify(token: string) {
    const {data, error} = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return {id:data.user.id, label:data.user.email || 'Compte AimRoutine'};
  },
  async call(action: string, args: Record<string, unknown>) {
    const {data, error} = await client.rpc('aim_windows_operation', {
      operation:action, args,
    });
    if (error || !data) throw new Error('Windows database operation failed');
    return data;
  }
};

Deno.serve(request => handleWindows(request,backend));
