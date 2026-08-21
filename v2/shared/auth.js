import { sb } from "./supabase.js";
export async function getSesion(){ const { data } = await sb.auth.getSession(); return data.session; }
export async function requiereAuth(redirect="/v2/login/"){ const s = await getSesion(); if(!s) location.href = redirect; return s; }
export async function vincular(){ try{ const { data } = await sb.rpc("vincular_mi_empleado"); return data; }catch(e){ return null; } }
export async function salir(){ await sb.auth.signOut(); location.href = "/v2/login/"; }
