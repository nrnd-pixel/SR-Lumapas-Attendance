import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/+esm';

export function createAttendanceClient(){
  return createClient(
    'https://rojetehazryfpcxlwtbi.supabase.co',
    'sb_publishable_gc1-vVGBZOSgw32SCJumyw__vm0e3Jd',
    {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
  );
}
