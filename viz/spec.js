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

export const Spec = z.discriminatedUnion('type', [SplitSpec, BarsSpec, BeforeAfterSpec, DumbbellSpec, SeriesSpec, EntitiesSpec]);
export const TYPES = { split: SplitSpec, bars: BarsSpec, 'before-after': BeforeAfterSpec, dumbbell: DumbbellSpec, series: SeriesSpec, entities: EntitiesSpec };

const items = (s) => s.parts ?? s.bars ?? s.rows ?? s.records ?? (s.after ? [s.after] : []);
const kind = (v) => (typeof v === 'number' ? 'number' : 'date');

/** Rules that span fields: x values of one kind, in order, and a mark that is one of the points. */
function crossChecks(s) {
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
