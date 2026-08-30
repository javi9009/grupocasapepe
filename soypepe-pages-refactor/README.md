# Páginas SoyPepe Refactorizadas — Header + Footer Fijo

**Todas estas páginas usan el estándar de navegación definido en `soypepe-navegacion`:**
- Header sticky (back + título + subtítulo)
- Footer sticky (4 botones de navegación)
- Contenido scrollable en el medio

---

## 🔴 Alta Prioridad (COMPLETADAS)

### 1. Llegué / Me voy
**Archivo:** `llegue-me-voy.html`
**Módulo:** COL-CHECADOR
**Contenido:** 
- Estado de hoy (llegada registrada, salida estimada)
- Botón para registrar movimiento
- Historial de la semana
- Resumen de horas acumuladas

### 2. Mis Vacaciones
**Archivo:** `mis-vacaciones.html`
**Módulo:** COL-VACACIONES
**Contenido:**
- KPIs: Permitidas, Tomadas, Disponibles
- Año vacacional (ciclo)
- Formulario: Solicitar vacaciones
- Lista de solicitudes (Aprobadas, Pendientes)
- FAQ

### 3. Eloy Queda · Mantenimiento
**Archivo:** `eloy-queda-mantenimiento.html`
**Módulo:** NUEVO (no estaba en SoyPepe)
**Contenido:**
- KPIs: Tickets abiertos, Resueltos, Preventivos
- Lecturas del día (Agua, Luz, Gas)
- Tickets abiertos (reactivos y preventivos)
- Reportes diarios/semanales
- Próximas tareas programadas

---

## 🟡 Media Prioridad (PRÓXIMAS)

- [ ] Comidas (COL-COMIDAS)
- [ ] Mi limpieza (COL-HK-MIS)
- [ ] Valoraciones (COL-VALORACIONES)
- [ ] Guías del Guía (COL-GUIAS)
- [ ] Reporte del día (COL-REPORTE)
- [ ] Room audit
- [ ] Lecturas del día

---

## 🟢 Baja Prioridad

- [ ] Mi perfil (COL-PERFIL)
- [ ] Notificaciones (COL-NOTIF)
- [ ] Configuración (COL-CONFIG)

---

## Estructura HTML (todas las páginas)

```html
<div class="sp-app">
  <header class="sp-header">
    <button class="sp-back">&lt;</button>
    <div class="sp-context">
      <h1 class="sp-title">Título</h1>
      <p class="sp-subtitle">Contexto</p>
    </div>
  </header>

  <main class="sp-content">
    <!-- Tarjetas de contenido -->
  </main>

  <footer class="sp-footer">
    <!-- 4 botones de navegación -->
  </footer>
</div>
```

---

## Notas técnicas

- **CSS:** Usa flexbox con `height: 100vh` en `.sp-app`
- **Header:** `position: sticky; top: 0; z-index: 100`
- **Footer:** `position: sticky; bottom: 0; z-index: 100`
- **Contenido:** `.sp-content` es el único área scrollable
- **Tarjetas:** `.sp-card` para cada sección

---

## Próximos pasos

1. Copiar estas 3 páginas al directorio correcto en el repo
2. Vincularlas desde `index.html` (menú de SoyPepe)
3. Refactorizar las 7 páginas de media prioridad
4. Deploy a Netlify y verificar

---

**Fecha:** 2026-08-29  
**Responsable:** Javi Puente + Claude
