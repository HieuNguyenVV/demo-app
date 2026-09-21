---
name: generate-sequencediagram
description: Use when the user wants a sequence diagram, UML sequence, interaction diagram, or request/response timeline, including if/else, loops, notes, and parallel paths. Returns both a .drawio file and a SequenceDiagram.org .txt source file.
---

# Generate sequence diagram

Call `generate-sequencediagram` when the user asks for a sequence diagram, UML sequence, tương tác giữa các hệ thống, luồng request/response, **if/else**, **loop**, **note**, or **parallel**.

The tool returns **two files**:
- **`.drawio`** — OpenAI-drawn diagram, open in diagrams.net
- **`.txt`** — SequenceDiagram.org source so they can edit

Do **not** use `generate-drawio` for this.
Do **not** use this tool to search the web. Call `inkline-search` instead.

OpenAI **draws** the sequence. Pass the user's request through; do not invent participants or messages.

## Input

- `fileName` without extension, for example `dang-nhap`.
- `title`: short heading, Vietnamese is fine.
- `prompt`: the user's request **as they wrote it**, including if/else, loop, and actors. Do not rewrite into JSON steps.

## After the tool returns

Tell the user both `fileName` (`.drawio`) and `txtFileName` (`.txt`), plus `participantCount` and `messageCount` from `summary`.
They can open the `.drawio` at https://app.diagrams.net, or paste the `.txt` into https://sequencediagram.org to edit.
Do not paste `content` or full `txtContent` unless they ask.
