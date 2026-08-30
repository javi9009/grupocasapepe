# Refactor de páginas SoyPepe → Header + Footer fijo

**Objetivo:** Todas las páginas mantienen header (back + título) y footer (navegación) siempre visibles.

**Estado:** En progreso  
**Fecha:** 2026-08-29

---

## Páginas a refactorizar

### ✅ COMPLETADAS (patrón correcto)
- **Mi horario** — Header + footer + contenido scrollable ✓
- **Mi cuenta** — Subpáginas con header back ✓

### 🔄 PENDIENTES (necesitan header + footer)

| Código | Página | Estado | Prioridad |
|--------|--------|--------|-----------|
| COL-CHECADOR | Llegué / Me voy | — | 🔴 Alta |
| COL-VACACIONES | Mis Vacaciones | — | 🔴 Alta |
| COL-COMIDAS | Comidas | — | 🟡 Media |
| COL-HK-MIS | Mi limpieza | — | 🟡 Media |
| COL-VALORACIONES | Valoraciones | — | 🟡 Media |
| COL-GUIAS | Guías del Guía | — | 🟡 Media |
| COL-REPORTE | Reporte del día | — | 🟡 Media |
| COL-PERFIL | Mi perfil | — | 🟢 Baja |
| COL-NOTIF | Notificaciones | — | 🟢 Baja |
| COL-CONFIG | Configuración | — | 🟢 Baja |
| **MANTENIMIENTO** | Eloy Queda | — | 🔴 Alta |
| **AUDIT** | Room audit | — | 🟡 Media |
| **LECTURAS** | Lecturas del día | — | 🟡 Media |

---

## Template a usar

Todas las nuevas páginas usan este template:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>[TITULO] · SoyPepe</title>
  <link rel="stylesheet" href="../casapepe-ui.css">
  <link rel="stylesheet" href="../soypepe-navegacion.css">
</head>
<body>

<div class="sp-app">
  
  <!-- HEADER STICKY -->
  <header class="sp-header">
    <button class="sp-back" onclick="history.back()">&lt;</button>
    <div class="sp-context">
      <h1 class="sp-title">[TITULO]</h1>
      <p class="sp-subtitle">[ROL / CONTEXTO]</p>
    </div>
  </header>

  <!-- CONTENIDO (scrollable) -->
  <main class="sp-content">
    <!-- Tarjetas aquí -->
  </main>

  <!-- FOOTER STICKY (siempre igual) -->
  <footer class="sp-footer">
    <a href="../" class="sp-nav-item active">
      <svg><!-- home --></svg>
      <span>Inicio</span>
    </a>
    <a href="../llegue/" class="sp-nav-item">
      <svg><!-- reloj --></svg>
      <span>Llegué / Me voy</span>
    </a>
    <a href="#chat" class="sp-nav-item">
      <svg><!-- chat --></svg>
      <span>Pepe Chat</span>
    </a>
    <a href="#cuenta" class="sp-nav-item">
      <svg><!-- usuario --></svg>
      <span>Mi cuenta</span>
    </a>
  </footer>

</div>

</body>
</html>
```

---

## Ejemplos por módulo

### Llegué / Me voy (COL-CHECADOR)
```html
<h1 class="sp-title">Llegué / Me voy</h1>
<p class="sp-subtitle">Asistencia · Jornada</p>
```

### Mis Vacaciones (COL-VACACIONES)
```html
<h1 class="sp-title">Mis Vacaciones</h1>
<p class="sp-subtitle">Tu saldo del año y solicitudes</p>
```

### Mantenimiento (Eloy Queda)
```html
<h1 class="sp-title">Eloy Queda</h1>
<p class="sp-subtitle">Mantenimiento · Sistema automático</p>
```

### Room audit
```html
<h1 class="sp-title">Room audit</h1>
<p class="sp-subtitle">Revisión diaria de habitaciones</p>
```

---

## Notas importantes

1. **Header:** SIEMPRE visible, sticky, no scroll
2. **Footer:** SIEMPRE visible, sticky, no scroll
3. **Contenido:** Único área scrollable
4. **Altura:** `height: 100vh` en `.sp-app`, footer/header restan

---

## Próximos pasos

1. **Actualizar `soypepe-navegacion.css`** con layout flexbox
2. **Refactorizar Eloy Queda** (Mantenimiento) como ejemplo
3. **Aplicar a 5 páginas prioritarias** (Checador, Vacaciones, Room Audit, Reporte, Lecturas)
4. **Luego:** resto de páginas

---

**Responsable:** Javi Puente  
**Última actualización:** 2026-08-29
