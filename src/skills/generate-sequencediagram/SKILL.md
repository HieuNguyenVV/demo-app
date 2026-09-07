---
name: generate-sequencediagram
description: Use when the user wants a sequence diagram, UML sequence, interaction diagram, or request/response timeline. Returns both a .drawio file and a SequenceDiagram.org .txt source file.
---

# Generate sequence diagram

Call `generate-sequencediagram` when the user asks for a sequence diagram, UML sequence, tương tác giữa các hệ thống, luồng request/response, or a draw.io sequence they can open and edit.

The tool returns **two files**:
- **`.drawio`** — open in diagrams.net / draw.io
- **`.txt`** — SequenceDiagram.org source (`title`, `Alice->Bob:`, `Alice<--Bob:`, `Bob->(1)Server:`)

Do **not** use `generate-drawio` for this. That tool lays out flowcharts, not lifelines.
Do **not** use `generate-file`.

Infer participants and messages from the user's request. Do not invent extra systems.

## Input rules

- `fileName` without extension, for example `login-sequence` (the tool appends `.drawio` and `.txt`).
- `title`: short heading, Vietnamese is fine.
- `participants`: left-to-right lifelines. Unique `id` (`user`, `api`). Short `label` (1–4 words). 2 to 12 items. Native JSON array — do not stringify.
- `messages`: time order, top to bottom. `from` / `to` must match participant ids. Short `label` (`POST /login`, `200 OK`). 1 to 40 items. Native JSON array — do not stringify.
- Quote ASCII ids in JSON (`"id": "api"`, not `"id": api`).
- `kind`:
  - `sync` — solid call `A->B:` (default)
  - `async` — non-instantaneous `A->(1)B:`
  - `return` — dashed reply `A<--B:`
  - `self` — loop on the same lifeline (`from` equals `to`)

Keep the happy path clear. Add a `return` only when the reply matters. Stay within the limits; split huge interactions.

## After the tool returns

Tell the user both `fileName` (`.drawio`) and `txtFileName` (`.txt`), plus `participantCount` and `messageCount` from `summary`.
They can open the `.drawio` at https://app.diagrams.net, or paste the `.txt` into https://sequencediagram.org.
Do not paste the XML `content` unless they ask. Do not paste the full `txtContent` unless they ask for the source.
