# Cambio Estructura: Ateneo Virreyes → Sincrético

**Fecha:** 2026-08-29  
**Responsable:** Javi Puente  
**Estado:** Documentado, listo para ejecutar  

---

## Cambio Principal

**ANTES:**
```
Hostal Boutique RU
  ├ Casa Pepe CDMX (property)
  ├ Casa Pepe Puebla (property)
  └ Corporativo (property)

Ateneo de Virreyes (entity independiente)
  └ Ateneo Virreyes CDMX (property)
```

**DESPUÉS:**
```
Hostal Boutique RU
  ├ Casa Pepe CDMX (property)
  ├ Casa Pepe Puebla (property)
  └ Corporativo (property)

Izazaga 8 SA
  ├ Sincrético (entity)
  │   └ Ateneo Virreyes CDMX (property) ← MOVIDO AQUÍ
  └ (otros)
```

---

## Qué cambia en Supabase

| Tabla | ID | Campo | Cambio |
|---|---|---|---|
| `properties` | `3e10a9ea-4913-4f7c-86ef-0c829caa851d` (Ateneo Virreyes) | `entity_id` | De `06c2b780...` (Ateneo entity) → `f70154ca...` (Sincrético entity) |

**Cascada automática:** Todas las relaciones hijas (`espacios`, `reservas_espacio`, `reglamento`, `info_propiedad`, `user_modules`, módulos) se mantienen iguales porque referencian `property_id`, no `entity_id`.

---

## Cómo ejecutar

### Opción 1: Supabase SQL Editor (UI) ✅ Recomendado

1. **Abre** Supabase → [rehophywchakfapivsbh](https://app.supabase.com/project/rehophywchakfapivsbh)
2. **Ve a** "SQL Editor" (lado izquierdo)
3. **Copia** el contenido completo de:
   ```
   /mnt/skills/user/casapepe-arquitectura/scripts/move-ateneo-to-sincretico.sql
   ```
4. **Pega** en el editor
5. **Ejecuta** en este orden:
   - Primero: paso **1** (UPDATE principal)
   - Luego: pasos **2–9** (verificaciones)
6. **Confirma** que:
   - ✅ Ateneo Virreyes ahora apunta a `entity_id = f70154ca...`
   - ✅ Espacios, reservas, reglamento siguen intactos
   - ✅ Ateneo aparece en la lista de properties bajo Sincrético

### Opción 2: CLI (`supabase` command)

```bash
# Ejecutar el script
supabase db execute \
  --project-ref rehophywchakfapivsbh \
  < /mnt/skills/user/casapepe-arquitectura/scripts/move-ateneo-to-sincretico.sql
```

### Opción 3: API REST (si tienes la key)

```bash
curl -X PATCH \
  "https://rehophywchakfapivsbh.supabase.co/rest/v1/properties?id=eq.3e10a9ea-4913-4f7c-86ef-0c829caa851d" \
  -H "apikey: YOUR_SUPABASE_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "f70154ca-3c1f-4679-bc89-a45c31ae40f4"}'
```

---

## Funcionalidades movidas a Sincrético

✅ **5 Espacios:**
- Coworking
- Estudio Podcast
- Cine
- Estudio Música
- Café Cumbre

✅ **Reservas de espacios** (todas las que apunten a estos espacios)

✅ **Reglamento** (12 reglas del Ateneo)

✅ **Info de propiedad** (datos descriptivos)

✅ **Módulos UI** y **user_modules** (asignaciones de dashboard)

---

## Verificaciones POST-CAMBIO

Después de ejecutar, verifica en el Supabase dashboard:

### 1. Ver Ateneo bajo Sincrético
```sql
SELECT * FROM properties 
WHERE entity_id = 'f70154ca-3c1f-4679-bc89-a45c31ae40f4'
AND id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d';
```
**Debería retornar 1 fila con entity_id = `f70154ca...`**

### 2. Ver espacios del Ateneo
```sql
SELECT tipo, nombre, capacidad FROM espacios 
WHERE property_id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d';
```
**Debería retornar 5 espacios** (coworking, podcast, cine, música, café)

### 3. Ver que Sincrético ahora tiene Ateneo
```sql
SELECT p.nombre, p.tipo FROM properties p
WHERE p.entity_id = 'f70154ca-3c1f-4679-bc89-a45c31ae40f4';
```
**Debería incluir "Ateneo Virreyes"**

---

## Actualizaciones paralelas (ya hechas)

✅ `inventario.md` — actualizado (Ateneo apunta a Sincrético)  
✅ `schema-supabase.md` — documentado cambio  
✅ Script SQL creado y listo

---

## Rollback (si algo sale mal)

```sql
UPDATE properties
SET entity_id = '06c2b780-9111-4a3a-a381-1d1c759a892b'  -- Ateneo de Virreyes entity
WHERE id = '3e10a9ea-4913-4f7c-86ef-0c829caa851d'
RETURNING *;
```

---

## Timeline

| Paso | Quién | Fecha | Status |
|---|---|---|---|
| Documentar cambio | Javi + Claude | 2026-08-29 | ✅ Completo |
| Ejecutar SQL en Supabase | Javi o Dev | — | ⏳ Pendiente |
| Verificar en UI (SoyPepe, etc.) | Equipo | — | ⏳ Pendiente |
| Comunicar cambio al equipo | Javi | — | ⏳ Pendiente |

---

## Próximos pasos

1. **Ejecutar el SQL** (opción 1, 2 o 3 arriba)
2. **Verificar las 3 queries de control**
3. **Verificar en SoyPepe** que Ateneo siga visible con sus espacios
4. **Enviar un mensaje** en Pepe Chat confirmando el cambio

Listo para cualquier pregunta. 🟢
