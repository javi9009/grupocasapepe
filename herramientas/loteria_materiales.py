# Los cuatro niveles como materiales sobre el collage de la carta.
# El oro es el que a Javi le gusta: va empujado a metal de verdad.
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance
import numpy as np


def _marco(im):
    a = np.asarray(im.convert('RGB')); H, W, _ = a.shape
    osc = (a.max(axis=2) < 90)
    ys = np.where(osc.sum(axis=1) > W*0.5)[0]; xs = np.where(osc.sum(axis=0) > H*0.5)[0]
    if len(ys) < 2 or len(xs) < 2: return (0, 0, W, H)
    return (int(xs[0]), int(ys[0]), int(xs[-1])+1, int(ys[-1])+1)


def _relieve(L, fuerza, suave=1.0):
    """La luz pega desde arriba-izquierda sobre la pendiente de la luminancia."""
    L = np.asarray(Image.fromarray(L).filter(ImageFilter.GaussianBlur(suave)), np.float32)/255.0
    gy, gx = np.gradient(L)
    return np.clip(0.5 + fuerza*(gx*0.7 - gy*0.7) + 0.4*L, 0, 1)


def _rampa(n, paradas):
    """paradas: [(t, (r,g,b)), ...] con t de 0 a 1."""
    ts = np.array([p[0] for p in paradas], np.float32)
    cs = np.array([p[1] for p in paradas], np.float32)
    out = np.empty(n.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(n, ts, cs[:, c])
    return out


def oro(im):
    """Repujado en oro. Sombra profunda, brillo especular y bruñido."""
    L = np.asarray(im.convert('L'))
    n = _relieve(L, 4.2, 1.2)
    n = np.clip((n - 0.5)*1.45 + 0.52, 0, 1)          # más contraste de metal
    out = _rampa(n, [(0.00, (48, 26, 2)), (0.28, (126, 74, 8)),
                     (0.55, (198, 142, 28)), (0.78, (240, 196, 72)),
                     (0.92, (255, 232, 140)), (1.00, (255, 250, 214))])
    # reflejo especular: sólo donde el relieve sube de verdad
    esp = np.clip((n - 0.80)/0.20, 0, 1)**2.2
    out = out + esp[..., None]*np.array([70, 58, 26], np.float32)
    # bruñido: rayitas finas de taller, no ruido de foto
    r = np.random.default_rng(11)
    br = r.normal(0, 1, (L.shape[0], L.shape[1]//14 + 1))
    br = np.asarray(Image.fromarray(((br - br.min())/np.ptp(br)*255).astype(np.uint8))
                    .resize((L.shape[1], L.shape[0]), Image.BICUBIC), np.float32)/255.0
    out = out*(0.955 + 0.09*br)[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def _tabla(H, W, semilla=4):
    """Una tabla de madera: veta larga, anillos y un par de nudos."""
    r = np.random.default_rng(semilla)
    # ruido estirado en vertical -> la veta corre a lo largo
    n = r.normal(0, 1, (H//3 + 1, W//40 + 1))
    n = np.asarray(Image.fromarray(((n-n.min())/np.ptp(n)*255).astype(np.uint8))
                   .resize((W, H), Image.BICUBIC), np.float32)/255.0
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # anillos de crecimiento: líneas que ondulan siguiendo el ruido
    anillos = 0.5 + 0.5*np.sin(xx*0.16 + n*22.0 + yy*0.004)
    anillos = anillos**2.2                       # vetas finas y marcadas
    # un nudo, chico y pegado al canto, que es donde salen
    cx, cy, rr = W*0.90, H*0.26, W*0.055
    d = np.sqrt(((xx-cx)/rr)**2 + ((yy-cy)/(rr*1.6))**2)
    nudo = 0.5 + 0.5*np.sin(d*7.0 + n*2.0)
    peso = np.clip(1.0 - d/2.6, 0, 1)**1.5
    anillos = anillos*(1-peso) + nudo*peso
    fibra = r.normal(0, 0.035, (H, W))
    t = np.clip(0.30 + 0.62*anillos + 0.18*n + fibra, 0, 1)
    return t

def madera(im, fuerza=0.80):
    a = np.asarray(im.convert('RGB'), np.float32)
    H, W, _ = a.shape
    t = _tabla(H, W)
    # la tabla, en color
    tab = np.stack([np.interp(t, [0, .35, .7, 1], [58, 122, 178, 221]),
                    np.interp(t, [0, .35, .7, 1], [32,  76, 124, 174]),
                    np.interp(t, [0, .35, .7, 1], [14,  38,  70, 116])], -1)
    # la tinta: el arte, apagado y un poco más oscuro, como serigrafía
    tinta = np.asarray(ImageEnhance.Color(im.convert('RGB')).enhance(0.62), np.float32)
    tinta = np.clip((tinta - 128)*0.92 + 118, 0, 255)
    # overlay de la tabla sobre la tinta: la veta atraviesa la imagen
    b = tab/255.0; s = tinta/255.0
    ov = np.where(s < 0.5, 2*s*b, 1 - 2*(1-s)*(1-b))
    out = (s*(1-fuerza) + ov*fuerza)*255.0
    # la madera manda en las zonas claras: ahí casi no hay tinta
    luz = np.clip((tinta.mean(-1, keepdims=True) - 150)/105.0, 0, 1)
    out = out*(1-luz*0.55) + tab*(luz*0.55)
    # bisel: el canto de la tabla
    m = max(3, W//110)
    borde = np.ones((H, W, 1), np.float32)
    borde[:m, :] *= 1.22; borde[:, :m] *= 1.18
    borde[-m:, :] *= 0.74; borde[:, -m:] *= 0.80
    out = out*borde
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def chaquira(im, paso=9):
    """Tabla huichola: la carta entera cuenta a cuenta, sobre fondo de cera.
    El margen de papel desaparece: una tabla no tiene margen blanco."""
    x0, y0, x1, y1 = _marco(im)
    fondo = Image.new('RGB', im.size, (18, 24, 86))     # azul de tabla huichola
    fondo.paste(im.crop((x0, y0, x1, y1)), (x0, y0))
    im = fondo
    W, H = im.size
    peq = im.convert('RGB').resize((max(1, W//paso), max(1, H//paso)), Image.BOX)
    col = np.asarray(peq, np.float32)
    col = np.clip((col - 128)*1.40 + 124, 0, 255)
    col = (np.round(col/26.0)*26.0).clip(0, 255).astype(np.uint8)   # sin degradados
    out = Image.new('RGB', (W, H), (12, 10, 18))
    d = ImageDraw.Draw(out)
    r = paso*0.47
    for j in range(col.shape[0]):
        cy = j*paso + paso/2
        off = (paso/2) if (j % 2) else 0
        for i in range(col.shape[1]):
            cx = i*paso + paso/2 + off
            c = tuple(int(x) for x in col[j, i])
            d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=c)
            rr = r*0.32
            lx, ly = cx - r*0.30, cy - r*0.30
            luz = tuple(min(255, int(x*0.42 + 148)) for x in c)
            d.ellipse([lx-rr, ly-rr, lx+rr, ly+rr], fill=luz)
    return out


def catrin(im):
    """Día de muertos: grabado de hueso sobre cempasúchil, como estampa de Posada."""
    L = np.asarray(im.convert('L').filter(ImageFilter.SMOOTH), np.float32)
    # contornos, que es lo que hace que parezca grabado
    bordes = np.asarray(im.convert('L').filter(ImageFilter.FIND_EDGES), np.float32)
    bordes = np.clip(bordes*2.2, 0, 255)
    t = np.clip((L - 40)/165.0, 0, 1)
    out = _rampa(t, [(0.00, (26, 14, 34)),    # morado de altar
                     (0.30, (122, 34, 62)),
                     (0.55, (226, 104, 28)),  # cempasúchil
                     (0.80, (246, 190, 96)),
                     (1.00, (250, 240, 216))])  # hueso
    out = out - bordes[..., None]*0.72          # la línea negra del grabado
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


NIVELES = {'madera': madera, 'chaquira': chaquira, 'oro': oro, 'catrin': catrin}
