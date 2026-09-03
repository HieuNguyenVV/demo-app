---
name: generate-drawio
description: Use when the user wants a draw.io / diagrams.net flowchart, architecture, or process diagram as a .drawio file.
---

# Generate draw.io diagram

Call `generate-drawio` when the user asks for a draw.io, diagrams.net, mxfile, flowchart, architecture diagram, or process diagram they can open and edit.

Do not use `generate-file` for this. That tool cannot emit a valid `.drawio` file.

## Input rules

- Set `fileName` without extension, for example `checkout-flow`.
- Optional `title` is the page name inside draw.io.
- Optional `direction`: `top-down` (default, flowcharts) or `left-right` (pipelines).
- Put every box in `nodes`. Each node needs a unique `id` (`start`, `pay`) and a short `label`.
- Use `kind` when the shape matters: `start`, `end`, `process`, `decision`, `data`. Default `process`.
- Put connectors in `edges` with `from` / `to` matching node ids. Use `label` for yes/no or protocol names.
- Infer a clear graph from the user's description. Do not invent unrelated systems.
- Stay within 40 nodes and 80 edges. Split huge maps into focused diagrams if needed.

## After the tool returns

Tell the user the `fileName`, `nodeCount`, and `edgeCount` from `summary`.
They should download the `.drawio` file and open it at https://app.diagrams.net or in the draw.io desktop app.
Do not paste the XML `content` into chat unless the user explicitly asks for the source.
