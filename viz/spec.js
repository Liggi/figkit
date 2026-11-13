/* The named visualisations: one Zod schema per type. An agent picks a type and gives data; it never writes markup. */
import { z } from 'zod';

const TONE = z.enum(['accent', 'second', 'good', 'bad']);
const label = z.string({ error: 'needs a label' }).trim().min(1, 'needs a label').max(40, 'keep labels to 40 characters');
const title = z.string({ error: 'needs a title: the one point, stated' }).trim().min(1, 'needs a title: the one point, stated')
  .refine((t) => t.split(/\s+/).length <= 14, 'keep the title to 14 words');
const common = {
  title,
  note: z.string().trim().max(160, 'keep the note to 160 characters').optional(),
  unit: z.string().max(8).optional(),
  source: z.string().trim().max(120).optional(),
  style: z.enum(['report'], { error: 'style: "report" for a light chart that sits in a page, or leave it out' }).optional(),
};
const value = z.number({ error: 'must be a number' }).finite();

/** Parts of a whole, as one bar cut into segments. */
export const SplitSpec = z.object({
  type: z.literal('split'),
  ...common,
  parts: z.array(z.object({
    label,
    value: value.positive('must be more than 0'),
    tone: TONE.optional(),
    show: z.string().max(24).optional(),
  }).strict()).min(2, 'a split needs at least 2 parts').max(8, 'at most 8 parts; group the small ones as "Other"'),
}).strict();

/** A few numbers compared, one bar each, on an axis from zero. */
export const BarsSpec = z.object({
  type: z.literal('bars'),
  ...common,
  max: z.number().positive().optional(),
  bars: z.array(z.object({
    label,
    value: value.nonnegative('must be 0 or more'),
    tone: TONE.optional(),
    show: z.string().max(24).optional(),
    note: z.string().trim().max(40).optional(),
  }).strict()).min(1).max(12, 'at most 12 bars'),
}).strict()
  .refine((s) => s.max === undefined || s.bars.every((b) => b.value <= s.max), { message: 'every value must be at most max', path: ['max'] });

const side = z.object({
  label: z.string({ error: 'needs a label: when it was' }).trim().min(1, 'needs a label: when it was').max(24, 'keep it to 24 characters'),
  value: value.nonnegative('must be 0 or more'),
  show: z.string().max(16).optional(),
}).strict();

/** One measure that changed: the value before and after, side by side on one scale. */
export const BeforeAfterSpec = z.object({
  type: z.literal('before-after'),
  ...common,
  note: z.string({ error: 'required: what the number counts, e.g. "Share of orders delivered late"' }).trim().min(1).max(80, 'keep the note to 80 characters'),
  max: z.number().positive().optional(),
  before: side,
  after: side.extend({ tone: TONE.optional() }),
}).strict()
  .refine((s) => s.max === undefined || (s.before.value <= s.max && s.after.value <= s.max), { message: 'both values must be at most max', path: ['max'] });

const isoDate = z.string().refine((d) => /^\d{4}-\d{2}-\d{2}/.test(d) && !Number.isNaN(Date.parse(d)), 'must be a number or a date like 2026-10-05');
const point = z.union([z.number().finite(), isoDate], { error: 'must be a number or a date like 2026-10-05' });

/** Each row a move from one value to another, drawn as an arrow, with the gap labelled. */
export const DumbbellSpec = z.object({
  type: z.literal('dumbbell'),
  ...common,
  fromLabel: z.string({ error: 'required: what the start of each arrow is' }).trim().min(1).max(24),
  toLabel: z.string({ error: 'required: what the end of each arrow is' }).trim().min(1).max(24),
  rows: z.array(z.object({
    label: label.max(24, 'keep row labels to 24 characters'),
    from: point,
    to: point,
    gap: z.string().max(20).optional(),
    tone: TONE.optional(),
  }).strict()).min(1).max(8, 'at most 8 rows'),
}).strict();

/** A line over time (or any ordered x) with one point marked and labelled. */
export const SeriesSpec = z.object({
  type: z.literal('series'),
  ...common,
  points: z.array(z.object({ x: point, y: value }).strict()).min(3, 'a series needs at least 3 points').max(2000),
  mark: z.object({ x: point, label: z.string().trim().min(1).max(32, 'keep the mark label to 32 characters') }, { error: 'required: the one point to notice, { "x", "label" }' }).strict(),
  zero: z.boolean().optional(),
}).strict();


const seriesName = label.max(28, 'keep series names to 28 characters');
const TONE_ONE = z.enum(['accent', 'good', 'bad'], { error: 'tone: "accent", or "good" or "bad" when it is a result' });

/** Bars in groups: each group a few bars, one per series, read across the groups. */
const groupRow = z.object({
  label: label.max(32, 'keep group labels to 32 characters'),
  values: z.array(value.nonnegative('must be 0 or more: bars start at zero')),
}).strict();
const groupsData = {
  series: z.array(seriesName).min(2, 'at least 2 series; one bar per group is a "bars" chart').max(4, 'at most 4 series; more is too many bars to read'),
  groups: z.array(groupRow).min(2, 'at least 2 groups; one group is a "bars" chart').max(6, 'at most 6 groups'),
  accent: z.object({
    series: z.string().optional(),
    group: z.string().optional(),
    tone: TONE_ONE.optional(),
  }, { error: 'required: what to notice, { "series" } for a whole series, or { "series", "group" } for one bar' }).strict(),
  max: z.number().positive().optional(),
};
export const GroupsSpec = z.object({ type: z.literal('groups'), ...common, ...groupsData }).strict();

/** Two or three lines on one axis, each named at its end; one is the line to notice. */
const linePoint = z.object({ x: point, y: value }).strict();
const linesData = {
  series: z.array(z.object({
    label: seriesName,
    points: z.array(linePoint).min(3, 'a line needs at least 3 points').max(2000),
  }).strict()).min(2, 'at least 2 lines; one line is a "series" chart').max(3, 'at most 3 lines on one axis; more is small multiples ("panels")'),
  accent: z.string({ error: 'required: the label of the line to notice' }),
  mark: z.object({ x: point, label: z.string().trim().min(1).max(32, 'keep the mark label to 32 characters') }).strict().optional(),
  zero: z.boolean().optional(),
  xTicks: z.array(z.object({ x: point, label: z.string().trim().min(1).max(12, 'keep tick labels to 12 characters') }).strict()).min(2).max(8, 'at most 8 ticks').optional(),
};
export const LinesSpec = z.object({ type: z.literal('lines'), ...common, ...linesData }).strict();

/** The same chart drawn once per part, side by side on one scale. */
export const PanelsSpec = z.object({
  type: z.literal('panels'),
  ...common,
  chart: z.enum(['groups', 'lines'], { error: 'chart: "groups" or "lines", the chart each panel draws' }),
  series: groupsData.series.optional(),
  accent: z.union([z.string(), groupsData.accent]),
  max: z.number().positive().optional(),
  zero: z.boolean().optional(),
  xTicks: linesData.xTicks,
  panels: z.array(z.object({
    label: label.max(32, 'keep panel labels to 32 characters'),
    groups: z.array(groupRow).min(1).max(6, 'at most 6 groups').optional(),
    series: linesData.series.optional(),
  }).strict()).min(2, 'at least 2 panels').max(4, 'at most 4 panels; more is two figures'),
}).strict();

/** A grid of values coloured from pale to strong: where something is high or low across two dimensions. */
const axisLabel = z.union([z.string().trim().min(1).max(16, 'keep row and column labels to 16 characters'), z.number().finite()]);
export const HeatmapSpec = z.object({
  type: z.literal('heatmap'),
  ...common,
  note: z.string({ error: 'required: what the colour counts, e.g. "People active per hour"' }).trim().min(1).max(160, 'keep the note to 160 characters'),
  rows: z.array(axisLabel).min(2).max(12, 'at most 12 rows'),
  columns: z.array(axisLabel).min(2).max(31, 'at most 31 columns'),
  values: z.array(z.array(value)),
  mark: z.object({ row: axisLabel, column: axisLabel, label: z.string().trim().min(1).max(32, 'keep the mark label to 32 characters') }).strict().optional(),
}).strict();

const slug = z.string({ error: 'needs an id, e.g. "order"' }).regex(/^[a-z][a-z0-9-]{0,23}$/, 'ids are short lowercase words, e.g. "order" or "order-line"');

/**
 * What the things are and which points at which: records, and references from one record to another. A reference is
 * a pointer one record holds (a foreign key, an id field), never a step in the order work happens.
 */
export const EntitiesSpec = z.object({
  type: z.literal('entities'),
  title,
  note: common.note,
  source: common.source,
  style: common.style,
  records: z.array(z.object({
    id: slug,
    name: label.max(32, 'keep record names to 32 characters'),
    table: z.never({ error: 'no table: name the record in words; if the table name matters to the reader, put it in fields' }).optional(),
    fields: z.array(z.string().trim().min(1).max(36, 'keep each field to 36 characters')).max(4, 'at most 4 fields: the ones that explain the picture').optional(),
    tone: z.literal('accent', { error: 'tone: only "accent", on the one record to notice' }).optional(),
  }).strict()).min(2, 'at least 2 records').max(5, 'at most 5 records; more is two figures (the core, then one corner of it), not one'),
  refs: z.array(z.object({
    from: slug,
    to: slug,
    field: z.never({ error: 'no field: the line is the reference, so its column is not written out' }).optional(),
    count: z.enum(['many', 'one'], { error: 'count: "many" or "one": how many "from" records can point at one "to" record' }).default('many'),
    optional: z.boolean().optional(),
  }).strict()).min(1, 'at least 1 reference').max(8, 'at most 8 references; more is two figures, not a reference left out'),
}).strict();

export const Spec = z.discriminatedUnion('type', [SplitSpec, BarsSpec, BeforeAfterSpec, DumbbellSpec, SeriesSpec, EntitiesSpec, GroupsSpec, LinesSpec, PanelsSpec, HeatmapSpec]);
export const TYPES = { split: SplitSpec, bars: BarsSpec, 'before-after': BeforeAfterSpec, dumbbell: DumbbellSpec, series: SeriesSpec, entities: EntitiesSpec, groups: GroupsSpec, lines: LinesSpec, panels: PanelsSpec, heatmap: HeatmapSpec };

const items = (s) => s.parts ?? s.bars ?? s.rows ?? s.records ?? (s.after ? [s.after] : []);
const kind = (v) => (typeof v === 'number' ? 'number' : 'date');


function groupsChecks(s, at = '') {
  const out = [];
  s.groups.forEach((g, i) => { if (g.values.length !== s.series.length) out.push(`${at}groups[${i}].values: one value per series, ${s.series.length}, not ${g.values.length}`); });
  if (s.accent.series !== undefined && !s.series.includes(s.accent.series)) out.push(`accent.series: must be one of ${s.series.map((x) => `"${x}"`).join(', ')}`);
  if (s.accent.group !== undefined && !s.groups.some((g) => g.label === s.accent.group)) out.push(`${at}accent.group: must be the label of one of the groups`);
  if (s.accent.series === undefined && s.accent.group === undefined) out.push('accent: name the series to notice, or a series and a group for one bar');
  if (s.max !== undefined && s.groups.some((g) => g.values.some((v) => v > s.max))) out.push('max: every value must be at most max');
  return out;
}
function linesChecks(s, at = '') {
  const out = [];
  const xs = s.series.flatMap((l) => l.points.map((p) => p.x));
  if (new Set(xs.map(kind)).size > 1) out.push(`${at}series: x values must be all numbers or all dates, not both`);
  const t = (x) => (typeof x === 'number' ? x : Date.parse(x));
  s.series.forEach((l, i) => { for (let j = 1; j < l.points.length; j++) if (t(l.points[j].x) <= t(l.points[j - 1].x)) { out.push(`${at}series[${i}].points[${j}].x: points must be in order of x`); break; } });
  const names = s.series.map((l) => l.label);
  if (new Set(names).size < names.length) out.push(`${at}series: two lines have the same label`);
  if (!names.includes(s.accent)) out.push(`accent: must be the label of one of the lines, ${names.map((x) => `"${x}"`).join(', ')}`);
  if (s.mark) { const line = s.series.find((l) => l.label === s.accent); if (line && !line.points.some((p) => t(p.x) === t(s.mark.x))) out.push(`mark.x: must be the x of one of the points on the "${s.accent}" line`); }
  return out;
}

/** Rules that span fields: x values of one kind, in order, and a mark that is one of the points. */
function crossChecks(s) {
  if (s.type === 'groups') return groupsChecks(s);
  if (s.type === 'lines') return linesChecks(s);
  if (s.type === 'panels') {
    const out = [];
    s.panels.forEach((p, i) => {
      const at = `panels[${i}].`;
      if (s.chart === 'groups') {
        if (!p.groups || p.series) { out.push(`${at}: a groups panel has "groups" and no "series"`); return; }
        if (!s.series) { out.push('series: a groups chart names its series once, at the top'); return; }
        if (typeof s.accent !== 'object') { out.push('accent: { "series" } or { "series", "group" } for a groups chart'); return; }
        out.push(...groupsChecks({ series: s.series, groups: p.groups, accent: { ...s.accent, group: undefined }, max: s.max }, at));
        if (s.accent.group !== undefined && !s.panels.some((q) => q.groups?.some((g) => g.label === s.accent.group))) out.push('accent.group: must be the label of a group in a panel');
      } else {
        if (!p.series || p.groups) { out.push(`${at}: a lines panel has "series" and no "groups"`); return; }
        if (typeof s.accent !== 'string') { out.push('accent: the label of the line to notice, the same in every panel'); return; }
        out.push(...linesChecks({ series: p.series, accent: s.accent }, at));
        const names = (q) => q.series.map((l) => l.label).join('|');
        if (names(p) !== names(s.panels[0])) out.push(`${at}series: every panel has the same lines, in the same order, so a line is one colour throughout`);
      }
    });
    return [...new Set(out)];
  }
  if (s.type === 'heatmap') {
    const out = [];
    if (s.values.length !== s.rows.length) out.push(`values: one row of values per row label, ${s.rows.length}, not ${s.values.length}`);
    s.values.forEach((r, i) => { if (r.length !== s.columns.length) out.push(`values[${i}]: one value per column, ${s.columns.length}, not ${r.length}`); });
    if (s.mark && !s.rows.includes(s.mark.row)) out.push('mark.row: must be one of the row labels');
    if (s.mark && !s.columns.includes(s.mark.column)) out.push('mark.column: must be one of the column labels');
    return out;
  }
  if (s.type === 'dumbbell') {
    const kinds = new Set(s.rows.flatMap((r) => [kind(r.from), kind(r.to)]));
    if (kinds.size > 1) return ['rows: use all numbers or all dates, not both'];
  }
  if (s.type === 'series') {
    const kinds = new Set(s.points.map((p) => kind(p.x)));
    if (kinds.size > 1) return ['points: x values must be all numbers or all dates, not both'];
    const at = (x) => (typeof x === 'number' ? x : Date.parse(x));
    for (let i = 1; i < s.points.length; i++) if (at(s.points[i].x) <= at(s.points[i - 1].x)) return [`points[${i}].x: points must be in order of x, each later than the one before`];
    if (!s.points.some((p) => at(p.x) === at(s.mark.x))) return [`mark.x: must be the x of one of the points, not ${JSON.stringify(s.mark.x)}`];
  }
  if (s.type === 'entities') {
    const ids = s.records.map((r) => r.id);
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) return [`records: two records have the id "${dup}"`];
    const out = [];
    const pairs = new Set();
    s.refs.forEach((r, i) => {
      for (const end of ['from', 'to']) if (!ids.includes(r[end])) out.push(`refs[${i}].${end}: no record has the id "${r[end]}"; the ids are ${ids.map((x) => `"${x}"`).join(', ')}`);
      if (r.from === r.to) out.push(`refs[${i}]: a record pointing at itself; say it in its fields instead`);
      const key = r.from + '>' + r.to;
      if (pairs.has(key)) out.push(`refs[${i}]: a second reference from "${r.from}" to "${r.to}"; make it one reference`);
      pairs.add(key);
    });
    if (s.records.filter((r) => r.tone).length > 1) out.push('records: accent at most one record, the one to notice');
    const loose = ids.filter((id) => !s.refs.some((r) => r.from === id || r.to === id));
    if (loose.length) out.push(`records: ${loose.map((x) => `"${x}"`).join(', ')} ${loose.length === 1 ? 'is' : 'are'} not in any reference; leave ${loose.length === 1 ? 'it' : 'them'} out or add the reference`);
    return out;
  }
  return [];
}

/**
 * Checks a spec (an object or JSON text). Returns { ok: true, spec } or { ok: false, problems },
 * each problem one line naming where it is, e.g. `parts[2].value: must be more than 0`.
 */
export function parseSpec(input) {
  let data = input;
  if (typeof input === 'string') {
    try { data = JSON.parse(input); } catch (e) { return { ok: false, problems: [`Not valid JSON: ${e.message}`] }; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, problems: ['A spec is a JSON object with a "type"'] };
  if (!(data.type in TYPES)) return { ok: false, problems: [`type: must be one of ${Object.keys(TYPES).map((t) => `"${t}"`).join(', ')}${data.type === undefined ? '' : `, not ${JSON.stringify(data.type)}`}`] };
  const r = Spec.safeParse(data);
  if (!r.success) return { ok: false, problems: r.error.issues.map((i) => `${where(i.path)}${i.message}`) };
  const cross = crossChecks(r.data);
  if (cross.length) return { ok: false, problems: cross };
  const tones = new Set(items(r.data).map((x) => x.tone).filter(Boolean));
  if (tones.size > 2) return { ok: false, problems: [`tone: use at most two colours, one for what to notice; this uses ${[...tones].join(', ')}`] };
  return { ok: true, spec: r.data };
}

function where(path) {
  if (!path.length) return '';
  return path.reduce((s, p) => (typeof p === 'number' ? `${s}[${p}]` : s ? `${s}.${String(p)}` : String(p)), '') + ': ';
}
