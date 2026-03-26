# Design System Strategy: High-End Editorial CRM

## 1. Overview & Creative North Star

### Creative North Star: "The Executive Architect"
This design system moves beyond the "utility-first" appearance of standard SaaS platforms to provide an experience of **Structured Serenity**. It is designed for the high-level decision-maker who values clarity, momentum, and premium aesthetics. 

While platforms like Linear or Notion focus on dense productivity, this system prioritizes **Airy Authority**. We achieve this by breaking the traditional "box-in-a-box" grid. Through intentional asymmetry, expansive negative space (using our custom spacing scale), and high-contrast editorial typography, the interface feels less like a database and more like a curated executive dashboard.

---

## 2. Colors & Surface Philosophy

The color palette is anchored in professional neutrals with "electric" accents that drive user action and highlight critical KPIs.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to define major UI sections. Borders are a sign of "template" design. Instead, define boundaries through:
- **Tonal Shifts:** Placing a `surface-container-low` section against a `surface` background.
- **Negative Space:** Using the `16` (5.5rem) or `20` (7rem) spacing tokens to create "mental borders."

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of premium materials. 
1.  **Base Layer:** `surface` (#f5f7f9) – The canvas.
2.  **Sectional Layer:** `surface-container` (#e5e9eb) – For grouping related content areas.
3.  **Actionable Layer (Cards):** `surface-container-lowest` (#ffffff) – This creates a natural "pop" of white against the grey background, signaling interactivity without the need for heavy shadows.

### The Glass & Signature Texture
*   **Glassmorphism:** For floating modals or "sticky" navigation elements, use `surface-container-lowest` with a 70% opacity and a `backdrop-blur` of 20px. This allows the vibrant primary accents to bleed through softly.
*   **Signature Gradients:** Main CTAs or Hero Cards should utilize a subtle linear gradient: `primary` (#0049e6) to `primary-container` (#829bff) at a 135-degree angle. This adds "visual soul" and depth that flat hex codes cannot replicate.

---

## 3. Typography: Editorial Authority

We use a dual-font strategy to balance character with readability.

*   **Display & Headlines (Manrope):** Chosen for its geometric, modern corporate feel. `display-lg` and `headline-md` should be used sparingly to create "Moments of Impact." Increase letter-spacing slightly (-0.02em) for a more premium, tracked-out look.
*   **Body & Labels (Inter):** The workhorse. `body-md` is the default for CRM data. Use `label-md` for secondary metadata, ensuring it is always set in `on-surface-variant` (#595c5e) to maintain a soft visual hierarchy.

**Hierarchy Tip:** Never rely on size alone. Use the contrast between `on-surface` (titles) and `on-surface-variant` (descriptions) to guide the CEO’s eye to the most important metric first.

---

## 4. Elevation & Depth

Standard "Material" shadows are too heavy for this aesthetic. We use **Tonal Layering** supplemented by **Ambient Light**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. The 2-3% difference in lightness creates a sophisticated "lift."
*   **Ambient Shadows:** If a card requires a floating state (e.g., a Kanban card being dragged), use a custom shadow:
    *   `box-shadow: 0 12px 32px -4px rgba(44, 47, 49, 0.06);`
    *   The shadow color is derived from `on-surface` (#2c2f31) at a very low opacity, mimicking natural light.
*   **The Ghost Border:** If accessibility requires a stroke (e.g., in a high-density data table), use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Cards
Cards are the heart of the CRM. 
- **Radius:** Always use `xl` (1.5rem / 24px) for outer containers and `lg` (1rem / 16px) for nested content.
- **Header:** Use a colored "accent tab" on the left (4px width) using `primary` or `secondary` to categorize card types (e.g., Leads vs. Deals).

### Data Tables
- **No Dividers:** Eliminate horizontal lines. Use `surface-container-low` on hover states to highlight rows.
- **Alignment:** Numbers are always tabular-lining; text is left-aligned with generous `padding-x: 6` (2rem).

### Kanban Boards
- **Column Styling:** Columns should use `surface-container-low` with no background color until a card is hovered.
- **Card Spacing:** Use `spacing-3` (1rem) between cards to maintain the "airy" feel.

### Buttons
- **Primary:** Gradient-filled (`primary` to `primary-container`) with `on-primary` text. No border.
- **Tertiary (Ghost):** No background or border. Use `primary` text weight 600. Only shows a `surface-variant` background on hover.

---

## 6. Do’s and Don’ts

### Do:
*   **DO** use whitespace as a functional element. If a page feels "busy," increase the spacing between sections to `20` (7rem).
*   **DO** use `tertiary` (#8d3a8b) for "Delight" moments—success messages or milestone achievements.
*   **DO** ensure that charts use the `secondary` (#006668) and `primary` (#0049e6) tokens to maintain the sophisticated teal/blue corporate palette.

### Don't:
*   **DON'T** use pure black (#000000) for text. Always use `on-background` (#2c2f31) to keep the interface soft.
*   **DON'T** use "Default" 4px or 8px corners. This system relies on the "friendly" nature of the `12px-16px` (`md` to `lg`) scale.
*   **DON'T** stack more than three levels of surface containers. If you need more depth, use a Backdrop Blur/Glassmorphism effect instead of another solid layer.