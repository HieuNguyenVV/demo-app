---
name: pdf-edit
description: Use when an office worker needs to stamp, add a cover or notes page, or keep only some pages of an existing PDF.
---

# Edit office PDF

Call `pdf` with `action: edit` when they ask to đóng dấu (BẢN SAO, MẬT, CONFIDENTIAL), thêm trang bìa, ghi chú cuối file, or tách trang để gửi sếp / khách.

## Input

- `fileName` for the output PDF.
- `editMode`: `stamp`, `cover-page`, `append-page`, or `page-range`.
- For `stamp`, set `text` (the mark) and optional `stampPosition`: `header`, `footer`, `watermark`.
- For `cover-page` or `append-page`, put the extra wording in `text`.
- For `page-range`, set `pageStart` and `pageEnd` (1-based).
- Source of the original PDF:
  - `source: file` + `fileId` from a PDF this app just created;
  - `source: platform` + `platformFileId` of a chat attachment;
  - `source: base64` + `pdfBase64` if those fail.

Do not pretend to rewrite every paragraph inside a scanned PDF. Stamps, covers, addenda, and page splits are the supported office edits.
