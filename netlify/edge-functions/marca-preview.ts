/* LA MARCA, TAMBIÉN EN LA PREVIA DE WHATSAPP.
   `apepe/marca.js` traduce la app en el navegador del huésped, y eso basta
   para quien la abre. Pero cuando alguien PEGA la liga en WhatsApp, Telegram,
   Slack o iMessage, quien la lee es un robot que no ejecuta JavaScript: se
   descarga el HTML tal cual y enseña lo que diga el <title> y la <meta
   description>. Por eso la tarjeta salía «APePe · Hola, Pepe Huésped — Tu app
   de huésped de Casa Pepe» aunque la liga fuera de Barrio.

   Esto se arregla antes de que el HTML salga del servidor. Si la liga trae
   `?h=<slug>`, esta función intercepta la respuesta, se trae la marca de ese
   hotel y reescribe la cabecera: título, descripción y las etiquetas Open
   Graph que leen todos los mensajeros (que no existían, y por eso la foto de
   la tarjeta era el oso de Casa Pepe).

   Reglas de la casa:
   - Sin `?h=` no hace absolutamente nada: la app de Casa Pepe no se toca.
   - Si algo falla —la base no contesta, la marca no existe, el HTML no es
     HTML— devuelve la página original. Nunca un error: antes la marca vieja
     que una app caída.
   - Las sustituciones son LAS MISMAS que las de `apepe/marca.js`. Si allí se
     añade una pieza, aquí también. Son dos sitios a propósito: uno traduce lo
     que ve la persona, el otro lo que ve el robot.
   Javi, 1-oct-2026. */

const SB  = 'https://rehophywchakfapivsbh.supabase.co';
const KEY = 'sb_publishable_BUSblqsDsVEokJr6yK8GIg_N34bGVWO';

type Marca = {
  hotel_id?: string; slug?: string; hotel?: string; ciudad?: string; grupo?: boolean;
  app?: string; soy?: string; go?: string; quiz?: string; corto?: string;
  conserje?: string; rest?: string; logo?: string; logo_blanco?: string;
};

/* La marca de un hotel cambia muy de vez en cuando; preguntarla en cada
   visita sería una llamada a la base por cada carga de la app. Media hora de
   memoria es suficiente para no notarlo y para que un cambio de nombre se vea
   el mismo día. */
const CACHE = new Map<string, { t: number; m: Marca | null }>();
const VIDA = 30 * 60 * 1000;

async function marca(slug: string): Promise<Marca | null> {
  const y = CACHE.get(slug);
  if (y && Date.now() - y.t < VIDA) return y.m;
  try {
    const r = await fetch(SB + '/rest/v1/rpc/apepe_marca', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug, p_resv: null }),
    });
    const j = r.ok ? await r.json() : null;
    // Un hotel del grupo no es una marca blanca: su app no se traduce a sí
    // misma. La RPC ya lo corta devolviendo hotel_id nulo; esto es el cinturón.
    const m = (j && j.hotel_id && !j.grupo) ? j as Marca : null;
    CACHE.set(slug, { t: Date.now(), m });
    return m;
  } catch (_) {
    return null;
  }
}

/* El mismo traductor que apepe/marca.js, recortado a lo que cabe en una
   cabecera. «Grupo Casa Pepe» se aparta y se devuelve: un hotel ajeno no es
   una empresa del Grupo. Y «Cósmica» pide C mayúscula para no tocar «La raza
   cósmica», que es el libro de Vasconcelos. */
// Cada sustitucion deja un hueco numerado y se devuelve al final: asi ninguna
// regla relee lo que puso otra. Sin esto, "Pepe huesped" -> "<hotel> huesped"
// y la regla de "Casa Pepe" entraba encima del resultado. Mismo arreglo que en
// apepe/marca.js, y por la misma razon.
function traduce(s: string, m: Marca): string {
  if (!s) return s;
  if (!/pepe|c[óo]smica/i.test(s)) return s;
  const c = (m.corto || (m.go ? m.go.replace(/\s*GO!?\s*$/, '') : '') || m.hotel || '').trim();
  const caja: string[] = [];
  const g = (v: string) => { caja.push(v); return '\u0000' + (caja.length - 1) + '\u0000'; };
  let t = s.replace(/Grupo\s?Casa\s?Pepe/g, () => g('Grupo Casa Pepe'));
  if (m.go)   t = t.replace(/Pepe\s?GO!?/g, () => g(m.go!));
  if (m.quiz) t = t.replace(/PepeQuiz/g, () => g(m.quiz!));
  if (m.soy)  t = t.replace(/Soy\s?Pepe\b/g, () => g(m.soy!));
  if (c) {
    t = t.replace(/Pepe(\s+)(hu[eé]sped|Hu[eé]sped|guest|Guest)/g, (_x, e, h) => g(c + e + h));
    t = t.replace(/\b(Hola|Hi|Hello)(,?\s+)Pepe\b/g, (_x, h, e) => g(h + e + c));
    t = t.replace(/\bapp de los Pepes\b/g, () => g('app de ' + c));
    t = t.replace(/\bthe Pepes app\b/g, () => g('the ' + c + ' app'));
  }
  t = t.replace(/\b([Ll])os\s+Pepes\b/g, (_x, i) => g(i + 'os anfitriones'));
  t = t.replace(/\bthe\s+Pepes\b/g, () => g('the hosts'));
  t = t.replace(/SuperPepe/g, () => g('tu descuento'));
  if (m.app)   t = t.replace(/APePe/g, () => g(m.app!));
  if (m.hotel) t = t.replace(/Casa\s?Pepe/g, () => g(m.hotel!));
  t = t.replace(/La\s?C[óo]smica/g, () => g(m.rest || 'Restaurante'));
  if (m.conserje) t = t.replace(/Don\s?Jos[eé]/g, () => g(m.conserje!));
  return t.replace(/\u0000(\d+)\u0000/g, (_x, i) => caja[Number(i)]);
}

function atrib(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async (request: Request, context: any) => {
  let res: Response;
  try {
    const url = new URL(request.url);
    const slug = (url.searchParams.get('h') || '').trim().toLowerCase();
    res = await context.next();
    if (!slug) return res;

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return res;

    const m = await marca(slug);
    if (!m) return res;

    let html = await res.text();

    /* Título y descripción, traducidos. */
    let titulo = '';
    html = html.replace(/<title>([\s\S]*?)<\/title>/i, (_x, t) => {
      titulo = traduce(String(t).trim(), m);
      return '<title>' + titulo + '</title>';
    });
    let desc = '';
    html = html.replace(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i, (_x, d) => {
      desc = traduce(String(d), m);
      return '<meta name="description" content="' + atrib(desc) + '">';
    });
    html = html.replace(/<meta\s+name=["']apple-mobile-web-app-title["']\s+content=["']([\s\S]*?)["']\s*\/?>/i,
      (_x, d) => '<meta name="apple-mobile-web-app-title" content="' + atrib(traduce(String(d), m)) + '">');

    /* Open Graph: lo que de verdad lee el mensajero. No existía ninguna, y por
       eso la foto de la tarjeta era el icono de Casa Pepe. */
    const foto = m.logo ? url.origin + m.logo : '';
    const og = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="' + atrib(m.hotel || '') + '">',
      '<meta property="og:title" content="' + atrib(titulo || (m.app || m.hotel || '')) + '">',
      desc ? '<meta property="og:description" content="' + atrib(desc) + '">' : '',
      '<meta property="og:url" content="' + atrib(url.toString()) + '">',
      foto ? '<meta property="og:image" content="' + atrib(foto) + '">' : '',
      '<meta name="twitter:card" content="' + (foto ? 'summary' : 'summary') + '">',
      '<meta name="twitter:title" content="' + atrib(titulo || (m.app || '')) + '">',
      desc ? '<meta name="twitter:description" content="' + atrib(desc) + '">' : '',
      foto ? '<meta name="twitter:image" content="' + atrib(foto) + '">' : '',
    ].filter(Boolean).join('\n');

    html = html.replace(/<\/head>/i, og + '\n</head>');

    const h = new Headers(res.headers);
    h.delete('content-length');
    return new Response(html, { status: res.status, headers: h });
  } catch (_) {
    /* Pase lo que pase, la app sigue abriendo. */
    try { return await context.next(); } catch (__) { return new Response(null, { status: 302, headers: { location: '/apepe/' } }); }
  }
};

export const config = {
  path: ['/apepe', '/apepe/*', '/soypepe', '/soypepe/*', '/sinc', '/sinc/*'],
};
