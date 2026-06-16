// ===== Datos =====
const PUESTOS = [
  {codigo:"VARIABLE",nombre:"Variable",horario:"10:00–18:00",color:"#9d6fc4",chipCls:"morado",horas:8},
  {codigo:"TURNO_MANANA",nombre:"Turno Mañana",horario:"7:00–15:00",color:"#1d9e75",chipCls:"",horas:8},
  {codigo:"TURNO_TARDE",nombre:"Turno Tarde",horario:"15:00–23:00",color:"#1d9e75",chipCls:"",horas:8},
  {codigo:"AUDITOR",nombre:"Auditor",horario:"23:00–7:00",color:"#1d9e75",chipCls:"",horas:8},
  {codigo:"EXPERIENCIAS_MAT",nombre:"Experiencias MAT",horario:"10:00–18:00",color:"#c47318",chipCls:"amarillo",horas:8},
  {codigo:"EXPERIENCIAS_VES",nombre:"Experiencias VES",horario:"15:00–23:00",color:"#c47318",chipCls:"amarillo",horas:8},
  {codigo:"SEGURIDAD",nombre:"Seguridad",horario:"9:00–9:00 (24h)",color:"#5f5e5a",chipCls:"gris",horas:24},
  {codigo:"DESCANSO_FRONT",nombre:"Descanso Front",horario:"",color:"#aaa",chipCls:"gris",horas:0},
  {codigo:"ANIMACION",nombre:"Animación · Juana",horario:"variable",color:"#E1251B",chipCls:"rojo",horas:0}
];
const INT = {
  VARIABLE:{i:600,f:1080}, TURNO_MANANA:{i:420,f:900}, TURNO_TARDE:{i:900,f:1380},
  AUDITOR:{i:1380,f:1860}, EXPERIENCIAS_MAT:{i:600,f:1080}, EXPERIENCIAS_VES:{i:900,f:1380},
  SEGURIDAD:{i:540,f:1980}, DESCANSO_FRONT:null, ANIMACION:null
};
const NOMBRES = {ASTRID:"Astrid",DAMARIS:"Damaris",LEONEL:"Leonel",CECILIO:"Cecilio",JOSEPH:"Joseph",ALAN:"Alan",ARNULFO:"Arnulfo",JUANA:"Juana"};
const DIAS = ["2026-06-15","2026-06-16","2026-06-17","2026-06-18","2026-06-19","2026-06-20","2026-06-21"];
const CONCEPTO_MAT = {1:null,2:{a:"Walking Tour",u:"Chapultepec"},3:{a:"Walking Tour",u:"Centro Histórico"},4:{a:"Walking Tour",u:"Roma y Condesa"},5:{a:"Walking Tour",u:"Coyoacán"},6:{a:"Chopo",u:"Mercado del Chopo"},0:{a:"Walking Tour",u:"Tepito"}};
const CONCEPTO_VES = {1:null,2:{a:"Luchas"},3:null,4:null,5:{a:"Luchas"},6:{a:"MIX",u:"Xochimilco + MITOS + Luchas"},0:{a:"Luchas"}};
const SUG_ANIM = ["Walking Tour mañana","Partido Mundial","Power Hour"];

const ORIG = {
  VARIABLE:{"2026-06-15":[{apodo:"ASTRID"}],"2026-06-16":[{apodo:"ASTRID"}],"2026-06-20":[{apodo:"ASTRID"}],"2026-06-21":[{apodo:"ASTRID"}]},
  TURNO_MANANA:{"2026-06-15":[{apodo:"DAMARIS"}],"2026-06-16":[{apodo:"DAMARIS"}],"2026-06-17":[{apodo:"DAMARIS"}],"2026-06-18":[{apodo:"LEONEL"}],"2026-06-19":[{apodo:"LEONEL"}],"2026-06-20":[{apodo:"LEONEL"}],"2026-06-21":[{apodo:"LEONEL"}]},
  TURNO_TARDE:{"2026-06-15":[{apodo:"LEONEL"}],"2026-06-16":[{apodo:"LEONEL"}],"2026-06-17":[{apodo:"ALAN"}],"2026-06-18":[{apodo:"DAMARIS"}],"2026-06-19":[{apodo:"ASTRID"}],"2026-06-20":[{apodo:"DAMARIS"}],"2026-06-21":[{apodo:"DAMARIS"}]},
  AUDITOR:{"2026-06-15":[{apodo:"CECILIO"}],"2026-06-16":[{apodo:"CECILIO"}],"2026-06-17":[{apodo:"LEONEL"}],"2026-06-18":[{apodo:"CECILIO"}],"2026-06-19":[{apodo:"CECILIO"}],"2026-06-20":[{apodo:"CECILIO"}],"2026-06-21":[{apodo:"CECILIO"}]},
  EXPERIENCIAS_MAT:{"2026-06-16":[{apodo:"JOSEPH"}],"2026-06-17":[{apodo:"JOSEPH"}],"2026-06-18":[{apodo:"JOSEPH"}],"2026-06-19":[{apodo:"JOSEPH"}],"2026-06-20":[{apodo:"ASTRID"}],"2026-06-21":[{apodo:"JOSEPH"}]},
  EXPERIENCIAS_VES:{"2026-06-16":[{apodo:"ALAN"}],"2026-06-18":[{apodo:"ALAN"}],"2026-06-19":[{apodo:"ALAN"}],"2026-06-20":[{apodo:"ASTRID"},{apodo:"JOSEPH"},{apodo:"ALAN"}],"2026-06-21":[{apodo:"ALAN"}]},
  SEGURIDAD:{"2026-06-15":[{apodo:"ARNULFO"}],"2026-06-16":[{apodo:"ARNULFO"}],"2026-06-17":[{apodo:"ARNULFO"}],"2026-06-18":[{apodo:"ARNULFO"}],"2026-06-19":[{apodo:"ARNULFO"}],"2026-06-20":[{apodo:"ARNULFO"}],"2026-06-21":[{apodo:"ARNULFO"}]},
  DESCANSO_FRONT:{"2026-06-15":[{apodo:"JOSEPH"},{apodo:"ALAN"}],"2026-06-16":[{apodo:"ARNULFO"}],"2026-06-17":[{apodo:"CECILIO"},{apodo:"ASTRID"}],"2026-06-18":[{apodo:"LEONEL"}],"2026-06-19":[{apodo:"DAMARIS"}]},
  ANIMACION:{
    "2026-06-15":[{apodo:"JUANA",actividad:"Walking Tour mañana",notas:"10:00-13:00"},{apodo:"JUANA",actividad:"Power Hour",notas:"19:00-20:00"}],
    "2026-06-17":[{apodo:"JUANA",actividad:"Walking Tour mañana",notas:"10:00-13:00"},{apodo:"JUANA",actividad:"Power Hour",notas:"19:00-20:00"}],
    "2026-06-18":[{apodo:"JUANA",actividad:"Partido Mundial",notas:"14:00-16:00"},{apodo:"JUANA",actividad:"Power Hour",notas:"19:00-20:00"}],
    "2026-06-19":[{apodo:"JUANA",actividad:"Walking Tour mañana",notas:"10:00-13:00"},{apodo:"JUANA",actividad:"Power Hour",notas:"19:00-20:00"}],
    "2026-06-20":[{apodo:"JUANA",actividad:"Partido Mundial",notas:"14:00-16:00"},{apodo:"JUANA",actividad:"Power Hour",notas:"19:00-20:00"}]
  }
};

let HORARIO = JSON.parse(JSON.stringify(ORIG));
let dragData = null, activeSug = null;

function diaSem(iso) { return new Date(iso+"T12:00:00").getDay(); }
function fmt(iso) { return new Date(iso+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric"}); }
function pName(c) { return PUESTOS.find(p => p.codigo === c)?.nombre || c; }
function concepto(puesto, fecha) {
  const d = diaSem(fecha);
  if (puesto === "EXPERIENCIAS_MAT") return CONCEPTO_MAT[d];
  if (puesto === "EXPERIENCIAS_VES") return CONCEPTO_VES[d];
  return null;
}

function parseHoras(notas) {
  if (!notas) return 0;
  const m = notas.match(/(\d{1,2})[:.]?(\d{0,2})\s*(am|pm)?\s*[-–a]\s*(\d{1,2})[:.]?(\d{0,2})\s*(am|pm)?/i);
  if (!m) return 0;
  const to24 = (h, mn, ap) => {
    let hh = parseInt(h, 10);
    if (ap) {
      ap = ap.toLowerCase();
      if (ap === "pm" && hh < 12) hh += 12;
      if (ap === "am" && hh === 12) hh = 0;
    }
    return hh * 60 + parseInt(mn || "0", 10);
  };
  let ini = to24(m[1], m[2], m[3]);
  let fin = to24(m[4], m[5], m[6] || m[3]);
  if (fin <= ini) fin += 1440;
  return Math.max(0, (fin - ini) / 60);
}

function chipHtml(p, c) {
  return `<span class="chip ${p.chipCls}" draggable="true" data-emp="${c.apodo}">${NOMBRES[c.apodo] || c.apodo}</span>`;
}

function activHtml(c, idx, fecha) {
  if (c.actividad === "PENDIENTE") {
    return `<div class="activ" draggable="true" data-emp="${c.apodo}" data-idx="${idx}">PENDIENTE</div>`;
  }
  const sA = (c.actividad || "").replace(/"/g, "&quot;");
  const sN = (c.notas || "").replace(/"/g, "&quot;");
  return `<div class="activ" draggable="true" data-emp="${c.apodo}" data-idx="${idx}" data-fecha="${fecha}"><button class="del-btn" data-action="del">×</button><div class="a-name" data-field="actividad">${sA}</div><div class="a-time" data-field="notas">${sN || "(sin horario)"}</div></div>`;
}

function renderGrid() {
  const tb = document.getElementById("tbody");
  let html = "";
  for (const p of PUESTOS) {
    html += "<tr>";
    html += `<td class="puesto"><span class="puesto-bar" style="background:${p.color}"></span><span class="puesto-nombre">${p.nombre}</span>${p.horario ? `<span class="puesto-horario">${p.horario}</span>` : ""}</td>`;
    for (const dia of DIAS) {
      const cell = HORARIO[p.codigo]?.[dia] || [];
      html += `<td class="cell" data-fecha="${dia}" data-puesto="${p.codigo}">`;
      const cf = concepto(p.codigo, dia);
      if (p.codigo === "EXPERIENCIAS_MAT" || p.codigo === "EXPERIENCIAS_VES") {
        if (cf) {
          const t = [cf.a, cf.u].filter(Boolean).join(" · ");
          html += `<span class="concepto-fijo">📍 ${t}</span>`;
        } else {
          html += `<span class="concepto-fijo libre">— libre / descanso —</span>`;
        }
      }
      if (cell.length === 0 && p.codigo !== "EXPERIENCIAS_MAT" && p.codigo !== "EXPERIENCIAS_VES") {
        html += `<span class="empty">—</span>`;
      } else if (p.codigo === "ANIMACION") {
        for (let i = 0; i < cell.length; i++) html += activHtml(cell[i], i, dia);
        html += `<button class="add-activ-btn" data-action="add" data-fecha="${dia}">+ actividad</button>`;
      } else {
        for (const c of cell) html += chipHtml(p, c);
      }
      html += "</td>";
    }
    html += "</tr>";
  }
  tb.innerHTML = html;
  bindHandlers();
  validate();
  renderResumen();
}

function closeSug() {
  if (activeSug) { activeSug.remove(); activeSug = null; }
}
document.addEventListener("click", e => {
  if (activeSug && !activeSug.contains(e.target) && !e.target.matches(".a-name")) closeSug();
});

function bindHandlers() {
  document.querySelectorAll('[draggable="true"]').forEach(el => {
    el.addEventListener("dragstart", e => {
      e.stopPropagation();
      const td = el.closest("td.cell");
      const items = td.querySelectorAll(".chip, .activ");
      dragData = {
        apodo: el.dataset.emp,
        fromP: td.dataset.puesto,
        fromF: td.dataset.fecha,
        fromI: Array.from(items).indexOf(el),
        type: el.classList.contains("activ") ? "activ" : "chip",
        orig: null
      };
      if (dragData.type === "activ") {
        const arr = HORARIO[dragData.fromP]?.[dragData.fromF] || [];
        dragData.orig = arr[dragData.fromI];
      }
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", el.dataset.emp || "x");
    });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
  });

  document.querySelectorAll("td.cell").forEach(td => {
    td.addEventListener("dragover", e => { e.preventDefault(); td.classList.add("drag-over"); });
    td.addEventListener("dragleave", () => td.classList.remove("drag-over"));
    td.addEventListener("drop", e => {
      e.preventDefault();
      td.classList.remove("drag-over");
      if (!dragData) return;
      const toP = td.dataset.puesto, toF = td.dataset.fecha;
      if (dragData.fromP === toP && dragData.fromF === toF) { dragData = null; return; }
      const fromArr = HORARIO[dragData.fromP]?.[dragData.fromF] || [];
      const moved = fromArr.splice(dragData.fromI, 1)[0];
      if (!moved) { dragData = null; return; }
      if (fromArr.length === 0) delete HORARIO[dragData.fromP][dragData.fromF];
      if (!HORARIO[toP]) HORARIO[toP] = {};
      if (!HORARIO[toP][toF]) HORARIO[toP][toF] = [];
      if (toP === "ANIMACION" && dragData.type !== "activ") {
        HORARIO[toP][toF].push({apodo: moved.apodo, actividad: "Nueva actividad", notas: "00:00-00:00"});
      } else if (toP !== "ANIMACION" && dragData.type === "activ") {
        HORARIO[toP][toF].push({apodo: moved.apodo});
      } else {
        HORARIO[toP][toF].push(moved);
      }
      dragData = null;
      renderGrid();
    });
  });

  document.querySelectorAll(".activ .a-name").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); showSug(el); });
  });
  document.querySelectorAll(".activ .a-name, .activ .a-time").forEach(el => {
    el.addEventListener("blur", () => commitEdit(el));
    el.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); el.blur(); }
      if (e.key === "Escape") { el.contentEditable = "false"; el.blur(); renderGrid(); }
    });
  });
  document.querySelectorAll(".activ .del-btn").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const a = b.closest(".activ");
      const td = a.closest("td.cell");
      const f = td.dataset.fecha;
      const i = Array.from(td.querySelectorAll(".activ")).indexOf(a);
      HORARIO.ANIMACION[f].splice(i, 1);
      if (HORARIO.ANIMACION[f].length === 0) delete HORARIO.ANIMACION[f];
      renderGrid();
    });
  });
  document.querySelectorAll(".add-activ-btn").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      showSug(b, {isNew: true, fecha: b.dataset.fecha});
    });
  });
}

function showSug(target, opts) {
  opts = opts || {};
  closeSug();
  const list = document.createElement("div");
  list.className = "sug-list";
  const r = target.getBoundingClientRect();
  list.style.left = (r.left + scrollX) + "px";
  list.style.top = (r.bottom + 4 + scrollY) + "px";
  list.innerHTML = `<div class="label">Sugerencias</div>` +
    SUG_ANIM.map(s => `<button data-v="${s}">${s}</button>`).join("") +
    `<button data-v="__c__" style="color:var(--accent)">✎ Personalizada…</button>`;
  document.body.appendChild(list);
  activeSug = list;
  list.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      const v = b.dataset.v;
      if (opts.isNew) {
        if (!HORARIO.ANIMACION) HORARIO.ANIMACION = {};
        if (!HORARIO.ANIMACION[opts.fecha]) HORARIO.ANIMACION[opts.fecha] = [];
        HORARIO.ANIMACION[opts.fecha].push({apodo: "JUANA", actividad: v === "__c__" ? "Nueva" : v, notas: "00:00-00:00"});
        closeSug();
        renderGrid();
      } else {
        if (v === "__c__") {
          target.contentEditable = "true";
          target.focus();
          getSelection().selectAllChildren(target);
        } else {
          target.textContent = v;
          commitEdit(target);
        }
        closeSug();
      }
    });
  });
}

function commitEdit(el) {
  el.contentEditable = "false";
  const a = el.closest(".activ");
  if (!a) return;
  const td = a.closest("td.cell");
  const f = td.dataset.fecha;
  const i = Array.from(td.querySelectorAll(".activ")).indexOf(a);
  const field = el.dataset.field;
  let v = el.textContent.trim();
  if (field === "notas" && v === "(sin horario)") v = "";
  if (HORARIO.ANIMACION?.[f]?.[i]) {
    HORARIO.ANIMACION[f][i][field] = v;
    validate();
    renderResumen();
  }
}

function validate() {
  const alerts = [], dayHasIssue = new Set(), chipConflicts = new Set();
  const asig = {};
  for (const p of PUESTOS) {
    const dias = HORARIO[p.codigo] || {};
    for (const f in dias) {
      for (const c of dias[f]) {
        if (!c.apodo) continue;
        asig[c.apodo] = asig[c.apodo] || {};
        asig[c.apodo][f] = asig[c.apodo][f] || [];
        asig[c.apodo][f].push(p.codigo);
      }
    }
  }
  for (const a in asig) {
    const pd = asig[a];
    const diasT = Object.keys(pd).filter(f => pd[f].some(p => p !== "DESCANSO_FRONT"));
    for (const f in pd) {
      const lista = pd[f];
      const sinDup = lista.filter((x, i) => !(x === "ANIMACION" && lista.slice(0, i).includes("ANIMACION")));
      const noA = sinDup.filter(x => x !== "ANIMACION");
      for (let i = 0; i < noA.length; i++) {
        for (let j = i + 1; j < noA.length; j++) {
          const A = INT[noA[i]], B = INT[noA[j]];
          let ov = false;
          if (A && B) ov = A.i < B.f && B.i < A.f;
          if (ov) {
            alerts.push({lv: "error", msg: `<span class="who">${NOMBRES[a] || a}</span> ${pName(noA[i])} + ${pName(noA[j])} ${fmt(f)} (encimados)`});
            dayHasIssue.add(f);
            chipConflicts.add(`${a}|${noA[i]}|${f}`);
            chipConflicts.add(`${a}|${noA[j]}|${f}`);
          } else if (noA[i] !== noA[j]) {
            alerts.push({lv: "warn", msg: `<span class="who">${NOMBRES[a] || a}</span> doble turno ${fmt(f)}`});
            dayHasIssue.add(f);
          }
        }
      }
      const cnt = {};
      noA.forEach(p => cnt[p] = (cnt[p] || 0) + 1);
      for (const p in cnt) {
        if (cnt[p] > 1) {
          alerts.push({lv: "error", msg: `<span class="who">${NOMBRES[a] || a}</span> ${cnt[p]}x en ${pName(p)} ${fmt(f)}`});
          dayHasIssue.add(f);
          chipConflicts.add(`${a}|${p}|${f}`);
        }
      }
    }
    if (diasT.length >= 7) {
      alerts.push({lv: "error", msg: `<span class="who">${NOMBRES[a] || a}</span> trabaja los <strong>7 días</strong> sin descanso`});
    }
  }
  const animDias = new Set();
  for (const f in (HORARIO.ANIMACION || {})) {
    const acts = HORARIO.ANIMACION[f];
    if (acts.length === 0) continue;
    const persona = acts[0].apodo;
    if (!persona) continue;
    animDias.add(`${persona}|${f}`);
    let h = 0;
    for (const x of acts) h += parseHoras(x.notas);
    if (h > 5) {
      alerts.push({lv: "error", msg: `<span class="who">${NOMBRES[persona] || persona}</span> ${fmt(f)}: <strong>${h.toFixed(1)}h</strong> de animación (máx 5)`});
      dayHasIssue.add(f);
    }
  }
  const xpp = {};
  for (const k of animDias) {
    const p = k.split("|")[0];
    xpp[p] = (xpp[p] || 0) + 1;
  }
  for (const p in xpp) {
    if (xpp[p] > 5) {
      alerts.push({lv: "error", msg: `<span class="who">${NOMBRES[p] || p}</span> tiene <strong>${xpp[p]} días</strong> de animación (máx 5)`});
    }
  }
  const ab = document.getElementById("alerts-bar");
  if (alerts.length === 0) {
    ab.innerHTML = `<span class="alert ok">✓ Sin conflictos · turnos válidos</span>`;
  } else {
    ab.innerHTML = alerts.map(x => `<span class="alert ${x.lv}">${x.lv === "error" ? "⚠️" : "⚡"} ${x.msg}</span>`).join("");
  }
  document.querySelectorAll("th.day").forEach(th => th.classList.toggle("has-issue", dayHasIssue.has(th.dataset.fecha)));
  document.querySelectorAll("td.cell").forEach(td => {
    const p = td.dataset.puesto, f = td.dataset.fecha;
    td.querySelectorAll(".chip, .activ").forEach(chip => {
      chip.classList.toggle("conflict", chipConflicts.has(`${chip.dataset.emp}|${p}|${f}`));
    });
  });
}

function renderResumen() {
  const grid = document.getElementById("resumen-grid");
  const apodos = Object.keys(NOMBRES);
  const data = {};
  for (const a of apodos) data[a] = {trab: new Set(), des: new Set(), horas: 0, animDias: new Set()};
  for (const p of PUESTOS) {
    const dias = HORARIO[p.codigo] || {};
    for (const f in dias) {
      for (const c of dias[f]) {
        const a = c.apodo;
        if (!data[a]) continue;
        if (p.codigo === "DESCANSO_FRONT") data[a].des.add(f);
        else data[a].trab.add(f);
        if (p.codigo === "ANIMACION") {
          data[a].horas += parseHoras(c.notas);
          data[a].animDias.add(f);
        } else {
          data[a].horas += p.horas || 0;
        }
      }
    }
  }
  let html = "";
  for (const a of apodos) {
    const d = data[a];
    const noRest = d.trab.size >= 7;
    const animOver = d.animDias.size > 5;
    let badge = "";
    if (noRest) badge = "⚠ sin descanso";
    if (animOver) badge = `⚠ ${d.animDias.size}d anim`;
    html += `<div class="resumen-row${noRest || animOver ? " no-rest" : ""}"><span class="name">${NOMBRES[a]}</span><span class="days">${d.trab.size}t · ${d.des.size}d · ${d.horas.toFixed(0)}h ${badge}</span></div>`;
  }
  grid.innerHTML = html;
}

document.getElementById("reset").addEventListener("click", () => {
  if (!confirm("¿Restaurar?")) return;
  HORARIO = JSON.parse(JSON.stringify(ORIG));
  renderGrid();
});

document.getElementById("export").addEventListener("click", () => {
  const payload = {
    property: "Casa Pepe CDMX",
    semana: "2026-06-15",
    ts: new Date().toISOString(),
    conceptos: {mat: CONCEPTO_MAT, ves: CONCEPTO_VES},
    horario: HORARIO
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "horario-casa-pepe-cdmx.json";
  a.click();
});

renderGrid();
