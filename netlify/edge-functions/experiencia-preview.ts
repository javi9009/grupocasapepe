/* LA TARJETA DE WHATSAPP DE UNA EXPERIENCIA.
   Javi, 6-nov-2026, enseñando la previa de la liga que le pasó a Dina:
   «¿puedes hacer que al compartir el link de Dina diga "reserva con Tekpan tu
   próxima experiencia" y en este caso Teotihuacán compartido? Pon la foto del
   tour y en cada experiencia el nombre de la que le toca».

   El problema es el de siempre: quien lee la liga pegada en WhatsApp es un
   robot que no ejecuta JavaScript. `exp.html` pone el nombre del tour en el
   título con JS —línea 1148—, pero eso pasa en el navegador del huésped,
   demasiado tarde. El robot se lleva el HTML tal cual, que dice «Sincrético ·
   la experiencia» para las 43 fichas por igual, sin foto.

   Así que se reescribe la cabecera antes de que el HTML salga del servidor:
   título, descripción y Open Graph, con el nombre de ESA experiencia, la frase
   que pidió Javi con el nombre de SU touroperadora, y la foto horizontal.

   El nombre de la touroperadora sale de la propia ficha -`v_exp_publica.
   operador`-, no del código del enlace: el padrón de touroperadoras no es
   público y aquí no hay sesión de nadie. Da lo mismo, porque la ficha sólo
   tiene una touroperadora y es la misma que comparte su canal. Si no tiene
   -los tours de la casa-, firma Sincrético.

   Reglas de la casa:
   - Sin un `id` que parezca un uuid no hace nada.
   - Si algo falla -la base no contesta, la ficha no existe, no es HTML-
     devuelve la página original. Nunca un error: antes la tarjeta sosa que una
     ficha caída.
   - Convive con `marca-preview.ts`, que atiende otra cosa (`?h=`). */

const SB  = 'https://rehophywchakfapivsbh.supabase.co';
const KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

type Ficha = { nombre?: string; resumen?: string; operador?: string; foto?: string };

/* Una ficha cambia poco y la tarjeta la piden varios robots seguidos cada vez
   que alguien pega la liga en un grupo. Diez minutos ahorran esa ráfaga sin
   que un cambio de nombre tarde en verse. */
const CACHE = new Map<string, { t: number; f: Ficha | null }>();
const VIDA = 10 * 60 * 1000;

async function ficha(id: string): Promise<Ficha | null> {
  const y = CACHE.get(id);
  if (y && Date.now() - y.t < VIDA) return y.f;
  try {
    const h = { apikey: KEY, Authorization: 'Bearer ' + KEY };
    const [a, b] = await Promise.all([
      fetch(SB + '/rest/v1/v_exp_publica?select=nombre,resumen,operador&id=eq.' + id + '&limit=1', { headers: h }),
      fetch(SB + '/rest/v1/v_exp_media_publica?select=url_h,url,orden&experiencia_id=eq.' + id + '&order=orden&limit=1', { headers: h }),
    ]);
    const e = a.ok ? (await a.json())[0] : null;
    if (!e || !e.nombre) { CACHE.set(id, { t: Date.now(), f: null }); return null; }
    const m = b.ok ? (await b.json())[0] : null;
    const f: Ficha = {
      nombre: e.nombre, resumen: e.resumen, operador: e.operador,
      foto: (m && (m.url_h || m.url)) || '',
    };
    CACHE.set(id, { t: Date.now(), f });
    return f;
  } catch (_) {
    return null;
  }
}

function atrib(s: string): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Dos renglones es lo que enseña WhatsApp. El resumen de algunas fichas son
   seis; se corta por la última palabra entera y con puntos suspensivos, que
   una frase partida a mitad de palabra parece un error. */
function recorta(s: string, n: number): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const c = t.slice(0, n);
  return c.slice(0, Math.max(c.lastIndexOf(' '), 40)).replace(/[,;:.\s]+$/, '') + '…';
}

export default async (request: Request, context: any) => {
  try {
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').trim();
    const res = await context.next();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res;

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return res;

    const f = await ficha(id);
    if (!f || !f.nombre) return res;

    const quien = (f.operador || '').trim() || 'Sincrético';
    const titulo = f.nombre;
    const desc = 'Reserva con ' + quien + ' tu próxima experiencia. ' + recorta(f.resumen || '', 110);

    let html = await res.text();

    html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + atrib(titulo) + ' · Sincrético</title>');
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      '<meta name="description" content="' + atrib(desc) + '">');

    const og = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Sincrético">',
      '<meta property="og:locale" content="es_MX">',
      '<meta property="og:title" content="' + atrib(titulo) + '">',
      '<meta property="og:description" content="' + atrib(desc) + '">',
      '<meta property="og:url" content="' + atrib(url.toString()) + '">',
      f.foto ? '<meta property="og:image" content="' + atrib(f.foto) + '">' : '',
      f.foto ? '<meta property="og:image:alt" content="' + atrib(titulo) + '">' : '',
      '<meta name="twitter:card" content="' + (f.foto ? 'summary_large_image' : 'summary') + '">',
      '<meta name="twitter:title" content="' + atrib(titulo) + '">',
      '<meta name="twitter:description" content="' + atrib(desc) + '">',
      f.foto ? '<meta name="twitter:image" content="' + atrib(f.foto) + '">' : '',
    ].filter(Boolean).join('\n');

    html = html.replace(/<\/head>/i, og + '\n</head>');

    const h = new Headers(res.headers);
    h.delete('content-length');
    return new Response(html, { status: res.status, headers: h });
  } catch (_) {
    try { return await context.next(); } catch (__) { return new Response(null, { status: 500 }); }
  }
};

export const config = { path: ['/sinc/exp.html'] };
