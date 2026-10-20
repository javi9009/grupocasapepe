// pantalla.ts — la cara que ve el huésped cuando el cobro no puede seguir.
//
// Un JSON crudo en la cara de alguien que venía a pagar es una forma rápida de
// perder el cobro y la confianza. Esto es una página sobria, con los colores de
// la casa, que dice qué pasó y a dónde ir.

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ESC[c]);

export function cobroHTML(titulo: string, texto: string) {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)} · Casa Pepe</title>
<style>
  :root{--ground:#F4F1EA;--surface:#FFFFFF;--ink:#1F1B16;--muted:#6B6459;--rule:#E2DCCF;--accent:#F2682A}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--ink);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.55;
    display:flex;align-items:center;justify-content:center;min-height:100vh;
    padding:max(24px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(24px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
  .caja{background:var(--surface);border:1px solid var(--rule);border-radius:16px;padding:30px 26px;max-width:460px;width:100%;
    box-shadow:0 1px 1px rgba(31,27,22,.04),0 10px 30px -22px rgba(31,27,22,.4)}
  h1{margin:0 0 10px;font-size:1.3rem;line-height:1.25;text-wrap:balance}
  p{margin:0 0 18px;color:var(--muted)}
  a.btn{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;
    padding:12px 22px;border-radius:11px;font-size:.92rem}
  .pie{margin:18px 0 0;font-size:.8rem;color:var(--muted)}
  .pie a{color:var(--accent)}
</style></head><body>
<div class="caja">
  <h1>${esc(titulo)}</h1>
  <p>${esc(texto)}</p>
  <a class="btn" href="https://wa.me/525544700390">Escríbenos por WhatsApp</a>
  <p class="pie">Casa Pepe · <a href="mailto:recepcion.cdmx@casapepe.mx">recepcion.cdmx@casapepe.mx</a></p>
</div></body></html>`;
}
