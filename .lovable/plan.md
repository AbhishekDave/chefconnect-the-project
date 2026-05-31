# Audit fixes — schema truth, presence, stitching, ops totals

## 1. Generate typed Supabase client (permanent fix)

Root cause of repeated phantom-column bugs: the client is untyped (`createClient(url, anonKey)` with no generic), so wrong columns only fail at runtime.

- Add `src/integrations/supabase/types.ts` generated from the live schema.
  - Run `bunx supabase gen types typescript --project-id <id> --schema public > src/integrations/supabase/types.ts` (project id from `VITE_SUPABASE_PROJECT_ID`).
  - Add an npm script `"gen:types": "supabase gen types typescript --project-id $VITE_SUPABASE_PROJECT_ID --schema public > src/integrations/supabase/types.ts"` so it's repeatable.
- Update `src/lib/supabaseClient.ts` to `createClient<Database>(url, anonKey, ...)` importing `Database` from the generated file.
- Remove the hand-written `type Restaurant`, `type ChefProfile`, `type Chef`, etc. in routes; derive from `Database["public"]["Tables"][...]["Row"]` where useful, or let inference do its job.
- Replace `as any` casts on joined rows (`row.chef_profiles as ...`) with typed inference where possible, narrowing only at the join edges.

Once this is in, any `select("description")` against `restaurants` is a TS error, not a silent prod miss.

## 2. Fix all wrong column selects/JSX

Schema truth (per user): `restaurants` has no `description`; `chef_profiles` has no `full_name` or `photo_url`. Chef name lives on `users.full_name` via `chef_profiles.user_id → users.id`. No profile-photo column on `users` → drop photos entirely.

Files to fix:

- **`src/routes/restaurant.$slug.tsx`**
  - Select: `id, name, slug, cover_image_url` (drop `description`).
  - Remove `description` from `Restaurant` type, head() fallback, and the `{restaurant.description && ...}` JSX block.
  - Crew select: `crew_role, chef_profiles:chef_profile_id(id, user_id, users:user_id(full_name))`. Map `full_name` from the nested `users` row.
- **`src/routes/chef.$chefId.tsx`**
  - Select: `id, bio, user_id, users:user_id(full_name)` (drop `full_name`, `photo_url`).
  - Use `users.full_name` everywhere (`<h1>`, `alt`, initial avatar, head title/description).
  - Remove the `<img src={chef.photo_url} ...>` branch — always render the initial-letter avatar.
- **`src/routes/table.$tableId.tsx`**
  - Crew select: `chef_profile_id, crew_role, chef_profiles:chef_profile_id(id, user_id, users:user_id(full_name))`. Build `Chef` from the nested `users.full_name`.
- **`src/routes/_authenticated/ops.tsx`**
  - Crew select: `id, chef_profiles:chef_profile_id(id, user_id, users:user_id(full_name))`. Map `full_name` from `users`.

## 3. Identity stitching — stop swallowing failures, verify all three tables

In `src/lib/auth.tsx > reconcileIdentity`:

- Replace `console.warn("stitch_anonymous_session", sErr)` with a thrown error that bubbles to `runReconcile`'s catch, which then surfaces a `toast.error("We couldn't link your earlier taps — contact support")` and **does not** mark `reconciledRef` as done (so the next auth event retries). Same for `users upsert` and `foodie_profiles insert` warnings — surface as toasts; don't fail silently.
- Add import of `toast` from `sonner`.
- After a successful stitch, optimistically invalidate `["hearts-count", ...]` and any `/me` queries so the diner sees their stitched history immediately.
- Add a one-time sanity assertion in dev: after stitch, read counts of (a) `hearts where from_user_id = user.id`, (b) `thank_you_notes where from_foodie_id = foodieProfileId`, (c) `meal_visit_proofs where foodie_profile_id = foodieProfileId`, and log a single grouped console table. If all three are 0 while the anon token had activity, log a visible warning (RPC silently no-op'd).
- Document in a code comment that the deployed RPC stitches **all three** target columns; if a future schema migration adds a new anon-keyed table, the RPC must be updated too.

## 4. Presence link on hearts — reuse `is_gps_verified`

In `src/routes/table.$tableId.tsx > HeartRow.tap()`:

- Read `src` (from `Route.useSearch`) at the `HeartRow` level (pass it down, or read via `useSearch({ from: "/table/$tableId" })`).
- When inserting a heart, set `is_gps_verified: src === "nfc"` on the payload.
- No schema change. This makes the "verified" badge truthful per-heart.
- `/ops` and chef rollups already count all hearts; no change there, but the column is now meaningful for future filters.

## 5. /ops venue total — correct filtering

In `src/routes/_authenticated/ops.tsx > RestaurantOps`:

- Drop `restaurantId` from the heart `in("target_id", ids)` list — nothing writes hearts with `target_type='restaurant'`.
- Split into two filtered queries (or one query with `or()` on `(target_type,target_id)` pairs):
  - `hearts where target_type='chef_profile' and target_id in chefIds`
  - `hearts where target_type='dish' and target_id in dishIds`
- Venue `total` = sum of the two counts (matches the per-chef + per-dish rollup the page already shows).
- Keep `target_type` in the select so the existing per-dish / per-chef breakdown still works on the same dataset.

## 6. Remove dead restaurant Love Meter

In `src/routes/restaurant.$slug.tsx`:

- Delete `const restaurantHearts = useLiveHeartCount("restaurant", restaurant.id)` and the `<HeartButton count={restaurantHearts} label="Love Meter" />` block.
- Replace the hero meter with a venue rollup: sum of `getChefHeartTotal` over the page's `chefs`, displayed once. Implement as a small `useQuery` keyed by `["restaurant-rollup", restaurant.id]` that calls `getChefHeartTotal` for each chef in parallel and sums.
- Caption stays: "Hearts come from diners at the table."

## Out of scope (per prior corrections)

- No schema changes (no new tables, no new columns).
- No `dish_cooks`, no `target_chef_id` on hearts.
- No public-page heart inserts.
- No moderation, no proof verification, no signup-nudge reset (separate audit items).
