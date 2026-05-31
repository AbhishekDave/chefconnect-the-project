## Part 1 — Landing page wiring (items 1-3)

**`src/routes/index.tsx`**
- Replace `__WA_NUMBER__` with `4915123702524` (single `WA_NUMBER` const, used by `buildWaUrl()` and `StickyWhatsApp`).
- Add `EMAIL_FALLBACK = "cheftoman_official@outlook.com"` const, with `// TODO: swap to info@cheftoman.com when domain email is live`.
- Under the lead-form primary CTA ("Send via WhatsApp"), add a small secondary line: "No WhatsApp? Email us" → `mailto:` link populated with the same name/restaurant/city fields (subject + body prefilled).
- Same email fallback link under the "Request a free sample stand" CTA in the FreePilot section.
- City stays a free-text `<input>` (no change).

**`src/components/marketing/StickyWhatsApp.tsx`** — no change.

## Part 2 — Dish-to-cook recognition (READ-TIME ROLLUP only)

No schema changes. No new tables. No new columns. Heart insert on `/table/$tableId` stays exactly as-is (`target_type='dish'`, `target_id = dish.id`; or `target_type='chef_profile'`, `target_id = chef.id`).

Add a single helper `getChefHeartTotal(chefProfileId)` in `src/lib/crew.ts` (or new `src/lib/hearts.ts`) that computes:

1. Fetch dish ids for the chef:
   `signature_dishes` where `assigned_crew_id` ∈ `restaurant_crew.id` whose `chef_profile_id = chefProfileId`.
   (Two queries: `restaurant_crew` rows for this chef → their `id`s → `signature_dishes` where `assigned_crew_id IN (...)`.)
2. Count hearts where `(target_type='chef_profile' AND target_id = chefProfileId)` OR `(target_type='dish' AND target_id IN dishIds)`.
3. Return the sum.

Wire this rollup into the read sites:
- `src/routes/chef.$chefId.tsx` — show the rollup instead of (or in addition to) `chef_profiles.total_hearts`. Display-only HeartButton uses the rollup count.
- `src/routes/_authenticated/me.tsx` — same rollup for the signed-in cook.
- `src/routes/_authenticated/ops.tsx` — per-cook recognition column uses the rollup.
- `src/routes/restaurant.$slug.tsx` — if it lists chefs with hearts, use the rollup per chef.

Public-page HeartButton stays display-only. Table-page heart flow is untouched.

Multi-cook per dish (a real `dish_crew` join) is Phase 2, not now.

## Part 3 — Read-only portfolio polish (items 5-6)

Visual-only pass, no query shape changes beyond swapping in the rollup helper above:

- `src/routes/chef.$chefId.tsx`: typography hierarchy (Instrument Serif display, Inter body), spacing rhythm, hero with rollup hearts + tier badge, signature dishes grid using `dish_name`, bio block, specialties as chips.
- `src/routes/restaurant.$slug.tsx`: hero, chef roster cards (link to `/chef/$chefId`), signature dishes from the restaurant's chefs.
- Semantic tokens only (charcoal/ember/cream from `src/styles.css`). No literal hex.

## Part 4 — Preview & SEO checks (items 7-8)

- Load `/` in the preview, check console for unresolved imports / route-tree warnings, screenshot at 1336×853 and ~390px mobile.
- Add leaf-level `head()` to `src/routes/index.tsx`:
  - `title`, `description`, `og:title`, `og:description`, `og:url` (relative `/`), `og:type: "website"`.
  - Canonical `<link rel="canonical" href="/">` (leaf only).
  - JSON-LD `Organization` block (name: Cheftoman, contact: WhatsApp URL).
- `og:image`: skip this pass (no asset), flag as follow-up.
- Confirm `/chef/$chefId` and `/restaurant/$slug` have leaf `head()` with unique title/description from loader data; add if missing.

## Out of scope
- No Supabase schema changes; no `dish_cooks`, no `target_chef_id`, no per-cook fan-out.
- No `chefmojis` work (Phase 6 locked).
- No scanner UI/route.
- No backend for the lead form (WhatsApp + mailto only).
- No points/karma/badge copy.
- No public-page heart inserts.
