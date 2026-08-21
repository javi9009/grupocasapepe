import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPA_URL, SUPA_ANON } from "./config.js";
export const sb = createClient(SUPA_URL, SUPA_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
