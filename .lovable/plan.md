# Freeze Punch List — Build (revised)

Ship all nine in-scope fixes. No new tables, columns, or features. After build, stop and report.

## Items

1. **`/me` HeartsList — resolve target names** (`src/routes/_authenticated/me.tsx`)
   Two-step fetch: load 50 hearts, then batch-resolve.
   - Chefs: `chef_profiles.select('id, users:user_id(full_name)').in('id', chefIds)` → display `users.full_name` (fall back to short id).
   - Dishes: `signature_dishes.select('id, dish_name').in('id', dishIds)` → display `dish_name`.

2. **`/ops` live connections — server-side scope** (`src/routes/_authenticated/ops.tsx`)
   Upstream: `restaurant_tables.select('id').eq('restaurant_id', restaurantId)`. Then `table_connections.in('table_id', tableIds).order(...).limit(30)`. Gate with `enabled: tableIds.length > 0`.

3. **Kill misleading `0` while loading**
   `ChefRollupBadge`, `DishHeartBadge`, `/ops` totals, `/me` Stat accept `count: number | null` and render `—` when null. Pass `count ?? null` from query results.

4. **Menu enrichment** (`src/routes/restaurant.$slug.tsx`, `src/routes/chef.$chefId.tsx`)
   Extend `signature_dishes` Row in `src/lib/database.types.ts` with `description`, `image_url`, `dietary_type`, `is_vegetarian`, `is_vegan`, `is_gluten_free`, `contains_allergens`. Add `dietaryTag(d)` helper. Render image thumb, name, dietary chip, line-clamped description. No price.

5. **Reset `nudge_count` on claim** (`src/lib/anonymousSession.ts`, `src/lib/auth.tsx`)
   Add `resetNudgeCount()`; call from `reconcileIdentity` on successful stitch.

6. **Realtime invalidates rollups** (`src/routes/table.$tableId.tsx`)
   In `postgres_changes` callback, also `qc.invalidateQueries({ queryKey: ['chef-rollup'] })` and `['venue-rollup']`.

7. **NudgeBanner safe-area**
   `<main>` base `pb-32`; conditional `pb-40` when `!user && nudgeCount > 0`.

8. **Heart double-insert race** — at the insert site (`src/routes/table.$tableId.tsx`, `HeartRow.tap()`)
   `useRef(false)` inside `HeartRow`. tap(): guard → optimistic filled → await insert → on error rollback + toast → on success bump nudge + invalidate → `finally` clears ref. `HeartButton` stays presentational.

9. **Thank-you note min length** — require `content.trim().length >= 3`.

## README note (no pipeline change)

Append under a "Types" heading:

> Database types in `src/lib/database.types.ts` are hand-maintained for the MVP. Phase 2 will switch to `bun run gen:types` (generated locally, committed). Do not wire prebuild regen or store `SUPABASE_ACCESS_TOKEN` in CI.

## Out of scope (not building)

`og:image` on chef pages, DB unique constraint, multi-cook, real presence, note acks, ops date filters, notifications, billing, i18n, image moderation, canonical absolute URLs, generated-types pipeline.

## After build

Stop and report per-item: built / verified / needs user check.
