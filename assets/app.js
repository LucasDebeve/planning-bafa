/* Planning BAFA — application 100 % statique (aucune donnée envoyée à un serveur). */
'use strict';

const STORAGE_KEY = 'planning-bafa:v1';
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/* ---------- Utilitaires ---------- */

const $ = (sel, root = document) => root.querySelector(sel);

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) node.style.setProperty(prop, val);
    }
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(iso, n) {
  const d = parseISODate(iso);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

const fmtDayLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtFull = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function formatDate(iso, formatter = fmtDayLong) {
  const d = parseISODate(iso);
  return d ? formatter.format(d) : '';
}

function minutesOf(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function slotMinutes(slot) {
  let diff = minutesOf(slot.end) - minutesOf(slot.start);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatHours(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

function initials(name) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = el('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function slugify(s) {
  return (s || 'planning')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'planning';
}

/* ---------- Modèle de données ---------- */

function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return toISODate(d);
}

function defaultName(type, start) {
  return `${FORMATIONS[type].short} — session du ${formatDate(start, fmtFull)}`;
}

function createPlanning(type = 'bafa1', start = nextMonday(), withTemplate = true) {
  const p = {
    id: uid(),
    name: defaultName(type, start),
    type,
    theme: '',
    organisme: '',
    lieu: '',
    start,
    days: [],
    slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
    team: [],
    cells: {},
    updated: Date.now(),
  };
  resizeDays(p, FORMATIONS[type].days);
  if (withTemplate) applyTemplate(p);
  return p;
}

function resizeDays(p, count) {
  while (p.days.length < count) {
    const prev = p.days[p.days.length - 1];
    p.days.push({ date: prev ? addDays(prev.date, 1) : p.start });
  }
  if (p.days.length > count) {
    for (let i = count; i < p.days.length; i++) {
      for (const s of p.slots) delete p.cells[cellKey(i, s.id)];
    }
    p.days.length = count;
  }
}

function applyTemplate(p) {
  p.cells = {};
  for (const [day, slotId, title, cat] of TEMPLATES[p.type]) {
    if (day >= p.days.length || !p.slots.some((s) => s.id === slotId)) continue;
    const key = cellKey(day, slotId);
    (p.cells[key] ||= []).push(newActivity({ title, cat }));
  }
}

function newActivity(base = {}) {
  return {
    id: uid(),
    title: base.title || '',
    cat: CAT_BY_ID[base.cat] ? base.cat : 'pratique',
    team: base.team ? [...base.team] : [],
    duration: base.duration || null,
    place: base.place || '',
    notes: base.notes || '',
  };
}

function cellKey(day, slotId) {
  return `${day}|${slotId}`;
}

function dayHasContent(p, dayIdx) {
  return p.slots.some((s) => (p.cells[cellKey(dayIdx, s.id)] || []).length);
}

/* Durée effective d'une séquence : durée saisie, sinon part égale du temps restant du créneau. */
function activityMinutes(p, slot, list, act) {
  if (act.duration) return Number(act.duration);
  const fixed = list.reduce((sum, a) => sum + (a.duration ? Number(a.duration) : 0), 0);
  const auto = list.filter((a) => !a.duration).length;
  return Math.max(0, slotMinutes(slot) - fixed) / (auto || 1);
}

/* Normalise un planning importé (fichier, lien) pour éviter les données incohérentes. */
function sanitizePlanning(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Format invalide');
  const type = FORMATIONS[raw.type] ? raw.type : 'bafa1';
  const p = createPlanning(type, raw.start || nextMonday(), false);
  p.name = String(raw.name || p.name);
  p.theme = String(raw.theme || '');
  p.organisme = String(raw.organisme || '');
  p.lieu = String(raw.lieu || '');
  if (Array.isArray(raw.slots) && raw.slots.length) {
    p.slots = raw.slots.map((s) => ({
      id: String(s.id || uid()),
      label: String(s.label || 'Créneau'),
      start: /^\d\d:\d\d$/.test(s.start) ? s.start : '09:00',
      end: /^\d\d:\d\d$/.test(s.end) ? s.end : '12:00',
    }));
  }
  if (Array.isArray(raw.days)) {
    p.days = raw.days.slice(0, FORMATIONS[type].days).map((d, i) => ({
      date: parseISODate(d && d.date) ? d.date : addDays(p.start, i),
    }));
    resizeDays(p, FORMATIONS[type].days);
  }
  if (Array.isArray(raw.team)) {
    p.team = raw.team
      .filter((m) => m && m.name)
      .map((m) => ({ id: String(m.id || uid()), name: String(m.name), role: String(m.role || '') }));
  }
  const teamIds = new Set(p.team.map((m) => m.id));
  if (raw.cells && typeof raw.cells === 'object') {
    for (const [key, list] of Object.entries(raw.cells)) {
      if (!Array.isArray(list)) continue;
      const [day, slotId] = key.split('|');
      if (!(Number(day) < p.days.length) || !p.slots.some((s) => s.id === slotId)) continue;
      p.cells[key] = list.map((a) => {
        const act = newActivity({ ...a, title: String(a.title || 'Séquence') });
        act.team = (Array.isArray(a.team) ? a.team : []).map(String).filter((id) => teamIds.has(id));
        act.duration = Number(a.duration) > 0 ? Number(a.duration) : null;
        act.place = String(a.place || '');
        act.notes = String(a.notes || '');
        return act;
      });
    }
  }
  return p;
}

/* ---------- Persistance ---------- */

let store = loadStore();

function loadStore() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    data = null;
  }
  if (!data || !data.plannings || !Object.keys(data.plannings).length) {
    const p = createPlanning();
    data = { currentId: p.id, plannings: { [p.id]: p }, library: [] };
  }
  if (!data.plannings[data.currentId]) data.currentId = Object.keys(data.plannings)[0];
  data.library ||= [];
  return data;
}

let saveTimer;
function save() {
  current().updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      toast('Impossible d\'enregistrer localement (stockage indisponible).');
    }
  }, 150);
}

function current() {
  return store.plannings[store.currentId];
}

function library() {
  return [
    ...DEFAULT_LIBRARY.map((x, i) => ({ ...x, key: `d${i}`, custom: false })),
    ...store.library.map((x) => ({ ...x, key: x.id, custom: true })),
  ];
}

function commit() {
  save();
  render();
}

/* ---------- Rendu ---------- */

function render() {
  renderPlanningSelect();
  renderSettings();
  renderTeam();
  renderSlots();
  renderLibrary();
  renderLegend();
  renderGrid();
  renderSummary();
  renderPrintHeader();
}

function renderPlanningSelect() {
  const sel = $('#planning-select');
  sel.replaceChildren(
    ...Object.values(store.plannings)
      .sort((a, b) => (b.updated || 0) - (a.updated || 0))
      .map((p) => el('option', { value: p.id, selected: p.id === store.currentId }, p.name || 'Sans titre')),
  );
  $('#btn-delete').disabled = Object.keys(store.plannings).length < 2;
}

function renderSettings() {
  const p = current();
  const setVal = (id, v) => {
    const input = $(id);
    if (document.activeElement !== input) input.value = v;
  };
  setVal('#f-name', p.name);
  setVal('#f-theme', p.theme);
  setVal('#f-start', p.start);
  setVal('#f-org', p.organisme);
  setVal('#f-place', p.lieu);
  for (const r of document.querySelectorAll('#f-type input')) r.checked = r.value === p.type;
  $('#f-theme-wrap').hidden = p.type !== 'bafa3';
}

function renderTeam() {
  const p = current();
  const list = $('#team-list');
  if (!p.team.length) {
    list.replaceChildren(el('li', { class: 'empty' }, 'Aucun membre pour l\'instant.'));
    return;
  }
  list.replaceChildren(
    ...p.team.map((m) =>
      el(
        'li',
        { class: 'chip' },
        el('span', { class: 'avatar' }, initials(m.name)),
        el('span', { class: 'chip-text' }, el('strong', {}, m.name), m.role ? el('small', {}, m.role) : null),
        el(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            title: `Retirer ${m.name}`,
            'aria-label': `Retirer ${m.name}`,
            onclick: () => {
              p.team = p.team.filter((x) => x.id !== m.id);
              for (const acts of Object.values(p.cells)) {
                for (const a of acts) a.team = a.team.filter((id) => id !== m.id);
              }
              commit();
            },
          },
          '×',
        ),
      ),
    ),
  );
}

function renderSlots() {
  const p = current();
  $('#slot-list').replaceChildren(
    ...p.slots.map((s, i) =>
      el(
        'li',
        { class: 'slot-item' },
        el('input', {
          type: 'text',
          value: s.label,
          'aria-label': 'Nom du créneau',
          onchange: (e) => {
            s.label = e.target.value.trim() || 'Créneau';
            commit();
          },
        }),
        el('input', {
          type: 'time',
          value: s.start,
          'aria-label': 'Début',
          onchange: (e) => {
            s.start = e.target.value || s.start;
            commit();
          },
        }),
        el('input', {
          type: 'time',
          value: s.end,
          'aria-label': 'Fin',
          onchange: (e) => {
            s.end = e.target.value || s.end;
            commit();
          },
        }),
        el(
          'span',
          { class: 'slot-buttons' },
          el('button', {
            type: 'button',
            class: 'icon-btn',
            title: 'Monter',
            'aria-label': 'Monter',
            disabled: i === 0,
            onclick: () => {
              [p.slots[i - 1], p.slots[i]] = [p.slots[i], p.slots[i - 1]];
              commit();
            },
          }, '↑'),
          el('button', {
            type: 'button',
            class: 'icon-btn',
            title: 'Supprimer le créneau',
            'aria-label': 'Supprimer le créneau',
            disabled: p.slots.length < 2,
            onclick: () => {
              const used = p.days.some((_, d) => (p.cells[cellKey(d, s.id)] || []).length);
              if (used && !confirm(`Supprimer le créneau « ${s.label} » et toutes ses séquences ?`)) return;
              p.slots.splice(i, 1);
              p.days.forEach((_, d) => delete p.cells[cellKey(d, s.id)]);
              commit();
            },
          }, '×'),
        ),
      ),
    ),
  );
}

function renderLibrary() {
  const q = $('#lib-search').value.trim().toLowerCase();
  const items = library().filter((x) => !q || x.title.toLowerCase().includes(q));
  const groups = CATEGORIES.map((c) => ({ cat: c, items: items.filter((x) => x.cat === c.id) })).filter(
    (g) => g.items.length,
  );
  const root = $('#library');
  if (!groups.length) {
    root.replaceChildren(el('p', { class: 'empty' }, 'Aucune séquence trouvée.'));
    return;
  }
  root.replaceChildren(
    ...groups.map((g) =>
      el(
        'div',
        { class: 'lib-group' },
        el('h3', { style: { '--cat': g.cat.color } }, g.cat.name),
        ...g.items.map((item) =>
          el(
            'div',
            {
              class: 'lib-item',
              draggable: 'true',
              style: { '--cat': g.cat.color },
              ondragstart: (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'lib', title: item.title, cat: item.cat }));
                e.dataTransfer.effectAllowed = 'copy';
              },
            },
            el('span', {}, item.title),
            item.custom
              ? el('button', {
                  type: 'button',
                  class: 'icon-btn',
                  title: 'Retirer de la bibliothèque',
                  'aria-label': 'Retirer de la bibliothèque',
                  onclick: () => {
                    store.library = store.library.filter((x) => x.id !== item.key);
                    commit();
                  },
                }, '×')
              : null,
          ),
        ),
      ),
    ),
  );
}

function renderLegend() {
  $('#legend').replaceChildren(
    ...CATEGORIES.map((c) => el('span', { class: 'legend-item', style: { '--cat': c.color } }, c.name)),
  );
}

function renderGrid() {
  const p = current();
  const grid = $('#grid');
  const head = el(
    'tr',
    {},
    el('th', { class: 'corner', scope: 'col' }, FORMATIONS[p.type].short),
    ...p.days.map((d, i) =>
      el(
        'th',
        { scope: 'col', class: 'day-head' },
        el('span', { class: 'day-num' }, `Jour ${i + 1}`),
        el('input', {
          type: 'date',
          class: 'day-date no-print',
          value: d.date,
          'aria-label': `Date du jour ${i + 1}`,
          onchange: (e) => {
            if (!e.target.value) return;
            d.date = e.target.value;
            if (i === 0) p.start = d.date;
            commit();
          },
        }),
        el('span', { class: 'day-label' }, formatDate(d.date)),
      ),
    ),
  );

  const rows = p.slots.map((slot) =>
    el(
      'tr',
      {},
      el(
        'th',
        { scope: 'row', class: 'slot-head' },
        el('strong', {}, slot.label),
        el('small', {}, `${slot.start} – ${slot.end}`),
      ),
      ...p.days.map((_, dayIdx) => renderCell(p, dayIdx, slot)),
    ),
  );

  grid.replaceChildren(el('thead', {}, head), el('tbody', {}, rows));
}

function renderCell(p, dayIdx, slot) {
  const key = cellKey(dayIdx, slot.id);
  const list = p.cells[key] || [];
  const td = el('td', { class: 'cell', dataset: { key } });

  for (const act of list) {
    const cat = CAT_BY_ID[act.cat] || CATEGORIES[0];
    const members = act.team.map((id) => p.team.find((m) => m.id === id)).filter(Boolean);
    const card = el(
      'button',
      {
        type: 'button',
        class: 'card',
        draggable: 'true',
        style: { '--cat': cat.color },
        dataset: { id: act.id },
        title: act.notes || act.title,
        onclick: () => openActivityDialog(key, act.id),
        ondragstart: (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'card', from: key, id: act.id }));
          e.dataTransfer.effectAllowed = 'copyMove';
          card.classList.add('dragging');
        },
        ondragend: () => card.classList.remove('dragging'),
      },
      el('span', { class: 'card-title' }, act.title),
      el(
        'span',
        { class: 'card-meta' },
        el('span', {}, formatHours(activityMinutes(p, slot, list, act))),
        act.place ? el('span', {}, `· ${act.place}`) : null,
        members.length
          ? el(
              'span',
              { class: 'card-team' },
              ...members.map((m) => el('span', { class: 'avatar avatar-sm', title: m.name }, initials(m.name))),
            )
          : null,
      ),
    );
    td.append(card);
  }

  td.append(
    el(
      'button',
      {
        type: 'button',
        class: 'add-btn no-print',
        'aria-label': `Ajouter une séquence — jour ${dayIdx + 1}, ${slot.label}`,
        onclick: () => openActivityDialog(key, null),
      },
      '＋',
    ),
  );

  td.addEventListener('dragover', (e) => {
    e.preventDefault();
    const copyOnly = e.dataTransfer.effectAllowed === 'copy';
    e.dataTransfer.dropEffect = copyOnly || e.ctrlKey || e.altKey ? 'copy' : 'move';
    td.classList.add('drop-target');
  });
  td.addEventListener('dragleave', (e) => {
    if (!td.contains(e.relatedTarget)) td.classList.remove('drop-target');
  });
  td.addEventListener('drop', (e) => {
    e.preventDefault();
    td.classList.remove('drop-target');
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch (err) {
      return;
    }
    const beforeCard = e.target.closest('.card');
    handleDrop(payload, key, beforeCard ? beforeCard.dataset.id : null, e.ctrlKey || e.altKey);
  });
  return td;
}

function handleDrop(payload, toKey, beforeId, copy) {
  const p = current();
  let act;
  if (payload.kind === 'lib') {
    act = newActivity({ title: payload.title, cat: payload.cat });
  } else if (payload.kind === 'card') {
    const from = p.cells[payload.from] || [];
    const idx = from.findIndex((a) => a.id === payload.id);
    if (idx < 0) return;
    if (payload.id === beforeId) return;
    if (copy) {
      act = { ...from[idx], id: uid(), team: [...from[idx].team] };
    } else {
      [act] = from.splice(idx, 1);
      if (!from.length) delete p.cells[payload.from];
    }
  } else {
    return;
  }
  const target = (p.cells[toKey] ||= []);
  const pos = beforeId ? target.findIndex((a) => a.id === beforeId) : -1;
  if (pos >= 0) target.splice(pos, 0, act);
  else target.push(act);
  commit();
}

function renderSummary() {
  const p = current();
  const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  const byMember = Object.fromEntries(p.team.map((m) => [m.id, 0]));
  let total = 0;
  let count = 0;
  let emptySlots = 0;

  p.days.forEach((_, d) => {
    for (const slot of p.slots) {
      const list = p.cells[cellKey(d, slot.id)] || [];
      if (!list.length) emptySlots++;
      for (const act of list) {
        const min = activityMinutes(p, slot, list, act);
        count++;
        total += min;
        byCat[act.cat] = (byCat[act.cat] || 0) + min;
        for (const id of act.team) if (id in byMember) byMember[id] += min;
      }
    }
  });

  const first = p.days[0] && p.days[0].date;
  const last = p.days[p.days.length - 1] && p.days[p.days.length - 1].date;
  const maxCat = Math.max(1, ...Object.values(byCat));
  const maxMember = Math.max(1, ...Object.values(byMember));

  const bar = (label, value, max, color) =>
    el(
      'div',
      { class: 'bar-row' },
      el('span', { class: 'bar-label' }, label),
      el('span', { class: 'bar-track' }, el('span', { class: 'bar', style: { width: `${(value / max) * 100}%`, '--cat': color } })),
      el('span', { class: 'bar-value' }, formatHours(value)),
    );

  $('#summary').replaceChildren(
    el(
      'div',
      { class: 'stats' },
      stat('Durée', `${p.days.length} jours`, FORMATIONS[p.type].label),
      stat('Dates', first ? `${formatDate(first, fmtDayShort)} → ${formatDate(last, fmtDayShort)}` : '—', p.lieu || 'Lieu à préciser'),
      stat('Volume programmé', formatHours(total), `${count} séquence${count > 1 ? 's' : ''}`),
      stat('Créneaux vides', String(emptySlots), emptySlots ? 'à compléter' : 'planning complet'),
    ),
    el(
      'div',
      { class: 'summary-cols' },
      el(
        'div',
        { class: 'summary-block' },
        el('h3', {}, 'Répartition par catégorie'),
        ...CATEGORIES.filter((c) => byCat[c.id]).map((c) => bar(c.name, byCat[c.id], maxCat, c.color)),
        total ? null : el('p', { class: 'empty' }, 'Aucune séquence programmée.'),
      ),
      el(
        'div',
        { class: 'summary-block' },
        el('h3', {}, 'Temps d\'intervention par formateur·rice'),
        ...p.team.map((m) => bar(m.name, byMember[m.id], maxMember, 'var(--accent)')),
        p.team.length ? null : el('p', { class: 'empty' }, 'Ajoutez l\'équipe pour suivre la répartition.'),
      ),
    ),
  );
}

function stat(label, value, sub) {
  return el('div', { class: 'stat' }, el('span', { class: 'stat-label' }, label), el('strong', {}, value), el('small', {}, sub));
}

function renderPrintHeader() {
  const p = current();
  const first = p.days[0] && p.days[0].date;
  const last = p.days[p.days.length - 1] && p.days[p.days.length - 1].date;
  const info = [
    FORMATIONS[p.type].label + (p.type === 'bafa3' && p.theme ? ` — ${p.theme}` : ''),
    first ? `du ${formatDate(first, fmtFull)} au ${formatDate(last, fmtFull)}` : '',
    p.lieu,
    p.organisme,
  ].filter(Boolean);
  $('#print-header').replaceChildren(
    el('h1', {}, p.name),
    el('p', {}, info.join(' · ')),
    p.team.length ? el('p', {}, 'Équipe : ' + p.team.map((m) => m.name + (m.role ? ` (${m.role})` : '')).join(', ')) : null,
  );
}

/* ---------- Dialogue séquence ---------- */

let editing = null; // { key, id }

function fillCategorySelect(select) {
  select.replaceChildren(...CATEGORIES.map((c) => el('option', { value: c.id }, c.name)));
}

function openActivityDialog(key, id) {
  const p = current();
  const [day, slotId] = key.split('|');
  const slot = p.slots.find((s) => s.id === slotId);
  const act = id ? (p.cells[key] || []).find((a) => a.id === id) : null;
  editing = { key, id };

  $('#activity-dialog-title').textContent = act ? 'Modifier la séquence' : 'Nouvelle séquence';
  $('#activity-dialog-sub').textContent = `Jour ${Number(day) + 1} · ${formatDate(p.days[day].date)} · ${slot.label} (${slot.start} – ${slot.end})`;

  const fromLib = $('#act-from-lib');
  $('#act-from-lib-wrap').hidden = !!act;
  fromLib.replaceChildren(
    el('option', { value: '' }, '— Séquence personnalisée —'),
    ...CATEGORIES.map((c) =>
      el(
        'optgroup',
        { label: c.name },
        ...library()
          .filter((x) => x.cat === c.id)
          .map((x) => el('option', { value: x.key }, x.title)),
      ),
    ),
  );

  $('#act-title').value = act ? act.title : '';
  $('#act-cat').value = act ? act.cat : 'pratique';
  $('#act-duration').value = act && act.duration ? act.duration : '';
  $('#act-place').value = act ? act.place : '';
  $('#act-notes').value = act ? act.notes : '';
  $('#act-save-lib').checked = false;
  $('#act-delete').hidden = !act;

  const teamBox = $('#act-team');
  teamBox.replaceChildren(
    ...(p.team.length
      ? p.team.map((m) =>
          el(
            'label',
            { class: 'check' },
            el('input', { type: 'checkbox', value: m.id, checked: act ? act.team.includes(m.id) : false }),
            el('span', {}, m.name),
          ),
        )
      : [el('p', { class: 'empty' }, 'Ajoutez des membres dans « Équipe de formation ».')]),
  );

  $('#activity-dialog').showModal();
  (act ? $('#act-title') : fromLib).focus();
}

function saveActivityFromDialog() {
  const p = current();
  const { key, id } = editing;
  const list = (p.cells[key] ||= []);
  let act = id ? list.find((a) => a.id === id) : null;
  if (!act) {
    act = newActivity();
    list.push(act);
  }
  act.title = $('#act-title').value.trim() || 'Séquence';
  act.cat = $('#act-cat').value;
  const dur = Number($('#act-duration').value);
  act.duration = dur > 0 ? dur : null;
  act.place = $('#act-place').value.trim();
  act.notes = $('#act-notes').value.trim();
  act.team = [...document.querySelectorAll('#act-team input:checked')].map((i) => i.value);

  if ($('#act-save-lib').checked && !library().some((x) => x.title === act.title && x.cat === act.cat)) {
    store.library.push({ id: uid(), title: act.title, cat: act.cat });
  }
  commit();
}

/* ---------- Partage par lien ---------- */

function bytesToBase64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

async function encodePlanning(p) {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  if ('CompressionStream' in window) return 'z' + bytesToBase64url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return 'j' + bytesToBase64url(bytes);
}

async function decodePlanning(s) {
  let bytes = base64urlToBytes(s.slice(1));
  if (s[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function sharePlanning() {
  const url = `${location.origin}${location.pathname}#p=${await encodePlanning(current())}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Lien copié : il contient tout le planning.');
  } catch (e) {
    prompt('Copiez ce lien :', url);
  }
}

async function importFromHash() {
  const m = location.hash.match(/^#p=(.+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const p = sanitizePlanning(await decodePlanning(m[1]));
    if (!confirm(`Importer le planning partagé « ${p.name} » ?`)) return;
    addPlanning(p);
    toast('Planning importé.');
  } catch (e) {
    toast('Lien de partage invalide.');
  }
}

function addPlanning(p) {
  store.plannings[p.id] = p;
  store.currentId = p.id;
  commit();
}

/* ---------- Export agenda (.ics) ---------- */

function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function icsFold(line) {
  const parts = [];
  while (line.length > 74) {
    parts.push(line.slice(0, 74));
    line = ' ' + line.slice(74);
  }
  parts.push(line);
  return parts.join('\r\n');
}

function icsDate(iso, minutes) {
  const d = parseISODate(iso);
  d.setMinutes(minutes);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function exportICS() {
  const p = current();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planning BAFA//FR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsEscape(p.name)}`];
  p.days.forEach((day, d) => {
    for (const slot of p.slots) {
      const list = p.cells[cellKey(d, slot.id)] || [];
      let cursor = minutesOf(slot.start);
      for (const act of list) {
        const dur = activityMinutes(p, slot, list, act);
        const members = act.team.map((id) => (p.team.find((m) => m.id === id) || {}).name).filter(Boolean);
        const desc = [CAT_BY_ID[act.cat].name, members.length ? `Équipe : ${members.join(', ')}` : '', act.notes]
          .filter(Boolean)
          .join('\n');
        lines.push(
          'BEGIN:VEVENT',
          `UID:${act.id}@planning-bafa`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${icsDate(day.date, cursor)}`,
          `DTEND:${icsDate(day.date, cursor + dur)}`,
          `SUMMARY:${icsEscape(act.title)}`,
          `DESCRIPTION:${icsEscape(desc)}`,
          `CATEGORIES:${icsEscape(CAT_BY_ID[act.cat].name)}`,
        );
        if (act.place || p.lieu) lines.push(`LOCATION:${icsEscape(act.place || p.lieu)}`);
        lines.push('END:VEVENT');
        cursor += dur;
      }
    }
  });
  lines.push('END:VCALENDAR');
  download(`${slugify(p.name)}.ics`, lines.map(icsFold).join('\r\n') + '\r\n', 'text/calendar');
}

/* ---------- Événements ---------- */

function bindEvents() {
  $('#planning-select').addEventListener('change', (e) => {
    store.currentId = e.target.value;
    commit();
  });

  $('#btn-new').addEventListener('click', () => {
    $('#new-start').value = nextMonday();
    $('#new-dialog').showModal();
  });
  $('#new-cancel').addEventListener('click', () => $('#new-dialog').close());
  $('#new-form').addEventListener('submit', () => {
    const type = $('#new-form').querySelector('input[name="newtype"]:checked').value;
    addPlanning(createPlanning(type, $('#new-start').value || nextMonday(), $('#new-template').checked));
    toast('Nouveau planning créé.');
  });

  $('#btn-duplicate').addEventListener('click', () => {
    const copy = structuredClone(current());
    copy.id = uid();
    copy.name = `${copy.name} (copie)`;
    addPlanning(copy);
    toast('Planning dupliqué.');
  });

  $('#btn-delete').addEventListener('click', () => {
    const p = current();
    if (Object.keys(store.plannings).length < 2) return;
    if (!confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
    delete store.plannings[p.id];
    store.currentId = Object.keys(store.plannings)[0];
    commit();
  });

  const bindText = (sel, prop) =>
    $(sel).addEventListener('input', (e) => {
      current()[prop] = e.target.value;
      save();
      renderPlanningSelect();
      renderSummary();
      renderPrintHeader();
    });
  bindText('#f-name', 'name');
  bindText('#f-theme', 'theme');
  bindText('#f-org', 'organisme');
  bindText('#f-place', 'lieu');

  $('#f-start').addEventListener('change', (e) => {
    const p = current();
    if (!e.target.value) return;
    const autoName = p.name === defaultName(p.type, p.start);
    p.start = e.target.value;
    if (autoName) p.name = defaultName(p.type, p.start);
    p.days.forEach((d, i) => (d.date = addDays(p.start, i)));
    commit();
  });

  $('#f-type').addEventListener('change', (e) => {
    const p = current();
    const type = e.target.value;
    const count = FORMATIONS[type].days;
    const lost = p.days.slice(count).some((_, i) => dayHasContent(p, count + i));
    if (lost && !confirm(`Passer en ${FORMATIONS[type].short} supprimera les jours ${count + 1} à ${p.days.length} et leurs séquences. Continuer ?`)) {
      renderSettings();
      return;
    }
    if (p.name === defaultName(p.type, p.start)) p.name = defaultName(type, p.start);
    p.type = type;
    resizeDays(p, count);
    commit();
  });

  $('#team-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#team-name').value.trim();
    if (!name) return;
    current().team.push({ id: uid(), name, role: $('#team-role').value.trim() });
    $('#team-name').value = '';
    $('#team-role').value = '';
    commit();
    $('#team-name').focus();
  });

  $('#btn-add-slot').addEventListener('click', () => {
    const p = current();
    const last = p.slots[p.slots.length - 1];
    const start = last ? last.end : '09:00';
    const endMin = Math.min(minutesOf(start) + 60, 23 * 60 + 59);
    const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    p.slots.push({ id: uid(), label: 'Nouveau créneau', start, end });
    commit();
  });

  $('#lib-search').addEventListener('input', renderLibrary);

  $('#btn-add-lib').addEventListener('click', () => {
    $('#lib-title').value = '';
    $('#lib-cat').value = 'pratique';
    $('#lib-dialog').showModal();
  });
  $('#lib-cancel').addEventListener('click', () => $('#lib-dialog').close());
  $('#lib-form').addEventListener('submit', () => {
    const title = $('#lib-title').value.trim();
    if (!title) return;
    store.library.push({ id: uid(), title, cat: $('#lib-cat').value });
    commit();
  });

  $('#act-from-lib').addEventListener('change', (e) => {
    const item = library().find((x) => x.key === e.target.value);
    if (!item) return;
    $('#act-title').value = item.title;
    $('#act-cat').value = item.cat;
  });
  $('#act-cancel').addEventListener('click', () => $('#activity-dialog').close());
  $('#act-delete').addEventListener('click', () => {
    const p = current();
    const { key, id } = editing;
    p.cells[key] = (p.cells[key] || []).filter((a) => a.id !== id);
    if (!p.cells[key].length) delete p.cells[key];
    $('#activity-dialog').close();
    commit();
  });
  $('#activity-form').addEventListener('submit', saveActivityFromDialog);

  $('#btn-template').addEventListener('click', () => {
    const p = current();
    if (Object.keys(p.cells).length && !confirm('Remplacer le contenu actuel par le planning type ?')) return;
    applyTemplate(p);
    commit();
  });
  $('#btn-clear').addEventListener('click', () => {
    if (!confirm('Vider toutes les séquences de ce planning ?')) return;
    current().cells = {};
    commit();
  });

  $('#btn-print').addEventListener('click', () => window.print());
  $('#btn-ics').addEventListener('click', exportICS);
  $('#btn-share').addEventListener('click', sharePlanning);

  $('#btn-export').addEventListener('click', () => {
    const p = current();
    download(`${slugify(p.name)}.json`, JSON.stringify({ app: 'planning-bafa', version: 1, planning: p }, null, 2), 'application/json');
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      addPlanning(sanitizePlanning(data.planning || data));
      toast('Planning importé.');
    } catch (err) {
      toast('Fichier invalide : impossible d\'importer ce planning.');
    }
  });

  window.addEventListener('hashchange', importFromHash);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      store = loadStore();
      render();
    }
  });
}

/* ---------- Démarrage ---------- */

fillCategorySelect($('#act-cat'));
fillCategorySelect($('#lib-cat'));
bindEvents();
render();
importFromHash();
