# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary user — AI Agent Owner / Developer (Bên B operator & UniHack judge):** Builders and non-custodial wallet owners running autonomous x402 AI agents (via CLI, MCP Gateway in Antigravity/Claude Code, or local demo) who need real-time visibility into USDC spending limits, instant 1-click promotion of newly tested Sandbox APIs to Trusted Whitelist, and an immediate on-chain emergency Kill Switch (`pause()`/`unpause()`).
- **Secondary observer — Hackathon Evaluator / Auditor:** Evaluators testing the 7-step demo flow on Avalanche Fuji C-Chain via Privy email login (no browser wallet extension required) and verifying every transaction on Snowtrace.

## Product Purpose

AgentLeash is a non-custodial on-chain spending control plane ("wallet with an on-chain leash") for AI agents paying HTTP `x402` APIs using EIP-3009 USDC on Avalanche Fuji. The LLM/agent can only *propose* payments; the owner's dedicated `AgentPolicy` smart contract enforces 2-tier spending caps (Trusted Whitelist vs. micro-budget Sandbox), ERC-1271 signature approval, and a sovereign Kill Switch that blocks even pre-approved unpaid authorizations.

Success means an owner or evaluator can assess live 2-tier budget health within seconds, trace x402 money flow from AI Agent through `AgentPolicy` to APIs, trigger or inspect the 7-step demo flow (including rule-engine bypass simulations), promote a Sandbox endpoint to Whitelist in 1 click, or halt all agent spending immediately.

## Positioning

Unlike standard EOA agent wallets or single-threshold allowance modules (such as Safe `AllowanceModule`), AgentLeash binds every EIP-3009 `transferWithAuthorization` digest directly to `AgentPolicy.isValidSignature` (ERC-1271) with built-in 2-tier separation:
- **Trusted Whitelist (Tier 1):** Known APIs (`payTo` addresses) operate under normal per-tx and period caps.
- **Sandbox (Tier 2):** Unknown APIs can still be probed via `x402` under strict micro-caps (`sandboxPerTxCap`, `sandboxDailyCap`), counted inside the shared cycle `dailyCap`, and promoted to Tier 1 with one Privy-signed `setWhitelist` transaction.

## Operating Context

- **Network & Settlement:** Avalanche Fuji Testnet (`chainId 43113`), USDC (`FiatTokenV2_2` supporting ERC-1271), Routescan event indexing + Fuji RPC polling every 3 seconds, Snowtrace explorer links (`testnet.snowtrace.io`).
- **Authentication & Signing:** Privy embedded wallet via email login (`@privy-io/react-auth` + pure `viem`); read-only observer mode works without sign-in; mutating on-chain actions require the policy owner's Privy wallet signature after `simulateContract`.
- **Two-Sided Architecture (Side A / Side B):** Side A coding agents/MCP clients request paid data (`test_unknown_api`, `call_trusted_api`, `get_policy_status`); Side B AgentLeash enforces off-chain Rule Engine checks + on-chain `AgentPolicy` caps and logs off-chain/on-chain rejections to `agent/logs/audit.json`.
- **Competition Demo Constraint (Rule 6):** Demo cycles use `120` seconds (`DEMO_PERIOD_SECONDS=120`) instead of `1` day, and mock structured sellers (`Thời tiết`, `Tỷ giá`) with mock Gemini (`--mock-llm`) for deterministic 2-minute evaluation.
- **User-Confirmed Dashboard Priorities (19/11/2026):**
  - Hybrid single-screen layout on desktop: live 2-tier overview, x402 flow diagram/history, and rejections remain visible without tab switching during the 2-minute demo; deep policy configuration (Factory creation, `setCaps`, ERC-8004 passport) organizes into clean sub-tabs/panels inside the Policy & Rules area.
  - Precision Ops information density: fast 3-second scannability, tabular numeric precision, clean SVG icons, flat non-nested surfaces, 8px spacing rhythm.
  - Dedicated collapsible 2-minute Demo Control bar below the header (or top of workspace) housing the `--bypass-rules` switch, mock Dalat agent runner, and 7-step flow indicator cleanly separated from production policy controls.

## Capabilities and Constraints

- **Immutable Functional Contract:** Preserve all Web3/on-chain logic in `web/src/lib/*`, API routes (`/api/demo-run`, `/api/rejections`), 1-click "Chuyển thành API quen" (`Sandbox -> Whitelist`), Kill Switch (`pause`/`unpause` with confirmation dialog), Factory policy creation, policy switcher, 2-tier `setCaps` validation, ERC-8004 identity registration, and the 7-step demo scenario.
- **Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, `@privy-io/react-auth`, `viem` v2 (no `wagmi`, no heavy UI libraries that risk peer-dependency conflicts).
- **Language & Legal Framing:** Clear Vietnamese UI copy across 320px–1440px viewports without overflow; test USDC only for machine-to-machine API data payments (no fiat/payroll/financial-advice framing); no PII on-chain.
- **Zero Fabrication:** All shown balances, events, blocks, rejection logs, and ERC-8004 identities come strictly from on-chain RPC, Routescan, and `/api/rejections` or `/api/demo-run`.

## Brand Commitments

- **Product Name:** `AgentLeash` (Vietnamese tagline: "Ví cho AI agent có dây xích on-chain trên Avalanche").
- **Color Mode & Semantic Palette (Committed):** Dark Mode (`#020617` deep canvas, `#0f172a` elevated surface) with four distinct semantic state colors:
  - Whitelist / Trusted: Green
  - Sandbox / Demo Warning: Yellow/Amber
  - x402 Money Flow / Primary Action: Cyan
  - Kill Switch / Blocked / Danger: Red

## Evidence on Hand

- Live Fuji contracts (`AgentPolicy` demo `0x62Ea5e422b3ef66174B6Dd6Aa855F1f036894177`, `AgentPolicyFactory` `0x369251fC256D8Ae3B25F66Fe1c4b3114A06BA864`, `ERC8004IdentityRegistry` `0x8004A818BFB912233c491871b3d84c89A494BD9e`).
- Existing Vitest suite (`86` passing tests across `web/src/lib/*.test.ts`).
- Reference docs in `docs/SPEC.md`, `docs/HUONG_DAN_CHUAN_BI_FIGMA.md`, and `docs/FIGMA_UI_2_BAN_SO_SANH.md`.

## Product Principles

1. **Safety State Before Everything:** Policy pause status, spendable USDC balance, and emergency Kill Switch must be unmistakable within one glance.
2. **Enforce Tier Separation Visually:** Trusted Whitelist, Sandbox micro-limits, x402 active flow, and Blocked states must never blur together in color, label, or icon.
3. **Zero Ambiguity in Wallet & Tx State:** Always distinguish Read-Only Guest vs. Authenticated Non-Owner vs. Policy Owner, and track every owner signature through Signing -> Pending -> Confirmed/Error.
4. **Demo Clarity Without Production Clutter:** The 7-step demo runner and `--bypass-rules` simulation must be immediately operable for evaluators while visually demarcated from real policy rules.
5. **Graceful Resilience on Partial Data:** Handle initial RPC loading, missing local `audit.json` (e.g., online deployment), empty spends/rejections, and RPC errors without breaking layout or hiding recovery CLI paths.

## Accessibility & Inclusion

- Meet WCAG 2.1 AA contrast (>= 4.5:1 body text, >= 3:1 UI borders/icons/large text) on dark surfaces, never relying on color alone for status.
- Full keyboard navigation, visible `:focus-visible` outlines, native `<dialog>` semantics for confirmation, WAI-ARIA tabs/switches/meters, and zero horizontal overflow from `320px` to `1440px`.
