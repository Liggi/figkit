/* figkit runtime: arrows routed around boxes, split bars, bars, Plot charts, and checks measured in the browser. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const M = 16; // clearance an arrow keeps from a box
  const fig = (window.fig = { problems: [], info: {}, queue: [] });
  const root = () => document.querySelector('.fig');
  const css = (name) => getComputedStyle(root()).getPropertyValue(name).trim();
  const TONES = ['accent', 'second', 'good', 'bad'];

  fig.theme = new Proxy({}, { get: (_t, k) => css('--' + String(k)) });

  // ---------- geometry ----------
  function rectOf(el) {
    const r = el.getBoundingClientRect(), o = root().getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
  }
  function textRect(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect(), o = root().getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
  }
  const grow = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
  const inside = (r, x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
  const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2;
  const name = (el) => (el.id ? '#' + el.id : '"' + (el.innerText ?? el.textContent).trim().replace(/\s+/g, ' ') + '"');
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const SOLID = '.node, .decision, .group, fig-split, fig-bars, fig-change, .chart, .shot, .fig-wire-label';
  /** Overlap that knows a decision is a diamond, not its bounding box. */
  function hits(a, b) {
    if (!overlap(a.r, b.r)) return false;
    const d = a.el?.classList.contains('decision') ? a : b.el?.classList.contains('decision') ? b : null;
    if (!d) return true;
    const o = d === a ? b : a;
    if (o.el?.classList.contains('decision')) return true;
    const cx = d.r.x + d.r.w / 2, cy = d.r.y + d.r.h / 2;
    const px = Math.max(o.r.x, Math.min(cx, o.r.x + o.r.w)), py = Math.max(o.r.y, Math.min(cy, o.r.y + o.r.h));
    return Math.abs(px - cx) / (d.r.w / 2) + Math.abs(py - cy) / (d.r.h / 2) < 0.98;
  }

  /** Things an arrow must not run through: boxes, charts, and any loose text. */
  function obstacles() {
    const out = [];
    const solid = [...root().querySelectorAll(SOLID)].filter(visible);
    for (const el of solid) if (!el.classList.contains('bare')) out.push({ el, r: rectOf(el) });
    const walker = document.createTreeWalker(root(), NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      let el = n.parentElement;
      // Inline pieces of one paragraph (<em>, <b>, <code>) are one block of text, not separate things that can collide.
      while (el !== root() && el.parentElement && getComputedStyle(el).display === 'inline') el = el.parentElement;
      if (seen.has(el) || !visible(el) || el.closest('svg, script, style, fig-arrow')) continue;
      const box = el.closest(SOLID);
      if (box && !box.classList.contains('bare') && !box.classList.contains('group')) continue;
      seen.add(el);
      out.push({ el, r: textRect(el), text: true });
    }
    return out;
  }

  // ---------- orthogonal router ----------
  const DIRS = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
  function ports(el, r, other, allowed, at) {
    const diamond = el.classList.contains('decision');
    // A record is joined at the side of its name, never beside a field, which a line there would seem to be.
    const h3 = el.classList.contains('record') && el.querySelector(':scope > h3');
    const head = h3 && (() => { const t = rectOf(h3), line = Math.min(t.h, parseFloat(getComputedStyle(h3).lineHeight) || t.h); return { mid: t.y + line / 2, lo: r.y + 12, hi: Math.max(t.y + t.h + 6, r.y + 12) }; })();
    const out = [];
    for (const s of allowed) {
      const d = DIRS[s];
      let x, y;
      if (d[0] === 0) {
        const lo = Math.max(r.x, other.x), hi = Math.min(r.x + r.w, other.x + other.w);
        x = !diamond && hi - lo >= 24 ? (lo + hi) / 2 : r.x + r.w / 2;
        if (at != null && !diamond) x = r.x + r.w * at;
        y = s === 'top' ? r.y : r.y + r.h;
      } else {
        const lo = Math.max(r.y, other.y), hi = Math.min(r.y + r.h, other.y + other.h);
        y = !diamond && hi - lo >= 24 ? (lo + hi) / 2 : r.y + r.h / 2;
        if (at != null && !diamond) y = r.y + r.h * at;
        if (head) y = Math.min((head.lo + head.hi) / 2, head.mid + 4); // the first line of the name, so a wrapped name joins level with its row
        x = s === 'left' ? r.x : r.x + r.w;
      }
      x = Math.round(x); y = Math.round(y);
      out.push({ s, d, x, y, sx: x + d[0] * M, sy: y + d[1] * M, off: 0 });
      // Spares beside the chosen point, for when another line already ends there.
      if (at != null || diamond) continue;
      for (const k of [-1, 1, -2, 2]) {
        const band = head && d[0] !== 0;
        const v = (d[0] === 0 ? x : y) + k * (band ? 18 : 26), lo = band ? head.lo : (d[0] === 0 ? r.x : r.y) + 14, hi = band ? head.hi : (d[0] === 0 ? r.x + r.w : r.y + r.h) - 14;
        if (v < lo || v > hi) continue;
        const px = d[0] === 0 ? v : x, py = d[0] === 0 ? y : v;
        out.push({ s, d, x: px, y: py, sx: px + d[0] * M, sy: py + d[1] * M, off: Math.abs(k) });
      }
    }
    return out;
  }

  class Heap {
    constructor() { this.a = []; }
    push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
    pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
    get size() { return this.a.length; }
  }

  function routeOrtho(A, B, obs, arrow, used, W, H) {
    const hard = obs.map((o) => grow(o.r, 3)), soft = obs.map((o) => grow(o.r, M - 1));
    const others = obs.filter((o) => o.el !== A.el && o.el !== B.el).map((o) => grow(o.r, 3));
    const clear = (x1, y1, x2, y2) => {
      const seg = { x: Math.min(x1, x2) - 0.5, y: Math.min(y1, y2) - 0.5, w: Math.abs(x2 - x1) + 1, h: Math.abs(y2 - y1) + 1 };
      return !others.some((r) => Math.min(seg.x + seg.w, r.x + r.w) > Math.max(seg.x, r.x) && Math.min(seg.y + seg.h, r.y + r.h) > Math.max(seg.y, r.y));
    };
    const pa = ports(A.el, A.r, B.r, arrow.fromSides, arrow.fromAt), pb = ports(B.el, B.r, A.r, arrow.toSides, arrow.toAt);
    // Arrows from one box share a trunk, and so do arrows into one box; references only share the end they land on.
    const bus = (u) => ((u.from === arrow.from && !arrow.ref) || u.to === arrow.to) && u.tone === arrow.tone;
    // A point where another line already starts or ends costs a lot; a spare beside it costs a little.
    const portCost = (p) => p.off * 18 + (used.some((u) => !bus(u) && ((Math.abs(u.x1 - p.x) < 12 && Math.abs(u.y1 - p.y) < 12 && u.first) || (Math.abs(u.x2 - p.x) < 12 && Math.abs(u.y2 - p.y) < 12 && u.last))) ? 140 : 0);

    // Fast path: the two boxes face each other, so a straight line is the whole route.
    const facing = [['right', 'left'], ['left', 'right'], ['bottom', 'top'], ['top', 'bottom']];
    for (const [sa, sb] of facing) {
      const p = pa.find((q) => q.s === sa && !q.off), q = pb.find((t) => t.s === sb && !t.off);
      if (!p || !q || portCost(p) || portCost(q)) continue;
      const ahead = (q.x - p.x) * p.d[0] + (q.y - p.y) * p.d[1];
      const aligned = p.d[0] === 0 ? Math.abs(p.x - q.x) < 1 : Math.abs(p.y - q.y) < 1;
      if (ahead > 6 && aligned && clear(p.x, p.y, q.x, q.y)) return [[p.x, p.y], [q.x, q.y]];
    }

    // Grid lines: box edges plus clearance, the middle of each gap, and the ports.
    const xs = new Map(), ys = new Map();
    const add = (m, v, kind) => { v = Math.round(v); if (!m.has(v) || kind === 'mid') m.set(v, kind); };
    for (const o of obs) {
      const g = grow(o.r, M);
      add(xs, g.x, 'edge'); add(xs, g.x + g.w, 'edge'); add(ys, g.y, 'edge'); add(ys, g.y + g.h, 'edge');
      let nx = null, ny = null;
      for (const p of obs) {
        if (p === o) continue;
        if (p.r.x >= o.r.x + o.r.w && (nx === null || p.r.x < nx)) nx = p.r.x;
        if (p.r.y >= o.r.y + o.r.h && (ny === null || p.r.y < ny)) ny = p.r.y;
      }
      if (nx !== null && nx - (o.r.x + o.r.w) >= 2 * M) add(xs, (nx + o.r.x + o.r.w) / 2, 'mid');
      if (ny !== null && ny - (o.r.y + o.r.h) >= 2 * M) add(ys, (ny + o.r.y + o.r.h) / 2, 'mid');
    }
    add(xs, 14, 'edge'); add(xs, W - 14, 'edge'); add(ys, 14, 'edge'); add(ys, H - 14, 'edge');
    const pad = parseFloat(getComputedStyle(root()).paddingLeft) || 0;
    if (pad > 14) { add(xs, pad, 'mid'); add(xs, W - pad, 'mid'); }
    for (const p of [...pa, ...pb]) { add(xs, p.sx, 'mid'); add(ys, p.sy, 'mid'); add(xs, p.x, 'mid'); add(ys, p.y, 'mid'); }
    const X = [...xs.keys()].sort((a, b) => a - b), Y = [...ys.keys()].sort((a, b) => a - b);
    const NX = X.length, NY = Y.length;
    const xi = new Map(X.map((v, i) => [v, i])), yi = new Map(Y.map((v, i) => [v, i]));
    const kx = X.map((v) => (xs.get(v) === 'edge' ? 1.12 : 1)), ky = Y.map((v) => (ys.get(v) === 'edge' ? 1.12 : 1));

    const mult = (x, y) => {
      for (const r of hard) if (inside(r, x, y)) return Infinity;
      for (const r of soft) if (inside(r, x, y)) return 5;
      return 1;
    };
    const usedCost = (x1, y1, x2, y2) => {
      let k = 1, plus = 0;
      const horiz = y1 === y2;
      for (const u of used) {
        const uh = u.y1 === u.y2;
        if (uh === horiz) {
          const off = horiz ? Math.abs(u.y1 - y1) : Math.abs(u.x1 - x1);
          if (off >= 10) continue;
          const lo = horiz ? Math.max(Math.min(x1, x2), Math.min(u.x1, u.x2)) : Math.max(Math.min(y1, y2), Math.min(u.y1, u.y2));
          const hi = horiz ? Math.min(Math.max(x1, x2), Math.max(u.x1, u.x2)) : Math.min(Math.max(y1, y2), Math.max(u.y1, u.y2));
          if (hi - lo <= 0.5) { if (arrow.ref && off < 0.5 && hi - lo > -160 && !bus(u)) plus += 400; continue; }
          if (off < 0.5 && bus(u)) k = Math.min(k, 0.85); else k = Math.max(k, arrow.ref ? 12 : 4);
        } else if (!bus(u)) {
          const cx = horiz ? u.x1 : x1, cy = horiz ? y1 : u.y1;
          // Strictly inside this step, or at its far end: two lines that meet on a grid point cross there too.
          const onMe = horiz ? (cx > Math.min(x1, x2) && cx < Math.max(x1, x2)) || cx === x2 : (cy > Math.min(y1, y2) && cy < Math.max(y1, y2)) || cy === y2;
          const onU = horiz ? cy > Math.min(u.y1, u.y2) && cy < Math.max(u.y1, u.y2) : cx > Math.min(u.x1, u.x2) && cx < Math.max(u.x1, u.x2);
          if (onMe && onU) plus += arrow.ref ? 1500 : 70;
        }
      }
      return [k, plus];
    };

    // Dijkstra over (column, row, heading).
    const BEND = 64;
    const id = (ix, iy, d) => (iy * NX + ix) * 4 + d;
    const VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const dirIndex = (d) => VEC.findIndex((v) => v[0] === d[0] && v[1] === d[1]);
    const dist = new Map(), prev = new Map(), heap = new Heap();
    for (const p of pa) {
      if (mult(p.sx, p.sy) === Infinity) continue;
      const s = id(xi.get(p.sx), yi.get(p.sy), dirIndex(p.d));
      const c0 = portCost(p);
      dist.set(s, c0); prev.set(s, { port: p }); heap.push(c0, s);
    }
    const goals = new Map();
    for (const p of pb) if (mult(p.sx, p.sy) !== Infinity) goals.set(xi.get(p.sx) + ',' + yi.get(p.sy), p);
    let best = null, bestCost = Infinity;
    while (heap.size) {
      const [c, s] = heap.pop();
      if (c > (dist.get(s) ?? Infinity)) continue;
      if (c >= bestCost) break;
      const d = s % 4, cell = (s - d) / 4, ix = cell % NX, iy = (cell - ix) / NX;
      const goal = goals.get(ix + ',' + iy);
      if (goal) {
        const inward = dirIndex([-goal.d[0], -goal.d[1]]);
        const total = c + (d === inward ? 0 : BEND) + portCost(goal);
        if (total < bestCost) { bestCost = total; best = { s, port: goal }; }
      }
      for (let nd = 0; nd < 4; nd++) {
        if ((nd + 2) % 4 === d) continue;
        const jx = ix + VEC[nd][0], jy = iy + VEC[nd][1];
        if (jx < 0 || jy < 0 || jx >= NX || jy >= NY) continue;
        const x1 = X[ix], y1 = Y[iy], x2 = X[jx], y2 = Y[jy];
        const m = mult((x1 + x2) / 2, (y1 + y2) / 2);
        if (m === Infinity) continue;
        const [k, plus] = usedCost(x1, y1, x2, y2);
        const len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
        const cost = c + len * m * k * (VEC[nd][0] === 0 ? kx[ix] : ky[iy]) + plus + (nd === d ? 0 : BEND);
        const t = id(jx, jy, nd);
        if (cost < (dist.get(t) ?? Infinity)) { dist.set(t, cost); prev.set(t, { from: s }); heap.push(cost, t); }
      }
    }
    if (!best) return null;
    const pts = [[best.port.x, best.port.y]];
    let s = best.s;
    for (;;) {
      const d = s % 4, cell = (s - d) / 4, ix = cell % NX, iy = (cell - ix) / NX;
      pts.push([X[ix], Y[iy]]);
      const p = prev.get(s);
      if (p.port) { pts.push([p.port.x, p.port.y]); break; }
      s = p.from;
    }
    pts.reverse();
    return simplify(pts);
  }

  function simplify(pts) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      if (c && ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]))) continue;
      out.push(b);
    }
    return out;
  }

  function sideToward(r, o) {
    const dx = o.x + o.w / 2 - (r.x + r.w / 2), dy = o.y + o.h / 2 - (r.y + r.h / 2);
    const gapX = Math.max(o.x - (r.x + r.w), r.x - (o.x + o.w)), gapY = Math.max(o.y - (r.y + r.h), r.y - (o.y + o.h));
    if (gapX >= gapY) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'bottom' : 'top';
  }
  function routeLoose(A, B, arrow) {
    const sa = arrow.fromSides.length === 1 ? arrow.fromSides[0] : sideToward(A.r, B.r);
    const sb = arrow.toSides.length === 1 ? arrow.toSides[0] : sideToward(B.r, A.r);
    const p = ports(A.el, A.r, B.r, [sa], arrow.fromAt)[0], q = ports(B.el, B.r, A.r, [sb], arrow.toAt)[0];
    return { p, q };
  }

  // ---------- drawing ----------
  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }
  function roundedPath(pts, r = 10) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
      const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by);
      const k = Math.min(r, l1 / 2, l2 / 2);
      const p1 = [bx - ((bx - ax) / l1) * k, by - ((by - ay) / l1) * k], p2 = [bx + ((cx - bx) / l2) * k, by + ((cy - by) / l2) * k];
      d += ` L${p1[0]},${p1[1]} Q${bx},${by} ${p2[0]},${p2[1]}`;
    }
    const last = pts[pts.length - 1];
    return d + ` L${last[0]},${last[1]}`;
  }
  function head(svg, tip, from, color, size) {
    const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
    const L = size, Wd = size * 0.42;
    const bx = tip[0] - Math.cos(a) * L, by = tip[1] - Math.sin(a) * L;
    const pts = [tip, [bx + Math.sin(a) * Wd, by - Math.cos(a) * Wd], [bx - Math.sin(a) * Wd, by + Math.cos(a) * Wd]];
    svgEl('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill: color }, svg);
    return [tip[0] - Math.cos(a) * (L - 1), tip[1] - Math.sin(a) * (L - 1)];
  }

  /** A cross a little short of the target: the route that does not exist. Returns where the line should stop. */
  function blockedEnd(svg, tip, from, color, weight) {
    const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
    const cx = tip[0] - Math.cos(a) * 26, cy = tip[1] - Math.sin(a) * 26, k = 8;
    for (const s of [1, -1]) svgEl('line', { x1: cx - k, y1: cy - k * s, x2: cx + k, y2: cy + k * s, stroke: color, 'stroke-width': weight + 1, 'stroke-linecap': 'round' }, svg);
    return [cx - Math.cos(a) * 16, cy - Math.sin(a) * 16];
  }

  function drawArrows() {
    const R = root(), W = R.offsetWidth, H = R.offsetHeight;
    R.querySelectorAll('svg.fig-wires, .fig-wire-label').forEach((e) => e.remove());
    const svg = svgEl('svg', { class: 'fig-wires', viewBox: `0 0 ${W} ${H}` });
    R.appendChild(svg);
    const obs = obstacles();
    const used = [];
    const labels = [];
    fig.wires = [];
    const sides = (v) => (v ? v.split(/[\s,]+/).filter((s) => DIRS[s]) : Object.keys(DIRS));
    const num = (v) => (v == null || v === '' ? null : Number(v));
    for (const tag of document.querySelectorAll('fig-arrow')) {
      const from = tag.getAttribute('from'), to = tag.getAttribute('to');
      const a = document.getElementById(from), b = document.getElementById(to);
      if (!a || !b) { fig.problems.push(`Arrow ${from} → ${to}: there is no element with id "${!a ? from : to}".`); continue; }
      const tone = TONES.find((t) => tag.hasAttribute(t) || tag.getAttribute('tone') === t) ?? (tag.getAttribute('tone') === 'ink' ? 'ink' : 'line');
      const color = css('--' + tone);
      const ref = tag.getAttribute('ref');
      const arrow = {
        from, to, tone, ref, fromSides: sides(tag.getAttribute('from-side')), toSides: sides(tag.getAttribute('to-side')),
        fromAt: num(tag.getAttribute('from-at')), toAt: num(tag.getAttribute('to-at')),
      };
      const A = { el: a, r: rectOf(a) }, B = { el: b, r: rectOf(b) };
      const mine = obs.filter((o) => o.el === a || o.el === b || !(o.el.contains(a) || o.el.contains(b) || a.contains(o.el) || b.contains(o.el)));
      for (const end of [A, B]) if (!mine.some((o) => o.el === end.el)) mine.push(end);
      const mode = tag.getAttribute('route') ?? 'ortho';
      const weight = Number(tag.getAttribute('weight') ?? (tone === 'line' ? 2 : 2.5));
      const size = 9 + weight * 2;
      const dash = tag.hasAttribute('dashed') ? '7 7' : null;
      const heads = tag.getAttribute('head') ?? (tag.hasAttribute('blocked') ? 'blocked' : tag.hasAttribute('both') ? 'both' : 'end');
      let pts = null, pathD = null, labelAt = null;
      if (mode === 'ortho') {
        pts = routeOrtho(A, B, mine, arrow, used, W, H);
        if (!pts) { fig.problems.push(`Arrow ${from} → ${to}: no route found. Leave a gap beside the boxes, or set from-side / to-side.`); continue; }
        for (let i = 1; i < pts.length; i++) used.push({ x1: pts[i - 1][0], y1: pts[i - 1][1], x2: pts[i][0], y2: pts[i][1], from, to, tone, ref, first: i === 1, last: i === pts.length - 1 });
      } else {
        const { p, q } = routeLoose(A, B, arrow);
        if (mode === 'straight') {
          const ca = [A.r.x + A.r.w / 2, A.r.y + A.r.h / 2], cb = [B.r.x + B.r.w / 2, B.r.y + B.r.h / 2];
          const clip = (r, c, o) => { const dx = o[0] - c[0], dy = o[1] - c[1]; const t = Math.min(dx ? r.w / 2 / Math.abs(dx) : Infinity, dy ? r.h / 2 / Math.abs(dy) : Infinity); return [c[0] + dx * t, c[1] + dy * t]; };
          pts = [clip(A.r, ca, cb), clip(B.r, cb, ca)];
        } else {
          const k = Math.max(40, Math.hypot(q.x - p.x, q.y - p.y) * 0.42);
          const c1 = [p.x + p.d[0] * k, p.y + p.d[1] * k], c2 = [q.x + q.d[0] * k, q.y + q.d[1] * k];
          pts = [[p.x, p.y], [q.x, q.y]];
          pts.curve = [c1, c2];
          labelAt = [(p.x + 3 * c1[0] + 3 * c2[0] + q.x) / 8, (p.y + 3 * c1[1] + 3 * c2[1] + q.y) / 8];
        }
      }
      // Heads first, so the line stops at the base of each head.
      let start = pts[0], end = pts[pts.length - 1];
      const beforeEnd = pts.curve ? pts.curve[1] : pts[pts.length - 2], afterStart = pts.curve ? pts.curve[0] : pts[1];
      // A reference has no head: a dot on the record it names, and on the holder a crow's foot when many can hold
      // one, a short bar when only one can.
      if (ref) svgEl('circle', { cx: end[0], cy: end[1], r: weight + 4, fill: color }, svg);
      if (ref && !pts.curve) {
        const [ax, ay] = pts[0], [bx, by] = pts[1], len = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / len, uy = (by - ay) / len;
        const mark = (x1, y1, x2, y2) => svgEl('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': weight, 'stroke-linecap': 'round' }, svg);
        if (ref === 'many') {
          const tip = [ax + ux * 20, ay + uy * 20];
          for (const k of [-1, 0, 1]) mark(tip[0], tip[1], ax - uy * k * 11, ay + ux * k * 11);
        } else {
          const at = [ax + ux * 12, ay + uy * 12];
          mark(at[0] - uy * 7, at[1] + ux * 7, at[0] + uy * 7, at[1] - ux * 7);
        }
      }
      else if (heads === 'blocked') end = blockedEnd(svg, end, beforeEnd, color, weight);
      if (!ref && (heads === 'end' || heads === 'both')) end = head(svg, end, beforeEnd, color, size);
      if (!ref && heads === 'both') start = head(svg, start, afterStart, color, size);
      const line = [start, ...pts.slice(1, -1), end];
      pathD = pts.curve ? `M${start[0]},${start[1]} C${pts.curve[0][0]},${pts.curve[0][1]} ${pts.curve[1][0]},${pts.curve[1][1]} ${end[0]},${end[1]}` : roundedPath(line);
      const attrs = { d: pathD, fill: 'none', stroke: color, 'stroke-width': weight, 'stroke-linecap': 'round' };
      if (dash) attrs['stroke-dasharray'] = dash;
      svgEl('path', attrs, svg);
      fig.wires.push({ from, to, pts, mode, ref });

      const text = ref ? '' : tag.getAttribute('label') ?? tag.textContent.trim();
      if (text) labels.push({ text, tone, color, pts, at: labelAt, want: tag.getAttribute('label-at'), from, to });
    }
    return placeLabels(labels, obs);
  }

  /** Pairs of drawn lines that cross. Arrows from one box, or into one box, share a trunk, so meeting is not crossing. */
  function crossingPairs() {
    const segs = (fig.wires ?? []).filter((w) => w.mode !== 'curve').flatMap((w) => w.pts.slice(1).map((b, i) => ({ w, a: w.pts[i], b })));
    const out = [];
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], t = segs[j];
      if (s.w === t.w || (s.w.from === t.w.from && !(s.w.ref && t.w.ref)) || s.w.to === t.w.to) continue;
      const sh = s.a[1] === s.b[1], th = t.a[1] === t.b[1];
      if (sh === th) continue;
      const h = sh ? s : t, v = sh ? t : s;
      const x = v.a[0], y = h.a[1];
      if (x > Math.min(h.a[0], h.b[0]) + 1 && x < Math.max(h.a[0], h.b[0]) - 1 && y > Math.min(v.a[1], v.b[1]) + 1 && y < Math.max(v.a[1], v.b[1]) - 1
        && !out.some(([u, w]) => u === s.w && w === t.w)) out.push([s.w, t.w]);
    }
    return out;
  }

  /**
   * A label that found no free place: open the gap between its two boxes so it has one, and say whether anything
   * changed. The gap grows on the row, column or grid that holds both boxes, between the parts holding each.
   */
  function widen(fails, tried) {
    let changed = false;
    for (const f of fails) {
      const key = f.from + '>' + f.to;
      if (tried.has(key)) continue;
      tried.set(key, null);
      const a = document.getElementById(f.from), b = document.getElementById(f.to);
      let lca = a.parentElement;
      while (lca && !lca.contains(b)) lca = lca.parentElement;
      if (!lca || !root().contains(lca)) continue;
      const ca = [...lca.children].find((c) => c.contains(a)), cb = [...lca.children].find((c) => c.contains(b));
      if (!ca || !cb || ca === cb) continue;
      const cs = getComputedStyle(lca);
      if (!/flex|grid/.test(cs.display)) continue;
      const ra = ca.getBoundingClientRect(), rb = cb.getBoundingClientRect();
      const across = ra.right <= rb.left + 1 || rb.right <= ra.left + 1;
      const now = across ? Math.max(rb.left - ra.right, ra.left - rb.right) : Math.max(rb.top - ra.bottom, ra.top - rb.bottom);
      const more = Math.max((across ? f.w : f.h) + 64 - now, 24);
      const R = root();
      const undo = { el: lca, prop: across ? 'columnGap' : 'rowGap', gap: lca.style[across ? 'columnGap' : 'rowGap'], w: R.style.width, v: R.style.getPropertyValue('--w') };
      lca.style[undo.prop] = (parseFloat(cs[undo.prop]) || 0) + more + 'px';
      // A wider gap must not squeeze a box until its text overflows: the figure grows instead, by at most a third.
      if (across && squeezed()) {
        const base = Number(R.dataset.baseWidth ||= String(R.offsetWidth));
        const gaps = /grid/.test(cs.display) ? cs.gridTemplateColumns.split(' ').length - 1 : [...lca.children].filter((c) => c.offsetParent !== null).length - 1;
        const wider = R.offsetWidth + more * Math.max(gaps, 1);
        if (wider > base * 1.34) { lca.style[undo.prop] = undo.gap; continue; }
        R.style.setProperty('--w', wider + 'px');
        R.style.width = wider + 'px';
        if (squeezed()) { lca.style[undo.prop] = undo.gap; R.style.width = undo.w; if (undo.v) R.style.setProperty('--w', undo.v); else R.style.removeProperty('--w'); continue; }
      }
      tried.set(key, undo);
      changed = true;
    }
    return changed;
  }

  /** Whether any text now runs past the right edge of its box. */
  function squeezed() {
    return [...root().querySelectorAll('.node')].some((n) => {
      const b = rectOf(n);
      return [...n.querySelectorAll('*')].some((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && (() => { const t = textRect(e); return t.w && t.x + t.w > b.x + b.w + 1; })());
    });
  }

  /** Puts back a widening that did not free its label (an arrow that runs around the outside, not through the gap). */
  function unwiden(fails, tried) {
    let changed = false;
    for (const f of fails) {
      const undo = tried.get(f.from + '>' + f.to);
      if (!undo) continue;
      undo.el.style[undo.prop] = undo.gap;
      root().style.width = undo.w;
      if (undo.v) root().style.setProperty('--w', undo.v); else root().style.removeProperty('--w');
      tried.set(f.from + '>' + f.to, null);
      changed = true;
    }
    return changed;
  }

  /** Put each arrow label where it touches nothing: on its line if the line is long enough, otherwise beside it. */
  function placeLabels(labels, obs) {
    const R = root(), W = R.offsetWidth, H = R.offsetHeight;
    const placed = [], fails = [];
    const segsOf = (pts) => pts.slice(1).map((b, i) => ({ a: pts[i], b, len: Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1]) }));
    const wireHit = (r, skip) => (fig.wires ?? []).some((w) => segsOf(w.pts).some((s) => s !== skip && !(skip && s.a === skip.a && s.b === skip.b)
      && Math.min(Math.max(s.a[0], s.b[0]), r.x + r.w) >= Math.max(Math.min(s.a[0], s.b[0]), r.x) && Math.min(Math.max(s.a[1], s.b[1]), r.y + r.h) >= Math.max(Math.min(s.a[1], s.b[1]), r.y)));
    for (const L of labels) {
      const lab = document.createElement('div');
      lab.className = 'fig-wire-label';
      lab.textContent = L.text;
      if (L.tone !== 'line') lab.style.color = L.color;
      lab.dataset.arrow = `${L.from} → ${L.to}`;
      R.appendChild(lab);
      const w = lab.offsetWidth, h = lab.offsetHeight;
      const cands = [];
      if (L.at) cands.push({ c: L.at });
      else {
        let segs = segsOf(L.pts);
        const mine = (fig.wires ?? []).find((x) => x.pts === L.pts);
        if (L.want === 'start') segs = [segs[0]]; else if (L.want === 'end') segs = [segs[segs.length - 1]];
        else {
          const shared = (g) => (fig.wires ?? []).some((x) => x.pts !== L.pts && segsOf(x.pts).some((u) => {
            const gh = g.a[1] === g.b[1], uh = u.a[1] === u.b[1];
            if (gh !== uh || Math.abs(gh ? g.a[1] - u.a[1] : g.a[0] - u.a[0]) > 0.5) return false;
            const k = gh ? 0 : 1;
            return Math.min(Math.max(g.a[k], g.b[k]), Math.max(u.a[k], u.b[k])) - Math.max(Math.min(g.a[k], g.b[k]), Math.min(u.a[k], u.b[k])) > 1;
          }));
          const own = segs.filter((g) => !shared(g));
          segs = [...(own.length ? own : segs)].sort((p, q) => q.len - p.len);
        }
        for (const seg of segs) {
          const horiz = seg.a[1] === seg.b[1], mid = [(seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2];
          const real = segsOf(mine ? mine.pts : L.pts).find((s) => s.a[0] === seg.a[0] && s.a[1] === seg.a[1] && s.b[0] === seg.b[0] && s.b[1] === seg.b[1]);
          for (const t of [0.5, 0.3, 0.7]) {
            const c = [seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t];
            if (seg.len >= (horiz ? w : h) + 36) cands.push({ c, on: real });
            if (horiz) cands.push({ c: [c[0], c[1] - h / 2 - 7] }, { c: [c[0], c[1] + h / 2 + 7] });
            else cands.push({ c: [c[0] + w / 2 + 9, c[1]] }, { c: [c[0] - w / 2 - 9, c[1]] });
          }
          void mid;
        }
      }
      const rectAt = (c) => ({ x: c[0] - w / 2, y: c[1] - h / 2, w, h });
      const free = (cand) => {
        const r = rectAt(cand.c);
        if (r.x < 8 || r.y < 8 || r.x + r.w > W - 8 || r.y + r.h > H - 8) return false;
        const within = (g) => r.x > g.x + 4 && r.y > g.y + 4 && r.x + r.w < g.x + g.w - 4 && r.y + r.h < g.y + g.h - 4;
        if (obs.some((o) => (o.el.classList.contains('group') ? overlap(grow(r, 3), o.r) && !within(o.r) : hits({ r: grow(r, 3) }, o)))) return false;
        if (placed.some((p) => overlap(grow(r, 4), p))) return false;
        return !wireHit(grow(r, 2), cand.on);
      };
      const pick = cands.find(free) ?? (fails.push({ from: L.from, to: L.to, w, h }), cands[0]);
      lab.style.left = pick.c[0] + 'px';
      lab.style.top = pick.c[1] + 'px';
      placed.push(rectAt(pick.c));
    }
    return fails;
  }

  // ---------- split bar and bars (drawn by viz/draw.js, loaded as window.figkitViz) ----------
  const toneOf = (el) => TONES.find((t) => el.hasAttribute(t) || el.getAttribute('tone') === t);
  const item = (el, note) => ({ value: Number(el.getAttribute('value')), text: el.getAttribute('value').trim(), show: el.getAttribute('show') ?? undefined, note: note ? el.getAttribute('note') ?? undefined : undefined, label: el.innerHTML.trim(), tone: toneOf(el) });
  const unitOf = (host) => host.getAttribute('unit') ?? '';
  const withPrefix = (host, items) => items.map((x) => (x.show === undefined && host.getAttribute('prefix') ? { ...x, show: host.getAttribute('prefix') + x.text + unitOf(host) } : x));

  function buildSplits() {
    for (const host of document.querySelectorAll('fig-split')) {
      const parts = [...host.querySelectorAll(':scope > part')].map((p) => item(p));
      if (parts.length) window.figkitViz.drawSplit(host, withPrefix(host, parts), unitOf(host));
    }
  }

  function buildBars() {
    for (const host of document.querySelectorAll('fig-bars')) {
      const bars = [...host.querySelectorAll(':scope > bar')].map((b) => item(b, true));
      const max = host.hasAttribute('max') ? Number(host.getAttribute('max')) : undefined;
      if (bars.length) window.figkitViz.drawBars(host, withPrefix(host, bars), unitOf(host), max);
    }
  }

  // ---------- Plot ----------
  /** fig.plot('#id', ({ Plot, d3, width, theme }) => plotOptions): an Observable Plot chart in the figure's type and colours. */
  fig.plot = (target, build) => fig.queue.push(() => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) { fig.problems.push(`fig.plot: nothing matches ${target}.`); return; }
    el.classList.add('chart');
    const width = Math.floor(el.clientWidth) || 640;
    const t = { ink: css('--ink'), muted: css('--muted'), soft: css('--soft'), fill: css('--fill'), fill2: css('--fill2'), line: css('--line'), hair: css('--hair'), accent: css('--accent'), second: css('--second'), good: css('--good'), bad: css('--bad'), paper: css('--paper'), panel: css('--panel') };
    try {
      const opts = build({ Plot: window.Plot, d3: window.d3, width, theme: t });
      const size = parseFloat(css('--small')) || 15;
      el.appendChild(window.Plot.plot({ width, ...opts, style: { background: 'transparent', color: t.muted, fontFamily: css('--sans'), fontSize: size + 'px', overflow: 'visible', ...(opts.style ?? {}) } }));
    } catch (e) { fig.problems.push(`fig.plot ${target}: ${e.message}`); }
  });

  // ---------- checks ----------
  function check() {
    const R = root(), P = fig.problems;
    const W = R.offsetWidth, H = R.offsetHeight;
    const detail = R.classList.contains('detail');
    const minText = detail ? 13 : 15;
    const obs = obstacles();

    // Chart labels (SVG text, which the text checks below skip): inside the frame and clear of each other.
    const marks = [...R.querySelectorAll('.chart svg text')].filter((e) => e.textContent.trim() && visible(e)).map((e) => ({ e, r: rectOf(e) }));
    for (const [i, a] of marks.entries()) {
      if (a.r.x < -1 || a.r.y < -1 || a.r.x + a.r.w > W + 1 || a.r.y + a.r.h > H + 1) P.push(`Chart label leaves the frame: "${a.e.textContent.trim()}".`);
      for (const b of marks.slice(i + 1)) if (overlap(a.r, b.r) && !a.e.contains(b.e) && !b.e.contains(a.e)) P.push(`Chart labels overlap: "${a.e.textContent.trim()}" and "${b.e.textContent.trim()}".`);
    }

    // Text: too small, cut off, or past its box.
    const small = [];
    for (const o of obs.flatMap((b) => (b.text ? [b.el] : [...b.el.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))))) {
      if (o.closest('svg')) continue;
      const size = parseFloat(getComputedStyle(o).fontSize);
      if (size < minText) small.push(`${name(o)} at ${size}px`);
      const box = o.closest('.node, .decision, fig-split, fig-bars, fig-change') ?? R;
      const t = textRect(o), b = rectOf(box);
      if (t.w && (t.x < b.x - 1 || t.x + t.w > b.x + b.w + 1 || t.y < b.y - 1 || t.y + t.h > b.y + b.h + 1)) P.push(`Text runs past its box: ${name(o)}${box === R ? ' leaves the frame' : ' in ' + name(box)}.`);
    }
    for (const svgText of R.querySelectorAll('.chart text')) {
      const size = parseFloat(getComputedStyle(svgText).fontSize);
      if (svgText.textContent.trim() && size < minText) small.push(`chart label "${svgText.textContent.trim()}" at ${size}px`);
    }
    if (small.length) P.push(`Text under ${minText}px will not be readable: ${small.join(', ')}.`);
    for (const d of R.querySelectorAll('.decision')) {
      const kids = [...d.children].map(rectOf);
      const b = rectOf(d);
      const t = kids.length ? { x: Math.min(...kids.map((k) => k.x)), y: Math.min(...kids.map((k) => k.y)), w: 0, h: 0 } : textRect(d);
      if (kids.length) { t.w = Math.max(...kids.map((k) => k.x + k.w)) - t.x; t.h = Math.max(...kids.map((k) => k.y + k.h)) - t.y; }
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const reach = Math.max(Math.abs(t.x - cx), Math.abs(t.x + t.w - cx)) / (b.w / 2) + Math.max(Math.abs(t.y - cy), Math.abs(t.y + t.h - cy)) / (b.h / 2);
      if (reach > 1.02) P.push(`The text of decision ${name(d)} does not fit inside its diamond: shorten it or give the diamond a min-width.`);
    }

    // Boxes and labels that collide.
    for (let i = 0; i < obs.length; i++) for (let j = i + 1; j < obs.length; j++) {
      const a = obs[i], b = obs[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.el.closest('.step') || b.el.closest('.step') || a.el.closest('.mark, .shot') || b.el.closest('.mark, .shot')) continue;
      if (a.el.closest('.group > .label') || b.el.closest('.group > .label')) continue;
      if ((a.el.classList.contains('group') || b.el.classList.contains('group')) && (a.el.dataset.arrow || b.el.dataset.arrow || a.text || b.text) ? false : hits(a, b)) P.push(`${a.el.dataset.arrow ? 'The label of arrow ' + a.el.dataset.arrow : name(a.el)} overlaps ${b.el.dataset.arrow ? 'the label of arrow ' + b.el.dataset.arrow : name(b.el)}.`);
    }
    for (const o of obs) if (o.r.x < -1 || o.r.y < -1 || o.r.x + o.r.w > W + 1 || o.r.y + o.r.h > H + 1) P.push(`${name(o.el)} sticks out of the frame.`);

    // Arrows through boxes, and arrows crossing each other.
    const segs = [];
    for (const w of fig.wires ?? []) {
      const a = document.getElementById(w.from), b = document.getElementById(w.to);
      for (let i = 1; i < w.pts.length; i++) segs.push({ w, a: w.pts[i - 1], b: w.pts[i] });
      if (w.mode === 'curve') continue;
      for (const o of obs) {
        if (o.el === a || o.el === b || o.el.contains(a) || o.el.contains(b) || a.contains(o.el) || b.contains(o.el) || o.el.dataset.arrow === `${w.from} → ${w.to}`) continue;
        const r = grow(o.r, -2);
        const hit = w.pts.some((p, i) => i > 0 && Math.min(Math.max(p[0], w.pts[i - 1][0]), r.x + r.w) > Math.max(Math.min(p[0], w.pts[i - 1][0]), r.x) - 0.01 && Math.min(Math.max(p[1], w.pts[i - 1][1]), r.y + r.h) > Math.max(Math.min(p[1], w.pts[i - 1][1]), r.y) - 0.01
          && (p[0] === w.pts[i - 1][0] || p[1] === w.pts[i - 1][1]));
        if (hit) P.push(`Arrow ${w.from} → ${w.to} runs through ${name(o.el)}.`);
      }
    }
    const crossings = new Set(crossingPairs().map(([u, w]) => `${u.from} → ${u.to} and ${w.from} → ${w.to}`));
    if (crossings.size) P.push(R.querySelector('.entities')
      ? `References cross: ${[...crossings].join('; ')}. Split the records over two figures; do not leave a reference out.`
      : `Arrows cross: ${[...crossings].join('; ')}. Reorder the boxes so they do not, or drop an arrow.`);

    // Neighbours that almost line up.
    const boxes = obs.filter((o) => !o.text && !o.el.classList.contains('fig-wire-label') && !o.el.classList.contains('decision') && !o.el.parentElement.closest('.node'));
    const near = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // Records share a top edge in their row; their heights follow their fields, which figkit placed, not the author.
      if (a.el.classList.contains('record') && b.el.classList.contains('record')) continue;
      const edges = [['left edges', a.r.x, b.r.x], ['right edges', a.r.x + a.r.w, b.r.x + b.r.w], ['top edges', a.r.y, b.r.y], ['bottom edges', a.r.y + a.r.h, b.r.y + b.r.h]];
      for (const [what, u, v] of edges) { const d = Math.abs(u - v); if (d > 0.75 && d <= 6) near.push(`${name(a.el)} and ${name(b.el)} (${what}, ${d.toFixed(0)}px apart)`); }
    }
    if (near.length) P.push(`Almost aligned but not quite: ${near.slice(0, 6).join('; ')}${near.length > 6 ? `; and ${near.length - 6} more` : ''}. Put them in one row, column or grid so they share the edge.`);

    // Too much on the page.
    // Panels repeat the same labels in each panel; a label read once counts once.
    const panelText = R.querySelector('.panels') ? [...new Set([...R.querySelectorAll('.panels text, .panels h2')].map((e) => e.textContent.trim()))].join(' ') : null;
    const outside = R.querySelector('.panels') ? [...R.children].filter((c) => !c.matches('script, style') && !c.querySelector('.panels') && !c.matches('.panels')).map((c) => c.innerText).join(' ') : null;
    const words = (panelText !== null ? outside + ' ' + panelText : R.innerText).split(/\s+/).filter(Boolean).length;
    const nodes = R.querySelectorAll('.node:not(.bare), .decision').length, arrows = (fig.wires ?? []).length;
    const budget = detail ? { words: 190, nodes: 18, arrows: 18 } : { words: 70, nodes: 5, arrows: 8 };
    if (words > budget.words) P.push(`${words} words; a ${detail ? 'detail' : 'glance'} figure holds about ${budget.words}. Cut sentences that explain, and keep labels.`);
    if (nodes > budget.nodes) P.push(`${nodes} boxes; more than ${budget.nodes} stops reading as one picture. ${detail ? 'Split it into two figures or merge boxes.' : 'Split it into two or three figures in a row (what exists, one case through it, what changes), or merge boxes.'}`);
    if (arrows > budget.arrows) P.push(`${arrows} arrows; more than ${budget.arrows} tangles. Show the main path and drop the rest.`);
    const tones = TONES.filter((t) => R.querySelector(`.${t}, [${t}], .t-${t}`));
    if (tones.length > 2) P.push(`${tones.length} colours carry meaning (${tones.join(', ')}); use one for what the reader must notice and at most one more.`);
    for (const o of obs) if (o.text || o.el.matches('.node')) { const t = o.el.innerText ?? ''; if ((t.match(/ [·|•] /g) ?? []).length >= 1 && !o.el.querySelector('*')) P.push(`${name(o.el)} strings facts together with separators; give each fact its own line or cut one.`); }
    // A face that never loaded draws in whatever the machine has, and every measurement above is of that fallback.
    const faces = [...document.fonts];
    const families = [...new Set(['--sans', '--serif'].map((v) => css(v).split(',')[0].replace(/["']/g, '').trim()))];
    const missing = families.filter((f) => !faces.some((x) => x.family.replace(/["']/g, '') === f && x.status === 'loaded'));
    if (missing.length) P.push(`figkit's fonts did not load (${missing.join(', ')}); the figure is drawn in fallback fonts. Reinstall figkit with its dependencies.`);
    const h1 = R.querySelector('h1');
    if (!h1) P.push('No <h1>: give the figure a title that states its point.');
    else if (h1.innerText.split(/\s+/).length > 14) P.push('The title is over 14 words; state the point more shortly.');

    const scale = 358 / W;
    const px = (sel) => { const el = R.querySelector(sel); return el ? (parseFloat(getComputedStyle(el).fontSize) * scale).toFixed(1) : null; };
    // Columns of boxes side by side with no arrow between them, not marked as sides: on a phone they shrink instead of stacking.
    const side = (g, id) => [...g.children].findIndex((c) => c.contains(document.getElementById(id)));
    const unmarked = !R.querySelector('.sides') && [...R.querySelectorAll('.row, .grid')].some((g) => !g.parentElement.closest('.row, .grid, .node')
      && [...g.children].filter((c) => c.querySelector('.node')).length >= 2 && [...g.children].every((c) => c.matches('.col, .group') || c.querySelector('.node'))
      && (fig.wires ?? []).every((w) => side(g, w.from) < 0 || side(g, w.to) < 0 || side(g, w.from) === side(g, w.to)));
    fig.info = { width: W, height: H, words, nodes, arrows, unmarked, phone: { title: px('h1'), heading: px('.node h3, h3'), body: px('.node p, .note, p') } };
  }

  async function run() {
    if (!root()) { fig.problems.push('No element with class "fig".'); window.__figDone = true; return; }
    try {
      if (window.__figPhone) { root().classList.add('phone'); root().style.removeProperty('--w'); }
      // Load every theme face up front: labels are measured to place them, and a face first used mid-layout measures as the fallback.
      await Promise.all(['400 1em ' + css('--serif'), '400 1em ' + css('--sans'), '500 1em ' + css('--sans'), '600 1em ' + css('--sans')].map((f) => document.fonts.load(f)));
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; }))));
      for (const d of root().querySelectorAll('.decision')) { const h = Math.max(...[...d.children].map((k) => k.offsetHeight), 20); d.style.paddingBlock = Math.max(30, Math.round(h * 0.7)) + 'px'; }
      const spec = document.getElementById('figkit-spec');
      if (spec) window.figkitViz.drawSpec(JSON.parse(spec.textContent), root());
      else { buildSplits(); buildBars(); }
      for (const job of fig.queue) job();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // A label with no free place opens the gap it needs, then everything is drawn again.
      const tried = new Map();
      for (let i = 0; ; i++) {
        const fails = drawArrows();
        if (!fails.length || i === 6) break;
        const undone = unwiden(fails, tried), widened = widen(fails, tried);
        if (!undone && !widened) break;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      // Two lines that cross can often pass each other if the later one is drawn first.
      for (let i = 0; i < 4; i++) {
        const pairs = crossingPairs();
        if (!pairs.length) break;
        const tags = [...document.querySelectorAll('fig-arrow')], at = (w) => tags.find((t) => t.getAttribute('from') === w.from && t.getAttribute('to') === w.to);
        const [u, w] = pairs[0], first = at(u), second = at(w);
        if (!first || !second) break;
        const mark = document.createComment('');
        second.replaceWith(mark); first.before(second);
        drawArrows();
        if (crossingPairs().length < pairs.length) { mark.remove(); continue; }
        second.remove(); mark.replaceWith(second);
        drawArrows();
        break;
      }
      check();
    } catch (e) { fig.problems.push('figkit failed: ' + (e.stack || e.message)); }
    window.__figDone = true;
  }
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();
