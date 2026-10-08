/* cp-guarda.js — DESACTIVADO el 8-oct-2026.
 *
 * Este archivo envolvía window.fetch en las 30 pantallas que hacen PATCH, para
 * que un guardado bloqueado por RLS dejara de hacerse pasar por guardado.
 * La idea era buena; la ejecución tenía un fallo que no vi:
 *
 *   forzaba `Prefer: return=representation` PISANDO el `return=minimal` que
 *   mandaban muchas llamadas. Y con representation, PostgREST aplica además la
 *   política de SELECT: en una tabla donde alguien PUEDE escribir pero NO leer,
 *   el guardado vuelve vacío —o lo rechaza— aunque el UPDATE sea legítimo. Mi
 *   envoltorio lo convertía entonces en un 403 «no tienes permiso».
 *
 * Es decir: podía romper guardados que antes funcionaban, en cualquiera de las
 * 30 pantallas a la vez. Eso encaja con «muchos botones rotos» del 8-oct.
 *
 * Se deja el archivo vacío a propósito, en vez de quitar la etiqueta <script>
 * de 30 páginas: así la vuelta atrás es un solo archivo y es inmediata.
 *
 * Si se retoma, la forma correcta es NO tocar el Prefer de nadie: mirar la
 * cabecera Content-Range que PostgREST ya devuelve en el PATCH, que dice
 * cuántas filas se tocaron sin pedir el cuerpo ni pasar por el SELECT.
 */
