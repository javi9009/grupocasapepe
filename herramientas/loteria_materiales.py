# Los cuatro niveles de la lotería, cada uno como un material distinto.
# Las referencias las dio Javi: las Pokémon doradas de metal, las fichas de
# tarot pirograbadas, una tabla huichola de chaquira y un cartel de día de
# muertos. El collage de la carta es el mismo en los cuatro: lo que cambia
# es de qué está hecha la carta.
#
#   madera   -> tabla de abedul con el dibujo quemado a láser
#   chaquira -> tabla huichola, cuenta por cuenta, con cenefa
#   oro      -> placa de metal repujada, canto biselado
#   catrin   -> cartel de altar, colores planos, papel picado y cempasúchil

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def _redondo(W, H, r):
    """Máscara de esquinas redondeadas: las cuatro son fichas, no hojas."""
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, W-1, H-1], radius=r, fill=255)
    return np.asarray(m, np.float32)/255.0


def _canto(o, W, H, oscuro, suave=0.010, sombra=0.72):
    """Redondea y oscurece el canto de la ficha."""
    rad = int(min(W, H)*0.055)
    msk = _redondo(W, H, rad)
    c = np.asarray(Image.fromarray((msk*255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(min(W, H)*suave)), np.float32)/255.0
    o = o*(sombra + (1-sombra)*c)[..., None]
    return o*msk[..., None] + np.array(oscuro, np.float32)*(1-msk)[..., None]


def _rampa(n, paradas):
    ts = np.array([p[0] for p in paradas], np.float32)
    cs = np.array([p[1] for p in paradas], np.float32)
    return np.stack([np.interp(n, ts, cs[:, c]) for c in range(3)], -1)


def _marco(im):
    """El rectángulo negro impreso de la carta, sin el margen de papel."""
    a = np.asarray(im.convert('RGB')); H, W, _ = a.shape
    osc = (a.max(axis=2) < 90)
    ys = np.where(osc.sum(axis=1) > W*0.5)[0]
    xs = np.where(osc.sum(axis=0) > H*0.5)[0]
    if len(ys) < 2 or len(xs) < 2:
        return (0, 0, W, H)
    return (int(xs[0]), int(ys[0]), int(xs[-1])+1, int(ys[-1])+1)


# Madera tipo ficha de tarot: tabla de abedul clara con el dibujo quemado
# a láser. Líneas cafés finas, sin color, esquinas redondeadas y canto tostado.


def _tabla(H, W, semilla=9):
    r = np.random.default_rng(semilla)
    n = r.normal(0, 1, (max(2, H//4), max(2, W//60)))
    n = np.asarray(Image.fromarray(((n-n.min())/np.ptp(n)*255).astype(np.uint8))
                   .resize((W, H), Image.BICUBIC), np.float32)/255.0
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    veta = 0.5 + 0.5*np.sin(xx*0.05 + n*9.0 + yy*0.002)
    t = np.clip(0.80 + 0.14*veta + 0.06*n + r.normal(0, 0.012, (H, W)), 0, 1)
    # abedul: crema cálido, muy claro
    return np.stack([t*236, t*214*1.02, t*176], -1).clip(0, 255)


def madera(im):
    W, H = im.size
    a = np.array(im.convert('RGB'))[:, :, ::-1]
    g = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    suave = cv2.bilateralFilter(g, 9, 70, 70)

    # el trazo: contornos, como el paso del láser
    e1 = cv2.Canny(suave, 40, 110)
    e2 = cv2.Canny(cv2.GaussianBlur(suave, (0, 0), 2.2), 25, 70)
    trazo = np.maximum(e1, e2).astype(np.float32)/255.0
    k = max(1, int(min(W, H)*0.0022))
    trazo = cv2.dilate(trazo, np.ones((k*2+1, k*2+1), np.uint8))
    trazo = cv2.GaussianBlur(trazo, (0, 0), 0.7)

    # un tono suave para que las manchas grandes se lean, sin llenar de negro
    tono = np.clip((160 - suave.astype(np.float32))/160.0, 0, 1)**1.7 * 0.30

    quema = np.clip(trazo*0.92 + tono, 0, 1)

    tabla = _tabla(H, W)
    # el quemado no es negro plano: es café que varía con la profundidad
    cafe = np.stack([np.full((H, W), 92.0), np.full((H, W), 56.0), np.full((H, W), 26.0)], -1)
    out = tabla*(1-quema[..., None]) + cafe*quema[..., None]

    # canto tostado y esquinas redondeadas
    rad = int(min(W, H)*0.055)
    msk = _redondo(W, H, rad)
    canto = np.asarray(Image.fromarray((msk*255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(min(W, H)*0.010)), np.float32)/255.0
    out = out*(0.72 + 0.28*canto)[..., None]
    out = out*msk[..., None] + (30, 24, 18)*(1-msk)[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# Chaquira huichola: la carta entera sembrada de cuentas, cada una con su
# agujero, en paleta cerrada y saturada, con cenefa de bandas alrededor.

# paleta corta y brillante, como la cera de una tabla huichola
PAL = np.array([
    (250, 250, 248), (24, 22, 28), (206, 26, 34), (238, 108, 22),
    (248, 196, 30), (146, 196, 44), (30, 146, 72), (28, 178, 176),
    (58, 130, 216), (26, 44, 150), (118, 52, 158), (224, 34, 140),
    (246, 148, 178), (124, 74, 42), (170, 170, 178),
], np.float32)

CENEFA = [(250, 250, 248), (206, 26, 34), (248, 196, 30), (30, 146, 72), (26, 44, 150)]


def _snap(c):
    d = ((c[:, :, None, :] - PAL[None, None, :, :])**2).sum(-1)
    return PAL[d.argmin(-1)]


def chaquira(im, paso=11):
    W, H = im.size
    x0, y0, x1, y1 = _marco(im)

    # el margen de papel se cambia por la cenefa de bandas
    base = Image.new('RGB', (W, H), CENEFA[-1])
    d0 = ImageDraw.Draw(base)
    ancho = max(paso, int(min(x0, y0)/max(1, len(CENEFA)))) or paso
    for k, col in enumerate(CENEFA):
        d0.rectangle([k*ancho, k*ancho, W-1-k*ancho, H-1-k*ancho], fill=col)
    base.paste(im.crop((x0, y0, x1, y1)).filter(ImageFilter.SMOOTH), (x0, y0))

    # se muestrea una cuenta por celda y se cierra a la paleta
    nx, ny = max(1, W//paso), max(1, H//paso)
    peq = np.asarray(base.resize((nx, ny), Image.BOX), np.float32)
    peq = np.clip((peq - 128)*1.45 + 122, 0, 255)
    col = _snap(peq).astype(np.uint8)

    out = Image.new('RGB', (W, H), (16, 14, 20))
    d = ImageDraw.Draw(out)
    r = paso*0.50
    for j in range(ny):
        cy = j*paso + paso/2
        off = (paso/2) if (j % 2) else 0
        for i in range(nx):
            cx = i*paso + paso/2 + off
            c = tuple(int(v) for v in col[j, i])
            aro = tuple(int(v*0.58) for v in c)
            d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=c, outline=aro,
                      width=max(1, int(paso*0.09)))
            # el agujero de la cuenta
            hr = r*0.26
            d.ellipse([cx-hr, cy-hr, cx+hr, cy+hr], fill=tuple(int(v*0.42) for v in c))
            # brillo de la cera
            br = r*0.22; bx, by = cx - r*0.34, cy - r*0.34
            d.ellipse([bx-br, by-br, bx+br, by+br],
                      fill=tuple(min(255, int(v*0.40 + 155)) for v in c))
    return out


# Oro tipo placa de metal: la carta entera es una lámina, con canto biselado,
# esquinas redondeadas y todo el dibujo repujado sobre la misma superficie.


def oro(im):
    W, H = im.size
    L = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(0.8)), np.float32)/255.0

    # altura: el dibujo, más un reborde levantado como el marco de la placa
    alto = L*0.75
    m = int(min(W, H)*0.045)
    marco = np.zeros((H, W), np.float32)
    marco[m:-m, m:-m] = 1.0
    marco = np.asarray(Image.fromarray((marco*255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(m*0.35)), np.float32)/255.0
    borde = int(min(W, H)*0.018)
    interior = np.zeros((H, W), np.float32)
    interior[m+borde:-(m+borde), m+borde:-(m+borde)] = 1.0
    interior = np.asarray(Image.fromarray((interior*255).astype(np.uint8))
                          .filter(ImageFilter.GaussianBlur(borde*0.8)), np.float32)/255.0
    cresta = np.clip(marco - interior, 0, 1)          # el cordón del marco
    alto = alto + cresta*0.55 + 0.10

    # sombreado: luz desde arriba-izquierda sobre la pendiente
    gy, gx = np.gradient(alto)
    n = np.clip(0.50 + 5.0*(gx*0.7 - gy*0.7) + 0.42*alto, 0, 1)
    n = np.clip((n - 0.5)*1.5 + 0.54, 0, 1)

    # gradiente de la lámina: arriba más clara, abajo más caliente
    yy = np.linspace(-0.12, 0.12, H)[:, None]
    n = np.clip(n - yy, 0, 1)

    out = _rampa(n, [(0.00, (54, 30, 4)), (0.24, (122, 72, 10)),
                     (0.48, (186, 132, 26)), (0.70, (228, 182, 58)),
                     (0.86, (248, 216, 112)), (1.00, (255, 246, 196))])
    esp = np.clip((n - 0.82)/0.18, 0, 1)**2.0
    out = out + esp[..., None]*np.array([64, 52, 20], np.float32)

    # cepillado fino del metal
    r = np.random.default_rng(13)
    br = r.normal(0, 1, (H, max(1, W//16)))
    br = np.asarray(Image.fromarray(((br-br.min())/np.ptp(br)*255).astype(np.uint8))
                    .resize((W, H), Image.BICUBIC), np.float32)/255.0
    out = out*(0.955 + 0.09*br)[..., None]

    # canto: el borde de la lámina se oscurece y las esquinas se redondean
    rad = int(min(W, H)*0.055)
    msk = _redondo(W, H, rad)
    canto = np.asarray(Image.fromarray((msk*255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(min(W, H)*0.012)), np.float32)/255.0
    out = out*(0.55 + 0.45*canto)[..., None]
    out = out*msk[..., None] + (14, 11, 8)*(1-msk)[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# Catrín: la carta como cartel de día de muertos. Colores planos de altar,
# papel picado arriba y cempasúchil en las esquinas.

MORADO=(58,30,78); LILA=(123,79,168); MAGENTA=(214,56,155)
CEMPA=(238,140,30); AMBAR=(245,194,66); HUESO=(250,240,220); TURQ=(63,191,196)
BANDERAS=[TURQ,MAGENTA,AMBAR,LILA,CEMPA]

def _flor(d,cx,cy,r,fuera,dentro,petalos=8):
    for k in range(petalos):
        a=2*np.pi*k/petalos
        px,py=cx+np.cos(a)*r*0.62, cy+np.sin(a)*r*0.62
        pr=r*0.52
        d.ellipse([px-pr,py-pr,px+pr,py+pr],fill=fuera)
    for k in range(petalos):
        a=2*np.pi*k/petalos+np.pi/petalos
        px,py=cx+np.cos(a)*r*0.34, cy+np.sin(a)*r*0.34
        pr=r*0.36
        d.ellipse([px-pr,py-pr,px+pr,py+pr],fill=dentro)
    d.ellipse([cx-r*0.24,cy-r*0.24,cx+r*0.24,cy+r*0.24],fill=fuera)

def _papel_picado(d,W,alto,n=6):
    ancho=W/n
    for k in range(n):
        x=k*ancho; col=BANDERAS[k%len(BANDERAS)]
        d.polygon([(x,0),(x+ancho,0),(x+ancho,alto*0.72),(x+ancho/2,alto),(x,alto*0.72)],fill=col)
        # picado: agujeros blancos
        for (fx,fy,fr) in ((0.5,0.30,0.16),(0.28,0.50,0.09),(0.72,0.50,0.09),(0.5,0.58,0.07)):
            cx,cy,r=x+ancho*fx, alto*fy, ancho*fr
            d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=HUESO)
    d.line([(0,2),(W,2)],fill=MORADO,width=max(2,int(W*0.006)))

def catrin(im):
    W,H=im.size
    L=np.asarray(im.convert('L').filter(ImageFilter.MedianFilter(5)),np.float32)/255.0
    # colores planos: seis bandas de luminancia, sin degradados
    bordes=[0,0.20,0.36,0.52,0.68,0.84,1.01]
    cols=[MORADO,LILA,MAGENTA,CEMPA,AMBAR,HUESO]
    out=np.zeros((H,W,3),np.float32)
    for i,c in enumerate(cols):
        m=(L>=bordes[i])&(L<bordes[i+1])
        out[m]=c
    cap=Image.fromarray(out.astype(np.uint8))
    d=ImageDraw.Draw(cap)
    _papel_picado(d,W,int(H*0.085))
    r=W*0.105
    _flor(d,r*0.92,H-r*1.02,r,CEMPA,AMBAR)
    _flor(d,W-r*0.92,H-r*1.02,r,AMBAR,CEMPA)
    _flor(d,r*2.05,H-r*0.62,r*0.60,AMBAR,MAGENTA)
    _flor(d,W-r*2.05,H-r*0.62,r*0.60,CEMPA,MAGENTA)
    o=np.asarray(cap,np.float32)
    rad=int(min(W,H)*0.055); msk=_redondo(W,H,rad)
    o=o*msk[...,None]+(26,18,34)*(1-msk)[...,None]
    return Image.fromarray(np.clip(o,0,255).astype(np.uint8))


NIVELES = {'madera': madera, 'chaquira': chaquira, 'oro': oro, 'catrin': catrin}
