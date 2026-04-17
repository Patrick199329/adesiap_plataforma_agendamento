# Design System Document: Precision Logistics & Fleet Management

## 1. Overview & Creative North Star: "The Architectural Command" 

This design system moves away from the "industrial-utilitarian" look typical of logistics software and instead adopts the **"Architectural Command"** North Star. This vision treats fleet management as a high-end editorial experience: authoritative, expansive, and meticulously organized.

To break the "template" look, we utilize **intentional asymmetry**. Primary dashboard metrics are not placed in rigid, equal-sized boxes; instead, they use varying container widths and "bleeding" edges to guide the eye toward critical data. We replace heavy structural lines with **tonal depth** and **layered surfaces**, creating a professional environment that feels like a physical command center rather than a simple database.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule

The palette is anchored by deep maritime blues (`primary`) and technical greys (`surface`). The goal is to provide a "reliable" foundation where status colors act as precise signals, not distractions.

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Boundaries must be defined solely through background color shifts. Use `surface-container-low` for large section backgrounds sitting on a `surface` base. This creates a cleaner, more premium interface that emphasizes content over containers.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
*   **Base:** `surface` (#f7f9fc)
*   **Sections:** `surface-container-low` (#f2f4f7)
*   **Interactive Cards:** `surface-container-lowest` (#ffffff)
*   **Modal/Popovers:** `surface-bright` with Glassmorphism.

### The Glass & Signature Texture Rule
*   **Glassmorphism:** For floating navigation or "Quick Action" overlays, use `surface_variant` at 70% opacity with a `20px` backdrop-blur. 
*   **Signature Gradients:** For primary CTAs and High-Level Fleet Summaries, use a subtle linear gradient from `primary` (#00193c) to `primary_container` (#002d62) at a 135-degree angle. This adds "soul" and prevents the deep navy from looking "flat."

---

## 3. Typography: The Editorial Scale

We pair **Manrope** (Display/Headlines) for a modern, geometric authority with **Inter** (Body/Labels) for maximum legibility in dense data environments.

*   **Display (Manrope):** Use `display-md` for total vehicle counts or critical KPIs. The tight kerning and geometric "o"s convey modern precision.
*   **Headlines (Manrope):** `headline-sm` for section headers. Use `on_surface_variant` (#43474f) to keep these headers sophisticated rather than aggressive.
*   **Body & Data (Inter):** `body-md` is the workhorse. For dense fleet tables, use `label-md` for secondary data (like VIN numbers or timestamps) to create a clear visual hierarchy between "What is this" and "Details."

The hierarchy communicates **authority**. Large, airy headlines represent the "Fleet Strategy," while tight, tabular Inter text represents the "Tactical Execution."

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are banned. We use **Tonal Layering** to convey hierarchy.

*   **The Layering Principle:** To lift a "Vehicle Detail" card, place it (`surface-container-lowest`) on top of a `surface-container-low` dashboard background. The contrast in lightness creates a natural, soft lift.
*   **Ambient Shadows:** For floating elements like "Filter Drawers," use a shadow tinted with `on-surface`: `rgba(25, 28, 30, 0.06)` with a `40px` blur and `10px` Y-offset. It should feel like a soft glow of light, not a black smudge.
*   **The Ghost Border:** If a border is required for accessibility in input fields, use `outline_variant` (#c4c6d1) at **20% opacity**. It should be felt, not seen.

---

## 5. Components: Fleet-Specific Primitive Styling

### Dense Data Tables (The Fleet Ledger)
*   **Rule:** Forbid horizontal divider lines.
*   **Style:** Use alternating row fills (`surface` vs `surface-container-low`) or simply 16px of vertical whitespace between rows. 
*   **Status Indicators:** Use a "Pill" style for statuses. Available (`on_secondary_container` background), Alert (`tertiary_fixed`), Maintenance (`error_container`). The text color must always be the "On" variant (e.g., `on_error_container`) for accessibility.

### Summary Cards
*   **Layout:** Use asymmetrical padding. 24px on the left/top, 32px on the right to allow for "Bleeding" iconography or background glyphs.
*   **Content:** Large `display-sm` numbers paired with `label-sm` descriptors.

### Primary Action Buttons
*   **Style:** `primary` fill with `on_primary` text.
*   **Shape:** `md` roundedness (0.375rem) to maintain a professional, architectural feel—avoid full-rounded "pill" buttons which feel too consumer-grade.

### Input Fields
*   **Style:** Background-fill only (`surface-container-high`). No bottom line. When focused, transition the background to `surface-container-highest` and add a 2px `surface_tint` indicator on the left edge only.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use whitespace as a separator. If a section feels cluttered, increase the margin-bottom rather than adding a line.
*   **Do** use `primary_fixed_dim` for icons within cards to keep them visible but subordinate to the text.
*   **Do** ensure "Maintenance" (Red) and "Alert" (Yellow) are only used for actionable data.

### Don't:
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#191c1e) to maintain the premium, soft-contrast look.
*   **Don't** use "Alert" yellow for decorative elements; it is reserved for fleet warnings.
*   **Don't** stack more than three levels of surface nesting. (e.g., Background > Section > Card is the limit).

### Accessibility Note
While we use low-contrast "Ghost Borders," all interactive elements must maintain a 4.5:1 contrast ratio for text. If a `surface-container` shift is too subtle for a specific user base, use the `outline` token at 15% opacity to reinforce the boundary without breaking the "No-Line" aesthetic.
