---
name: generate-drawio
description: Use when the user wants a draw.io / diagrams.net flowchart or architecture diagram as a .drawio file. For sequence diagrams use generate-sequencediagram.
---

# Generate draw.io diagram

Call `generate-drawio` when the user asks for a draw.io, diagrams.net, mxfile, flowchart, architecture diagram, or process diagram they can open and edit.

For a **sequence diagram**, UML sequence, request/response timeline, **if/else**, or **loop**, call `generate-sequencediagram` instead.

Do not use `generate-file` for this. That tool cannot emit a valid `.drawio` file.

## Input rules (layout quality)

The backend lays out the graph. Ugly diagrams almost always come from messy input — keep the graph clean.

- `fileName` without extension, for example `checkout-flow`.
- `title`: short page heading, Vietnamese is fine.
- `direction`: `top-down` for flowcharts with yes/no; `left-right` for pipelines, timelines, and request/response chains. The backend balances columns, side branches, and page size — keep the graph simple and let it layout.
- Every box in `nodes`. Unique `id` (`start`, `pay`). **Short labels** (1–6 words). Do not put a paragraph in a box.
- Set `kind` so shapes match meaning:
  - `start` / `end` — terminals
  - `decision` — questions (diamond). Pair with edge labels `Có` / `Không` or `Yes` / `No`
  - `data` — document, record, database
  - `process` — a step (default)
- `edges` `from` / `to` must match ids. One primary path down/right. Avoid dumping a complete mesh.
- Put nodes in **flow order** (start first, end last). Infer a clear graph; do not invent unrelated systems.
- Stay within 40 nodes and 80 edges. Split huge maps into focused diagrams.

## After the tool returns

Tell the user the `fileName`, `nodeCount`, and `edgeCount` from `summary`.
They should download the `.drawio` file and open it at https://app.diagrams.net or in the draw.io desktop app.
Do not paste the XML `content` into chat unless the user explicitly asks for the source.
