# Carteles del ejemplo "Ateneo Producciones".
# Nada de fotos de nadie: todo se dibuja aqui, con la paleta de Sincretico.
import os, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

F = "/tmp/fuentes"
OSW7 = F + "/Oswald-wght-700.ttf"
OSW5 = F + "/Oswald-wght-500.ttf"
INT6 = F + "/Inter-wght-600.ttf"
INT4 = F + "/Inter-wght-400.ttf"

OUT = "/tmp/gcp/sinc/img/ejemplo"
os.makedirs(OUT, exist_ok=True)

NARANJA = (242, 104, 42)
NAR_OSC = (201, 80, 26)
MAGENTA = (226, 24, 142)
TINTA   = (30, 26, 22)
PAPEL   = (251, 247, 242)
VERDE   = (85, 123, 40)
AZUL    = (31, 74, 102)
ORO     = (214, 160, 54)


def f(path, size):
    return ImageFont.truetype(path, size)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def fondo(w, h, c1, c2, c3):
    """Degradado diagonal de tres tintas, como una serigrafia mal registrada."""
    base = Image.new("RGB", (w, h), c1)
    d = ImageDraw.Draw(base)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=lerp(c1, c2, t))
    # mancha de la tercera tinta, en multiply suave
    cap = Image.new("RGB", (w, h), c3)
    m = Image.new("L", (w, h), 0)
    dm = ImageDraw.Draw(m)
    dm.ellipse([-w * .35, -h * .55, w * .85, h * .75], fill=165)
    m = m.filter(ImageFilter.GaussianBlur(w * .11))
    return Image.composite(cap, base, m)


def grano(im, fuerza=11):
    w, h = im.size
    rnd = random.Random(7)
    ruido = Image.new("L", (w // 2, h // 2))
    ruido.putdata([128 + rnd.randint(-fuerza, fuerza) for _ in range(ruido.size[0] * ruido.size[1])])
    ruido = ruido.resize((w, h), Image.BILINEAR)
    return Image.blend(im, Image.merge("RGB", (ruido, ruido, ruido)), 0.09)


def puntos(d, x0, y0, x1, y1, color, paso=16, r=3.2, alpha=None):
    y = y0
    fila = 0
    while y < y1:
        x = x0 + (paso / 2 if fila % 2 else 0)
        while x < x1:
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)
            x += paso
        y += paso
        fila += 1


def corta(draw, texto, fuente, ancho):
    palabras, lineas, linea = texto.split(), [], ""
    for p in palabras:
        probar = (linea + " " + p).strip()
        if draw.textlength(probar, font=fuente) <= ancho:
            linea = probar
        else:
            if linea:
                lineas.append(linea)
            linea = p
    if linea:
        lineas.append(linea)
    return lineas


def cartel(nombre, titulo, sobre, pie, c1, c2, c3, dibujo, tinta_txt=(255, 255, 255)):
    W, H = 1200, 900
    im = grano(fondo(W, H, c1, c2, c3))
    d = ImageDraw.Draw(im, "RGBA")
    dibujo(d, W, H)

    # EL VELO VA ARRIBA, Y EL TEXTO TAMBIEN. En la tarjeta del escaparate la
    # pastilla de la hora va pegada abajo a la izquierda: si el titulo esta
    # abajo, se le monta encima y el cartel se ve roto. Con el texto arriba, el
    # tercio de abajo queda libre para la pastilla.
    velo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dv = ImageDraw.Draw(velo)
    corte = H * .62
    for y in range(0, int(corte)):
        t = 1 - (y / corte)
        dv.line([(0, y), (W, y)], fill=(18, 15, 12, int(208 * t ** 1.25)))
    im = Image.alpha_composite(im.convert("RGBA"), velo).convert("RGB")
    d = ImageDraw.Draw(im, "RGBA")

    # El bloque de texto se ancla ABAJO, dejando 150 px libres: en la tarjeta del
    # escaparate la hora va pegada abajo a la izquierda, y si el titulo llega
    # hasta el borde la pastilla se le monta encima. La sala y la hora tampoco
    # se escriben en el cartel: la tarjeta ya las pone debajo, y repetirlas se
    # ve a medio tapar.
    m = 78
    fs = f(OSW5, 32)
    d.text((m, 74), sobre.upper(), font=fs, fill=(255, 255, 255, 215))
    d.line([(m, 130), (m + 96, 130)], fill=MAGENTA, width=8)

    ft = f(OSW7, 104)
    lineas = corta(d, titulo.upper(), ft, W - m * 2)
    if len(lineas) > 2:
        ft = f(OSW7, 80)
        lineas = corta(d, titulo.upper(), ft, W - m * 2)
    y = 168
    for ln in lineas:
        d.text((m, y), ln, font=ft, fill=tinta_txt)
        y += int(ft.size * 1.02)

    d.text((m, y + 18), pie, font=f(INT6, 30), fill=(255, 255, 255, 190))
    im.save(os.path.join(OUT, nombre), "JPEG", quality=86, optimize=True)
    return os.path.join(OUT, nombre)


# ---------- los dibujos de cada cartel ----------

def dib_rock(d, W, H):
    """Ondas de sonido: barras que suben y bajan, como un ecualizador."""
    rnd = random.Random(3)
    base = H * .60
    x = 60
    while x < W - 40:
        alt = (math.sin(x / 83.0) * .5 + .5) * .42 + rnd.random() * .22
        alt *= H
        d.rounded_rectangle([x, base - alt, x + 26, base], radius=13,
                            fill=(255, 255, 255, 52))
        x += 42
    d.ellipse([W * .60, -H * .22, W * 1.12, H * .52], outline=(255, 255, 255, 70), width=10)
    puntos(d, W * .70, H * .06, W * .99, H * .30, (255, 255, 255, 60), 24, 4)


def dib_ensayo(d, W, H):
    """Renglones: una hoja escrita, con una linea tachada y vuelta a escribir."""
    y = H * .13
    rnd = random.Random(11)
    while y < H * .66:
        largo = W * (.30 + rnd.random() * .52)
        d.rounded_rectangle([W * .10, y, W * .10 + largo, y + 11], radius=6,
                            fill=(255, 255, 255, 46))
        y += 44
    d.line([(W * .10, H * .31), (W * .66, H * .31)], fill=MAGENTA + (210,), width=8)
    d.ellipse([W * .70, H * .12, W * .95, H * .37], outline=(255, 255, 255, 80), width=9)


def dib_alebrijes(d, W, H):
    """Un bestiario geometrico: formas de papel recortado, encajadas."""
    rnd = random.Random(23)
    colores = [(255, 255, 255, 58), MAGENTA + (120,), ORO + (130,), NARANJA + (120,)]
    for i in range(16):
        cx = rnd.uniform(W * .08, W * .95)
        cy = rnd.uniform(H * .06, H * .62)
        r = rnd.uniform(38, 118)
        lados = rnd.choice([3, 3, 4, 5, 6])
        giro = rnd.uniform(0, math.pi)
        pts = [(cx + r * math.cos(giro + 2 * math.pi * k / lados),
                cy + r * math.sin(giro + 2 * math.pi * k / lados)) for k in range(lados)]
        d.polygon(pts, fill=rnd.choice(colores))
    puntos(d, W * .06, H * .06, W * .97, H * .62, (255, 255, 255, 52), 34, 4.6)


def dib_teatro(d, W, H):
    """El telon y el circulo de luz del escenario."""
    for i in range(14):
        x = W * i / 14.0
        an = W / 14.0
        d.polygon([(x, 0), (x + an, 0), (x + an * .72, H * .68), (x + an * .22, H * .68)],
                  fill=(255, 255, 255, 30 if i % 2 else 52))
    d.ellipse([W * .30, H * .10, W * .70, H * .50], fill=(255, 255, 255, 46))
    d.ellipse([W * .36, H * .16, W * .64, H * .44], fill=(255, 255, 255, 54))


def dib_congreso(d, W, H):
    """Una red: nodos unidos, que es de lo que va un congreso."""
    rnd = random.Random(41)
    nodos = [(rnd.uniform(W * .08, W * .94), rnd.uniform(H * .08, H * .60)) for _ in range(17)]
    for i, a in enumerate(nodos):
        for b in nodos[i + 1:]:
            if math.dist(a, b) < W * .25:
                d.line([a, b], fill=(255, 255, 255, 62), width=3)
    for i, (x, y) in enumerate(nodos):
        r = 11 + (i % 4) * 7
        d.ellipse([x - r, y - r, x + r, y + r],
                  fill=(MAGENTA + (205,)) if i % 5 == 0 else (255, 255, 255, 170))


def dib_portada(d, W, H):
    """Arcos concentricos: la boveda de un patio del Centro."""
    for i in range(9):
        r = W * (.10 + i * .085)
        d.arc([W * .5 - r, H * .92 - r, W * .5 + r, H * .92 + r], 180, 360,
              fill=(255, 255, 255, 46 if i % 2 else 76), width=9)
    puntos(d, W * .02, H * .04, W * .30, H * .52, (255, 255, 255, 54), 30, 4.4)
    puntos(d, W * .72, H * .04, W * .99, H * .52, (255, 255, 255, 54), 30, 4.4)


CARTELES = [
    ("rock.jpg", "Ariel Eléctrico", "Concierto de rock",
     "Sala Mayor · 21:00", TINTA, (74, 18, 58), MAGENTA, dib_rock),
    ("ensayo.jpg", "El ensayo como conversación", "Taller de escritura",
     "Aula Reyes · 4 sesiones", (26, 38, 30), VERDE, (143, 170, 62), dib_ensayo),
    ("alebrijes.jpg", "Bestiario de papel", "Taller de alebrijes",
     "Patio del Ateneo · sábados", (58, 26, 12), NAR_OSC, NARANJA, dib_alebrijes),
    ("teatro.jpg", "El Banquete", "Lectura escenificada",
     "Foro Caso · 20:00", (22, 24, 40), AZUL, (72, 128, 162), dib_teatro),
    ("congreso.jpg", "Turismo y Tecnología", "Congreso · dos días",
     "Izazaga 8 · 9:00 a 19:00", TINTA, (28, 60, 70), (0, 150, 148), dib_congreso),
]

for nombre, titulo, sobre, pie, c1, c2, c3, dib in CARTELES:
    print(cartel(nombre, titulo, sobre, pie, c1, c2, c3, dib))

# ---------- la portada, ancha ----------
W, H = 2000, 820
im = grano(fondo(W, H, TINTA, (92, 28, 16), NAR_OSC))
d = ImageDraw.Draw(im, "RGBA")
dib_portada(d, W, H)
im.save(os.path.join(OUT, "portada.jpg"), "JPEG", quality=86, optimize=True)
print(os.path.join(OUT, "portada.jpg"))

# ---------- el logo ----------
L = 600
im = Image.new("RGB", (L, L), PAPEL)
d = ImageDraw.Draw(im, "RGBA")
d.ellipse([L * .06, L * .06, L * .94, L * .94], fill=TINTA)
d.arc([L * .145, L * .145, L * .855, L * .855], 0, 360, fill=NARANJA, width=13)
fa = f(OSW7, 190)
caja = d.textbbox((0, 0), "AP", font=fa)
d.text(((L - (caja[2] - caja[0])) / 2 - caja[0],
        L * .50 - (caja[3] - caja[1]) / 2 - caja[1] - L * .045), "AP", font=fa, fill=PAPEL)
d.rectangle([L * .40, L * .665, L * .60, L * .695], fill=MAGENTA)
im.save(os.path.join(OUT, "logo.png"), "PNG", optimize=True)
print(os.path.join(OUT, "logo.png"))

# ---------- la galeria ----------
GAL = [
    ("gal-1.jpg", "Patio lleno", TINTA, (92, 28, 16), NARANJA, dib_portada),
    ("gal-2.jpg", "Lectura", (26, 38, 30), VERDE, (143, 170, 62), dib_ensayo),
    ("gal-3.jpg", "Manos", (58, 26, 12), NAR_OSC, ORO, dib_alebrijes),
    ("gal-4.jpg", "Telón", (22, 24, 40), AZUL, (72, 128, 162), dib_teatro),
    ("gal-5.jpg", "La red", TINTA, (28, 60, 70), (0, 150, 148), dib_congreso),
    ("gal-6.jpg", "Última noche", TINTA, (74, 18, 58), MAGENTA, dib_rock),
]
for nombre, _t, c1, c2, c3, dib in GAL:
    W, H = 1100, 825
    im = grano(fondo(W, H, c1, c2, c3))
    d = ImageDraw.Draw(im, "RGBA")
    dib(d, W, H)
    im.save(os.path.join(OUT, nombre), "JPEG", quality=84, optimize=True)
    print(os.path.join(OUT, nombre))
