# Los cuatro niveles como materiales sobre el collage de la carta.
# El oro es el que a Javi le gusta: va empujado a metal de verdad.
from PIL import Image, ImageFilter, ImageDraw, ImageOps
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


def madera(im):
    """Talla policromada: relieve marcado, veta encima, color apagado del original."""
    a = np.asarray(im.convert('RGB'), np.float32)
    L = np.asarray(im.convert('L'))
    n = _relieve(L, 3.4, 1.4)
    n = np.clip((n - 0.5)*1.3 + 0.5, 0, 1)
    r = np.random.default_rng(5)
    v = r.normal(0, 1, (L.shape[0], L.shape[1]//6 + 1))
    v = np.asarray(Image.fromarray(((v - v.min())/np.ptp(v)*255).astype(np.uint8))
                   .resize((L.shape[1], L.shape[0]), Image.BICUBIC), np.float32)/255.0
    yy = np.linspace(0, 1, L.shape[0])[:, None]
    veta = 0.78 + 0.22*(0.5 + 0.5*np.sin(v*9.0 + yy*2.4))
    base = _rampa(n*veta, [(0.00, (36, 20, 9)), (0.35, (104, 60, 26)),
                           (0.70, (176, 118, 62)), (1.00, (232, 190, 132))])
    # el color del collage se queda, pero mate y comido por la madera
    col = np.clip((a - 128)*0.55 + 128, 0, 255)
    out = base*0.70 + col*0.30
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def chaquira(im, paso=9):
    """Cada celda es una cuenta con su punto de luz, en hileras encajadas."""
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
