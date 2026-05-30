# Cheftoman PWA — Build Plan (v3.4, final)

Mobile-first PWA. **Strictly client-side Supabase** via `@supabase/supabase-js` with the publishable anon key, `persistSession: true`, `autoRefreshToken: true`. No server functions, no edge functions.

## Locked conventions

- **Column `anon_token` is banned** on `hearts`, `table_connections`, `meal_visit_proofs`, `thank_you_notes` — they all use `anonymous_session_token`.
- **Exception:** the RPC `stitch_anonymous_session` is called with key `anon_token` (matches its SQL parameter name).
- Storage bucket: **`cheftoman`** (public), already policied.
- **No hardcoded placeholder content.** Every name, count, dish, chef, note, metric renders from Supabase with explicit loading/empty/error states.
- **No backend SQL or storage policies from me** — RLS, grants, storage policies, and Realtime are already applied on your side.
- **`users.full_name` stays NOT NULL.** Sign-up always carries a name through to the row — the first `users` insert would otherwise fail.
- **Vocabulary:** the aggregate heart total is the **"Love Meter"** (diner side: *hearts given*; venue side: *hearts received*). **Thank-you notes** keep that name. No "points", "karma", or "badge" language anywhere in UI copy.

## 1. Foundations

- `src/lib/supabaseClient.ts` — `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })`.
- `src/lib/anonymousSession.ts` — `getOrCreateAnonymousSessionToken()` returns uuid v4 in LocalStorage key `cheftoman.anonymous_session_token`. Never auto-cleared.
- `src/lib/auth.tsx` — React context over `supabase.auth.getSession` + `onAuthStateChange`. Owns the **idempotent post-auth reconcile** (see §4).
- `src/lib/storage.ts` — `supabase.storage.from('cheftoman').upload(...)` + `getPublicUrl(...)`.
- `src/lib/crew.ts` — `getCrewContextForCurrentUser()` (see §6).
- `src/lib/chefTier.ts` — client-side tier label from `total_hearts` (no DB column).
- Tailwind tokens in `src/styles.css`: charcoal + ember + cream, Instrument Serif headings + Inter body, mobile-first container, safe-area padding.
- PWA: `public/manifest.webmanifest` + 192/512 icons + theme-color + `<link rel="manifest">` in `__root.tsx`. No service worker.

## 2. Routes (file-based, `src/routes/`)

```
__root.tsx              shell + AuthProvider + QueryClientProvider + manifest
index.tsx               landing
auth.tsx                email/password sign in + sign up (with name)
table.$tableId.tsx      anonymous diner (reads ?src=)
restaurant.$slug.tsx    public restaurant (slug confirmed)
chef.$chefId.tsx        public chef profile
_authenticated.tsx      gate
_authenticated/me.tsx   foodie profile + diner Love Meter
_authenticated/ops.tsx  ops panel (crew-only) + venue Love Meter
```

## 3. Anonymous diner — `/table/$tableId?src=nfc|qr|link`

- `validateSearch` (zod): `src ∈ {'nfc','qr','link'}`, default `'link'`.
- Resolve table → restaurant, table number, chefs on duty, dishes.
- Insert `table_connections`: `table_id`, `anonymous_session_token`, `entry_method = src`, `is_verified_presence = (src === 'nfc')`. No geolocation.
- Heart tap → insert `hearts` with `target_type`, `target_id`, `anonymous_session_token`. Optimistic. Realtime updates counters.
- **"Prove you ate here"** — upload to `cheftoman` at `proofs/{anonymous_session_token}/{uuid}.{ext}`, then insert `meal_visit_proofs`:
  - `restaurant_id` (required, NOT NULL — derived from the table's restaurant)
  - `table_id`
  - `anonymous_session_token`
  - `image_url`
  - `foodie_profile_id` = null when anonymous; current user's foodie_profile_id when signed in
- **Thank-you note** — real insert into `thank_you_notes`: `target_chef_id`, `note_content` (1–500), `anonymous_session_token`. Empty state when none. Diner copy: **"Goes straight to {chef name}'s kitchen team."**
- **Signup nudge** by `cheftoman.nudge_count` (LocalStorage, never reset): 1st → chip, 2nd → card, 3rd+ → sticky banner to `/auth`. **Copy:** *"Claim your profile — your {n} hearts come with you."* (n = current count of `hearts` rows for this anonymous_session_token; never reset, never re-counted to zero).

## 4. Auth + idempotent post-auth reconcile

`/auth` has email + password tabs. **Sign-up form fields (all required):** `full_name`, `email`, `password`.

```ts
supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name } }    // lands in user.user_metadata.full_name
})
```

The signup callback only fires `signUp` and shows status. **No DB writes happen synchronously there.**

All identity reconciliation lives in **one place** inside `AuthProvider`: a listener on `supabase.auth.onAuthStateChange((_event, session) => …)` that runs `reconcileIdentity(session.user)` whenever there is a valid session (signup, sign-in, token refresh, page reload). Every step is idempotent and **safe to fire on every login/reload**:

```text
reconcileIdentity(user):
  1. users upsert (onConflict: 'id'):
       full_name = user.user_metadata?.full_name ?? <existing> ?? user.email
       { id: user.id, email: user.email, full_name, user_type: 'foodie' }
     - No password_hash.
     - full_name is ALWAYS non-null (users.full_name is NOT NULL).
     - Read the existing row first; only upsert full_name when the incoming
       metadata value is non-empty AND existing is null, OR when there is
       no existing row. Email fallback exists only to satisfy NOT NULL on
       a brand-new row that somehow lacks metadata.

  2. foodie_profiles ensure-one:
       SELECT id FROM foodie_profiles WHERE user_id = user.id LIMIT 1
       if none → INSERT { user_id: user.id, ... } RETURNING id
     - Single row per user_id. Cache foodie_profile_id in context + LocalStorage.

  3. Stitch anon session if a token exists:
       token = localStorage['cheftoman.anonymous_session_token']
       if token:
         supabase.rpc('stitch_anonymous_session', {
           target_user_id: user.id,
           target_foodie_profile_id: foodie_profile_id,
           anon_token: token            // matches SQL param name
         })
     - Token stays in LocalStorage; RPC is itself idempotent.
     - Counts never reset.

  4. Mark reconciled for this session (in-memory flag keyed by user.id).
```

Run sequentially, swallow expected "already exists" cases, surface real errors via toast. Navigate to `/me` after step 2 resolves on a fresh signup; on a normal reload, stay on the current route.

## 5. Public reads

- `/restaurant/$slug` — restaurant, dishes, crew (Head Chef pinned via `crew_role = 'Head Chef'`), live heart counters. Per-section empty states.
- `/chef/$chefId` — photo, **total hearts**, recent public thank-you notes. **No `tier_level` badge** (column doesn't exist); derived tier label from `total_hearts` via `chefTier.ts`. Empty state when no notes.

## 6. Crew resolution (ops gate)

`restaurant_crew` has **no `user_id`**. Resolve via `chef_profiles`:

```text
auth.uid()
  → chef_profiles WHERE user_id = auth.uid()        → chef_profile_id(s)
  → restaurant_crew WHERE chef_profile_id IN (...)  → restaurant_id(s) + crew_role(s)
```

Mirrors `is_crew_of()`. Empty result → "Not authorized" empty state on `/ops`.

## 7. Authenticated — `/me` (diner)

Header: **Diner Love Meter** — two live counters from DB, no schema change:

- **Hearts given** — `count(*) from hearts where from_user_id = auth.uid()`
- **Thank-you notes written** — `count(*) from thank_you_notes where from_foodie_id = <my foodie_profile_id>`

Both subscribe via Realtime (filter on the same columns) and re-count on insert/delete. Zero-state shows the count `0` plus a one-line empty caption — never hidden.

Below the meter, three tabs with **different attribution columns**:

- **Hearts**: `hearts` WHERE `from_user_id = auth.uid()`
- **Proofs**: `meal_visit_proofs` WHERE `foodie_profile_id = <my foodie_profile_id>`
- **Notes**: `thank_you_notes` WHERE `from_foodie_id = <my foodie_profile_id>`
- Per-tab empty states.

## 8. Authenticated — `/ops` (crew-only via §6)

Header: **Venue Love Meter** — a consolidated restaurant heart total, computed live:

```text
restaurant_total =
    count(hearts) where target_type='chef_profile' AND target_id IN <restaurant's chef_profile_ids>
  + count(hearts) where target_type='dish'         AND target_id IN <restaurant's dish_ids>
  + count(hearts) where target_type='restaurant'   AND target_id = <restaurant_id>
```

Beneath the total, two breakdowns rendered as lists with live counts:

- **Per chef** — for each `chef_profile` on the restaurant's crew: count of `hearts` where `target_type='chef_profile' AND target_id = chef.id`, sorted desc.
- **Per dish** — for each dish on the restaurant: count of `hearts` where `target_type='dish' AND target_id = dish.id`, sorted desc.

Alongside the Love Meter, the existing live feeds (unchanged):

- **Live `table_connections` feed** (Realtime) for the crew's restaurant(s) with `entry_method` + `is_verified_presence` badges.
- **Live `thank_you_notes` feed** (Realtime) grouped by chef. Real rows only.
- Recent proofs from DB.

All counts/feeds via Realtime on `hearts`, `table_connections`, `thank_you_notes` → invalidate query keys; ops never shows hardcoded numbers.

## 9. Data layer

- TanStack Query throughout.
- Realtime via `supabase.channel(...).on('postgres_changes', ...)` on `hearts`, `table_connections`, `thank_you_notes` → invalidate query keys.
- All writes are direct client calls relying on existing RLS. Every anonymous insert sends `anonymous_session_token`.

## 10. Out of scope (v1)

Service worker / offline, push notifications, payments/tipping, geolocation verification, public moderation UI, "intercepted" framing, "points"/"karma"/"badge" language, hardcoded placeholder content.

---

Approve to start building. I'll scaffold foundations + routes in parallel, no SQL output from my side.