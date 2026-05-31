# Marketing Landing Page — `/` (index)

Replace the current restaurant-list `/` with a static, mobile-first marketing page aimed at restaurant owners. Diner flow (`/table/$tableId`) is untouched and never lands here. No Supabase calls, no auth, no backend.

## Scope

- Rewrite `src/routes/index.tsx` only.
- Add 2 small presentational components under `src/components/marketing/`.
- Reuse existing brand tokens in `src/styles.css` (charcoal + ember + cream, Instrument Serif headings, Inter body). No new tokens, no new deps.
- No changes to `__root.tsx`, navbar, or any other route. (Navbar already hides on public marketing context per existing layout; if it shows, we'll let it — out of scope to retheme nav.)

## Open items needing user input before implementation

1. **WhatsApp number** for `wa.me/<NUMBER>` links and the sticky button. Need the full international number (no `+`, no spaces).
2. **Sample-stand fallback email** — when the lead form "sends an email", which address? (Or should the lead form ALSO just open WhatsApp prefilled, and we skip mailto entirely?)
3. **City** field — free text, or a small preset list?

I'll proceed assuming: WhatsApp number = placeholder `__WA_NUMBER__` (easy to swap), lead form opens WhatsApp prefilled (no mailto), city is free text. Tell me if any of that should change.

## Page structure (in order)

1. **Hero** — H1 + subhead + primary WhatsApp CTA + secondary "Request a free sample stand" (scrolls to lead form). Charcoal bg, ember accent, cream type.
2. **What we solve** — 4 cards (grid: 1 col mobile, 2 cols sm, 4 cols lg). Pain points in diner→kitchen recognition gap.
3. **How it works** — 3 numbered steps (tap NFC / send heart + note / kitchen sees it live).
4. **Presence-verified difference** — explainer block: why hearts come from real seated diners (NFC + QR at the table), not from anonymous internet reviews. No mention of blocking Google reviews.
5. **For your kitchen** — benefit list aimed at chefs/owners (morale, retention, signature-dish signal).
6. **Free pilot offer** — what's included, zero cost, no lock-in. Primary CTA: WhatsApp. Secondary: lead form anchor.
7. **Lead form** — minimal: name, restaurant, city, WhatsApp number. Submit builds a `wa.me/<NUMBER>?text=...` URL with the four fields prefilled and opens it in a new tab. Pure client-side, no fetch.
8. **Final CTA** — single big WhatsApp button + one-line reassurance.
9. **Footer** — minimal: brand, year, link to `/auth` for existing owners.

## Always-on UI

- **Sticky WhatsApp FAB** — fixed bottom-right, ember bg, visible on every section, `aria-label="Chat on WhatsApp"`. Hidden on `/table/*` and `/auth` because it only lives inside `index.tsx` (not the root).
- **Scroll-triggered popup** — appears once after the user scrolls past the "How it works" section (IntersectionObserver on a sentinel below that section). Value-first copy: "Want a free sample stand for your tables?" with WhatsApp CTA + dismiss. Never time-triggered. Dismissal persisted in `sessionStorage` so it doesn't reappear that session.

## Files to add / change

- **edit** `src/routes/index.tsx` — replace `Landing` + `RestaurantList` + `featuredQuery` with the marketing page. Keep `head()` SEO with updated title/description for owners.
- **add** `src/components/marketing/StickyWhatsApp.tsx` — sticky FAB.
- **add** `src/components/marketing/ScrollPopup.tsx` — IntersectionObserver popup, sessionStorage gated.
- (Lead form lives inline in `index.tsx` — small enough not to warrant its own file.)

## Technical notes

- Single shared helper `buildWaUrl(message: string)` defined in `index.tsx` returns `https://wa.me/${NUMBER}?text=${encodeURIComponent(message)}`.
- All CTAs are `<a href target="_blank" rel="noopener noreferrer">`, not buttons, so they work without JS.
- Lead form is a controlled `<form onSubmit>` that calls `window.open(buildWaUrl(...))` and `preventDefault`s. No network calls.
- Uses semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-primary`, `bg-primary`, `border-border`, etc.) — no literal hex.
- One H1 only (in hero). Section headings are H2. SEO `head()` updated: title ≈ "Cheftoman — Real love from real diners, straight to your kitchen", description ≈ 150 chars for restaurant owners.
- Mobile-first: base styles target ~375px; `sm:` and `lg:` widen the grids.
- No framer-motion needed; CSS transitions only (keeps bundle small, no new deps).
- Removes the now-unused `featuredQuery` and the `useSuspenseQuery` import from this file. The `restaurants` table query disappears from `/`; nothing else in the app depends on it.

## Out of scope (explicitly)

- Any backend, lead persistence, email sending, or analytics.
- Navbar/footer restructure across other routes.
- Changes to `/table/$tableId`, `/restaurant/$slug`, `/chef/$chefId`, `/me`, `/ops`, `/auth`.
- New brand tokens or font additions (using only what's already in `src/styles.css`).
- Any "block your Google reviews" framing — copy stays positive ("verified, kitchen-direct appreciation").
