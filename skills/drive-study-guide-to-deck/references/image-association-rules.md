# Image association rules

Use these rules only when a source guide contains meaningful visual material.
Do not attach an image merely because it is near a card.

## 1. Preserve source structure

For each extracted image, record:

- a stable `image_id`;
- the temporary local image path;
- source page, slide, sheet, or document block when available;
- enclosing heading or table row;
- explicit caption;
- nearby text before and after the image;
- OCR text visible inside the image.

Keep original source order. Do not redraw, regenerate, or materially alter a
source image. Cropping empty margins and lossless rotation are allowed.

## 2. Exclude decorative images

Exclude repeated logos, page decorations, backgrounds, separators, icons with
no study value, and unrelated screenshots. Record an exclusion reason in the
association manifest so every extracted image is accounted for.

## 3. Require two independent signals

Attach an image only when both categories agree:

1. Structural evidence:
   - `explicit_caption`
   - `same_table_row`
   - `anchored_block`
   - `same_section`
   - `nearby_text`
2. Semantic evidence:
   - `visual_semantic`
   - `ocr_semantic`

Structural proximity alone is insufficient. Visual similarity without source
context is also insufficient.

## 4. Confidence and review

- `0.90–1.00`: attach automatically when evidence requirements pass.
- `0.70–0.89`: require user approval.
- Below `0.70`: leave unattached unless the user explicitly approves it.
- Competing cards with similar scores: mark `review`.
- One diagram genuinely supporting several cards: ask whether to share it or
  select one primary card. Do not silently duplicate it.

Use `scripts/validate_image_associations.py` as the publishing gate.

## 5. Interpretation boundaries

- Describe only visible content and source-supported meaning.
- Do not infer labels that the guide does not support.
- Preserve readable labels, legends, axes, equations, and annotations.
- Prefer a concise factual `imageAlt` description, not a full interpretation.
- Do not include private Drive URLs, author identities, comments, or hidden
  metadata in the published deck.

## 6. Manifest shape

```json
{
  "source_title": "Biology Unit 3 Study Guide",
  "associations": [
    {
      "image_id": "image-004",
      "image_path": "images/image-004.webp",
      "decision": "attach",
      "card_term": "Mitosis",
      "confidence": 0.96,
      "review_status": "not_required",
      "evidence": [
        {
          "type": "same_section",
          "detail": "Image is anchored under the Mitosis heading."
        },
        {
          "type": "visual_semantic",
          "detail": "Diagram shows prophase through telophase."
        }
      ]
    },
    {
      "image_id": "image-005",
      "image_path": "images/image-005.png",
      "decision": "exclude",
      "review_status": "not_required",
      "reason": "Repeated course logo with no study content."
    }
  ]
}
```

For a user-approved association below `0.90`, set `review_status` to
`approved`. Leave unresolved items as `decision: "review"` and do not publish.

## 7. Published deck fields

The draft deck may point `image` to a temporary local file:

```json
{
  "term": "Mitosis",
  "definition": "Cell division producing two identical daughter cells.",
  "image": "images/image-004.webp",
  "imageAlt": "Diagram showing the stages of mitosis"
}
```

`install_deck.py` copies the image into
`deck-assets/DECK-SLUG/` and replaces the temporary path with the public
relative path. Published decks must never contain local filesystem paths.

## 8. Source-type routing

- Native Google Docs: preserve inline order, headings, table cells, captions,
  and anchored-image context. Export only when the Drive read surface cannot
  expose embedded images.
- PDF: render relevant pages, retain page coordinates, and distinguish full
  diagrams from decorative page elements.
- Slides: treat each slide title and nearby text as the structural section.
- DOCX: preserve paragraph order and image relationships; do not associate
  images by media filename alone.
- Sheets: associate images through the containing row, cell range, and headers.

If the source surface cannot expose an image with reliable context, mark it for
review rather than guessing.
