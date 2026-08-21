import { sb } from "./supabase.js";
const ORDEN = { none:0, ver:1, editar:2, admin:3 };
export async function miNivel(pagina){
  const { data, error } = await sb.rpc("mi_nivel", { p_pagina_codigo: pagina });
  return error ? "none" : (data || "none");
}
export async function puede(pagina, minimo="ver"){ return ORDEN[await miNivel(pagina)] >= ORDEN[minimo]; }
export async function guard(pagina, minimo="ver"){
  if(!(await puede(pagina, minimo))){
    document.body.innerHTML = '<p style="font-family:sans-serif;padding:40px;color:#333">Sin permisos para esta seccion.</p>';
    throw new Error("acceso denegado: "+pagina);
  }
}
