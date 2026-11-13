/* The chart types, drawn into a host element styled by runtime/fig.css. Figures use them through runtime/fig.js. */
import * as Plot from '@observablehq/plot';
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Each item: { value, text (the printed number), show?, label (HTML), tone?, note? }. */
const shown = (x, unit) => x.show ?? x.text + (unit ?? '');

/** Parts of a whole into a <fig-split>. Labels too wide for their segment move to a line under the bar. */
export function drawSplit(host, parts, unit) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  host.innerHTML = '';
  const bar = Object.assign(document.createElement('div'), { className: 'fs-bar' });
  const rest = Object.assign(document.createElement('div'), { className: 'fs-rest' });
  host.append(bar, rest);
  const segs = parts.map((p) => {
    const seg = document.createElement('div');
    seg.className = 'fs-seg' + (p.tone ? ' ' + p.tone : '');
    seg.style.flex = `${p.value / total} 1 0`;
    seg.innerHTML = `<b>${esc(shown(p, unit))}</b><span>${p.label}</span>`;
    bar.appendChild(seg);
    return { p, seg };
  });
  const outs = segs.filter((s) => s.seg.scrollWidth > s.seg.clientWidth + 1);
  if (!outs.length) { rest.remove(); return; }
  const hostBox = host.getBoundingClientRect();
  for (const o of outs) {
    o.seg.classList.add('fs-out');
    o.item = document.createElement('span');
    o.item.innerHTML = `<b>${esc(shown(o.p, unit))}</b> ${o.p.label}`;
    o.item.style.cssText = 'position: absolute; white-space: nowrap;';
    rest.appendChild(o.item);
  }
  const W = hostBox.width, GAP = 22;
  for (const o of outs) { const r = o.seg.getBoundingClientRect(); o.cx = r.left - hostBox.left + r.width / 2; o.w = o.item.offsetWidth; }
  const line = getComputedStyle(host).getPropertyValue('--line').trim();
  const paths = [];
  let height;
  // One line unless a label, pushed apart from its neighbours and kept inside the bar, would sit under another small
  // segment and read as its label; then one label per line beside them, if there is room on a side.
  for (const o of outs) o.x = Math.max(0, Math.min(W - o.w, o.cx - o.w / 2));
  for (let i = 1; i < outs.length; i++) outs[i].x = Math.max(outs[i].x, outs[i - 1].x + outs[i - 1].w + GAP);
  for (let i = outs.length - 1; i >= 0; i--) { const cap = i === outs.length - 1 ? W - outs[i].w : outs[i + 1].x - GAP - outs[i].w; outs[i].x = Math.min(outs[i].x, cap); }
  const PAD = 28, widest = Math.max(...outs.map((o) => o.w));
  const minCx = Math.min(...outs.map((o) => o.cx)), maxCx = Math.max(...outs.map((o) => o.cx));
  const side = minCx - PAD >= widest ? 'left' : W - maxCx - PAD >= widest ? 'right' : null;
  const misleading = outs.some((o) => outs.some((q) => q !== o && q.cx > o.x && q.cx < o.x + o.w));
  if (!misleading || !side) {
    const DROP = 26;
    for (const o of outs) {
      o.y = DROP;
      const tx = Math.max(o.x + 8, Math.min(o.x + o.w - 8, o.cx));
      paths.push(`M${o.cx},-8 V${DROP / 2 - 4} H${tx} V${DROP - 3}`);
    }
    height = DROP + outs[0].item.offsetHeight;
  } else {
    // Each label joined to its segment by an elbow; rows nearest the labels come first, so no line crosses another.
    const TOP = 14, ROW = outs[0].item.offsetHeight + 8;
    const left = side === 'left';
    const rows = [...outs].sort((p, q) => (left ? p.cx - q.cx : q.cx - p.cx));
    rows.forEach((o, i) => {
      o.y = TOP + i * ROW;
      const mid = o.y + o.item.offsetHeight / 2;
      if (left) { const end = minCx - PAD; o.right = W - end; paths.push(`M${o.cx},-8 V${mid} H${end + 6}`); }
      else { const start = maxCx + PAD; o.x = start; paths.push(`M${o.cx},-8 V${mid} H${start - 6}`); }
    });
    height = TOP + rows.length * ROW - 8;
  }
  rest.style.cssText = `position: relative; display: block; height: ${height}px;`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', height);
  svg.setAttribute('style', 'position:absolute;left:0;top:0;overflow:visible');
  rest.appendChild(svg);
  for (const o of outs) o.item.style.cssText = `position: absolute; ${o.right === undefined ? `left: ${o.x}` : `right: ${o.right}`}px; top: ${o.y}px; white-space: nowrap;`;
  for (const d of paths) {
    const path = document.createElementNS(NS, 'path');
    for (const [k, v] of Object.entries({ d, fill: 'none', stroke: line, 'stroke-width': 1.5 })) path.setAttribute(k, v);
    svg.appendChild(path);
  }
}

/** A few numbers compared into a <fig-bars>, on an axis from zero to max (default: the largest value). */
export function drawBars(host, bars, unit, max) {
  const top = max ?? Math.max(...bars.map((b) => b.value));
  host.innerHTML = '';
  const fills = bars.map((b) => {
    const label = Object.assign(document.createElement('div'), { className: 'fb-label', innerHTML: b.label });
    const track = Object.assign(document.createElement('div'), { className: 'fb-track' });
    const tone = b.tone ? ' ' + b.tone : '';
    track.innerHTML = `<div class="fb-bar${tone}"></div><div class="fb-val${b.tone ? ' lead ' + b.tone : ''}">${esc(shown(b, unit))}${b.note ? `<span class="fb-sub">${esc(b.note)}</span>` : ''}</div>`;
    host.append(label, track);
    return { bar: track.firstChild, ratio: top > 0 ? Math.max(0, b.value) / top : 0 };
  });
  // The longest bar leaves room for the widest value and note, so no label runs past the edge.
  const room = Math.max(...[...host.querySelectorAll('.fb-val')].map((v) => v.offsetWidth)) + 12;
  for (const f of fills) f.bar.style.width = `calc((100% - ${room}px) * ${f.ratio})`;
}

const ARROW = '<svg width="56" height="24" viewBox="0 0 56 24" aria-hidden="true"><path d="M2 12 H48 M38 3 L50 12 L38 21" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** One measure before and after into a <fig-change>: two numbers, each over a bar on one shared scale. */
export function drawChange(host, spec) {
  const top = spec.max ?? Math.max(spec.before.value, spec.after.value);
  const tone = spec.after.tone ?? 'accent';
  const side = (x, cls) => `<div class="fc-side ${cls}"><span class="fc-when">${esc(x.label)}</span><b class="fc-num">${esc(shown({ ...x, text: String(x.value) }, spec.unit))}</b><div class="fc-bar" style="width:${top > 0 ? (100 * x.value) / top : 0}%"></div></div>`;
  host.innerHTML = side(spec.before, 'before') + `<div class="fc-arrow">${ARROW}</div>` + side(spec.after, 'after ' + tone);
}

const themeOf = (host) => {
  const css = (n) => getComputedStyle(host).getPropertyValue(n).trim();
  return { css, ink: css('--ink'), muted: css('--muted'), soft: css('--soft'), fill: css('--fill'), fill2: css('--fill2'), hair: css('--hair'), paper: css('--paper'), line: css('--line'), accent: css('--accent'), second: css('--second'), good: css('--good'), bad: css('--bad'), small: parseFloat(css('--small')) || 15, body: parseFloat(css('--body')) || 16, sans: css('--sans') };
};
const toX = (v) => (typeof v === 'number' ? v : new Date(v));
const num = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('en-GB');
function span(a, b) {
  const d = Math.abs(b - a) / 864e5;
  if (d < 1) return `${num(d * 24)} hours`;
  return `${num(d)} ${d === 1 ? 'day' : 'days'}`;
}
function widest(host, texts, size, weight = 400) {
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:${size}px;font-weight:${weight}`;
  host.appendChild(probe);
  const w = Math.max(...texts.map((t) => { probe.textContent = t; return probe.getBoundingClientRect().width; }));
  probe.remove();
  return w;
}
function plotInto(host, t, opts) {
  host.classList.add('chart');
  host.innerHTML = '';
  host.appendChild(Plot.plot({ ...opts, style: { background: 'transparent', color: t.muted, fontFamily: t.sans, fontSize: t.small + 'px', overflow: 'visible' } }));
}

/** Rows that each move from one value to another into a .chart: an arrow per row, its gap labelled above it. */
export function drawDumbbell(host, spec) {
  const t = themeOf(host);
  const width = Math.floor(host.clientWidth) || 640;
  const date = typeof spec.rows[0].from === 'string';
  const rows = spec.rows.map((r) => ({ ...r, a: toX(r.from), b: toX(r.to) }));
  for (const r of rows) {
    r.text = r.gap ?? (date ? span(r.a, r.b) : num(Math.abs(r.b - r.a)) + (spec.unit ?? ''));
    r.mid = date ? new Date((+r.a + +r.b) / 2) : (r.a + r.b) / 2;
    r.color = t[r.tone ?? 'accent'];
  }
  const all = rows.flatMap((r) => [+r.a, +r.b]);
  const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo || 1) * 0.08;
  const domain = date ? [new Date(lo - pad), new Date(hi + pad)] : [lo - pad, hi + pad];
  const labelW = widest(host, rows.map((r) => r.label), t.body);
  plotInto(host, t, {
    width, height: rows.length * 92 + 50, marginLeft: Math.ceil(labelW) + 28, marginRight: 24, marginTop: 0, marginBottom: 40,
    x: { domain, ticks: width < 600 ? 4 : 5, label: null, tickFormat: date ? undefined : (d) => num(d) + (spec.unit ?? '') },
    y: { domain: rows.map((r) => r.label), axis: null, padding: 0.5 },
    marks: [
      Plot.text(rows, { y: 'label', text: 'label', frameAnchor: 'left', dx: -(Math.ceil(labelW) + 28), textAnchor: 'start', fill: t.ink, fontSize: t.body }),
      Plot.link(rows, { x1: 'a', x2: 'b', y1: 'label', y2: 'label', stroke: 'color', strokeWidth: 3 }),
      Plot.dot(rows, { x: 'a', y: 'label', r: 6.5, fill: t.fill }),
      // A fixed-size head at the end, pointing the way the row moved.
      // A fixed-size head whose tip, not its middle, sits on the end value.
      Plot.dot(rows.filter((r) => r.b >= r.a), { x: 'b', y: 'label', symbol: 'triangle2', r: 7.5, dx: -5, fill: 'color', rotate: 90 }),
      Plot.dot(rows.filter((r) => r.b < r.a), { x: 'b', y: 'label', symbol: 'triangle2', r: 7.5, dx: 5, fill: 'color', rotate: -90 }),
      Plot.text(rows, { x: 'mid', y: 'label', text: 'text', dy: -22, fill: t.ink, fontWeight: 600, fontSize: t.small }),
    ],
  });
  // The two ends named once, as a key above the rows.
  const key = document.createElement('p');
  key.className = 'fd-key';
  key.innerHTML = `<span class="fd-from"><i></i>${esc(spec.fromLabel)}</span><span class="fd-to${rows.every((r) => r.b < r.a) ? ' back' : ''}" style="color:${t.accent}"><i></i>${esc(spec.toLabel)}</span>`;
  key.style.marginLeft = labelW + 'px';
  host.prepend(key);
}

/** A line over ordered x into a .chart, with one point marked and labelled beside it. */
export function drawSeries(host, spec) {
  const t = themeOf(host);
  const width = Math.floor(host.clientWidth) || 640;
  const pts = spec.points.map((p) => ({ x: toX(p.x), y: p.y }));
  const i = pts.findIndex((p) => +p.x === +toX(spec.mark.x));
  const mark = pts[i];
  const near = pts.slice(Math.max(0, i - 3), i + 4).map((p) => p.y);
  const high = mark.y >= near.reduce((s, y) => s + y, 0) / near.length;
  const ys = pts.map((p) => p.y), zero = spec.zero ?? true;
  const top = Math.max(...ys), bottom = zero ? Math.min(0, ...ys) : Math.min(...ys);
  const fmt = (d) => num(d) + (spec.unit ?? '');
  const tickW = widest(host, [fmt(top), fmt(bottom)], t.small);
  // Label to the right of the point when it fits inside the plot there, otherwise to the left.
  const left0 = Math.ceil(tickW) + 14, plotW = width - left0 - 20;
  const at = left0 + plotW * ((+mark.x - +pts[0].x) / (+pts[pts.length - 1].x - +pts[0].x));
  const right = at + 14 + widest(host, [spec.mark.label], t.body, 600) <= width - 20;
  // Above a high point; level with a low one, lifted clear of the axis when it sits near the bottom.
  const lift = zero ? ((mark.y - bottom) / (top * 1.04 - bottom)) * (340 - 30 - 40) : Infinity;
  const dy = high ? -12 : Math.min(0, lift - 18);
  plotInto(host, t, {
    width, height: 340, marginLeft: left0, marginRight: 20, marginTop: 30, marginBottom: 40,
    x: { label: null, ticks: width < 600 ? 4 : 5, insetLeft: 18 },
    y: { label: null, grid: true, ticks: 4, tickSize: 0, domain: zero ? [bottom, top * 1.04] : undefined, tickFormat: fmt },
    marks: [
      zero ? Plot.ruleY([0], { stroke: t.line }) : null,
      Plot.lineY(pts, { x: 'x', y: 'y', stroke: t.fill, strokeWidth: 2.5 }),
      Plot.dot([mark], { x: 'x', y: 'y', r: 6.5, fill: t.accent }),
      Plot.text([mark], { x: 'x', y: 'y', text: () => spec.mark.label, dx: right ? 14 : -14, dy, textAnchor: right ? 'start' : 'end', fill: t.accent, fontWeight: 600, fontSize: t.body }),
    ],
  });
}

/**
 * Where each record sits: every arrangement of the records over a few small grids is scored, and the best kept.
 * A score counts references that cross, references that pass over another record, long references, and records drawn
 * above what they point at (a reference reads upward, to the thing it names). A phone gets at most two columns.
 */
export function placeRecords(records, refs, phone) {
  const n = records.length;
  const shapes = [];
  for (let rows = 1; rows <= 3; rows++) for (let cols = 1; cols <= (phone ? 2 : 3); cols++) {
    if (rows * cols >= n && rows * cols - n < Math.min(rows, cols)) shapes.push([rows, cols]);
  }
  const idx = new Map(records.map((r, i) => [r.id, i]));
  const edges = refs.map((r) => [idx.get(r.from), idx.get(r.to)]);
  const cross = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  // A record's cell is about 1.6 times as wide as it is tall, gaps included.
  const pt = ([r, c]) => [c * 1.6, r];
  const over = (a, b, cell) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b), [cx, cy] = pt(cell);
    const hw = 0.55, hh = 0.32;
    for (let t = 0.04; t < 1; t += 0.04) { const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; if (Math.abs(x - cx) < hw && Math.abs(y - cy) < hh) return true; }
    return false;
  };
  let best = null;
  for (const [rows, cols] of shapes) {
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([r, c]);
    const used = new Array(cells.length).fill(false), at = new Array(n);
    const score = () => {
      let s = rows * 0.6 + cols * 0.3;
      const pos = at.map((k) => cells[k]);
      edges.forEach(([f, t], i) => {
        const a = pos[f], b = pos[t];
        const [x1, y1] = pt(a), [x2, y2] = pt(b);
        s += Math.hypot(x2 - x1, y2 - y1) * 1.2;
        if (a[0] !== b[0] && a[1] !== b[1]) s += 1.5;
        if (a[0] < b[0]) s += 3;
        pos.forEach((p, k) => { if (k !== f && k !== t && over(a, b, p)) s += 12; });
        for (const [g, u] of edges.slice(i + 1)) if (g !== f && g !== t && u !== f && u !== t && cross(pt(a), pt(b), pt(pos[g]), pt(pos[u]))) s += 8;
      });
      // An empty cell in the middle of a row reads as something missing.
      for (let r = 0; r < rows; r++) for (let c = 1; c < cols - 1; c++) if (!pos.some((p) => p[0] === r && p[1] === c) && pos.some((p) => p[0] === r)) s += 4;
      return s;
    };
    const walk = (i) => {
      if (i === n) { const s = score(); if (!best || s < best.s - 1e-9) best = { s, rows, cols, pos: at.map((k) => cells[k]) }; return; }
      for (let k = 0; k < cells.length; k++) if (!used[k]) { used[k] = true; at[i] = k; walk(i + 1); used[k] = false; }
    };
    walk(0);
  }
  return best;
}

/** Records and the references between them into the figure: boxes on a grid figkit chose, and <fig-arrow ref> lines. */
function drawEntities(spec, main) {
  const phone = main.classList.contains('phone');
  const { rows, cols, pos } = placeRecords(spec.records, spec.refs, phone);
  const grid = document.createElement('div');
  grid.className = 'entities';
  grid.style.cssText = `grid-template-columns: repeat(${cols}, minmax(0, 1fr)); grid-template-rows: repeat(${rows}, auto);`;
  spec.records.forEach((r, i) => {
    const fields = r.fields ?? [];
    const box = document.createElement('div');
    box.className = 'node record' + (r.tone ? ' accent' : '');
    box.id = 'rec-' + r.id;
    box.style.gridArea = `${pos[i][0] + 1} / ${pos[i][1] + 1}`;
    box.innerHTML = `<h3>${esc(r.name)}</h3>${fields.length ? `<ul>${fields.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}`;
    grid.appendChild(box);
  });
  main.appendChild(grid);
  for (const ref of spec.refs) {
    const a = document.createElement('fig-arrow');
    a.setAttribute('from', 'rec-' + ref.from);
    a.setAttribute('to', 'rec-' + ref.to);
    a.setAttribute('ref', ref.count);
    if (ref.optional) a.setAttribute('dashed', '');
    main.appendChild(a);
  }
}

const HOSTS = { split: 'fig-split', bars: 'fig-bars', 'before-after': 'fig-change', dumbbell: 'div', series: 'div', groups: 'div', lines: 'div', panels: 'div', heatmap: 'div' };

/** A checked spec drawn into a figure: header, chart and footer, as figkit's own markup. */
export function drawSpec(spec, main) {
  const header = document.createElement('header');
  header.innerHTML = `<h1>${esc(spec.title)}</h1>${spec.note ? `<p class="read">${esc(spec.note)}</p>` : ''}`;
  if (spec.type === 'entities') {
    main.append(header);
    drawEntities(spec, main);
    if (spec.source) { const footer = document.createElement('footer'); footer.innerHTML = `<p>${esc(spec.source)}</p>`; main.append(footer); }
    return { chart: main.querySelector('.entities'), draw: () => {} };
  }
  const chart = document.createElement(HOSTS[spec.type]);
  main.append(header, chart);
  if (spec.source) {
    const footer = document.createElement('footer');
    footer.innerHTML = `<p>${esc(spec.source)}</p>`;
    main.append(footer);
  }
  const draw = () => {
    if (spec.type === 'before-after') return drawChange(chart, spec);
    if (spec.type === 'dumbbell') return drawDumbbell(chart, spec);
    if (spec.type === 'series') return drawSeries(chart, spec);
    if (spec.type === 'groups') return drawGroups(chart, spec, { unit: spec.unit, max: spec.max });
    if (spec.type === 'lines') return drawLines(chart, spec, { unit: spec.unit, xTicks: spec.xTicks });
    if (spec.type === 'panels') return drawPanels(chart, spec);
    if (spec.type === 'heatmap') return drawHeatmap(chart, spec);
    const items = (spec.parts ?? spec.bars).map((x) => ({ ...x, text: String(x.value), label: esc(x.label) }));
    if (spec.type === 'split') drawSplit(chart, items, spec.unit);
    else drawBars(chart, items, spec.unit, spec.max);
  };
  draw();
  return { chart, draw };
}

// ---------- grouped bars, several lines, panels, heat maps ----------

const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c.trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
/** a mixed with b, p of the way to b, as #rrggbb; a when either is not a plain hex colour. */
function mix(a, b, p) {
  const x = hex(a), y = hex(b);
  if (!x || !y) return a;
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * p).toString(16).padStart(2, '0')).join('');
}
const phoneOf = (host) => !!host.closest('.phone');

/**
 * Bars in groups into a .chart: a heading per group, a row per series labelled with its name, so no legend is needed.
 * opts.max fixes the end of the axis (panels share one), opts.unit follows each number.
 */
export function drawGroups(host, data, opts = {}) {
  const t = themeOf(host);
  const width = Math.floor(host.clientWidth) || 640, phone = phoneOf(host) || width < 420;
  const { series, groups, accent } = data;
  const tone = t[accent.tone ?? 'accent'];
  const rows = groups.flatMap((g) => series.map((s, i) => ({ g: g.label, s, v: g.values[i], hi: (accent.series === undefined || accent.series === s) && (accent.group === undefined || accent.group === g.label) })));
  const fmt = (v) => num(v) + (opts.unit ?? '');
  const top = opts.max ?? Math.max(...rows.map((r) => r.v));
  const indent = 0;
  const labelW = Math.ceil(Math.max(widest(host, series, t.body) + indent, widest(host, groups.map((g) => g.label), t.body, 600))) + 14;
  const valueW = Math.ceil(widest(host, rows.map((r) => fmt(r.v)), t.body, 600)) + 12;
  // A group's heading sits close above its own bars, with more room above it, so the groups read as blocks.
  const rowH = Math.max(phone ? 34 : 38, Math.ceil(t.body * 1.75)), headH = Math.max(30, Math.ceil(t.body * 1.7)), above = 22;
  const step = series.length * rowH + headH + above;
  plotInto(host, t, {
    width, height: groups.length * step - above + 8, marginLeft: labelW, marginRight: valueW, marginTop: headH, marginBottom: 8,
    // Every bar carries its number, so an axis would only repeat it; the zero line is kept.
    x: { domain: [0, top], axis: null },
    y: { domain: series, axis: null, padding: 0.18 },
    fy: { domain: groups.map((g) => g.label), axis: null, paddingInner: (headH + above) / step, paddingOuter: 0 },
    marks: [
      Plot.ruleX([0], { stroke: t.line }),
      Plot.barX(rows, { x: 'v', y: 's', fy: 'g', fill: (r) => (r.hi ? tone : t.fill), rx: 2 }),
      Plot.text(rows, { x: 'v', y: 's', fy: 'g', text: (r) => fmt(r.v), dx: 6, textAnchor: 'start', fill: (r) => (r.hi ? tone : t.ink), fontWeight: (r) => (r.hi ? 600 : 400), fontSize: t.body }),
      Plot.text(rows, { x: 0, y: 's', fy: 'g', text: 's', dx: -labelW + indent, textAnchor: 'start', fill: t.ink, fontSize: t.body }),
      Plot.text(groups.map((g) => g.label), { fy: (d) => d, frameAnchor: 'top-left', dx: -labelW, dy: -headH + 2, text: (d) => d, textAnchor: 'start', lineAnchor: 'top', fill: opts.quietGroups ? t.muted : t.ink, fontWeight: 600, fontSize: t.body * 1.06 }),
    ],
  });
}

/**
 * Two or three lines on one axis into a .chart. Each is named at its right end in its own colour; the accent line is
 * drawn last and thicker, the others in two greys. opts.domain fixes the y axis (panels share one).
 */
export function drawLines(host, data, opts = {}) {
  const t = themeOf(host);
  const width = Math.floor(host.clientWidth) || 640, phone = phoneOf(host) || width < 420;
  const greys = [t.fill2, t.fill];
  const lines = data.series.map((l) => ({ ...l, pts: l.points.map((p) => ({ x: toX(p.x), y: p.y, s: l.label })) }));
  const others = lines.filter((l) => l.label !== data.accent);
  others.forEach((l, i) => { l.color = greys[i % 2]; l.w = 2.25; });
  const hi = lines.find((l) => l.label === data.accent);
  hi.color = t.accent; hi.w = 3.25;
  const ys = lines.flatMap((l) => l.pts.map((p) => p.y));
  const zero = data.zero ?? true;
  const domain = opts.domain ?? [zero ? Math.min(0, ...ys) : Math.min(...ys), Math.max(...ys) * 1.04];
  const fmt = (d) => num(d) + (opts.unit ?? '');
  const height = phone ? 260 : 300, mt = data.mark ? 28 : 10, mb = 36;
  const ends = [...others, hi].map((l) => ({ l, last: l.pts[l.pts.length - 1] }));
  const labelW = Math.ceil(widest(host, ends.map((e) => e.l.label), t.small, 600)) + 14;
  // Each name sits level with its line's last point, pushed apart when two would overlap.
  const py = (v) => mt + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (height - mt - mb);
  const placed = ends.map((e) => ({ ...e, y: py(e.last.y) })).sort((a, b) => a.y - b.y);
  const gap = t.small * 1.3;
  for (let i = 1; i < placed.length; i++) placed[i].y = Math.max(placed[i].y, placed[i - 1].y + gap);
  for (let i = placed.length - 2; i >= 0; i--) placed[i].y = Math.min(placed[i].y, placed[i + 1].y - gap);
  const tickW = Math.ceil(widest(host, [fmt(domain[1]), fmt(domain[0])], t.small)) + 12;
  const markPt = data.mark && hi.pts.find((p) => +p.x === +toX(data.mark.x));
  plotInto(host, t, {
    width, height, marginLeft: tickW, marginRight: labelW, marginTop: mt, marginBottom: mb,
    x: opts.xTicks ? { label: null, insetLeft: 18, ticks: opts.xTicks.map((k) => toX(k.x)), tickFormat: (d) => opts.xTicks.find((k) => +toX(k.x) === +d)?.label ?? '' }
      : { label: null, insetLeft: 18, ticks: width < 520 ? 3 : 5, tickFormat: typeof lines[0].pts[0].x === 'number' ? (d) => num(d) : undefined },
    y: { domain, nice: false, label: null, grid: true, ticks: 4, tickSize: 0, tickFormat: fmt },
    marks: [
      zero ? Plot.ruleY([0], { stroke: t.line }) : null,
      ...[...others, hi].map((l) => Plot.lineY(l.pts, { x: 'x', y: 'y', stroke: l.color, strokeWidth: l.w })),
      Plot.text(placed, { x: (e) => e.last.x, y: (e) => domain[0] + (1 - (e.y - mt) / (height - mt - mb)) * (domain[1] - domain[0]), text: (e) => e.l.label, dx: 8, textAnchor: 'start', fill: (e) => (e.l === hi ? t.accent : t.muted), fontWeight: 600, fontSize: t.small }),
      markPt ? Plot.dot([markPt], { x: 'x', y: 'y', r: 6, fill: t.accent }) : null,
      markPt ? Plot.text([markPt], { x: 'x', y: 'y', text: () => data.mark.label, dy: -16, fill: t.accent, fontWeight: 600, fontSize: t.small }) : null,
    ],
  });
}

/** The same chart for each part, side by side on one scale; stacked on a phone. */
export function drawPanels(host, spec) {
  host.className = 'panels';
  host.innerHTML = '';
  const charts = spec.panels.map((p) => {
    const box = document.createElement('div');
    box.className = 'panel';
    box.innerHTML = `<h2>${esc(p.label)}</h2>`;
    const chart = document.createElement('div');
    box.appendChild(chart);
    host.appendChild(box);
    return { p, chart };
  });
  if (spec.chart === 'groups') {
    const max = spec.max ?? Math.max(...spec.panels.flatMap((p) => p.groups.flatMap((g) => g.values)));
    for (const { p, chart } of charts) {
      const accent = spec.accent.group && !p.groups.some((g) => g.label === spec.accent.group) ? { ...spec.accent, series: '\u0000' } : spec.accent;
      drawGroups(chart, { series: spec.series, groups: p.groups, accent }, { unit: spec.unit, max, quietGroups: true });
    }
  } else {
    const ys = spec.panels.flatMap((p) => p.series.flatMap((l) => l.points.map((q) => q.y)));
    const zero = spec.zero ?? true;
    const domain = [zero ? Math.min(0, ...ys) : Math.min(...ys), Math.max(...ys) * 1.04];
    for (const { p, chart } of charts) drawLines(chart, { series: p.series, accent: spec.accent, zero }, { unit: spec.unit, domain, xTicks: spec.xTicks });
  }
}

/**
 * A heat map into a .chart: the colour runs from pale to the accent, one hue, so darker is always more. The scale is
 * drawn above the grid at readable size. A marked cell is outlined and named in the scale line.
 */
export function drawHeatmap(host, spec) {
  const t = themeOf(host);
  const width = Math.floor(host.clientWidth) || 640, phone = phoneOf(host) || width < 420;
  const cells = spec.rows.flatMap((r, i) => spec.columns.map((c, j) => ({ r: String(r), c: String(c), v: spec.values[i][j] })));
  const vs = cells.map((d) => d.v), lo = Math.min(...vs), hi = Math.max(...vs);
  // One hue, near white to dark: darker is always more, and busy does not read as alarm the way red does.
  const scale = Plot.scale({ color: { type: 'linear', scheme: 'blues', domain: [lo - (hi - lo) * 0.08, hi] } });
  const colour = (v) => scale.apply(v);
  const ramp = [0, 0.25, 0.5, 0.75, 1].map((p) => colour(lo + (hi - lo) * p)).join(', ');
  const fmt = (v) => num(v) + (spec.unit ?? '');
  const cols = spec.columns.map(String), rows = spec.rows.map(String);
  const labelW = Math.ceil(widest(host, rows, t.small)) + 12;
  const cellW = (width - labelW - 8) / cols.length;
  const show = cellW >= 48 && cells.length <= 72;
  // Label every k-th column, k a divisor of the count where one exists, so 24 hours read 12am, 6am, 12pm, 6pm.
  const most = phone ? 5 : 9, steps = [1, 2, 3, 4, 5, 6, 8, 10, 12].filter((k) => cols.length / k <= most);
  const every = steps.find((k) => cols.length % k === 0) ?? steps[0] ?? Math.ceil(cols.length / most);
  const rowH = phone ? 30 : 36;
  const key = document.createElement('p');
  key.className = 'hm-key';
  key.innerHTML = `<span>${esc(fmt(lo))}</span><i style="background:linear-gradient(90deg, ${ramp})"></i><span>${esc(fmt(hi))}</span>`
    + (spec.mark ? `<span style="margin-left:14px;white-space:nowrap;display:inline-flex;align-items:center;gap:8px;color:${t.ink};font-weight:600"><i style="width:16px;height:16px;border:2.5px solid ${t.accent};border-radius:2px;background:none"></i>${esc(spec.mark.label)}</span>` : '');
  plotInto(host, t, {
    width, height: rows.length * rowH + 36, marginLeft: labelW, marginRight: 8, marginTop: 0, marginBottom: 36,
    x: { domain: cols, label: null, tickSize: 0, tickFormat: (d, i) => (i % every === 0 ? d : '') , padding: 0.06 },
    y: { domain: rows, label: null, tickSize: 0, padding: 0.08 },
    marks: [
      Plot.cell(cells, { x: 'c', y: 'r', fill: (d) => colour(d.v), inset: 0.5 }),
      show ? Plot.text(cells, { x: 'c', y: 'r', text: (d) => fmt(d.v), fill: (d) => ((d.v - lo) / (hi - lo || 1) > 0.55 ? '#ffffff' : t.ink), fontSize: t.small }) : null,
      // The marked cell: an accent ring, the one thing in the chart that is not the scale.
      spec.mark ? Plot.cell([{ r: String(spec.mark.row), c: String(spec.mark.column) }], { x: 'c', y: 'r', fill: 'none', stroke: t.accent, strokeWidth: 2.5 }) : null,
    ],
  });
  key.style.marginLeft = labelW + 'px';
  host.prepend(key);
}
