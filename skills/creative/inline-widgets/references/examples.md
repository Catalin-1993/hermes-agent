# Worked Examples

One request per scenario, the form it calls for, and the exact block. Every ```chart and ```card block
here is drawn by the app's own parsers in CI (`apps/desktop/src/components/assistant-ui/cards/skill-examples.test.ts`),
so a block copied from this file is known to render.

## "How did revenue do by quarter, per channel?" → chart (bar, several series)

```chart
{"type": "bar", "title": "Revenue by channel", "subtitle": "Thousands of dollars, 2026", "format": "currency",
 "categories": ["Q1", "Q2", "Q3", "Q4"],
 "series": [{"name": "Direct", "data": [42, 51, 47, 63]}, {"name": "Partners", "data": [18, 22, 26, 31]}]}
```

## "Show active users over the last weeks" → chart (area, one series, compact numbers)

```chart
{"type": "area", "title": "Weekly active users", "subtitle": "Last 8 weeks", "format": "compact",
 "categories": ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
 "series": [{"name": "Active users", "data": [11800, 12400, 12100, 13900, 14600, 14200, 15800, 16900]}]}
```

## "Where does the money come from?" → chart (donut, parts of a whole)

```chart
{"type": "donut", "title": "Revenue mix", "format": "currency",
 "slices": [{"name": "Subscriptions", "value": 54000}, {"name": "Services", "value": 26000}, {"name": "One-time", "value": 14000}]}
```

## "Give me the headline numbers" → chart (kpi)

```chart
{"type": "kpi", "format": "currency", "kpis": [
  {"label": "Revenue", "value": 48200, "delta": 12.4, "trend": [8, 11, 10, 14, 13, 17, 19]},
  {"label": "Churn", "value": "1.9%", "delta": -0.6}
]}
```

## "Compare these accounts" → chart (table, sortable)

```chart
{"type": "table", "title": "Top accounts", "format": "currency", "columns": ["Account", "Region", "ARR"],
 "rows": [["Cascade", "AMER", 65500], ["Atlas", "EMEA", 48200], ["Beacon", "APAC", 39100]]}
```

## "Find me a good BBQ place" → card (place)

```card
{"type": "place", "name": "Joe's Kansas City", "category": "BBQ", "price": "$$", "rating": 4.6, "reviews": 1284,
 "open": true, "status": "until 21:00", "address": "3002 W 47th Ave, Kansas City, KS", "lat": 39.0377, "lng": -94.6302,
 "note": "Known for the Z-Man sandwich; expect a line at lunch."}
```

## "Coffee spots near me" → card (map)

```card
{"type": "map", "title": "Specialty coffee nearby", "places": [
 {"name": "Origo", "category": "Roastery", "rating": 4.7, "open": true, "lat": 44.4360, "lng": 26.0985},
 {"name": "Steam Coffee", "category": "Coffee bar", "rating": 4.3, "open": true, "lat": 44.4290, "lng": 26.1090}
]}
```

## "Plan my weekend in Jasper" → card (itinerary)

```card
{"type": "itinerary", "title": "Weekend in Jasper", "subtitle": "2 days · 2 adults", "days": [
 {"label": "Day 1 · Sat", "items": [{"time": "09:00", "title": "Maligne Canyon icewalk", "place": "Maligne Canyon"}]},
 {"label": "Day 2 · Sun", "items": [{"time": "10:00", "title": "Jasper SkyTram", "note": "Book the first car"}]}
]}
```

## "Put the review on my calendar" → card (event)

```card
{"type": "event", "title": "Product review with design", "start": "2026-10-14T15:00:00", "end": "2026-10-14T16:00:00",
 "location": "Studio B · 3rd floor"}
```

## "Which stroller should I buy?" → card (product), one per finalist

```card
{"type": "product", "name": "Bugaboo Fox 5", "brand": "Bugaboo", "price": 1099, "was": 1299, "currency": "USD",
 "rating": 4.8, "reviews": 2310, "merchant": "Nordstrom", "stock": "In stock",
 "features": ["Folds one-handed", "All-terrain suspension"]}
```

## "Send me the docs" → card (link)

```card
{"type": "link", "url": "https://maplibre.org", "title": "MapLibre — open-source maps",
 "description": "Interactive vector maps in the browser, community governed."}
```

## "Show me how to make sourdough" → card (video), or videos for a few

```card
{"type": "video", "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw", "title": "Me at the zoo",
 "channel": "jawed", "duration": "0:19", "views": "350M", "published": "19 years ago"}
```

```card
{"type": "videos", "title": "Sourdough for beginners",
 "videos": [
  {"url": "https://youtu.be/dQw4w9WgXcQ", "title": "The starter, day by day", "channel": "Bread Lab", "duration": "12:04"},
  {"url": "https://youtu.be/jNQXAC9IVRw", "title": "Shaping and scoring", "channel": "Bread Lab", "duration": "8:41"}]}
```

Only for real videos you found (a search result gives the URL, title and channel) — never a guessed id.

## Not a card, not a chart

- "What's the capital of Peru?" → one sentence. No block.
- "Show how the request flows through the services" → a ```mermaid flowchart (or the flow-diagram
  template when it needs custom layout).
- "Build me a mortgage calculator" → a ```widget from `templates/slider-calculator.html`.
- "Five rows of plain facts" → a Markdown table; a chart table is for numbers someone will sort.
