---
name: meeting-minutes
description: Turn messy meeting notes into structured office minutes and a downloadable Word document (.docx).
---

# Meeting minutes

Use `meeting-minutes` when the user wants office-style meeting notes formatted into a proper minutes document.

The tool always returns a ready-to-download Word file in `docFileName` / `docContent`. The user does not need a second export step unless they ask for another format.

## When to use

- "Tạo biên bản họp"
- "Xuất biên bản file Word"
- "Format meeting notes"
- "Chuẩn hóa ghi chú cuộc họp"
- Raw notes with attendees, decisions, or action items

## Input rules

- For pasted notes, set `source: "text"` and pass the full `text`.
- For a chat attachment, call `upload-file` first, then `meeting-minutes` with `source: "file"` and the returned app `fileId`.
- Optionally pass `title` or `meetingDate` (YYYY-MM-DD).

## Supported note structure

Section headers (English or Vietnamese), for example:

- Attendees / Thành phần tham dự
- Agenda / Chủ đề
- Discussion / Nội dung
- Decisions / Quyết định
- Action items / Việc cần làm
- Next steps / Bước tiếp theo

Bullet lines (`-`, `*`, numbered lists) under each section are parsed automatically.

## After the tool returns

Report `summary`, key decisions, and open action items with owners when present.
Tell the user the Word file is ready to download from the tool card (`docFileName`).
Do not call `generate-file` just to recreate the same Word export.

## When not to use

- General text stats on an attached file → `analyze-file`.
- Simple todo extraction without meeting structure → ask the user to clarify or structure notes first.
