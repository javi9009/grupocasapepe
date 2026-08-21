import { sb } from "./supabase.js";
export async function getSesion(){ const { data } = await sb.auth.getSession(); return data.session; }
export async function requiereAuth(redirect="/v2/"){ const s = await getSesion(); if(!s) location.href = redirect; return s; }
export async function salir(){ await sb.auth.signOut(); location.href = "/v2/"; }
