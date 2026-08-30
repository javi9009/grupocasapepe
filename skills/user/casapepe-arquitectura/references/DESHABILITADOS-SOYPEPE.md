# Módulos deshabilitados en SoyPepe (hasta nuevo aviso)

**Fecha:** 2026-08-29  
**Decision:** Javi Puente  
**Responsable:** Claude + Javi  

---

## Módulos ocultos

### 1. Bitácora / Incidencias
- **Código:** `COL-BITACORA`
- **Estado:** `app = NULL` (oculto en SoyPepe)
- **Datos:** Conservados en Supabase (tabla `modulos`)
- **Para reactivar:** `UPDATE modulos SET app = 'soypepe' WHERE codigo = 'COL-BITACORA'`

### 2. Rankings
- **Código:** `COL-RANKINGS`
- **Estado:** `app = NULL` (oculto en SoyPepe)
- **Datos:** Conservados en Supabase (tabla `modulos`)
- **Para reactivar:** `UPDATE modulos SET app = 'soypepe' WHERE codigo = 'COL-RANKINGS'`

---

## ¿Por qué?

Mantenimiento temporal. Se ocultaron sin eliminar datos.

---

## Cómo reactivar

### SQL directo en Supabase:
```sql
UPDATE modulos
SET app = 'soypepe'
WHERE codigo IN ('COL-BITACORA', 'COL-RANKINGS');
```

Después: commit → push → Netlify auto-deploya (2-3 min).

---

## Verificación

### En SoyPepe:
- Bitácora no aparece en menú
- Rankings no aparece en menú
- Otros módulos (Horario, Vacaciones, etc.) siguen visibles

### En Supabase:
```sql
SELECT codigo, nombre, app FROM modulos 
WHERE codigo IN ('COL-BITACORA', 'COL-RANKINGS');
```
Debe mostrar `app = NULL`.

---

**Última actualización:** 2026-08-29
