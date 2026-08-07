# MoreImg Legacy Glass UI Style Guide

## Product Shape

MoreImg is a light blue-purple glassmorphism content-production workbench. New features must preserve the original atmosphere and component proportions while keeping text and actions readable.

## Visual Tokens

- Page background: indigo, violet, and sky color fields over `#f8fafc`; long scrolling views may use a static field implementation to avoid continuous repaint.
- Sidebar surface: translucent white with strong blur and a soft white border.
- Content surfaces: translucent white, typically `60%` to `90%`, with white/slate translucent borders.
- Shared surfaces are token-owned: panel surfaces use `.mi-surface-panel` (`16px` radius), repeated result cards use `.mi-surface-card` (`12px` radius), and history rows use `.mi-surface-list` with one selected variant. Business classes may own layout and padding but must not redefine the shared border/background/shadow contract without a documented variant.
- Primary action and selected state: indigo `#4f46e5`, usually at `90%` opacity.
- Warning: amber, used only for model or output risk.
- Error: red, used only for failed operations.
- Feedback semantics: indigo for information, amber for warning, red for error, green for success, and slate for neutral/loading. These roles consume `.mi-feedback-*` tokens and may not borrow selected/navigation colors.
- Radius families: `10px` brand mark, `12px` controls, `16px` cards and content input, `20px` segmented navigation, `24px` dialogs.
- Control heights: prominent actions and configuration fields use `48px`; ordinary text actions and tabs use `40px`; configuration helper actions use `36px`; compact icon actions use `32px`.
- Configuration fields use one `48px` height and an `8px` label-to-control gap.
- Required helper copy uses `--mi-text-helper` (`#64748b`) and must keep at least `4.5:1` contrast on its rendered surface; lower-contrast slate is reserved for disabled or nonessential metadata.
- Shadows are soft and low contrast; active indigo controls may use a faint indigo shadow.
- Blur is part of the brand language: use `4px` on controls, `12-24px` on panels, and stronger blur on dialogs/sidebar.

## Components

- Result panels use a translucent white surface, `16px` radius, one border, and one header band.
- Result panels, long-content panels, repeated result items, content cards, home feature cards, and history rows consume `.mi-surface` plus one surface variant; local classes own only content layout or an explicitly named brand variant.
- Text buttons consume `.mi-button` plus exactly one size variant: `.mi-button-prominent` (`48px / 12px`), `.mi-button-standard` (`40px / 10px`), or `.mi-button-compact` (`36px / 10px`). Business classes may change color and typography, but must not redefine geometry, focus, disabled, or loading behavior.
- Icon-only buttons use a stable `40px` square, `12px` radius, translucent white surface, and must include `aria-label` and `title`.
- Feedback containers use one complete, uniform border with a light semantic background, icon, and concise copy. Do not add a standalone thick left rule; notices must read as lightweight feedback rather than content cards.
- Prompt details use a plain disclosure separated by rules; expanded content must scroll vertically without causing page overflow.
- Preview, checklist, and actions belong to one result band. Checklist uses borders and spacing rather than a second card.
- Fluid color fields remain visible behind empty, processing, and result states.
- Stage and visual-page navigation consume `.mi-tab` and share a `40px` height and focus contract. Stage tabs use `12px` radius; visual-page tabs use `10px` radius. Selected state is paired with `aria-selected="true"`; unreachable stages use the native `disabled` state.
- Brand mark is `32px / 10px`; settings is `40px / 12px`. Their difference is intentional: identity mark versus interactive control.
- The article input is `180px / 16px` on desktop and `96px / 16px` on mobile, with the original animated gradient outline and frosted surface.
- Configuration dialogs use `24px` radius and one `.mi-field` `48px / 12px` field component for all text, password, URL, model, image, select, checkbox, and preference controls. Textareas may grow vertically but keep the same surface, radius, focus, and disabled contract.
- Configuration dialogs have one scroll owner: the dialog body. Long prompt editors expand to their content and must not introduce a competing inner scrollbar or resize handle.
- Hidden help content must not contribute to the dialog's scroll geometry. Prefer native titles or in-flow disclosure content over opacity-hidden absolute panels inside a scroll container.
- Visual-prompt pages use one page selector and one active workspace. Do not render every page as a full-height panel in one vertical list.
- Visual-prompt top-level sections use one hierarchy: section title and description sit outside, followed by one white content surface. Tabs, actions, prompt details, and previews stay inside that surface; do not mix floating content, inset headers, and unframed previews at the same level.
- The active visual workspace owns three regions: page tabs, result area, and a secondary prompt/details area. Prompt text is collapsed by default; generated media remains the visual priority.
- HTML output follows the active page selector and renders only the current card. Switching pages replaces the preview instead of appending every card vertically.
- Repeated warnings belong at workspace level. Page-level notices are reserved for errors, legacy-state recovery, or content specific to that page.
- Result media uses one shared item shell with a compact header and icon actions. Download, hide, and reveal actions use the shared icon-button geometry rather than new text-button variants.
- Toasts consume `.mi-feedback-success|error`, use a three-region grid (status icon, wrapping message, `32px` close action), expose `status` or `alert` according to severity, stay `24px` from desktop edges, and move to the bottom with `12px + safe-area` clearance on narrow screens so they do not cover header actions.
- Inline information, warning, error, success, and loading messages consume `.mi-feedback` and keep a complete `1px` semantic border. They must not inherit or recreate a thicker left edge. Full-panel bands may remove side borders/radius only as an explicit layout variant while keeping the shared semantic color and typography contract.
- Empty, loading-placeholder, and missing-result content consumes `.mi-empty-state`. Media slots use `.mi-empty-state-media` (`3:4 / 10px`), full-panel states use `.mi-empty-state-panel` (`260px / 24px`, narrowing to `220px` on mobile), and placeholders inside an existing preview frame use `.mi-empty-state-inline` without a second border or background. Icons use the shared `40px / 10px` geometry or the named `48px / 12px` large variant.
- Image diagnostics consume `.mi-surface-card` (`12px`) and keep only disclosure layout in `.image-diagnostic`; diagnostic business styles must not redefine border, background, or radius.
- Horizontal `role="tablist"` groups use roving `tabIndex` and support `ArrowLeft`, `ArrowRight`, `Home`, and `End`; disabled tabs are skipped.

## Typography

- Font family: the bundled sans-serif stack for product copy; monospace is limited to API values, prompts, timestamps, and technical identifiers.
- Page/product title: `20px`, extra bold.
- Primary content heading: `16-18px`, bold or extra bold.
- Panel title: `14px`, bold.
- Body copy: `13-14px`, regular to medium, line-height approximately `1.65-1.7` for long Chinese text.
- Field labels: `13px`, bold. Helper and metadata text: `11-12px` with slate neutral colors.
- Workflow stage headings and result-section headings use one `16px / 800` title treatment with a `3px` indigo leading rule. Stage tabs name the full user task in Chinese and must be updated when a stage expands beyond its original prompt-only scope.
- Do not use hero-scale typography inside dialogs, sidebars, result panels, or cards.
- HTML export cards are a publishing surface, not a dense product panel. At 1080×1440, cover titles use `92px`, body titles `80px`, body points `36px`, summaries `37px`, and back-cover titles `80px` unless a content-fit exception is documented.
- Card preview dimensions must preserve readable scaled text. Desktop previews use `400×533.333px`; narrow mobile previews use `300×400px`.

## Spacing And Dimensions

- Base spacing rhythm: `4 / 8 / 12 / 16 / 20 / 24 / 32px`.
- Control icon-to-label gap: `6-8px`.
- Field label-to-control gap: `8px`; configuration grid gap: `20px`.
- Panel header padding: `16px 24px`; ordinary panel content padding: `24px`.
- Stable dimensions: primary submit and configuration fields `48px`, ordinary actions and tabs `40px`, configuration helper actions `36px`, compact icon actions `32px`, desktop sidebar `320px`.
- Exceptions require a named component reason, not a one-off visual adjustment.
- Visual page tabs and normal visual actions use `40px / 10px`; stage tabs use `40px / 12px`; compact result icon actions use `32px / 8px`.
- All result stages share one `1120px` maximum workbench frame for the stage navigation and active content. Text-heavy content controls reading width inside its own surface instead of changing the page frame by stage.

## Component States

| Family | Default | Hover/Focus | Disabled/Loading | Error/Success |
| --- | --- | --- | --- | --- |
| Primary button | Indigo glass surface | Darker indigo, soft lift, shared `2px` focus ring | Muted glass, no lift; spinner and `aria-busy` where applicable | Toast communicates result |
| Secondary button | White glass surface | White/indigo emphasis, shared `2px` focus ring | Muted slate and no elevation; native `disabled` | Error Toast when command fails |
| Icon button | `40px / 12px`, accessible name | Indigo foreground and stronger white surface | Muted and noninteractive | Destructive actions use red only |
| Input/textarea | Translucent white, soft border | Brighter surface and shared indigo focus shadow | Muted surface and noninteractive cursor | Inline red message or Toast |
| Stage/tab | Transparent in frosted container | White hover surface and shared `2px` focus ring | Native disabled with reduced opacity when unreachable | Current tab uses selected skin plus `aria-selected` |
| Surface/list item | Token-owned panel/card/list surface | List rows may brighten without moving layout | Reduced opacity only when the whole item is unavailable | Current history row uses `.mi-surface-selected` plus `aria-current` |
| Empty/media placeholder | Shared dashed neutral surface or transparent inline variant | No layout-changing hover | Loading swaps the icon without changing geometry | Error remains a semantic feedback state, not an empty state |
| Feedback/Toast | Semantic background, border, icon, and text | Toast close action uses shared icon focus | Neutral loading remains dimensionally stable | `status` for success/loading, `alert` for errors; warnings remain amber |
| Result panel | Translucent white card | No layout-changing hover | Loading remains dimensionally stable | Red error band, amber output-risk notice |

## Feedback And Recovery

- Alert and Notice are lightweight feedback containers, not content cards: use one complete fine border, a restrained semantic background, an optional semantic icon, and concise copy. Do not combine a full border with a thick left rule, extra shadow, or nested card surface.
- Static informational notes do not announce themselves through `aria-live`. Dynamic success/loading uses `status`; blocking or urgent failure uses `alert`.
- Toasts are the shared response for copy, save, delete, generation success, and command failure.
- Toasts remain dismissible while their auto-close timer is active; long text wraps inside the message column and must not cover sticky or primary actions on narrow screens.
- Every asynchronous or browser-dependent command must handle both success and failure. Silent rejection is not allowed.
- Destructive actions require confirmation when recovery is not immediate.
- Stage switching and history restoration reset the result content region to its top so the new context starts from its heading.
- Generated results preserve existing images and history unless the user explicitly deletes or regenerates them.
- Narrow screens expose history through the header's labeled history action and a viewport-bounded dialog; responsive simplification may not remove restore, retry, or delete access.

## Motion And Layering

- Background color fields provide atmosphere and must never move content geometry. Keep long scrolling result views static unless measured evidence shows motion does not cause continuous blur repaint.
- Control transitions use approximately `180-300ms`; motion communicates hover, focus, loading, or state change.
- Loading spinners and progress indicators must respect stable container dimensions.
- Layer order: background below application, sidebar/content in normal product layer, Toast above content, modal overlay above Toast-sensitive page controls, Tooltip/help above its owning dialog content.
- Avoid adding new z-index values unless the component belongs to a documented layer.

## Implementation Map

- Shared contracts: `.mi-button` with `.mi-button-prominent|standard|compact`; `.mi-icon-button` with `.mi-icon-button-standard|compact`; `.mi-tab`; `.mi-field`; `.mi-surface` with `.mi-surface-panel|raised|card|list|selected`; `.mi-feedback` with `.mi-feedback-info|warning|error|success|neutral`; `.mi-empty-state` with `.mi-empty-state-media|panel|inline` and shared icon variants.
- Sidebar identity and input: `.sidebar-brand-mark`, `.sidebar-icon-button`, `.sidebar-input-shell`, `.sidebar-input`.
- Result controls and panels: `.visual-button`, `.visual-button-primary`, `.visual-panel`, `.visual-workspace-grid`, `.visual-result-item`; these are layout/skin owners layered on shared surface contracts.
- Visual page navigation and prompt details: `.visual-page-tabs`, `.visual-page-tab`, `.visual-prompt-column`, `.visual-disclosure`, `.visual-prompt-copy`.
- Stage navigation: `.results-stage-nav`, `.results-stage-tab`, `.results-stage-tab-active`.
- Configuration: `.config-dialog`, `.config-dialog-body`, `.config-input`, `.config-preference-textarea`, `.config-checkbox`, `.config-dialog-footer`.
- Feedback, empty states, diagnostics, and history: `.mi-toast`, `.config-status`, `.processing-notice`, `.visual-notice`, `.visual-error`, `.visual-result-slot-empty`, `.visual-comparison-empty`, `.image-diagnostic`, `.history-item`; semantic appearance comes from shared feedback/empty-state/surface variants.
- HTML output: `.visual-output-panel`, `.visual-current-output-body`, `.visual-output-card`, `.html-card-preview-frame`.
- Behavioral contracts: `resultScrollRef` owns stage/history scroll reset; `copyToClipboard` owns Clipboard API, fallback, and Toast feedback.

## Responsive Rules

- Desktop may use two-column output grids.
- Mobile keeps the same task order and lets action groups wrap as a unit.
- Text buttons may grow; icon buttons remain fixed.
- No horizontal page overflow, clipped labels, hidden primary actions, or nested competing scroll regions.
- Horizontally scrollable stage navigation must keep the selected stage fully visible after history restoration, stage changes, and viewport resizing.
- Below `1024px`, the visual result and prompt columns stack while preserving result-first task order.
- Below `640px`, page tabs scroll horizontally, action groups wrap as a unit, and result media becomes one column.

## Do Not

- Invent radius values outside the documented component families.
- Replace the blue-purple fluid atmosphere with a flat admin-dashboard background.
- Place cards inside cards for ordinary page sections.
- Introduce a new button style for a single action.
- Use dark or heavy shadows; separation should come from translucent borders, blur, and soft elevation.

## Verification

1. Run `node build.mjs` to assemble `src.html` and build `index.html` plus `app.js` from `src/`.
2. Run the focused generation and HTML-card tests.
3. Inspect the sidebar/input area, configuration dialog, and visual prompt page at desktop and mobile widths.
4. Check `48 / 40 / 36 / 32px` control heights, field gaps, focus-visible, disabled/loading/selected states, surface variants, Toast success/error/dismiss behavior, tab arrow-key navigation, horizontal overflow, wrapping, expanded prompt details, generated previews, error states, and console errors.
5. Verify stage/history changes start at the top of the result region and clipboard commands expose success or failure feedback.
