---
title: "Inline Widgets — Charts, dashboards and diagrams drawn in desktop chat"
sidebar_label: "Inline Widgets"
description: "Charts, dashboards and diagrams drawn in desktop chat"
---

{/* This page is auto-generated from the skill's SKILL.md by website/scripts/generate-skill-docs.py. Edit the source SKILL.md, not this page. */}

# Inline Widgets

Charts, dashboards and diagrams drawn in desktop chat.

## Skill metadata

| | |
|---|---|
| Source | Bundled (installed by default) |
| Path | `skills/creative/inline-widgets` |
| Version | `1.2.0` |
| Author | Hermes Agent |
| License | MIT |
| Platforms | linux, macos, windows |
| Tags | `widgets`, `charts`, `diagrams`, `dashboards`, `desktop`, `visualization` |
| Related skills | [`architecture-diagram`](../../bundled/creative/creative-architecture-diagram.md) |

## Reference: full SKILL.md

:::info
The following is the complete skill definition that Hermes loads when this skill is triggered. This is what the agent sees as instructions when the skill is active.
:::

# Inline Widgets Skill

Draw a chart, KPI card, diagram, table or small calculator inside the reply itself, in a sealed frame that
follows the app's theme. It covers the desktop app's ` ```widget ` fence and the `::preview{file}` directive;
it does not cover plain Markdown tables, standalone web pages, or any other surface (CLI, messaging,
TUI), where a widget would print as raw HTML.

## When to Use

- The answer is a number series, a comparison, a breakdown, a flow, a place or a video — or the user asks
  for a chart, a diagram or a dashboard — and a picture says it faster than prose.
- The platform hint says you are in the desktop app. Anywhere else, answer in text or write an
  image/file the user can open.
- **Not** for small talk, a one-line fact, an explanation or advice: those are plain text, always.
- Not for a full page: write an HTML file and use `::preview{file="…"}` for anything bigger than one screen.

## Five Rules (read these first)

1. **Text by default.** Draw only when the answer *is* data, a flow, a place or a video, or when asked.
2. **The block goes in your reply.** Write the ` ```chart ` / ` ```card ` / ` ```mermaid ` / ` ```widget `
   fence straight into your answer. Never write it into a file, never wrap it as `::card{…}` or
   `::chart{…}`, never answer with a file path instead of the chart.
3. **Native first.** A standard chart is a ` ```chart ` block of JSON — not Chart.js, not an HTML page. A
   process is a ` ```mermaid ` block. A ` ```widget ` is only for what those cannot say.
4. **The app owns the look.** No hex colours, no page background, no font, no emoji icons. Colour comes
   from the theme (`var(--accent)`, `var(--foreground)`, …) and follows light and dark on its own.
5. **Real data only.** Never invent numbers, places, prices, photos or video ids to fill a block.

## Dashboards

"Make me a dashboard" in chat means native blocks in your reply — not an HTML file, not Chart.js, not
Tailwind, even with fictional data. A dashboard is several native blocks, not one HTML page: a ` ```chart ` of `"type": "kpi"` for the
headline numbers, then one ` ```chart ` per view (trend, breakdown, comparison, table), each with a
`title` and a one-line takeaway after it. That keeps every part themed, sized and readable on any window.
Build an HTML dashboard only when the user asks for one file they can keep — then write it with the
theme variables and show it with `::preview{file="…"}`.

## Prerequisites

- Hermes desktop app (the frame only exists there). No packages, no API keys.
- Scripts, styles and fonts may load from `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com` and
  `esm.sh` only — pin a version in the URL. Anything else (an API) needs `<meta name="hermes:network"
  content="api.example.com">` and the user's approval; prefer inlining the data.

## How to Run

1. Pick the closest file from the table below with `read_file` (paths are relative to this skill).
2. Replace the data block at the top of its `<script>` with the user's real numbers and edit the labels.
3. Reply with one sentence of context, then the widget as a fenced block — the fence is the widget:

````
```widget
<style>…</style>
<div>…</div>
<script>…</script>
```
````

## Choosing the Form

Pick the lightest form that says it; never invent data, coordinates, prices or photos to fill one.

| The answer is… | Use |
| --- | --- |
| a fact, a sentence, a short list | plain text |
| a few rows of facts | a Markdown table |
| numbers to compare, a trend, a share, headline KPIs, rows to sort | ` ```chart ` |
| a place, places on a map, a plan, an event, a product, a link, YouTube videos | ` ```card ` |
| a flowchart, sequence or ER diagram | ` ```mermaid ` |
| something to use — a calculator, a custom diagram, a tool | ` ```widget ` (templates below) |
| a page, a mockup, a game | an HTML file and `::preview{file=…}` |

One block per idea: two products are two cards, a trend and a breakdown are two charts. Put a sentence
of context before a block and the takeaway after it. `references/examples.md` has a worked example for
each form — every one of them is drawn by the app's own parsers in CI.

## Charts First: the ```chart Fence

A standard chart is data, not HTML. Write a ` ```chart ` block of JSON and the app draws it natively —
themed, sized to the window, with tooltips, a clickable legend and Ctrl/⌘-wheel zoom on long series.
Reach for a `widget` only when a chart spec cannot say it.

| `type` | Fields |
| --- | --- |
| `bar`, `line`, `area` | `categories` (labels), `series: [&#123;name, data: [numbers or null]&#125;]`, optional `stacked`, `horizontal` (bar) |
| `donut`, `pie` | `slices: [&#123;name, value&#125;]` |
| `scatter` | `series: [&#123;name, data: [[x, y], …]&#125;]` |
| `kpi` | `kpis: [&#123;label, value, delta?, trend?: [numbers]&#125;]` — `delta` is a signed percentage |
| `table` | `columns: [names]`, `rows: [[cells]]` — one cell per column; sortable, numbers right-aligned |

Every type takes `title`, `subtitle`, `format` (`number` · `currency` · `percent` · `compact`),
`currency` (ISO code, default USD) and `unit` (a suffix such as `" ms"`). Percentages are written as
people write them (`12.5` means 12.5%). Limits: 8 series, 2000 points, 12 slices, 8 KPIs, 200 rows.

````
```chart
{"type": "bar", "title": "Revenue by channel", "subtitle": "Thousands of dollars, 2026",
 "format": "currency", "categories": ["Q1", "Q2", "Q3", "Q4"],
 "series": [{"name": "Direct", "data": [42, 51, 47, 63]}, {"name": "Partners", "data": [18, 22, 26, 31]}]}
```
````

## Cards: the ```card Fence

The fixed moments of a conversation are drawn by the app as native cards in one design line. Write a
` ```card ` block of JSON; the buttons a card shows only open the links it names or put a sentence in
the chat (a product's **Buy** asks you to walk the user through it — it never orders anything).

| `type` | Fields |
| --- | --- |
| `place` | `name`, `category`, `price` ("$$"), `rating` (0–5), `reviews`, `open` (bool), `status` ("until 22:00"), `address`, `lat`, `lng`, `image`, `url`, `note` — with coordinates it gets a live map |
| `map` | `title`, `subtitle`, `places: [place…]` — each needs `name`, `lat`, `lng`; photos become pins |
| `itinerary` | `title`, `subtitle`, `image`, `days: [&#123;label, items: [&#123;time, title, place, note&#125;]&#125;]` |
| `event` | `title`, `start` (ISO; a date alone means all day), `end`, `location`, `note`, `url`, `image` — offers Add to calendar |
| `product` | `name`, `brand`, `price`, `was`, `currency`, `rating`, `reviews`, `merchant`, `stock`, `badge`, `image`, `url`, `features: […]` |
| `link` | `url`, `title`, `description`, `image`, `site` |
| `video` | `url` (a YouTube link — required), `title`, `channel`, `duration` ("12:34" or seconds), `views`, `published`, `thumbnail` — a poster with a play button; pressing it plays the video right there |
| `videos` | `title`, `subtitle`, `videos: [video…]` — the first is the stage, the rest a row of posters to choose from |

Links and images must be `https://` (or `http://`); anything else is dropped. Use real coordinates and
real image URLs — never invent a photo. For a video, copy the title, channel and duration from the search result you found it in, and leave out what you do not know; a poster is added from the video id. A lone video the user only needs a link to can also be its bare URL on its own line (it shows a Load button). Limits: 20 places, 14 days × 12 items, 6 features, 8 videos.

## Quick Reference

Templates are for a custom widget only — never for a standard chart or a dashboard, which are
` ```chart ` blocks. For a widget the chart fence cannot express, start from a template:

| Need | Template | Library |
| --- | --- | --- |
| Headline numbers with trend | `templates/kpi-cards.html` | none |
| Compare categories | `templates/bar-chart.html` | Chart.js 4.4.1 |
| A series over time | `templates/line-chart.html` | Chart.js 4.4.1 |
| Share of a whole | `templates/donut-breakdown.html` | none |
| Process, architecture, request path | `templates/flow-diagram.html` | none (inline SVG) |
| Browse, sort, filter rows | `templates/sortable-table.html` | none |
| "What if" with sliders | `templates/slider-calculator.html` | none |

For a plain flowchart, sequence or ER diagram a ` ```mermaid ` fence is lighter than a widget; reach for
a widget when the diagram needs custom layout, colour or interaction.

## Procedure

**Write in this order:** `&lt;style>`, then markup, then `&lt;script>` last. The frame draws markup while you
write and runs scripts only once the block is complete, so the user watches it build instead of staring at
a blank box.

**Design rules (what makes it look native and premium):**

- Colour only through the theme variables the frame injects: `var(--foreground)`, `var(--muted-foreground)`,
  `var(--accent)`, `var(--border)`, `var(--card)`. Never set a page background, font or margin — the frame
  already gives a transparent canvas, the app font and zero margins. Dark mode follows for free.
- Surfaces are `color-mix(in srgb, var(--foreground) 3%, transparent)` with a 1px `var(--border)` and
  12–16px radius. No drop shadows, no gradients except a faint area fill under a line.
- One accent. Tint it for secondary series (`color-mix(in srgb, var(--accent) 60%, var(--card))`) instead
  of adding hues. Use green/red only for good/bad deltas.
- Type: 12–13px for labels in `--muted-foreground`, 15px for titles at weight 600, 26–32px for the hero
  number with `font-variant-numeric: tabular-nums` and slight negative letter-spacing.
- Spacing on a 4px grid (8, 12, 16).
- **Size:** charts, tables, dashboards and diagrams take `width:100%` — the frame gives them the text
  column, widened to about 900px on a wide window, and keeps them there as the window changes. Give
  a chart's box a height that follows the width — `height: clamp(200px, 44vw, 400px)` (vw is the
  frame's width) — never a fixed pixel height, and never `aspect-ratio` with a `min-height` (that pins a
  minimum width and the chart stops shrinking). A small
  card or calculator takes `width:100%; max-width:` its natural size (about 440px): it lines up with
  the text like an image. Inside, `@media (max-width: 480px)` adapts the layout to a narrow window.
  Do not centre with wrappers.
- Chart.js colours must be concrete: read them once with `getComputedStyle(document.documentElement)`.
  `color-mix(…)` strings are fine as canvas colours.
- Label every control, keep click targets ≥ 28px, show units, and round numbers for people.

**Talking back:** `window.hermes.send("prompt")` — or `data-hermes-send="prompt"` on any clickable
element — sends a hidden turn to you. Answer it with a new ` ```widget `, not prose. Use sparingly, for
things the widget cannot do itself ("explain this bar", "drill into Q3").

**Keeping it:** the user can save a finished widget to the Library (the bookmark on hover). There it
becomes an interactive block with `hermes.state`/`hermes.save` for data and the same theme variables.

## Pitfalls

- A script that needs a host outside the four CDNs fails silently. Inline the data, or declare the host.
- Unpinned library URLs (`chart.js` without `@4.4.1`) break whenever the library ships a new major.
- Tall widgets are clamped at 1200px; wide ones at about 900px, or the text column on a narrow window.
  Design for 280px up to 900px.
- `alert()`, `localStorage` and navigation do nothing in the sealed frame. Keep state in JS variables.
- A widget's width is measured once, from its first layout: don't animate it in from zero width.
- Do not rely on `window.hermes.send` in a widget the user will save: in the Library it answers
  undelivered. Guard calls with `.then(r => r.ok)`.

## Verification

- The user sees the markup appear while you write, then the chart or controls come alive when the block
  closes. If the box stays empty, the fence language is not exactly `widget`.
- Switch the app theme: the widget reloads in the new colours with no hard-coded colours left behind.
- Every external URL is on the CDN list above with a pinned version.
