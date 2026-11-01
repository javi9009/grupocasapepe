// correo.ts — el marco de los correos que mandamos a terceros.
//
// Javi, 10-oct-2026: «cuando mandamos correos a los touroperadores y
// productores, pon que vienen de parte de Ateneo o Sincrético, y mejora la
// explicación, el saludo, el sentido y los botones para que sea más intuitivo y
// genere confianza».
//
// Qué estaba mal y qué arregla este marco:
//
//  · LA MARCA. Los correos de Sincrético salían en un verde (#137A56) que no es
//    suyo: su paleta es naranja, magenta y tinta sobre papel. Un correo que no
//    se parece a la marca que dice ser es exactamente lo que enseña a desconfiar.
//  · LA LIGA EN CLARO. Ninguno la traía. Si el botón no pinta —y en muchos
//    clientes de correo no pinta— el correo se queda inservible, y pedirle a
//    alguien que pulse un botón que no ve es pedirle un acto de fe.
//  · EL PREHEADER. Es la línea que se lee en la bandeja antes de abrir. Sin
//    ella, el cliente enseña el primer trozo de HTML y parece basura.
//  · DE DÓNDE VIENE Y A QUIÉN SE CONTESTA. Un remitente de marca con dirección
//    física y un correo humano detrás es lo que separa un correo legítimo de uno
//    que acaba en spam. Y la frase de «si no esperabas esto» tiene que estar:
//    quien la lee y no le aplica, se queda tranquilo; quien la lee y sí, avisa.
//
// Se escribe en tablas y con estilos pegados a cada etiqueta porque los clientes
// de correo no entienden otra cosa. Nada de tipografías de fuera: Oswald no
// carga en Gmail, así que se declara y se cae a la del sistema.

export type Marca = "sincretico" | "ateneo";

type Piezas = {
  marca: Marca;
  /** Lo que se lee en la bandeja antes de abrir. Una frase, sin repetir el asunto. */
  avance: string;
  /** Nombre de pila o nombre comercial. Si no hay, el saludo se queda sin nombre. */
  saludo?: string | null;
  titulo: string;
  /** Párrafos del cuerpo, en HTML ya escapado por quien llama. */
  cuerpo: string[];
  boton: { texto: string; liga: string };
  /** Bloque de aviso, opcional: lo que le falta, lo que tiene que tener a mano. */
  nota?: string | null;
  /** Qué pasa justo después de pulsar. Baja la ansiedad de «¿y ahora qué?». */
  despues?: string | null;
};

const MARCAS = {
  sincretico: {
    nombre: "Sincrético",
    bajo: "Experiencias de Grupo Casa Pepe",
    tinta: "#1E1A16",
    acento: "#C9501A",      // naranja-oscuro: el naranja plano no pasa contraste en texto
    boton: "#F2682A",
    papel: "#FBF7F2",
    suave: "#FDE7DC",
    nota: "#8C6212",
    notaBg: "#F6EBD5",
    responde: "hola@casapepe.mx",
    donde: "Grupo Casa Pepe · Centro Histórico, Ciudad de México",
  },
  ateneo: {
    nombre: "Ateneo de Virreyes",
    bajo: "Grupo Casa Pepe",
    tinta: "#1E1A16",
    acento: "#44651F",
    boton: "#557B28",
    papel: "#F6EFE4",
    suave: "#EDF2E2",
    nota: "#8A6420",
    notaBg: "#FBF0DC",
    responde: "ateneo@casapepe.mx",
    donde: "José María Izazaga 8, piso 1 · Centro Histórico, Ciudad de México",
  },
} as const;

export function remitente(m: Marca) {
  const c = MARCAS[m];
  const env = m === "sincretico" ? "SINCRETICO_FROM" : "ATENEO_FROM";
  return Deno.env.get(env) || `${c.nombre} <${c.responde}>`;
}
export function respondeA(m: Marca) {
  const c = MARCAS[m];
  const env = m === "sincretico" ? "SINCRETICO_REPLY" : "ATENEO_REPLY";
  return Deno.env.get(env) || c.responde;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const TIPO = "Oswald,'Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif";
const TEXTO = "Inter,'Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif";

export function marco(p: Piezas): string {
  const c = MARCAS[p.marca];
  const saludo = p.saludo ? `Hola ${esc(p.saludo)},` : "Hola,";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.titulo)}</title></head>
<body style="margin:0;padding:0;background:${c.papel};">
<!-- El avance: se lee en la bandeja y luego se esconde. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${esc(p.avance)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.papel};padding:26px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#FFFFFF;border-radius:16px;overflow:hidden">

    <!-- Quién manda esto. Lo primero que se lee, antes del título. -->
    <tr><td style="background:${c.tinta};padding:16px 24px">
      <div style="font-family:${TIPO};font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#FFFFFF">${esc(c.nombre)}</div>
      <div style="font-family:${TEXTO};font-size:12px;color:#C9C2B8;margin-top:2px">${esc(c.bajo)}</div>
    </td></tr>

    <tr><td style="padding:24px 24px 6px">
      <div style="font-family:${TEXTO};font-size:15px;color:${c.tinta};margin:0 0 10px">${saludo}</div>
      <h1 style="font-family:${TIPO};font-size:22px;line-height:1.25;font-weight:700;color:${c.tinta};margin:0 0 12px">${esc(p.titulo)}</h1>
      ${p.cuerpo.map((t) =>
        `<p style="font-family:${TEXTO};font-size:15px;line-height:1.62;color:#3C3630;margin:0 0 13px">${t}</p>`).join("")}
    </td></tr>

    <!-- El botón, y debajo la misma liga escrita. Si el cliente no pinta el
         botón, el correo sigue sirviendo. -->
    <tr><td style="padding:6px 24px 4px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:${c.boton};border-radius:10px">
          <a href="${esc(p.boton.liga)}" style="display:inline-block;font-family:${TIPO};font-size:14px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;padding:14px 24px">${esc(p.boton.texto)}</a>
        </td></tr></table>
    </td></tr>
    <tr><td style="padding:12px 24px 0">
      <div style="font-family:${TEXTO};font-size:12.5px;line-height:1.55;color:#6E665C">
        ¿No se abre el botón? Copia esta dirección en tu navegador:<br>
        <span style="color:${c.acento};word-break:break-all">${esc(p.boton.liga)}</span>
      </div>
    </td></tr>

    ${p.nota ? `<tr><td style="padding:16px 24px 0">
      <div style="background:${c.notaBg};border-radius:10px;padding:12px 14px;font-family:${TEXTO};font-size:13.5px;line-height:1.55;color:${c.nota}">${p.nota}</div>
    </td></tr>` : ""}

    ${p.despues ? `<tr><td style="padding:16px 24px 0">
      <div style="font-family:${TEXTO};font-size:13.5px;line-height:1.6;color:#3C3630">${p.despues}</div>
    </td></tr>` : ""}

    <!-- El pie. Dirección de verdad, un correo con alguien detrás, y la salida
         para quien no esperaba esto. -->
    <tr><td style="padding:22px 24px 24px">
      <div style="border-top:1px solid #E6DFD6;padding-top:14px;font-family:${TEXTO};font-size:12.5px;line-height:1.6;color:#6E665C">
        Te escribe <b style="color:${c.tinta}">${esc(c.nombre)}</b>. Si tienes cualquier duda, responde a este correo
        o escríbenos a <a href="mailto:${esc(c.responde)}" style="color:${c.acento};text-decoration:none">${esc(c.responde)}</a>; contesta una persona.
        <div style="margin-top:8px;color:#A9A096">${esc(c.donde)}</div>
        <div style="margin-top:8px;color:#A9A096">La liga de arriba es personal: no la compartas. Si no esperabas este correo, ignóralo y avísanos.</div>
      </div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}
