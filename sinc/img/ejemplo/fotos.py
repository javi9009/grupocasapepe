# Las fotos de la pagina de ejemplo: se bajan de Openverse y se recortan.
#
# Javi, 10-oct-2026: «llename de fotos de internet abiertas la pagina».
#
# SOLO LICENCIAS QUE PERMITEN USO COMERCIAL Y OBRA DERIVADA: CC0, dominio
# publico, CC-BY y CC-BY-SA. Nada de NC (no comercial) ni ND (sin derivadas):
# esto es la pagina de una empresa, no un trabajo de clase.
#
# DE CADA FOTO SE GUARDA EL CREDITO en creditos.json, y la pagina lo enseña al
# pie. Una CC-BY sin credito es una CC-BY incumplida, y esta pagina la va a ver
# gente de fuera.
#
# Se evitan a proposito los retratos de personas con nombre: en una pagina de
# una productora inventada, la foto de una actriz identificable da a entender
# que trabaja ahi. Las que se usan son planos generales -escenario, butacas,
# publico de espaldas, una mesa de trabajo- y el desfile de alebrijes.
#
# Para rehacerlas:  python3 fotos.py
import json, os, subprocess, sys
from PIL import Image, ImageOps

UA = "CasaPepeEjemplo/1.0 (https://casapepe.mx; javi@casapepe.mx)"
AQUI = os.path.dirname(os.path.abspath(__file__))
CACHE = "/tmp/fotos-src"
CAND = "/tmp/ov-candidatas.json"   # lo deja fotos2.py, el buscador

# destino -> (bolsa de candidatas, indice, recorte, pie)
#
# NADA DE WIKIMEDIA. Sus servidores contestan 429 a esta IP -es compartida y
# esta limitada-, tanto la API de Commons como upload.wikimedia.org. Las
# candidatas que viven alli se descartan en la busqueda; estas vienen de Flickr,
# StockSnap y Rawpixel a traves de Openverse.
#
# LOS RETRATOS son fotos de archivo CC0 de StockSnap: gente de modelo, sin
# nombre y cedida para uso comercial. A proposito NO se usan retratos de
# personas identificables con nombre (los que salen en Flickr suelen serlo):
# ponerle un nombre inventado a alguien reconocible es otra cosa muy distinta.
# La pagina lo dice al pie: quienes aparecen no tienen que ver con los nombres.
ELEGIDAS = {
    "portada":   ("heroD",     0, (2000, 820),  "Un concierto lleno"),
    "cara-1":    ("wB",        2, (520, 520),   "Renata Caso"),
    "cara-2":    ("sB",        2, (520, 520),   "Mauro Torri"),
    "cara-3":    ("wD",        2, (520, 520),   "Citlali Herrán"),
    "cara-4":    ("mA",        0, (520, 520),   "Bruno Cravioto"),
    "cara-5":    ("wA",        5, (520, 520),   "Paulina Urueta"),
    "patio":     ("patioF",    4, (1100, 825),  "El patio, en panorámica"),
    "rock":      ("rock",      0, (1200, 900),  "Escenario de concierto"),
    "ensayo":    ("ensayo",    6, (1200, 900),  "Mesa de trabajo"),
    "alebrijes": ("alebrijeF", 3, (1200, 900),  "Desfile de alebrijes"),
    "teatro":    ("teatro2",   0, (1200, 900),  "Butacas antes de la función"),
    "congreso":  ("congreso2", 3, (1200, 900),  "Sala de conferencias"),
    "gal-1":     ("patioF",    1, (1100, 825),  "Casa Talavera, Centro Histórico"),
    "gal-2":     ("ensayo",    0, (1100, 825),  "Escribir a mano"),
    "gal-3":     ("alebrijeF", 9, (1100, 825),  "Alebrijes monumentales en Reforma"),
    "gal-4":     ("rock",      5, (1100, 825),  "El público"),
    "gal-5":     ("patioF",    5, (1100, 825),  "El claustro"),
    "gal-6":     ("rock",      8, (1100, 825),  "Guitarra bajo luz roja"),
}
# Las mismas cinco, en 16:9, para la cabecera de la ficha del evento.
ANCHAS = ["rock", "ensayo", "alebrijes", "teatro", "congreso"]


def baja(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 20000:
        return True
    r = subprocess.run(["curl", "-sSL", "-m", "120", "-H", "User-Agent: " + UA,
                        "-o", destino, "-w", "%{http_code}"], capture_output=True, text=True)
    cmd = ["curl", "-sSL", "-m", "120", "-H", "User-Agent: " + UA, "-o", destino,
           "-w", "%{http_code}", url]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.strip().startswith("2") and os.path.getsize(destino) > 20000


def recorta(src, w, h, destino, calidad=84, alto=False):
    im = Image.open(src)
    im = ImageOps.exif_transpose(im).convert("RGB")
    # En un retrato la cara esta arriba: si se recorta por el centro salen
    # barbillas. Por eso los cuadrados tiran hacia arriba.
    centro = (0.5, 0.26) if alto else (0.5, 0.42)
    im = ImageOps.fit(im, (w, h), Image.LANCZOS, centering=centro)
    im.save(destino, "JPEG", quality=calidad, optimize=True, progressive=True)
    return os.path.getsize(destino)


def main():
    cand = json.load(open(CAND))
    os.makedirs(CACHE, exist_ok=True)
    creditos = {}
    for nombre, (bolsa, i, (w, h), pie) in ELEGIDAS.items():
        x = cand[bolsa][i]
        src = os.path.join(CACHE, bolsa + "-" + str(i) + ".img")
        if not baja(x["url"], src):
            print("NO BAJA", nombre, x["url"]); continue
        peso = recorta(src, w, h, os.path.join(AQUI, nombre + ".jpg"),
                       alto=nombre.startswith("cara-"))
        if nombre in ANCHAS:
            recorta(src, 1600, 900, os.path.join(AQUI, nombre + "-ancha.jpg"))
        creditos[nombre] = {
            "pie": pie, "autor": x["autor"], "licencia": x["lic"].strip(),
            "licencia_url": x["lic_url"], "fuente": x["fuente"], "titulo": x["titulo"],
        }
        print("%-10s %6.0f KB  %s · %s" % (nombre, peso / 1024, x["lic"].strip(), x["autor"]))
    json.dump(creditos, open(os.path.join(AQUI, "creditos.json"), "w"),
              ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
