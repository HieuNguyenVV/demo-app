---
name: generate-drawio
description: Use when the user wants a draw.io / diagrams.net flowchart or architecture diagram as a .drawio file. For sequence diagrams use generate-sequencediagram.
---

# Generate draw.io diagram

Call `generate-drawio` when the user asks for a draw.io, diagrams.net, mxfile, flowchart, architecture diagram, or process diagram they can open and edit.

For a **sequence diagram**, UML sequence, request/response timeline, **if/else**, or **loop**, call `generate-sequencediagram` instead.

Do not use this tool to search the web. Call `inkline-search` instead.

OpenAI **draws** the diagram. Pass the user's request through; do not invent `nodes` or `edges`.

## Input

- `fileName` without extension, for example `duyet-nghi-phep`.
- `title`: short heading, Vietnamese is fine.
- `prompt`: the user's request **as they wrote it** (process, decisions, yes/no). Do not rewrite into a graph.

## After the tool returns

Tell the user the `fileName`, `nodeCount`, and `edgeCount` from `summary`.
They should download the `.drawio` file and open it at https://app.diagrams.net.
Do not paste the XML `content` into chat unless they ask.
