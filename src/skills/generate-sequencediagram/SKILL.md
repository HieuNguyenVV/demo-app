---
name: generate-sequencediagram
description: Use when the user wants a sequence diagram, UML sequence, interaction diagram, or request/response timeline, including if/else, loops, notes, and parallel paths. Returns both a .drawio file and a SequenceDiagram.org .txt source file.
---

# Generate sequence diagram

Call `generate-sequencediagram` when the user asks for a sequence diagram, UML sequence, tương tác giữa các hệ thống, luồng request/response, **if/else**, **loop**, **note**, **parallel**, or a draw.io sequence they can open and edit.

The tool returns **two files**:
- **`.drawio`** — open in diagrams.net / draw.io
- **`.txt`** — SequenceDiagram.org source

Do **not** use `generate-drawio` for this. That tool lays out flowcharts, not lifelines.
Do **not** use `generate-file`.

Infer participants and messages from the user's request. Do not invent extra systems.

## Input rules

- `fileName` without extension, for example `login-sequence` (the tool appends `.drawio` and `.txt`).
- `title`: short heading, Vietnamese is fine.
- `participants`: left-to-right lifelines. Unique `id` (`user`, `api`). Short `label` (1–4 words). 2 to 12 items. Native JSON array — do not stringify.
- `messages`: time order, top to bottom. Mix **calls** and **markers**. Native JSON array — do not stringify. 1 to 64 items. Quote ASCII ids (`"id": "api"`).

### Calls

`from` / `to` must match participant ids. Short `label`. `kind`:
- `sync` — solid call `A->B:` (default)
- `async` — `A->(1)B:`
- `return` — dashed reply `A<--B:`
- `self` — same lifeline (`from` equals `to`)

### Common markers

Insert as objects with `type`. Close every `alt` / `loop` / `opt` / `par` / `break` with `{ "type": "end" }`. Nesting max 2.

- `{ "type": "alt", "label": "còn hàng" }` then `{ "type": "else", "label": "hết hàng" }` then `end` — if/else
- `{ "type": "loop", "label": "mỗi SKU" }` then `end` — repeat / foreach / retry
- `{ "type": "opt", "label": "có coupon" }` then `end` — optional
- `{ "type": "par", "label": "song song" }` then `{ "type": "else", "label": "nhánh 2" }` then `end` — parallel
- `{ "type": "break", "label": "timeout" }` then `end` — exception / abort path
- `{ "type": "note", "from": "api", "to": "db", "label": "validate JWT" }` — comment; omit `to` for one lifeline
- `{ "type": "activate", "from": "api" }` / `{ "type": "deactivate", "from": "api" }` — execution bar after a call

When the user describes if/else, a loop, a note, or two things at once, emit these markers. Do not flatten both branches into one happy-path line.

Keep the happy path in the first `alt` branch. Stay within the limits; split huge interactions.

## After the tool returns

Tell the user both `fileName` (`.drawio`) and `txtFileName` (`.txt`), plus `participantCount` and `messageCount` from `summary`.
They can open the `.drawio` at https://app.diagrams.net, or paste the `.txt` into https://sequencediagram.org.
Do not paste the XML `content` unless they ask. Do not paste the full `txtContent` unless they ask for the source.
