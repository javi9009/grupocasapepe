// hk-extension-diag — sonda temporal. SOLO NÚMEROS, ningún dato de nadie.
//
// La pantalla de extensiones dice «no hay nadie en casa» y la caché de
// huespedes-encasa tiene 59 huéspedes esa misma noche. O sea que Cloudbeds
// contesta y el que lee mal soy yo. Esto prueba las tres formas de preguntar y
// devuelve cuántas reservas trae cada una, cuántas caen esta noche y cuántas
// traen cama asignada. Nombres, correos y reservas NO salen de aquí.
//
// Se retira en cuanto conteste. Javi, 7-oct-2026.
const CB = "https://hotels.cloudbeds.com/api/v1.2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TZ = "America/Mexico_City";
const hoyMX = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const masDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function cb(key: string, path: string) {
  const r = await fetch(`${CB}/${path}`, { headers: { Authorization: `Bearer ${key}` } });
  return await r.json().catch(() => ({ success: false, _noJson: true }));
}

function mide(j: any, hoy: string) {
  const d = Array.isArray(j?.data) ? j.data : [];
  let enCasa = 0, conCama = 0, camas = 0;
  const estados: Record<string, number> = {};
  for (const r of d) {
    const st = String(r.status || "").toLowerCase();
    estados[st] = (estados[st] || 0) + 1;
    const llega = String(r.startDate || ""), sale = String(r.endDate || "");
    if (llega <= hoy && hoy < sale) {
      enCasa++;
      const rooms = Array.isArray(r.rooms) ? r.rooms : [];
      const ids = rooms.map((x: any) => String(x.roomID || "")).filter(Boolean);
      if (ids.length) { conCama++; camas += ids.length; }
    }
  }
  return {
    success: j?.success, mensaje: typeof j?.message === "string" ? j.message.slice(0, 120) : undefined,
    reservas: d.length, en_casa: enCasa, con_cama: conCama, camas,
    estados, claves_de_una: d[0] ? Object.keys(d[0]).slice(0, 25) : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = Deno.env.get("CLOUDBEDS_API_KEY") || "";
  const pid = "10668";
  if (!key) return J({ ok: false, error: "sin llave" }, 503);
  const hoy = hoyMX();

  const [a, b, c] = await Promise.all([
    cb(key, `getReservationsWithRateDetails?propertyID=${pid}&resultsFrom=${masDias(hoy, -40)}&resultsTo=${masDias(hoy, 1)}&pageSize=100&pageNumber=1`),
    cb(key, `getReservations?propertyID=${pid}&checkInFrom=${masDias(hoy, -40)}&checkInTo=${masDias(hoy, 1)}&pageSize=100&pageNumber=1`),
    cb(key, `getReservationsWithRateDetails?propertyID=${pid}&checkInFrom=${masDias(hoy, -40)}&checkInTo=${masDias(hoy, 1)}&pageSize=100&pageNumber=1`),
  ]);

  return J({
    ok: true, hoy,
    A_rateDetails_resultsFrom: mide(a, hoy),
    B_getReservations_checkIn: mide(b, hoy),
    C_rateDetails_checkIn: mide(c, hoy),
  });
});
