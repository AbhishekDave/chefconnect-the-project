# Plan v4 (final) — Table-name fixes + ChefConnect UI adoption

## Part A — Table-name audit fixes

I audited every `supabase.from(...)` call. No `chefs` or `tables` misuses. Three `dishes` references need correction (table name + column name):

| File:line | Current | Fix |
|---|---|---|
| `src/routes/table.$tableId.tsx:44` | `.from("dishes").select("id, name")` | `.from("signature_dishes").select("id, dish_name").eq("is_active", true)` |
| `src/routes/restaurant.$slug.tsx:28` | `.from("dishes").select("id, name")` | `.from("signature_dishes").select("id, dish_name").eq("is_active", true).order("dish_name")` |
| `src/routes/_authenticated/ops.tsx:51` | `.from("dishes").select("id, name")` | `.from("signature_dishes").select("id, dish_name, hearts_count").eq("is_active", true)` |

JSX reading `d.name` updated to `d.dish_name`. The Venue Love Meter per-dish breakdown uses `signature_dishes.hearts_count` directly (matches schema, no re-count).

All other names already correct: `users`, `chef_profiles`, `foodie_profiles`, `restaurants`, `restaurant_tables`, `restaurant_crew`, `hearts`, `table_connections`, `meal_visit_proofs`, `thank_you_notes`. Crew lookup in `src/lib/crew.ts` already goes `user_id → chef_profiles.id → restaurant_crew.chef_profile_id`.

No SQL output. No schema changes.

## Part B — ChefConnect Hub UI adoption (visual polish, data wiring untouched)

Cherry-pick from `project:4a67d4f0`. All copy stays Love Meter / thank-you notes (no points/karma/badge). All colors via semantic tokens in `src/styles.css`.

| ChefConnect file | Cheftoman target | Notes |
|---|---|---|
| `HeartButton.tsx` | `src/components/HeartButton.tsx` (new) | Adopt tap animation + count chip. **Supports two modes:** interactive (table session) and display-only (public pages). |
| `VisitProofForm.tsx` | `src/components/VisitProofForm.tsx` (new) → replaces inline markup in `table.$tableId.tsx` | Keep `cheftoman` bucket upload + `meal_visit_proofs` insert. |
| `Navbar.tsx` + `NavLink.tsx` | `src/components/Navbar.tsx` (new) → mounted in `__root.tsx` | TanStack `<Link>`. Links: `/`, `/me`, `/ops`, `/auth`. |
| `MobileBottomNav.tsx` | `src/components/MobileBottomNav.tsx` (new) → mounted in `__root.tsx` (hidden ≥md) | TanStack `<Link>` swap. |
| ~~`ChefmojiReactions.tsx`~~ | **Skip** | Chefmoji tables locked (Phase 6). |
| ~~`ScannerFab.tsx`~~ | **Skip** | NFC tap / native QR scan opens `/table/$tableId` directly. No in-app scanner. |
| `BadgeCard`, `BadgeShowcase`, `BadgeUnlockModal` | **Skip** | No badge vocabulary. |
| `FollowButton`, `TagVoting`, `DishManager`, `PushNotificationSetup` | **Skip** | Out of v3.4 MVP. |
| `ui/*` (shadcn) | **Skip** | Already present. |

### HeartButton — interactive vs display-only (locked constraint)

`HeartButton` accepts an `interactive` boolean prop. Hearting is **enabled only on `/table/$tableId`** inside an active table session (verified-present diner). Public pages render the heart as display-only:

- `src/routes/table.$tableId.tsx` → `<HeartButton interactive count={...} onHeart={insert} />` — tap inserts, Realtime updates.
- `src/routes/chef.$chefId.tsx` → `<HeartButton count={totalHearts} />` (no `interactive`, no `onHeart`) — count chip only, no tap handler, no insert path wired. Cursor stays default, no hover/press states beyond a static badge.
- `src/routes/restaurant.$slug.tsx` → same display-only treatment for chef and dish cards.

Rationale (encoded in component): a heart must come from a verified-present diner; public pages never write to `hearts`. The button visually renders the same shape so the brand stays consistent, but the public variant is a `<div>` (not `<button>`) with no click handler and no aria-pressed.

### Adaptation rules (every copied component)

1. `react-router-dom` → `@tanstack/react-router`.
2. Replace literal colors (`bg-orange-500`, hex) with tokens (`bg-primary`, `text-primary-foreground`, `bg-card`, `text-muted-foreground`, …).
3. Strip "points", "karma", "level", "badge", "unlock", "achievement" copy.
4. No hardcoded names/counts/dishes; all bound to existing Supabase data. Loading / empty / error states preserved.
5. No new dependencies unless strictly required (will flag before installing).

## Order of work

1. Fix the three `dishes` → `signature_dishes` (and `name` → `dish_name`) call sites + JSX.
2. Create `HeartButton`, `VisitProofForm`, `Navbar`, `MobileBottomNav` (adapted).
3. Wire `Navbar` + `MobileBottomNav` into `__root.tsx`. Swap interactive `HeartButton` + `VisitProofForm` into `table.$tableId.tsx`. Swap display-only `HeartButton` into `chef.$chefId.tsx` and `restaurant.$slug.tsx`.
4. Type-check clean, refresh preview, verify: landing renders from DB, table flow hearts insert + Realtime, public-page hearts are non-tappable, Love Meters live-update.

## Out of scope (next pass)

- Dish-to-cook recognition routing.
- Read-only portfolio polish.
