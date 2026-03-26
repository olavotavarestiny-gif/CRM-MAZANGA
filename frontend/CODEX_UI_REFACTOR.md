# Codex UI/UX Refactoring Instructions

**Project:** Mazanga CRM Dashboard
**Goal:** Migrate visual layer from current light-navy design to Material Design 3 "Structured Serenity" aesthetic
**Scope:** UI/CSS only — zero business logic changes
**Font Policy:** **ALL fonts remain Montserrat** — no Manrope, no Inter

---

## 🔴 SACRED RULES — NEVER BREAK THESE

### 1. No Business Logic Changes
- Do NOT modify: `isActive()`, `handleLogout()`, `canView()`, `isAdvancedVisible()`, `isVisible()`
- Do NOT change: `useQuery` hooks, query keys, `queryFn` references
- Do NOT touch: API calls in `lib/api.ts`, auth guards, permission checks

### 2. No Function/Props Interface Changes
- Do NOT add required props to components
- Optional props only (e.g., `icon?: React.ElementType` in StatWidget)
- Do NOT change TypeScript interfaces in `types.ts` or `use-dashboard-config.ts`

### 3. No Routing/Navigation Changes
- All `<Link href=…>` paths stay identical
- All `router.push()` calls unchanged
- `data-tour` attributes must be preserved for product tour

### 4. Font Family Policy
- Keep `font-family: 'Montserrat'` in globals.css
- **Do NOT add** Manrope, Inter, or any new Google Fonts
- Improve hierarchy via Montserrat weight only: 400 → 500 → 600 → 700 → 800

### 5. Styling Only
- Only className modifications allowed
- Only inline `style={{ }}` for dynamic colors
- No new `useState`, `useEffect`, or imports from logic files
- Exception: icon in StatWidget (React.ElementType) is purely visual

---

## 📊 Color Token Reference

| Use | Old | New | CSS var |
|---|---|---|---|
| Primary (links, active nav, buttons) | `#0A2540` | `#0049e6` | `--primary` |
| Text foreground | `#0A2540` | `#2c2f31` | `--foreground` |
| Muted text (labels, hints) | `#6b7e9a` | `#595c5e` | `--muted-foreground` |
| Error/urgent | `red-500` | `#b31b25` | `--destructive` |
| Border | `#dde3ec` | `#e5e9eb` | `--border` |
| Background (body) | `#f0f4f9` | `#f5f7f9` | — |
| Card radius (outer) | `0.5rem` | `0.75rem` | `--radius` |
| Sidebar width | `w-56` | `w-64` | — |

---

## 📝 Component Changes (Step-by-Step)

### Step 1: `frontend/src/app/globals.css`

**Do:**
```css
/* Replace body background */
body {
  background: #f5f7f9;  /* was #f0f4f9 */
}

/* Update CSS variables */
:root {
  --foreground: #2c2f31;         /* was #0A2540 */
  --primary: #0049e6;            /* was #0A2540 */
  --muted-foreground: #595c5e;   /* was #6b7e9a */
  --border: 210 10% 92%;         /* was 210 20% 90% */
  --radius: 0.75rem;             /* was 0.5rem */
}

/* Update heading weights */
h1 { font-weight: 800; }   /* was 700 */
h3 { font-weight: 700; }   /* was 600 */

/* Add utility class */
.ambient-shadow {
  box-shadow: 0 2px 12px -2px rgba(44, 47, 49, 0.08);
}
```

**Do NOT:**
- Add font imports
- Touch driver.js tour CSS block
- Change `@tailwind` directives

---

### Step 2: `frontend/src/components/layout/sidebar.tsx`

**Changes:**
- Line 126: `w-56` → `w-64`
- Line 127: Update border color: `border-[#dde3ec]` → `border-slate-100`
- Lines 133–138 (logo area):
  - Box: `bg-[#0A2540]` → `bg-gradient-to-br from-[#0049e6] to-[#829bff]`
  - Optional: add a lucide icon `BarChart3` or similar inside the box
  - Text: keep structure but ensure Montserrat is applied
- Line 58–63 `navItemClass`:
  - Active: `bg-[#0A2540]/8 text-[#0A2540]` → `bg-blue-50 text-[#0049e6] rounded-xl`
  - Hover: `hover:text-[#0A2540] hover:bg-[#0A2540]/5` → `hover:text-[#0049e6] hover:bg-blue-50/60 rounded-xl`
- Line 155: Icon size: `w-4 h-4` → `w-[18px] h-[18px]`

**Do NOT:**
- Touch permission logic (lines 80–93)
- Change `isActive()`, `handleLogout()`, `chatUnread` query
- Modify nav link structure (lines 147–163)

---

### Step 3: `frontend/src/components/layout/layout-wrapper.tsx`

**Changes:**
- Find the `<main>` element wrapping page content
- If `bg-gradient-to-...` is hardcoded, remove it (let body background handle it)
- Update sidebar reference: if `w-56` appears in layout logic, change to `w-64`
- Mobile top bar title color: `text-[#0A2540]` → `text-[#2c2f31]`

**Do NOT:**
- Touch auth logic, redirect guards, `getCurrentUser()`
- Change `ProductTourProvider`, modals, onboarding checklist
- Modify keep-alive ping, impersonation banner

---

### Step 4: `frontend/src/components/dashboard/stat-widget.tsx`

**This is the biggest visual change.** Replace thin left-bar with bento icon card.

**New code structure:**
```tsx
'use client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

function fmt(v: number, unit: string) { /* unchanged */ }

export default function StatWidget({
  title,
  value,
  unit = '',
  color = '#0049e6',     // CHANGE: was #0A2540
  subtitle,
  icon: Icon = TrendingUp,  // NEW: optional icon prop
}: {
  title: string;
  value: number;
  unit?: string;
  color?: string;
  subtitle?: string;
  icon?: React.ElementType;  // NEW: optional prop type
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-all duration-300" style={{ borderLeft: `4px solid ${color}` }}>
      <CardContent className="p-6">
        {/* Icon Box */}
        <div className="inline-flex items-center justify-center p-2.5 rounded-lg mb-4" style={{ background: color + '18', color }}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Label */}
        <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">
          {title}
        </p>

        {/* Value */}
        <p className="text-4xl font-extrabold text-[#2c2f31] leading-none tracking-tighter">
          {fmt(value, unit)}
        </p>

        {/* Subtitle */}
        {subtitle && <p className="text-xs text-[#595c5e] mt-1">{subtitle}</p>}
        {unit && unit !== 'Kz' && <p className="text-xs text-[#595c5e] mt-0.5">{unit}</p>}
      </CardContent>
    </Card>
  );
}
```

**Key changes:**
- Remove the `absolute top-0 left-0` left bar div
- Add `border-l-4` using `style={{ borderLeft: ... }}`
- Add icon box with padding, rounded-lg, dynamic color background
- Update label color: `#6b7e9a` → `#595c5e`
- Update value: `text-3xl font-bold` → `text-4xl font-extrabold tracking-tighter`
- Add `group hover:shadow-md transition-all` to Card

**Do NOT:**
- Change `fmt()` function
- Remove subtitle logic
- Change return type or props interface (only add optional `icon`)

---

### Step 5: `frontend/src/components/dashboard/pipeline-widget.tsx`

**Changes:**
- Card wrapper: add `rounded-xl` and `ambient-shadow` classes
- Bar elements: `rounded-t-lg` → `rounded-t-md`
- Add `transition-all duration-500` to bar divs
- Bar hover: `hover:brightness-110`
- Section heading: ensure Montserrat weight 700
- "Ver detalhes" link: `text-[#0049e6] text-sm font-semibold`

**Do NOT:**
- Touch data fetching, stage.color logic
- Modify `/pipeline` link

---

### Step 6: `frontend/src/components/dashboard/tasks-widget.tsx`

**Changes:**
- Card dividers: `divide-y divide-gray-200` → `divide-y divide-slate-100`
- Pending task row: add `border-l-4 border-[#b31b25] bg-[#b31b25]/5`
- Completed task: keep `opacity-50 line-through`
- Empty state (if list is empty): add a centered message with `text-[#595c5e] text-sm`
- "Nova Tarefa" button: style as `text-[#0049e6] text-sm font-semibold hover:text-[#0049e6]/80`

**Do NOT:**
- Change task fetch logic
- Modify task click handlers or navigate links

---

### Step 7: `frontend/src/components/dashboard/goal-widget.tsx`

**Changes:**
- Card: add `rounded-xl` class
- Progress bar: add `transition-all duration-500`
- Heading text: ensure Montserrat 700 weight

**Do NOT:**
- Touch progress percentage calculation
- Change color threshold logic (grey → brand → amber → green)

---

### Step 8: `frontend/src/app/dashboard/page.tsx` (or `app/page.tsx`)

**Changes:**
- Stat cards grid: verify `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- Page title: `text-2xl font-extrabold text-[#2c2f31] tracking-tight` with Montserrat 800 weight
- Add sticky header if absent: `<header className="sticky top-0 bg-[#f5f7f9] backdrop-blur-sm z-40 px-8 py-4">…</header>`

**Do NOT:**
- Touch query hooks
- Modify widget props or data flow

---

## ✅ Verification Checklist

After all changes:

```bash
# 1. Build check
cd frontend
npm run build
# Expected: 0 errors, 0 warnings

# 2. Dev server
npm run dev
# Visit http://localhost:3000 in browser

# 3. Visual inspection
- [ ] Sidebar is w-64, logo has gradient blue bg
- [ ] Sidebar nav items show blue active state (not navy) when clicked
- [ ] Dashboard KPI cards have icon boxes with colored bg
- [ ] KPI values are larger (text-4xl, font-extrabold)
- [ ] KPI cards have border-l-4 color accent
- [ ] Pipeline chart renders with new styling
- [ ] Tasks list shows red accent for pending items
- [ ] All links navigate correctly
- [ ] Mobile: hamburger menu slides in sidebar correctly
- [ ] Chat unread badge displays correctly

# 4. Permission checks
- Log in as admin → all nav items visible
- Log in as team member → permission-filtered nav correct

# 5. User approval
- User visually approves changes locally
- Only then: deploy to production
```

---

## 🚨 Common Mistakes to Avoid

1. **Font imports** — Don't add Manrope/Inter. Montserrat only.
2. **Color hardcoding** — Use `style={{ color }}` with props, not inline hex.
3. **Props breaking** — Don't add required props; only optional (`icon?: …`).
4. **Logic mixing** — Don't add conditions to JSX for "styling optimization." Keep JSX structure flat.
5. **Radius consistency** — Cards get `rounded-xl`, buttons get `rounded-lg`.
6. **Icon mismatches** — Use lucide-react only; prototype uses Material Symbols (ignore that).

---

## 📞 Questions?

Refer back to the main plan: `/Users/mazangangunza/.claude/plans/effervescent-cuddling-bentley.md`

