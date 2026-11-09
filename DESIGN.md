# Acelera Talent UI

## Direction

Refinement of the existing portal, not a rebrand. Administrative and coach
screens prioritize scanning and repeat tasks; client screens prioritize reading
session summaries. Preserve role gates, terminology, data and existing workflows.

## Foundations

- Geist, fixed type sizes and zero letter spacing. Page headings 24px; reader
  headings 24px; body 14-16px; supporting labels 12px.
- White surfaces, cool neutral background, deep teal accent. Semantic red is
  reserved for errors and excess sessions; state labels retain distinct colors.
- 4px spacing rhythm. Controls 40-44px high, radius 6px; framed tools and repeated
  items radius 8px. Sections use separators rather than nested cards.
- Lucide icons, usually 16px and 1.8px stroke. Icons complement navigation labels.
- Visible keyboard focus; mobile form text 16px; long names wrap rather than
  truncate. Tables scroll inside their own named keyboard-focusable region.
- Transitions are limited to short color feedback. Respect reduced motion.

## Verification

`UI_LOCAL_PREVIEW=1 npm run dev -- --hostname 127.0.0.1 --port 3020`
opens `/login/ui-preview/progress`, `/login/ui-preview/client`, and
`/login/ui-preview/masterclasses`. These use fictional data and cannot render in
production. They do not bypass authentication on any operational route.
