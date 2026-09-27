#!/usr/bin/env python3
"""Prepara el despliegue de una función edge: copia _shared/equipo.ts al lado
del index.ts si lo importa, comprueba tipos con deno y escribe el JSON de
archivos que espera la API de despliegue en /tmp/deploy-<fn>.json.

Uso: python3 supabase/deploy-payload.py <slug> [<slug> ...]
"""
import json, pathlib, shutil, subprocess, sys

RAIZ = pathlib.Path(__file__).resolve().parent / "functions"
DENO = pathlib.Path.home() / ".deno/bin/deno"

for slug in sys.argv[1:]:
    d = RAIZ / slug
    src = (d / "index.ts").read_text()
    files = [{"name": "index.ts", "content": src}]
    if './equipo.ts' in src:
        shutil.copy(RAIZ / "_shared/equipo.ts", d / "equipo.ts")
        files.append({"name": "equipo.ts", "content": (d / "equipo.ts").read_text()})
    if DENO.exists():
        r = subprocess.run([str(DENO), "check", "--no-lock", "-q", str(d / "index.ts")], capture_output=True, text=True)
        estado = "ok" if r.returncode == 0 else "ERROR\n" + (r.stderr or r.stdout)[-1500:]
    else:
        estado = "sin deno"
    out = pathlib.Path(f"/tmp/deploy-{slug}.json")
    out.write_text(json.dumps(files, ensure_ascii=False))
    print(f"{slug}: {len(files)} archivos, {len(src)} bytes, deno check: {estado}")
