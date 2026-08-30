---
name: "soypepe-navegacion"
description: "Estándar unificado de navegación y apertura de pantallas en SoyPepe. Todas las pantallas secundarias abren siguiendo el patrón de 'Mi horario': back arrow + header + contexto + navegación + contenido en tarjetas. Úsala SIEMPRE que crees, edites o reestructures una pantalla en SoyPepe para que todo sea consistente. Triggers: «abrir pantalla SoyPepe», «estructura de pantalla», «navegación SoyPepe», «cómo se abre», «Mi horario», «unificar navegación», «patrón de pantalla»."
---

# SoyPepe · Estándar de Navegación y Apertura de Pantallas

**Decisión:** Todas las pantallas secundarias en SoyPepe abren usando el patrón de **"Mi horario"** como estándar. Esto reemplaza modales laterales, popups flotantes y paneles sin contexto.

Fecha: 2026-08-29 | Javi

---

## 1. Anatomía estándar de una pantalla en SoyPepe

### 1.1 Header de navegación (back + contexto)

```html
<div class="sp-header">
  <button class="sp-back" onclick="history.back()">
    <svg><!-- back arrow --></svg>
  </button>
  <div class="sp-context">
    <h1 class="sp-title">Mi horario</h1>
    <p class="sp-subtitle">Gerencia / Admin · Director General</p>
  </div>
</div>
```

**Reglas:**
- **Back button:** Siempre en la esquina superior izquierda. Ícono de flecha atrás (`<`). Vuelve a la pantalla anterior o lista principal.
- **Título:** Claro, corto (máx 3 palabras). Ej: "Mi horario", "Room audit", "Mis Vacaciones".
- **Subtítulo (opcional):** Rol/contexto del usuario o descripción de la sección. Ej: "Gerencia / Admin · Director General".

```css
.sp-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--rule);
}
.sp-back {
  background: transparent;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 20px;
}
.sp-back:hover {
  background: var(--surface-2);
  border-radius: 6px;
}
.sp-context {
  flex: 1;
}
.sp-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}
.sp-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
}
```

---

### 1.2 Barra de navegación/controles (si aplica)

Justo debajo del header, controles secundarios: filtros, navegación de fechas, botones de acción.

```html
<div class="sp-controls">
  <button class="sp-nav-prev">&lt;</button>
  <span class="sp-nav-current">24 ago – 30 ago</span>
  <button class="sp-nav-next">&gt;</button>
  <button class="btn">Hoy</button>
  <button class="btn ghost">Suscribir a mi calendario</button>
</div>
```

**Reglas:**
- Los controles van **horizontales, sticky debajo del header** (o los integras en el mismo header si caben).
- Botones de navegación de fechas: `<` y `>` pequeños (ícono).
- Botón primario (`Hoy`): acción rápida de volver a hoy/presente.
- Botones secundarios: acciones opcionales (suscribir, descargar, editar).

```css
.sp-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--rule);
  flex-wrap: wrap;
}
.sp-nav-prev, .sp-nav-next {
  background: transparent;
  border: 1px solid var(--rule);
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--ink);
  font-weight: 600;
}
.sp-nav-prev:hover, .sp-nav-next:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.sp-nav-current {
  flex: 0 0 auto;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}
```

---

### 1.3 Contenido principal (tarjetas/secciones)

El cuerpo de la pantalla usa tarjetas separadas, cada una con su propia semántica.

```html
<main class="sp-content">
  <!-- Sección 1: KPIs o resumen -->
  <section class="sp-card sp-kpis">
    <div class="kpi">
      <div class="kpi-value">18</div>
      <div class="kpi-label">Permitidas</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">8</div>
      <div class="kpi-label">Tomadas</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">10</div>
      <div class="kpi-label">Disponibles</div>
    </div>
  </section>

  <!-- Sección 2: Contenido principal -->
  <section class="sp-card">
    <h2 class="sp-section-title">Solicitar vacaciones</h2>
    <form>
      <input type="date" placeholder="dd/mm/aaaa">
      <input type="date" placeholder="dd/mm/aaaa">
      <button class="btn">Solicitar</button>
    </form>
  </section>

  <!-- Sección 3: Lista de items -->
  <section class="sp-card">
    <h3 class="sp-section-title">Mis solicitudes</h3>
    <div class="sp-item">
      <h4>14–ago – 22–ago</h4>
      <p>Vacaciones · 8 día(s)</p>
      <span class="badge badge-ok">Aprobada</span>
    </div>
    <div class="sp-item">
      <h4>19–jul – 26–jul</h4>
      <p>Vacaciones · 7 día(s)</p>
      <span class="badge badge-pending">Pendiente</span>
    </div>
  </section>
</main>
```

**Reglas:**
- **Cada sección es una tarjeta (`.sp-card`)** con fondo blanco, borde, radio 6px.
- Tarjetas van en un contenedor con padding y espaciado vertical.
- Títulos de sección (`.sp-section-title`): `<h2>` o `<h3>`, font-weight 700, color `--ink`.
- Items dentro de una sección se separan con divisores sutiles o padding.
- **NO usar modales, popups flotantes ni paneles laterales** — todo contenido va en tarjetas dentro del flujo.

```css
.sp-content {
  max-width: 1180px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sp-card {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 16px;
}
.sp-section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}
.sp-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--rule);
}
.sp-item:last-child {
  border-bottom: none;
}
.sp-item h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}
.sp-item p {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--muted);
}
.badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.badge-ok {
  background: var(--ok-bg);
  color: var(--ok);
}
.badge-pending {
  background: var(--warn-bg);
  color: var(--warn);
}
```

---

## 2. Estructura de página completa (header + contenido + footer)

**TODAS las páginas de SoyPepe deben tener esta estructura HTML:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SoyPepe</title>
  <link rel="stylesheet" href="casapepe-ui.css">
  <link rel="stylesheet" href="soypepe-navegacion.css">
</head>
<body>

<div class="sp-app">
  
  <!-- HEADER STICKY (SIEMPRE VISIBLE) -->
  <header class="sp-header">
    <button class="sp-back" onclick="history.back()">&lt;</button>
    <div class="sp-context">
      <h1 class="sp-title">Mi horario</h1>
      <p class="sp-subtitle">Gerencia / Admin · Director General</p>
    </div>
  </header>

  <!-- CONTROLES (sticky debajo del header, opcional) -->
  <div class="sp-controls">
    <button class="sp-nav-prev">&lt;</button>
    <span class="sp-nav-current">24 ago – 30 ago</span>
    <button class="sp-nav-next">&gt;</button>
    <button class="btn">Hoy</button>
  </div>

  <!-- CONTENIDO PRINCIPAL (scrollable) -->
  <main class="sp-content">
    <!-- Tarjetas aquí -->
  </main>

  <!-- FOOTER STICKY (SIEMPRE VISIBLE) -->
  <footer class="sp-footer">
    <a href="#inicio" class="sp-nav-item active">
      <svg><!-- Ícono home --></svg>
      <span>Inicio</span>
    </a>
    <a href="#llegue" class="sp-nav-item">
      <svg><!-- Ícono reloj --></svg>
      <span>Llegué / Me voy</span>
    </a>
    <a href="#chat" class="sp-nav-item">
      <svg><!-- Ícono chat --></svg>
      <span>Pepe Chat</span>
    </a>
    <a href="#cuenta" class="sp-nav-item">
      <svg><!-- Ícono usuario --></svg>
      <span>Mi cuenta</span>
    </a>
  </footer>

</div>

<script src="soypepe-navegacion.js"></script>
</body>
</html>
```

---

### **CSS para mantener header + footer visibles:**

```css
body {
  margin: 0;
  padding: 0;
  background: var(--ground);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.sp-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Header sticky en el tope */
.sp-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--surface);
  border-bottom: 1px solid var(--rule);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.sp-back {
  background: transparent;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 20px;
  flex-shrink: 0;
}

.sp-back:hover {
  background: var(--surface-2);
  border-radius: 6px;
}

.sp-context {
  flex: 1;
}

.sp-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}

.sp-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
}

/* Controles sticky */
.sp-controls {
  position: sticky;
  top: 64px;  /* Debajo del header */
  z-index: 99;
  background: var(--surface);
  border-bottom: 1px solid var(--rule);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Contenido scrollable (el espacio medio) */
.sp-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Footer sticky en el fondo */
.sp-footer {
  position: sticky;
  bottom: 0;
  z-index: 100;
  background: var(--surface);
  border-top: 1px solid var(--rule);
  padding: 12px 0;
  display: flex;
  justify-content: space-around;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.05);
}

.sp-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  text-decoration: none;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color 0.2s;
}

.sp-nav-item:hover,
.sp-nav-item.active {
  color: var(--accent);
}

.sp-nav-item svg {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  stroke-width: 1.5;
  fill: none;
}
```

---

## 2. Transiciones y comportamiento

### 2.1 Cómo se abre una pantalla

**De lista a detalle:**
- Click en un ítem de la lista → **slide lateral derecha** (o fade) → se abre la pantalla de detalle.
- El back button restaura la posición de scroll de la lista anterior.

**Implementación (CSS Transition):**

```css
.sp-screen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--ground);
  overflow: auto;
  transform: translateX(100%);
  transition: transform 0.3s ease-out;
}
.sp-screen.active {
  transform: translateX(0);
  z-index: 10;
}
.sp-screen.pop {
  transform: translateX(100%);
  z-index: 5;
}
```

**Implementación (JavaScript):**

```javascript
// Abrir pantalla
function openScreen(screenId) {
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    screen.classList.remove('pop');
  }
}

// Cerrar pantalla (back button)
function closeScreen(screenId) {
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('pop');
    setTimeout(() => screen.classList.remove('active'), 300);
  }
}

// Back button genérico
document.querySelectorAll('.sp-back').forEach(btn => {
  btn.addEventListener('click', () => {
    history.back();
  });
});
```

### 2.2 Responsive

- **Desktop:** Ancho máximo 1180px, centrado, padding lateral.
- **Tablet/Móvil:** 100% ancho, padding interior.

```css
@media (max-width: 768px) {
  .sp-content {
    padding: 12px;
    gap: 12px;
  }
  .sp-card {
    padding: 12px;
  }
  .sp-controls {
    padding: 12px;
  }
}
```

---

## 3. Aplicación a pantallas existentes

### 3.1 "Room audit"
**Actual:** Estructura compleja con KPIs y tarjetas anidadas.  
**Cambio:** Aplicar header + back + submenú sticky (si hay filtros). Mantener KPIs, pero envolver en `.sp-card`.

### 3.2 "Mis Vacaciones"
**Actual:** Abre como modal/popup flotante.  
**Cambio:** Abre como pantalla full con back header. Contenido en tarjetas: KPIs arriba, formulario de solicitud, lista de solicitudes abajo.

### 3.3 "Lecturas del día"
**Actual:** Panel lateral derecha.  
**Cambio:** Abre como pantalla full con back header. Mantiene el flujo de foto por medidor, pero en tarjetas verticales.

### 3.4 "Mi horario"
**Actual:** ✅ Estándar ya implementado. Mantener así.

---

## 4. Checklist de implementación (OBLIGATORIO)

### Header (SIEMPRE)
- [ ] Back arrow (`<`) en esquina superior izquierda
- [ ] Título claro (máx 3 palabras)
- [ ] Subtítulo con rol/contexto (ej: "Gerencia / Admin · Director General")
- [ ] Header sticky: `position: sticky; top: 0; z-index: 100`

### Contenido (FLEXIBLE)
- [ ] Controles/navegación (si aplica) sticky debajo del header
- [ ] Contenido en tarjetas (`.sp-card`) separadas
- [ ] Contenido scrollable (`.sp-content` tiene `overflow-y: auto`)
- [ ] Colores y tipografía según `casapepe-ui` (fondo crema, tokens)
- [ ] Botones usan `.btn` y `.btn.ghost`

### Footer (SIEMPRE)
- [ ] 4 botones de navegación: Inicio, Llegué/Me voy, Pepe Chat, Mi cuenta
- [ ] Ícono + texto en cada botón
- [ ] Footer sticky: `position: sticky; bottom: 0; z-index: 100`
- [ ] Active state en el botón actual

### Interacción
- [ ] NO hay modales, popups ni paneles flotantes
- [ ] Transición suave (slide o fade) al abrir/cerrar pantallas
- [ ] Responsive: funciona en móvil/tablet/desktop
- [ ] Back button vuelve correctamente a la pantalla anterior

---

## 5. Variables CSS requeridas

Asegúrate de que `:root` tenga definidas (heredadas de `casapepe-ui`):

```css
--ground: #F4F1EA;      /* fondo de página */
--surface: #FFFFFF;     /* tarjetas */
--rule: #E2DCCF;        /* bordes */
--ink: #1F1B16;         /* texto principal */
--muted: #6B6459;       /* texto secundario */
--accent: #137A56;      /* verde Casa Pepe */
--ok-bg: #E1F0E7;
--warn-bg: #F3EAD6;
--shadow: 0 1px 1px rgba(31,27,22,.04), 0 10px 26px -20px rgba(31,27,22,.35);
```

Si usas Supabase/componentes, importa el CSS de `casapepe-ui` primero, luego este.

---

## 6. Aplicación a módulos específicos (CON header + footer)

### Mantenimiento ("Eloy Queda")

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Eloy Queda · SoyPepe</title>
  <link rel="stylesheet" href="../casapepe-ui.css">
  <link rel="stylesheet" href="../soypepe-navegacion.css">
</head>
<body>

<div class="sp-app">
  
  <!-- HEADER -->
  <header class="sp-header">
    <button class="sp-back" onclick="history.back()">&lt;</button>
    <div class="sp-context">
      <h1 class="sp-title">Eloy Queda</h1>
      <p class="sp-subtitle">Mantenimiento · Sistema automático</p>
    </div>
  </header>

  <!-- CONTENIDO PRINCIPAL -->
  <main class="sp-content">
    
    <!-- Sección: Lecturas de hoy -->
    <section class="sp-card">
      <h2 class="sp-section-title">Lecturas del día (29/08/2026)</h2>
      <div class="sp-item">
        <h4>💧 Agua</h4>
        <p>Lee los medidores de agua. Eloy los actualiza al detectarlos.</p>
        <button class="btn">Tomar foto</button>
      </div>
      <div class="sp-item">
        <h4>⚡ Luz</h4>
        <p>Lee los medidores de luz. Eloy los actualiza al detectarlos.</p>
        <button class="btn">Tomar foto</button>
      </div>
      <div class="sp-item">
        <h4>🔥 Gas</h4>
        <p>Lee los medidores de gas. Eloy los actualiza al detectarlos.</p>
        <button class="btn">Tomar foto</button>
      </div>
    </section>

    <!-- Sección: Tickets abiertos -->
    <section class="sp-card">
      <h2 class="sp-section-title">Tickets abiertos (3)</h2>
      <div class="sp-item">
        <h4>Cama 352 - Sin agua caliente</h4>
        <p>Reportado hace 2 horas · Reactivo</p>
        <span class="badge">Urgente</span>
        <button class="btn ghost">Ver detalles</button>
      </div>
      <div class="sp-item">
        <h4>Llave de paso general - Revisar</h4>
        <p>Mantenimiento preventivo · Esta semana</p>
        <span class="badge">Preventivo</span>
        <button class="btn ghost">Ver detalles</button>
      </div>
    </section>

    <!-- Sección: Reporte semanal -->
    <section class="sp-card">
      <h2 class="sp-section-title">Resumen de la semana</h2>
      <div class="sp-kpis">
        <div class="kpi">
          <div class="kpi-value">5</div>
          <div class="kpi-label">Tickets resueltos</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">2</div>
          <div class="kpi-label">Preventivos completados</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">1</div>
          <div class="kpi-label">Pendientes</div>
        </div>
      </div>
      <button class="btn">📥 Descargar reporte</button>
    </section>

  </main>

  <!-- FOOTER -->
  <footer class="sp-footer">
    <a href="../" class="sp-nav-item">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
      <span>Inicio</span>
    </a>
    <a href="../llegue/" class="sp-nav-item">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>
      <span>Llegué / Me voy</span>
    </a>
    <a href="#chat" class="sp-nav-item">
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>Pepe Chat</span>
    </a>
    <a href="#cuenta" class="sp-nav-item">
      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>
      <span>Mi cuenta</span>
    </a>
  </footer>

</div>

</body>
</html>
```

---

## 7. Ejemplos de código

### Pantalla mínima (header + footer obligatorio)

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="casapepe-ui.css">
  <link rel="stylesheet" href="soypepe-navegacion.css">
</head>
<body>

<div class="sp-screen active" id="mis-vacaciones">
  <!-- Header -->
  <div class="sp-header">
    <button class="sp-back">&lt;</button>
    <div class="sp-context">
      <h1 class="sp-title">Mis Vacaciones</h1>
      <p class="sp-subtitle">Tu saldo del año y solicitudes</p>
    </div>
  </div>

  <!-- Contenido -->
  <main class="sp-content">
    <section class="sp-card sp-kpis">
      <div class="kpi">
        <div class="kpi-value">18</div>
        <div class="kpi-label">Permitidas</div>
      </div>
      <!-- ... más KPIs ... -->
    </section>

    <section class="sp-card">
      <h2 class="sp-section-title">Solicitar vacaciones</h2>
      <form>
        <input type="date">
        <button class="btn">Solicitar</button>
      </form>
    </section>
  </main>
</div>

<script src="soypepe-navegacion.js"></script>
</body>
</html>
```

### Con navegación de fechas

```html
<div class="sp-controls">
  <button class="sp-nav-prev">&lt;</button>
  <span class="sp-nav-current">24 ago – 30 ago</span>
  <button class="sp-nav-next">&gt;</button>
  <button class="btn">Hoy</button>
</div>
```

---

## 7. Próximos pasos

1. **Auditar SoyPepe:** Identifica todas las pantallas secundarias (Room audit, Mis Vacaciones, Lecturas, etc.).
2. **Refactorizar:** Aplica el patrón header + contenido en tarjetas a cada una.
3. **Probar navegación:** Verifica que back button y transiciones funcionen.
4. **Documentar en Pepe Chat:** Envía link a este skill para que el equipo lo conozca.

---

**Responsable:** Javi Puente  
**Última revisión:** 2026-08-29
