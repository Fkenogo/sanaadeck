# Sanaadeck UI/UX Design Skill
> Project-specific design system for Sanaadeck — a premium dark-themed creative agency platform.
> Save this file in your Sanaadeck project root as: `SANAADECK-DESIGN.skill.md`

---

## Who You Are When Using This Skill
You are a Senior UI/UX Engineer building a high-end creative agency SaaS platform.
Sanaadeck must look like a premium creative tool — not a generic admin dashboard.
Every screen must feel like it belongs in the same family as Crextio, Linear, or Vercel.

---

## Brand Identity
- **Platform:** Sanaadeck — digital creative agency platform
- **Audience:** Creative founders, clients buying creative work, creative professionals
- **Aesthetic:** Dark, premium, African-modern, bold confidence
- **Reference style:** Crextio HR platform (dark surfaces, golden accents, card-based layouts)

---

## Color System

| Role | Token | Hex |
|---|---|---|
| Page background | `bg-base` | `#0F0F0F` |
| Surface / cards | `bg-surface` | `#1A1A1A` |
| Surface elevated | `bg-elevated` | `#222222` |
| Border subtle | `border-subtle` | `rgba(255,255,255,0.06)` |
| Primary accent | `accent-gold` | `#C9A227` |
| Primary accent light | `accent-gold-light` | `#E3C96E` |
| Secondary accent | `accent-green` | `#2D5A27` |
| Secondary accent light | `accent-green-light` | `#4A7C3F` |
| Text primary | `text-primary` | `#FFFFFF` |
| Text secondary | `text-muted` | `#A1A1AA` |
| Text disabled | `text-disabled` | `#52525B` |
| Status: success | `status-success` | `#10B981` |
| Status: warning | `status-warning` | `#F59E0B` |
| Status: error | `status-error` | `#EF4444` |
| Status: neutral | `status-neutral` | `#6B7280` |

---

## Typography

- **Font family:** Inter (primary), fallback: system-ui, sans-serif
- **Page titles (H1):** `text-2xl font-bold text-white`
- **Section titles (H2):** `text-lg font-semibold text-white`
- **Card labels:** `text-xs font-medium text-zinc-400 uppercase tracking-wider`
- **KPI numbers:** `text-3xl font-bold text-white`
- **Body:** `text-sm text-zinc-300`
- **Muted/caption:** `text-xs text-zinc-500`

---

## Layout Principles

### Spacing
- Page padding: `p-6` or `p-8`
- Card internal padding: `p-5` or `p-6`
- Between sections: `gap-6`
- Between card rows: `gap-3` or `gap-4`

### Border Radius
- Cards and containers: `rounded-2xl` (16px)
- Buttons: `rounded-xl` (12px)
- Badges/pills: `rounded-full`
- Input fields: `rounded-xl`

### Shadows
- Cards: `shadow-[0_4px_24px_rgba(0,0,0,0.4)]`
- Elevated modals: `shadow-[0_20px_60px_rgba(0,0,0,0.6)]`

### Glassmorphism (for sidebars, overlays, modals)
```css
background: rgba(26, 26, 26, 0.85);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.06);
```

---

## Component Rules

### Sidebar Navigation
```
- Background: #111111 with right border: 1px solid rgba(255,255,255,0.05)
- Active item: bg-[#1F1F1F] text-[#C9A227] left border accent 3px solid #C9A227
- Inactive item: text-zinc-400 hover:text-white hover:bg-white/5
- Logo area: bold white, subtitle muted gold
- Sign out button: border border-white/10 text-zinc-400 hover:text-white
```

### Cards / Stat Boxes (replace current KPI boxes)
```
- Background: #1A1A1A
- Border: 1px solid rgba(255,255,255,0.06)
- Border radius: rounded-2xl
- Padding: p-5
- Label: text-xs uppercase tracking-widest text-zinc-500
- Value: text-3xl font-bold text-white
- Sub-label: text-xs text-zinc-400
- Optional glow for primary metric: 
  text-shadow: 0 0 20px rgba(201, 162, 39, 0.3)
```

### Tables → Card Lists (CRITICAL REPLACEMENT)
**Never use standard HTML tables. Replace all tables with card-based row layouts.**

Each row becomes:
```html
<div class="flex items-center justify-between p-4 bg-[#1F1F1F] 
            rounded-xl border border-white/5 hover:border-white/10 
            transition-all cursor-pointer">
  <!-- Left: Avatar + Name + Role -->
  <div class="flex items-center gap-3">
    <div class="w-9 h-9 rounded-full bg-[#C9A227]/20 
                flex items-center justify-center text-[#C9A227] text-sm font-bold">
      C1
    </div>
    <div>
      <p class="text-sm font-medium text-white">Creative1</p>
      <p class="text-xs text-zinc-400">graphic_design · mid</p>
    </div>
  </div>
  <!-- Right: Status badge + Actions -->
  <div class="flex items-center gap-3">
    <span class="px-2 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400">
      active
    </span>
    <button class="text-xs text-zinc-400 hover:text-white">View</button>
  </div>
</div>
```

### Buttons
```
Primary:   bg-[#C9A227] text-black font-semibold rounded-xl px-4 py-2 
           hover:bg-[#E3C96E] transition-colors
Secondary: bg-white/5 text-white border border-white/10 rounded-xl px-4 py-2 
           hover:bg-white/10
Danger:    bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl px-4 py-2
Ghost:     text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl px-3 py-2
```

### Status Badges / Pills
```
Active:    bg-emerald-500/10 text-emerald-400 rounded-full px-2.5 py-0.5 text-xs
Pending:   bg-yellow-500/10 text-yellow-400 rounded-full px-2.5 py-0.5 text-xs
Suspended: bg-red-500/10 text-red-400 rounded-full px-2.5 py-0.5 text-xs
Neutral:   bg-zinc-700/50 text-zinc-400 rounded-full px-2.5 py-0.5 text-xs
Good/CPS:  bg-[#C9A227]/10 text-[#C9A227] rounded-full px-2.5 py-0.5 text-xs
```

### Input Fields
```
bg-[#262626] border border-white/10 rounded-xl px-4 py-2.5 
text-white placeholder-zinc-500 text-sm
focus:outline-none focus:border-[#C9A227]/50 focus:ring-1 focus:ring-[#C9A227]/20
```

### Charts / Data Visualization
- Chart background: transparent or `#1A1A1A`
- Grid lines: `rgba(255,255,255,0.05)`
- Primary line/bar color: `#C9A227`
- Secondary: `#2D5A27` or `#10B981`
- Axis labels: `#71717A`

### Modals / Overlays (Project Workspace)
```
bg-[#141414] border border-white/10 rounded-3xl
shadow-[0_25px_80px_rgba(0,0,0,0.7)]
backdrop-filter: blur(20px)
```

---

## Page-by-Page Refactor Priority

Refactor in this exact order to avoid breaking the app:

1. **Global styles first** — sidebar, page background, fonts
2. **Overview page** — KPI cards, revenue charts, notifications section
3. **Creatives page** — replace both tables with card lists
4. **Project Workspace modal** — dark overlay, card members, tab styling
5. **Clients page** — card list layout
6. **Payments / Credit Tx** — transaction list cards
7. **Reports page** — chart styling

---

## What to REMOVE Immediately
- ❌ All white (`#FFFFFF` or `bg-white`) backgrounds on containers
- ❌ All grey borders using standard Tailwind `border-gray-200` or `border-gray-300`
- ❌ Standard HTML `<table>` elements — replace with card rows
- ❌ Default browser button styles
- ❌ Any `rounded` or `rounded-md` — upgrade to `rounded-xl` or `rounded-2xl`

---

## Icons
- Library: Lucide React (already in most React setups)
- Stroke width: always `1.5`
- Size: `16px` inline, `20px` for nav items, `24px` for section headers
- Color: match context — white for active, zinc-400 for inactive

---

## Anti-Patterns to Avoid
- ❌ Solid white text on gold background (use black text on gold)
- ❌ Too many accent colors on one screen (max 2 accents visible at once)
- ❌ Full-width gold buttons (use contained width)
- ❌ Flat/no-depth cards (always add subtle border + shadow)
- ❌ Small font sizes for KPI numbers (always `text-2xl` minimum)
