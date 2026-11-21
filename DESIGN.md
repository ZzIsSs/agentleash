---
name: AgentLeash Operate Console
description: Non-custodial on-chain x402 AI agent spending policy & safety console on Avalanche Fuji
colors:
  canvas-abyss: "#020617"
  surface-console: "#0f172a"
  surface-inset: "#131c31"
  surface-elevated: "#18233a"
  border-hairline: "#1e293b"
  border-control: "#5b6f8e"
  ink-primary: "#f1f5f9"
  ink-muted: "#94a3b8"
  trusted-signal: "#22c55e"
  trusted-ink: "#4ade80"
  sandbox-signal: "#eab308"
  sandbox-ink: "#facc15"
  flow-signal: "#22d3ee"
  flow-ink: "#67e8f9"
  danger-signal: "#ef4444"
  danger-solid: "#dc2626"
  danger-ink: "#fca5a5"
typography:
  display:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.flow-signal}"
    textColor: "{colors.canvas-abyss}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.flow-ink}"
  button-danger:
    backgroundColor: "{colors.danger-solid}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  panel-surface:
    backgroundColor: "{colors.surface-console}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input-control:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: AgentLeash Operate Console

## Overview

**Creative North Star: "The Sovereign Circuit Breaker"**

AgentLeash is a high-trust Web3 security and spending-policy console where an AI agent proposes HTTP `x402` payments and the owner's `AgentPolicy` smart contract enforces deterministic guardrails on Avalanche Fuji. Built strictly for **Operate** mode, the visual system rejects decorative gradients, glowing neon tropes, and nested card clutter in favor of razor-sharp telemetry, unmistakable state color discipline, and zero-ambiguity controls.

Every surface communicates one core distinction within 3 seconds: whether funds are flowing through trusted **Whitelist** endpoints, micro-capped **Sandbox** probes, live **x402** settlement channels, or halted by the **Kill Switch**. Vietnamese copy is treated as a first-class typographic citizen with generous vertical diacritic clearance and tabular numerals across all balances, countdowns, and block telemetry.

**Key Characteristics:**
- Precision dark slate layering (`#020617` abyss canvas, `#0f172a` panel surface, `#131c31` inset control wells) without shadows at rest.
- Strict four-color semantic state vocabulary calibrated for WCAG 2.1 AA contrast (`>= 4.5:1` text, `>= 3:1` UI borders/icons).
- Native Vietnamese diacritic optimization via `Be Vietnam Pro` paired with `JetBrains Mono` (`tabular-nums`) for hashes and USDC figures.
- Flat structural separation using hairline dividers (`#1e293b`) and uniform 1.5px stroke SVG icons instead of nested boxes or Unicode glyphs.

## Colors

A restrained dark slate neutral foundation supports four high-meaning state hues that never compete as decoration.

### Primary
- **Flow Cyan (`flow-signal`)** (`#22d3ee`): Reserved for x402 money-flow paths, active settlement amounts, primary owner CTAs (paired with `#020617` dark ink), and Snowtrace verification links.
- **Flow Tint (`flow-ink`)** (`#67e8f9`): Hover state for primary cyan buttons and active link highlights.

### Secondary
- **Trusted Green (`trusted-signal`)** (`#22c55e`): Tier 1 Whitelist meter fills, active policy indicators, and confirmed transaction steps.
- **Trusted Text (`trusted-ink`)** (`#4ade80`): High-contrast green label and badge copy inside tinted dark green surfaces.
- **Sandbox Amber (`sandbox-signal`)** (`#eab308`): Tier 2 Sandbox micro-limit meter fills, Demo cycle disclosure indicators, and rule-engine off-chain warning borders.
- **Sandbox Text (`sandbox-ink`)** (`#facc15`): High-contrast amber text for Sandbox badges, gas warnings, and demo control notices.

### Tertiary
- **Danger Red (`danger-signal`)** (`#ef4444`): Border/icon highlights for on-chain contract rejections and blocked simulation alerts.
- **Kill Switch Solid (`danger-solid`)** (`#dc2626`): Solid fill for the emergency `KHÓA KHẨN CẤP` action button and destructive confirmations (`#ffffff` text achieves > 5.0:1 AA contrast).
- **Danger Text (`danger-ink`)** (`#fca5a5`): Readable light red copy for rejection reasons and form validation messages on dark tinted surfaces.

### Neutral
- **Canvas Abyss (`canvas-abyss`)** (`#020617`): Viewport background and primary button dark foreground ink.
- **Console Surface (`surface-console`)** (`#0f172a`): Primary panel and sticky header background.
- **Inset Well (`surface-inset`)** (`#131c31`): Interactive form inputs, KPI stat wells, and collapsible demo control background.
- **Elevated Surface (`surface-elevated`)** (`#18233a`): Hover states for secondary controls and active tab surfaces.
- **Hairline Border (`border-hairline`)** (`#1e293b`): Structural panel outlines and list row dividers.
- **Control Border (`border-control`)** (`#5b6f8e`): Interactive input and button boundaries meeting WCAG 3:1 non-text contrast.
- **Primary Ink (`ink-primary`)** (`#f1f5f9`): Headlines, values, and primary prose.
- **Muted Ink (`ink-muted`)** (`#94a3b8`): Secondary captions, metadata labels, and timestamps.

### Named Rules
**The Four-Hue Discipline Rule.** Green means Whitelist, Amber means Sandbox or Demo notice, Cyan means x402 flow or primary owner CTA, and Red means Kill Switch or Blocked. Never use any of these four hues for decorative accents outside their meaning.

**The AA Solid-Red Rule.** Never place white text on `#ef4444` at small control sizes; always use `#dc2626` (`danger-solid`) for filled danger buttons so text contrast stays above `5.0:1`.

## Typography

**Display Font:** `Be Vietnam Pro` (with `system-ui, sans-serif`)
**Body Font:** `Be Vietnam Pro` (with `system-ui, sans-serif`)
**Label/Mono Font:** `JetBrains Mono` (with `ui-monospace, monospace`)

**Character:** `Be Vietnam Pro` is engineered specifically for Vietnamese diacritics so stacked tone marks remain crisp at compact dashboard sizes (`12px`–`14px`), while `JetBrains Mono` locks wallet addresses, tx hashes, CLI strings, and `tabular-nums` USDC telemetry into clean vertical columns.

### Hierarchy
- **Display / App Title (`h1`)** (`700`, `1.5rem` / `24px`, `1.25` line-height, `-0.02em` tracking): Top-bar brand and console identity.
- **Headline (`h2`)** (`600`, `1.125rem` / `18px`, `1.35` line-height, `-0.015em` tracking): Panel titles (`Tổng quan & hạn mức 2 tầng`, `Dòng tiền x402`, `Policy & luật chi tiêu`, `Nhật ký bị từ chối`).
- **Title (`h3`)** (`600`, `0.9375rem` / `15px`, `1.4` line-height): Sub-panel and form group headings.
- **Body** (`400`, `0.875rem` / `14px`, `1.5` line-height, max `70ch` for prose): Descriptions, alerts, and empty-state guidance.
- **Label** (`500`, `0.75rem` / `12px`, `1.4` line-height): Field labels, metadata, and status badges.
- **Mono Telemetry** (`500`, `0.8125rem` / `13px`, `1.45` line-height, `font-variant-numeric: tabular-nums`): Balances, countdowns, addresses, and tx hashes.

### Named Rules
**The Tabular Telemetry Rule.** Every live number (`USDC` balances, countdown timers, block numbers, cap inputs) must use `tabular-nums` so 1-second timer ticks and 3-second RPC refreshes never cause horizontal layout jitter.

## Layout

Desktop (`1440px`) uses a `max-w-[1440px]` centered container with a sticky command header, a collapsible full-width 2-minute Demo Control bar, and a two-row asymmetric 12-column grid (`gap-4` on mobile, `gap-5` on desktop):
- **Row 1 (Telemetry):** `Tổng quan & hạn mức 2 tầng` (5 columns) paired with `Dòng tiền x402` SVG topology + ledger (7 columns).
- **Row 2 (Governance & Enforcement):** `Policy & luật chi tiêu` with 3 accessible sub-tabs (`Whitelist API`, `Hạn mức`, `Policy & ERC-8004`) (6 columns) paired with `Nhật ký bị từ chối` (6 columns).
- **Responsive (`320px`–`1024px`):** Stacks to a single clean column below `1024px`; header elements wrap without horizontal overflow (`overflow-x-clip`, zero clipped controls); touch targets maintain `min-h-11` (`44px`) on form inputs and primary buttons.

## Elevation & Depth

This Operate console uses **flat tonal layering** at rest rather than decorative drop shadows. Surface separation moves cleanly from `canvas-abyss` (`#020617`) to `surface-console` (`#0f172a`) to `surface-inset` (`#131c31`), bounded by `1px` hairline borders (`#1e293b`). Depth elevation (`0 20px 48px rgba(2, 6, 23, 0.75)`) is reserved exclusively for top-layer modal dialogs (`<dialog>`) and sticky header separation.

### Named Rules
**The Flat-By-Default Rule.** Panels and list rows sit flat on the canvas with zero ambient drop shadows; only the top-layer Kill Switch confirmation `<dialog>` casts a backdrop shadow.

## Shapes

Three restrained corner radii establish clear structural containment without bulbous pill distortion:
- **Panels (`12px`):** Top-level operational cards and modal dialogs.
- **Controls & Wells (`8px`):** Buttons, text inputs, selects, sub-tab containers, KPI stat wells, and inset demo bars.
- **Status Badges (`6px`):** Semantic tier chips (`Whitelist`, `Sandbox`, `Contract chặn`, `1-click`), keeping full `9999px` circles exclusively for `8px` live status indicator dots.

## Components

### Buttons
- **Shape:** Gently rounded (`8px` radius), minimum `36px` height (`44px` on form submitters and mobile tap targets), uniform `16px` SVG icon gap (`gap-2`).
- **Primary (`button-primary`):** Flow Cyan (`#22d3ee`) fill with Canvas Abyss (`#020617`) semibold text (`10px 16px` padding).
- **Danger / Kill Switch (`button-danger`):** Danger Solid (`#dc2626`) fill with `#ffffff` bold text (`10px 16px` padding).
- **Hover / Focus:** `150ms cubic-bezier(0.2, 0, 0, 1)` background transition; `2px solid #22d3ee` outline with `2px` offset on `:focus-visible`.
- **Secondary:** Inset Well (`#131c31`) background, Control Border (`#5b6f8e`), `#f1f5f9` text, transitioning to Elevated Surface (`#18233a`) on hover.

### Chips
- **Style:** Compact `6px` radius (`px-2 py-0.5`), tinted semantic background (`12%` opacity) with `1px` border (`30%` opacity) and high-contrast semantic ink (`trusted-ink`, `sandbox-ink`, `flow-ink`, `danger-ink`) plus a leading SVG icon or indicator dot.

### Cards / Containers
- **Corner Style:** `12px` (`rounded-xl`).
- **Background:** Console Surface (`#0f172a`).
- **Border:** `1px solid #1e293b` (`border-hairline`).
- **Internal Padding:** `20px` (`p-5`) on desktop, `16px` (`p-4`) on compact mobile.

### Inputs / Fields
- **Style:** Inset Well (`#131c31`) background, `1px` Control Border (`#5b6f8e`), `8px` radius, minimum `44px` (`min-h-11`) height, `10px 12px` padding.
- **Focus:** `2px solid #22d3ee` border + focus ring (`outline-offset: 2px`).
- **Error / Disabled:** `border-danger-signal` with subtle red tint and explicit inline Vietnamese recovery text; `opacity-50` with `cursor-not-allowed` when disabled.

### Navigation
- **Style:** Horizontal WAI-ARIA `tablist` inside `Policy & luật chi tiêu` (`Whitelist API`, `Hạn mức 2 tầng`, `Tạo Policy & ERC-8004`) using single-row overflow-safe tabs with a crisp bottom indicator border on `[aria-selected="true"]` and full arrow-key navigation.

## Do's and Don'ts

### Do:
- **Do** use native `<dialog>` with `showModal()` for Kill Switch confirmation, native `<input type="checkbox" switch>` semantics for `--bypass-rules`, and native `<button>`/`<a>` elements everywhere.
- **Do** separate repeated spend and rejection items with clean `divide-y` hairlines or flat tinted rows rather than nesting card boxes inside cards.
- **Do** pair every status color with clear Vietnamese text and a consistent 1.5px stroke SVG icon (`aria-hidden="true"` when beside text).
- **Do** show realistic layout-matched skeleton loaders (`animate-pulse` neutral blocks) while initial Fuji RPC data loads.

### Don't:
- **Don't** use one-sided thick borders (`border-l-4` side-tabs), decorative glow halos, purple/indigo AI-default palettes, or raw Unicode/emoji (`✓`, `✕`, `↗`) as UI icons.
- **Don't** number panel headings (`[1]`, `[2]`, `[3]`, `[4]`) or add decorative eyebrow kickers above section titles.
- **Don't** hide the Kill Switch, mandatory 120s Demo cycle disclosure, or 1-click "Chuyển thành API quen" button behind extra modals or nested menus.
