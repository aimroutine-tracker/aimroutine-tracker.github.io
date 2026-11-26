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
    let operation;
    if (action === 'profile') {
      operation = client.rpc('aim_windows_player_profile', {
        device_digest:args.digest, expected_revision:args.revision, replacement:args.profile,
      });
    } else if (action === 'save-profile') {
      operation = client.rpc('aim_web_player_profile', {
        verified_owner:args.uid, expected_revision:args.revision, replacement:args.profile,
      });
    } else {
      operation = client.rpc('aim_windows_operation', {operation:action, args});
    }
    const {data, error} = await operation;
    if (error || !data) throw new Error('Windows database operation failed');
    return data;
  }
};

Deno.serve(request => handleWindows(request,backend));
