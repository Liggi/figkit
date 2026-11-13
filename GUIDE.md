# figkit: explanatory images

Write a small HTML file, run the command below, and get a PNG to embed. The browser does the layout, so you never
work out coordinates or text widths: boxes size to their text, arrows route themselves around boxes, and the checks
measure the real result.

```
npx figkit figure.html [--out figure.png]
```

The file is just the `<main>` below; no doctype or `<head>` needed. Without `--out` the PNG goes to a temporary folder; the command prints where.
It prints the PNG, a preview of how small it sits inline on a phone (`figure-inline.png`, for looking at, never to
embed), and a list of problems. Fix every problem, open
the images and look, then embed the PNG: `![what it shows](/abs/path.png)`.

## Before you draw

- One figure, one point. Write the sentence it must get across; that sentence is the `<h1>`, 14 words at most. Two points are two figures.
- Draw only when position carries meaning: a flow, parts of a system, what owns or contains what, a chart, a before
  and after. Steps and comparisons with no shape are markdown lists and tables.
- Use real names and real numbers. Numbers that relate go in a shape (a split bar, bars, a chart), not a sentence.
- One colour for what the reader must notice (`accent`), at most one more with a second meaning (`second`), everything
  else grey. Say what each colour means in the reading line, in that colour. `good` and `bad` are for results only.
- Cut every word that explains how you got there. Labels, not sentences.

## Explaining a system

A question about structure ("what are the entities?", "where does X live?", "how do these relate?", "what loads
what?", "walk me through it") is answered with a picture first, not with numbered steps.

- "What are the entities and how do they relate?" is an `entities` spec (below), not boxes and arrows in HTML. It
  draws references: which record holds a pointer to which. The order work happens in (approve, then label, then
  train) is not a reference; it goes in prose, a list or a separate flow. A record that creates others still points
  at them: draw the pointers it holds, not the steps it runs. Draw every pointer a record holds, even when another
  line reaches the same record by a longer way; leaving one out says the column is not there.
- Each figure is a plain `fig` with at most 5 boxes and no `group`. More than that is two or three figures in a row,
  not one map: what exists, then one case through it, then what changes. A process or machine the code runs in is a
  `tag` on the box, not a box around it. Use `fig detail` only when the reader asked for the whole map.
- Under each figure, write only what it cannot show: why, the exceptions, what to do. Never retell it as steps.
- Put a real instance in each box, with its kind as the smaller line: "Refunds over £500" over "Approval rule",
  not a box that says only "Rule".
- Label where every flow starts and where its input comes from. An arrow that appears from nowhere gets asked about.
- When one thing feeds several, draw the copies: three workers each loading the catalogue is three copies and
  three arrows; one shared copy is one box fanning out to the three. "How many" must be visible without reading.
- Name each thing once, and use that name in the title, the boxes and your prose.

## Charts and entities from a spec

When the whole figure is one chart or one entities picture of a type below, write a JSON spec instead of HTML. You give the data; figkit
does the layout, colours and labels. Use HTML (the rest of this guide) for anything else, including a chart that sits
beside boxes or arrows.

```
npx figkit chart.json [--out chart.png]
```

A spec that breaks a rule is refused with one line per problem; fix them and run it again. Then look at the images
and embed the PNG, as for any figure.

`split`: parts of a whole, as one bar. 2 to 8 parts that add up to the whole; group the small ones as "Other".

```json
{ "type": "split", "title": "Search brings in most October trial sign-ups",
  "note": "By where the visitor came from", "unit": "%",
  "parts": [ { "label": "Search", "value": 58, "tone": "accent" }, { "label": "Referral", "value": 27 },
             { "label": "Ads", "value": 11 }, { "label": "Other", "value": 4 } ] }
```

`bars`: a few numbers compared, one bar each from zero. Up to 12 bars.

```json
{ "type": "bars", "title": "The new checkout halves the time to pay",
  "note": "Median time from cart to payment", "unit": " s",
  "bars": [ { "label": "Current checkout", "value": 86 }, { "label": "New checkout", "value": 41, "tone": "good" } ] }
```

`before-after`: one measure that changed, the two values side by side on one scale; `note` (required) says what
the number counts. For several things changing,
use `bars` or `dumbbell`.

```json
{ "type": "before-after", "title": "Late deliveries fell by three quarters after the route change",
  "note": "Share of orders delivered late", "unit": "%",
  "before": { "label": "Before 3 March", "value": 18 }, "after": { "label": "From 3 March", "value": 4.5, "tone": "good" } }
```

`dumbbell`: up to 8 rows, each a move from one value to another (dates or numbers), drawn as an arrow with the gap
labelled. `fromLabel` and `toLabel` name the two ends once. `gap` on a row replaces the computed gap text.

```json
{ "type": "dumbbell", "title": "Every spring release shipped later than planned",
  "fromLabel": "Planned", "toLabel": "Shipped",
  "rows": [ { "label": "Offline mode", "from": "2026-03-02", "to": "2026-03-09" },
            { "label": "Shared folders", "from": "2026-03-16", "to": "2026-04-06" } ] }
```

`series`: a line over time (or any ordered x) with exactly one point marked and labelled. Points in order of x; the
mark's `x` must be one of them. The y axis starts at zero unless `"zero": false`.

```json
{ "type": "series", "title": "Launch day brought twice the usual sign-ups",
  "note": "Trial sign-ups per day",
  "points": [ { "x": "2026-10-12", "y": 96 }, { "x": "2026-10-13", "y": 91 }, { "x": "2026-10-14", "y": 212 },
              { "x": "2026-10-15", "y": 131 }, { "x": "2026-10-16", "y": 98 } ],
  "mark": { "x": "2026-10-14", "label": "212, launch day" } }
```

`groups`: a few things measured for each of 2 to 6 groups, 2 to 4 series, one bar per series in each group, all
from zero. Use it when the point is a difference that shows in some groups and not others (before and after, one
segment against another); for one number per thing, use `bars`. Each group gets a heading and each bar its series
name and number, so there is no legend and no axis. `accent` is required: `{ "series" }` colours that series in every
group, `{ "series", "group" }` colours one bar; `"tone": "bad"` or `"good"` when the bar is a result.

```json
{ "type": "groups", "title": "Only the new carrier got slower in December",
  "note": "Median days from dispatch to doorstep", "unit": " days",
  "series": ["Old carrier", "New carrier"],
  "groups": [ { "label": "November", "values": [2.2, 2.1] }, { "label": "December", "values": [2.4, 3.6] } ],
  "accent": { "series": "New carrier", "group": "December", "tone": "bad" } }
```

`lines`: 2 or 3 lines on one axis, each named at its right end in its own colour. `accent` (required) names the
line the title is about; the others are grey. `mark` labels one point on the accent line. `xTicks` sets the axis
labels, e.g. hours as 12am, 6am, 12pm, 6pm, rather than 0 to 23. More than 3 lines is `panels`.

```json
{ "type": "lines", "title": "Weekday orders peak at noon", "note": "Orders per hour",
  "series": [ { "label": "Weekdays", "points": [ { "x": 0, "y": 3 }, { "x": 12, "y": 30 }, { "x": 23, "y": 4 } ] },
              { "label": "Weekends", "points": [ { "x": 0, "y": 4 }, { "x": 12, "y": 22 }, { "x": 23, "y": 6 } ] } ],
  "accent": "Weekdays", "mark": { "x": 12, "label": "30 at noon" },
  "xTicks": [ { "x": 0, "label": "12am" }, { "x": 12, "label": "12pm" } ] }
```

`panels`: small multiples, the same `groups` or `lines` chart drawn for 2 to 4 parts side by side, on one shared
scale so the panels compare; stacked on a phone. `chart` says which. For `groups`, `series` and `accent` are given once
at the top and each panel has its `groups`; for `lines`, `accent` is the line's label and every panel has the same
lines in the same order. Use it when one chart would need more than 3 lines or 4 series, or the parts measure
different things on the same scale.

```json
{ "type": "panels", "chart": "groups", "title": "The cheaper plan answers almost as fast as the premium one",
  "note": "Share of tickets answered within an hour", "unit": "%", "max": 100,
  "series": ["Basic", "Standard", "Premium"], "accent": { "series": "Standard" },
  "panels": [ { "label": "Email", "groups": [ { "label": "Weekdays", "values": [61, 84, 89] } ] },
              { "label": "Chat", "groups": [ { "label": "Weekdays", "values": [72, 91, 94] } ] } ] }
```

`heatmap`: a grid of values over two dimensions (day by hour, team by week), coloured from pale to dark blue: darker
is always more. Up to 12 `rows` and 31 `columns`; `values` is one array per row. `note` (required) says what the
colour counts, and the scale is drawn above the grid. Here the colour is the measure, so the one-accent rule moves:
`mark` outlines the one cell to notice in the accent colour and names it beside the scale. Cells show their numbers
when there is room. Columns label themselves at even steps, so give hours as "12am", "1am", … and they read 12am,
6am, 12pm, 6pm.

```json
{ "type": "heatmap", "title": "The help desk is busiest midweek mornings", "note": "Tickets opened per hour",
  "rows": ["Mon", "Tue", "Wed"], "columns": ["9am", "10am", "11am", "12pm"],
  "values": [ [22, 25, 27, 28], [23, 26, 29, 30], [24, 27, 30, 32] ],
  "mark": { "row": "Wed", "column": "12pm", "label": "Busiest: Wed noon" } }
```

`entities`: what the things are and which points at which. 2 to 5 `records`, each with an `id` you use in `refs`,
a `name` in the reader's words, and up to 4 `fields` that say what it holds (put a table name here only if the reader
needs it). Each of up to 8 `refs` is a pointer the `from` record holds to the `to` record: `count` is how many `from`
records can point at one `to` (`"many"`, the default, or `"one"`), and `"optional": true` when the pointer may be
empty. figkit places the records (what is pointed at sits above what points at it) and draws each reference as a line
joined at the records' names: a dot on the record named, and on the holder a crow's foot when many can point at one or
a short bar when only one can; dashed when it may be empty; never an arrow, never a key. It draws a two-column layout
for a phone. Every record must be in a reference. Accent at most one record: the one the title is about. The title
claims only what the lines show; if it says "everything names X", every record has a line to X. Names and fields are
in plain words, not in-house terms or button labels.

```json
{ "type": "entities", "title": "Every order line names one product and one order",
  "records": [ { "id": "order", "name": "Order", "fields": ["placed at"] },
               { "id": "line", "name": "Order line", "fields": ["quantity"], "tone": "accent" },
               { "id": "product", "name": "Product", "fields": ["sku"] },
               { "id": "payment", "name": "Payment" } ],
  "refs": [ { "from": "line", "to": "order" },
            { "from": "line", "to": "product" },
            { "from": "payment", "to": "order", "count": "one", "optional": true } ] }
```

More than 5 records is two figures: the core records, then one corner of it with the core record it hangs off.

Flows (boxes and arrows) have no spec: write them in HTML, below.

- `title` (required) is the point, 14 words at most. `note` is the reading line under it; `source` a footer.
- `"style": "report"` draws a light chart in one sans font, for a chart that sits in a page: a research report, a doc.
  It also draws a phone layout, `chart.phone.png`. Leave it out for the default dark figure for a dark chat.
- Keep `note` to what is measured, and "lower is better" where it applies; dates and method go in `source`.
- `unit` is printed straight after each number. `show` on an item replaces its printed value, e.g. `"11 of 29"`.
- `tone` is `accent` for what to notice, `good` or `bad` when it is a result; at most two tones in a chart. Leave the rest grey.
- `bars` takes `max` to fix the end of the axis (e.g. 100 for percentages) and a short `note` per bar.
- Labels are plain text, 40 characters at most. Put bars in reading order (before, then after).
- Examples: `examples/charts/` in the figkit package.

## The page

```html
<main class="fig">                 <!-- add "detail" for a map to open and read; "paper" for a light figure for docs; "report" for a light chart in a page, in one sans font -->
  <header>
    <h1>The point, stated. <em>The part to notice</em></h1>
    <p class="read">How to read it. <b class="t-accent">Orange</b> means code.</p>
  </header>
  ... the picture ...
  <footer><p>Source and date, if the reader needs them.</p></footer>
</main>
```

- In the `<h1>`, `<em>` turns the words accent-coloured italic and `<br>` sets a line break.
- `fig` is a glance figure, 960 wide: one point, big type, reads inline on a phone. At most 5 boxes, 8 arrows and 70 words.
- `fig detail` is 1360 wide, for a flow or map the reader asked for and opens full screen; to explain a system, use
  several `fig` figures instead (see Explaining a system). At most 18 boxes, 18 arrows and 190 words.
  Widen it with `style="--w: 1560px"` only when a row will not fit.
- Height follows the content. There is no fixed canvas to fill.
- Text must be at least 15px; the theme's sizes all pass. The phone line the command prints is information, and only the problems list needs fixing.

## Sides that stack on a phone

Two or three columns compared side by side (before and after, now and proposed) shrink to unreadable text inline on
a phone. Add `sides` to the row or grid that holds them, `<div class="grid sides" style="--cols: 2">`, and the command
also draws a phone layout, `figure.phone.png`, with the columns one above the other at a narrower width. Embed only
`figure.png`; a viewer that knows the convention shows the phone layout on narrow screens, and any other shows the
figure. The checks run on both layouts.

- Use it for columns that each make sense alone. Arrows from one column to another get routed round the stack on a
  phone, and the checks report it; leave those figures side by side.
- If the command says your columns will shrink on a phone, it found columns with no arrows between them that are not
  marked as sides.

## Layout: ordinary CSS

Use flex and grid; write inline `style` freely.

| Helper | Effect |
|---|---|
| `row`, `col` | flex row or column. Children of a row stretch to equal height, with text at the top |
| `grid` | equal columns; set `--cols` |
| `grow` | child takes an equal share of the width. Long labels then wrap, and no check flags that |
| `fit` | child keeps its natural width |
| `middle`, `top`, `bottom` | cross-axis alignment; `middle` stops boxes of different text length stretching |
| `center`, `between` | main-axis centring or space-between |
| `tight` | an 8px gap |
| `arrows`, `wide` | the gap for arrows; `wide` is 1.6 times `arrows`, for arrows with labels |

A row or column whose children are joined by arrows needs room for them: add `arrows` or `wide`, or set `column-gap`
to 44px or more. `between` combines with either. Put things that should line up in the same row, column or grid;
never nudge with margins.

## Boxes

```html
<div class="node accent" id="route">
  <h3>Route to a carrier</h3>
  <p>A table instead of code</p>
  <span class="tag">routing.yaml</span>
</div>
```

| Class | What it is |
|---|---|
| `node` | a box; add `accent`, `second`, `good`, `bad` for its colour |
| `node fill` | solid colour: the one thing to notice, or a start and end point |
| `node tint` | a wash of its colour: marks a set of boxes that share something, more quietly than `fill` |
| `node dashed` / `quiet` | optional or background things |
| `node bare` | text with no box that arrows can still attach to |
| `node pill` | rounded start or end; its text is centred, other nodes are left-aligned |
| `decision` | a diamond; put the question in a `<span>`, keep it short |
| `group` | a dashed container; its first child `<span class="label">` names it. `group flush` lines its contents up with the boxes outside it |
| `num` | a big number inside a node |
| `tag` | a small mono line: where something lives |
| `step` | a numbered badge on a node's corner |
| `note` | loose grey text; `lane-title` a column heading |

## Arrows

```html
<fig-arrow from="route" to="load" label="draft"></fig-arrow>
<fig-arrow from="check" to="route" accent label="Yes: start again" from-side="top" to-side="top"></fig-arrow>
```

Put them anywhere inside the figure; `from` and `to` are element ids. Any element can be an end: a node, a group, a
`mark` on a screenshot, a `<span>` of text. Arrows keep clear of boxes and loose text, and arrows sharing an end and
a colour share a trunk. When a label has no free place, figkit opens the gap between the two boxes (or widens the
figure a little) and draws again; keep labels to a few words so it rarely has to.

- colour: `accent`, `second`, `good`, `bad`; `dashed`; `weight="3"`; `both` for two heads; `head="none"`
- `blocked`: a route that does not exist. The line stops short of the target at a cross, with no arrowhead
- `from-side` / `to-side`: `top`, `right`, `bottom`, `left` when the automatic side reads wrong
- `from-at` / `to-at`: 0 to 1 along that side, to separate two arrows on one side, such as a pair going there and back
- `route="curve"` for a loose pointer such as a note to a screenshot; `route="straight"` for a direct line
- `label-at="start"` or `"end"` to move a label

If the checks report a crossing or a route through a box, move the boxes; do not fight it with more attributes.

## Numbers

Parts of a whole:

```html
<fig-split unit="%">
  <part value="58.6" accent>National post</part>
  <part value="32.3">Parcel lockers</part>
  <part value="9.1">Other</part>
</fig-split>
```

Segments too thin for their label move it to a line under the bar. `show="11 of 29"` overrides the printed value.
`unit` is printed straight after the number, so write `unit=" s"` for a space. Parts must add up to a whole; for a real
time axis with marked points, use Plot below.

A few numbers compared:

```html
<fig-bars unit="%" max="100">
  <bar value="58.6" accent>National post</bar>
  <bar value="32.3" note="cheapest">Parcel lockers</bar>
</fig-bars>
```

Grouped bars, several lines, small multiples and heat maps have specs (`groups`, `lines`, `panels`, `heatmap`); use
them when the chart is the whole figure. Anything else (dots, intervals, distributions, a chart beside boxes) is
Observable Plot, already loaded with d3:

```html
<div id="chart"></div>
<script>
  fig.plot("#chart", ({ Plot, d3, width, theme }) => ({
    height: 360, marginLeft: 44,
    x: { label: null }, y: { label: null, grid: true, ticks: 4 },
    marks: [
      Plot.lineY(rows, { x: "day", y: "n", stroke: theme.soft, strokeWidth: 2.5 }),
      Plot.dot([peak], { x: "day", y: "n", fill: theme.accent, r: 6 }),
      Plot.text([peak], { x: "day", y: "n", text: () => "131 on 3 Feb", dx: 12, textAnchor: "start", fill: theme.accent, fontWeight: 600, fontSize: 17 }),
    ],
  }));
</script>
```

`theme` has `ink`, `muted`, `soft`, `fill`, `fill2`, `line`, `accent`, `second`, `good`, `bad`. Draw the series in `fill`, the thing to
notice in `accent`, and label it directly on the chart; no legends. Start bar axes at zero.

## Screenshots

```html
<div class="shot"><img src="/abs/path/page.png">
  <div class="mark" id="m1" style="left: 3%; top: 30%; width: 94%; height: 36%"></div>
</div>
<div class="node bare" id="n1"><h3>One row per measure</h3></div>
<fig-arrow from="n1" to="m1" accent route="curve"></fig-arrow>
```

## What the checks catch, and what they cannot

Measured in the rendered page: text past its box or the frame, text too small, boxes and labels that overlap, arrows
through boxes, arrows crossing, edges that almost line up, too many words, boxes, arrows or colours, facts strung
together with separators, a missing or long title.

They cannot tell whether the picture is clear, true to the mechanism, or worth drawing. Look at the images yourself,
and before an important figure goes out, give the PNGs, without your reasoning, to someone who has not seen them
and ask what they take from it.
