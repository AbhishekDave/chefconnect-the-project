# Live-test fixes

## 1. Table route: resolve by `table_slug`, then UUID

In `src/routes/table.$tableId.tsx` `fetchTableContext(tableId)`:

- Replace the single `.eq("id", tableId)` query with:
  1. `select ... from restaurant_tables where table_slug = :tableId maybeSingle()`
  2. If no row AND `tableId` looks like a UUID (regex check), retry `where id = :tableId`.
  3. If still no row, `throw notFound()` (route gets a real `notFoundComponent`, no more 10–15s hang — current `throw new Error` is being retried by React Query; also set `retry: false` on this query).
- Use the resolved `t.id` (UUID) for the `table_connections` insert and `VisitProofForm` `tableId` prop. Pass the UUID down via the query result instead of using the raw URL param.
- Add `notFoundComponent` to the route.

No schema change. `restaurant_tables.table_slug` already exists.

## 2. Heart dedupe (client-side toggle)

Goal: one heart per (anon token OR user) per (target_type, target_id). Tap again removes it. Server enforcement deferred.

In `src/routes/table.$tableId.tsx > HeartRow`:

- Add `useQuery(["hearted", identity, targetType, targetId])` selecting the diner's own existing heart row:
  - If `user`: `where from_user_id = user.id and target_type and target_id limit 1`.
  - Else: `where anonymous_session_token = token and target_type and target_id limit 1`.
- `tap()` becomes a toggle:
  - If row exists → `delete().eq("id", row.id)`.
  - Else → insert (existing path).
  - Invalidate `hearts-count` and `hearted` queries.
- Update `HeartButton` with a `hearted` boolean → filled ♥ + active styling when true, outline when false.
- Only bump `nudge_count` on a fresh insert, never on un-heart.

Code comment: real enforcement = future DB unique index `(target_type, target_id, coalesce(from_user_id::text, anonymous_session_token))`.

## 3. Heart counts must come from row counts, never cached totals

Hard rule applied everywhere any heart number is displayed:

- All counts use `supabase.from("hearts").select("*", { count: "exact", head: true }).eq("target_type", …).eq/in("target_id", …)`. No reads of `signature_dishes.hearts_count`, `chef_profiles.total_hearts`, `restaurants.total_hearts`, or any similar cached column. (The insert trigger increments those but the un-heart delete won't decrement them, so they will drift the moment toggle ships.)
- Audit and fix:
  - `src/lib/hearts.ts > getChefHeartTotal` — already row-counts; keep.
  - `src/routes/restaurant.$slug.tsx` — `DishHeartBadge` already row-counts; `useVenueRollup` sums `getChefHeartTotal`; keep. Remove `hearts_count` from any select that still requests it.
  - `src/routes/_authenticated/ops.tsx` — remove any `signature_dishes.hearts_count` / `chef_profiles.total_hearts` selects; all totals derived from `hearts` row counts filtered by `target_type`.
  - `src/routes/_authenticated/me.tsx` — diner hearts = row count where `from_user_id = user.id`.
  - `src/routes/chef.$chefId.tsx` — uses `getChefHeartTotal`; keep.
- Add a tiny shared helper `countHearts(targetType, targetIds)` in `src/lib/hearts.ts` so every screen routes through one implementation.
- Invalidate keys on both insert and delete inside `HeartRow.tap()` so all rollups refresh.

## 4. Thank-you note feedback

- On success: `toast.success("Sent to the kitchen")`, then `setContent("")` AND `setChefId("")`.
- Show "Sending…" label while `busy`.

## 5. Contextual back navigation

Replace hardcoded `← Home` on `/restaurant/$slug` and `/chef/$chefId` with a small `BackLink` component:

- Prefers `router.history.canGoBack()` → renders a `<button>` calling `router.history.back()`, label "← Back".
- Else falls back:
  - Chef page → primary restaurant slug if available, else `/`.
  - Restaurant page → `/`.

Extend the chef loader to fetch one `restaurant_crew` row with `restaurants(slug, name)` for the fallback.

## 6. Visual polish (chef + restaurant)

Use existing tokens in `src/styles.css` (serif display, oklch palette). No new colors, no new libraries.

Restaurant page:
- Hero band: `cover_image_url` as 16:9 rounded image with soft gradient overlay; restaurant name `font-serif text-5xl`.
- Love Meter card: full-width on mobile, larger ♥, count `text-3xl tabular-nums`, subline "from diners at the table".
- Crew list cards: avatar initial circle, serif name, role chip muted, ♥ rollup right-aligned, hover lift.
- Dishes: 2-col grid on `sm+`, serif dish name, ♥ count, dashed empty state.
- Section headings: serif, uppercase eyebrow, `mt-12 mb-4`.
- Container `max-w-3xl`, rhythm `space-y-12`.

Chef page:
- Hero: photo or initial at `size-32`, name `font-serif text-5xl`, tier chip, restaurant link sub-line.
- Love Meter matches restaurant style.
- Bio in prose-like styling, tight max width.
- Signature dishes: same card grid.
- Thank-you notes: speech-bubble cards (`rounded-2xl`, `bg-secondary/40`, italic, small date).

All styles via tokens (`bg-card`, `border-border`, `text-primary`, `font-serif`). No raw hex.

## Files touched

- `src/routes/table.$tableId.tsx` — slug resolution, heart toggle, thank-you reset.
- `src/routes/chef.$chefId.tsx` — back link, primary restaurant fetch, visual polish.
- `src/routes/restaurant.$slug.tsx` — back link, visual polish.
- `src/routes/_authenticated/ops.tsx` — drop cached-total selects, route through row counts.
- `src/routes/_authenticated/me.tsx` — row-count diner hearts.
- `src/components/HeartButton.tsx` — add `hearted` prop + active styles.
- `src/lib/hearts.ts` — add shared `countHearts` helper.

## Out of scope

- DB unique constraint on hearts (Phase 2).
- Auth-required hearts.
- Removing/zeroing the existing cached-total columns in the DB (we just stop reading them; trigger can stay).
- Avatar uploads / font + palette changes.
