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

/* LA FIRMA DE LA TARJETA. Javi, 6-nov-2026: «en la página quita cualquier cosa
   de Casa Pepe y ahí sí pon la identidad de marca de Tekpan Tours... o la
   empresa que sea». Si la liga que se comparte es la del canal propio de una
   touroperadora, la tarjeta tampoco debe firmar Sincrético.
   Sólo con un código de canal válido: el mismo `?c=` lleva también el QR del
   concierge de un hotel, y ahí no toca. Quien decide es la base. */
const MARCAS = new Map<string, { t: number; n: string | null }>();

async function marcaCanal(cod: string): Promise<string | null> {
  const y = MARCAS.get(cod);
  if (y && Date.now() - y.t < VIDA) return y.n;
  try {
    const r = await fetch(SB + '/rest/v1/rpc/sinc_canal_marca', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_codigo: cod }),
    });
    const j = r.ok ? await r.json() : null;
    const n = (j && j[0] && j[0].nombre) ? String(j[0].nombre) : null;
    MARCAS.set(cod, { t: Date.now(), n });
    return n;
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

    /* Si la liga viene del canal propio, firma la touroperadora de ese canal;
       si no, la de la ficha; y si la ficha es de la casa, Sincrético. */
    const cod = (url.searchParams.get('c') || '').trim();
    const deCanal = cod ? await marcaCanal(cod) : null;
    const quien = (deCanal || f.operador || '').trim() || 'Sincrético';
    const titulo = f.nombre;
    /* Algunas fichas tienen de resumen su propio nombre -«Taller de Piñatas»-,
       y repetirlo detrás del título deja una tarjeta que se tartamudea. */
    const res0 = String(f.resumen || '').trim();
    const extra = (res0 && res0.toLowerCase() !== titulo.trim().toLowerCase()) ? ' ' + recorta(res0, 110) : '';
    const desc = 'Reserva con ' + quien + ' tu próxima experiencia.' + extra;

    let html = await res.text();

    html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + atrib(titulo) + ' · Sincrético</title>');
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      '<meta name="description" content="' + atrib(desc) + '">');

    const og = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="' + atrib(deCanal || 'Sincrético') + '">',
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
