---
name: generate-sequencediagram
description: Use when the user wants a sequence diagram, UML sequence, interaction diagram, or request/response timeline as a .drawio file.
---

# Generate sequence diagram

Call `generate-sequencediagram` when the user asks for a sequence diagram, UML sequence, tương tác giữa các hệ thống, luồng request/response, or a draw.io sequence they can open and edit.

Do **not** use `generate-drawio` for this. That tool lays out flowcharts, not lifelines.
Do **not** use `generate-file`.

Infer participants and messages from the user's request. Do not invent extra systems.

## Input rules

- `fileName` without extension, for example `login-sequence`.
- `title`: short heading, Vietnamese is fine.
- `participants`: left-to-right lifelines. Unique `id` (`user`, `api`). Short `label` (1–4 words). 2 to 12 items. Native JSON array — do not stringify.
- `messages`: time order, top to bottom. `from` / `to` must match participant ids. Short `label` (`POST /login`, `200 OK`). 1 to 40 items. Native JSON array — do not stringify.
- Quote ASCII ids in JSON (`"id": "api"`, not `"id": api`).
- `kind`:
  - `sync` — solid call (default)
  - `async` — open arrow
  - `return` — dashed reply
  - `self` — loop on the same lifeline (`from` equals `to`)

Keep the happy path clear. Add a `return` only when the reply matters. Stay within the limits; split huge interactions.

## After the tool returns

Tell the user `fileName`, `participantCount`, and `messageCount` from `summary`.
They should download the `.drawio` file and open it at https://app.diagrams.net.
Do not paste the XML `content` unless they ask for the source.
