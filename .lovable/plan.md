# Visual-only rebuild — Table page + /ops

Scope: visual + interaction layer only. **No Supabase queries, RPCs, or data wiring change.** All filters/joins stay as they are today, except one additive `.eq("is_public", true)` on the /ops notes feed.

---

## 1. Design tokens — `src/styles.css`

Switch palette to the agreed kitchen-forward system and register the shared animation + shadow tokens.

- `--cream: #FAF5ED`, `--ember: #E0552E`, `--heart: #D9442E`, `--ink: #2B2422`.
- `--radius: 0.875rem` (14px cards).
- Register colors in `@theme inline`: `--color-ember`, `--color-heart`, `--color-ink`, `--color-cream` → utilities `bg-ember`, `text-heart`, `text-ink`, `bg-cream`.
- Shadow token: `--shadow-warm: 0 6px 20px -8px color-mix(in oklab, var(--ember) 25%, transparent)` → utility `shadow-warm`. Replaces all ad-hoc shadows on the two screens.
- Font tokens: `--font-serif: "Fraunces"`, `--font-sans: "Inter"`. Drop `Instrument Serif`.
- Keyframes registered as Tailwind animations:
  - `ember-bloom` (heart fill burst, 600ms)
  - `pulse-ember` (one-shot halo for /ops realtime, 1500ms)
  - `note-fly` (thank-you note flies up & off, 800ms)
  - `slide-in-soft` (notes feed entry, 380ms)
  - `fade-up` (section entries)
  - `ticker-pulse` (ambient love meter)

## 2. Fonts — `src/routes/__root.tsx`

Add Google Fonts `<link>` for **Fraunces** (regular + italic) and **Inter** in the root head `links[]`. Remove the existing `@font-face` blocks from `styles.css`.

## 3. Unified Heart — `src/components/Heart.tsx` (new)

One primitive, three variants:
- `quiet` — read-only glyph + count (lists, badges).
- `interactive` — give-once tap target. On tap: fires `ember-bloom`, then awaits `onHeart()`.
- `pulse` — read-only; plays a one-shot halo when `pulseKey` increments. Used in /ops.

Render rules:
- Glyph color = `var(--heart)` when filled, 55%-transparent heart when empty.
- `count === null` renders `—` (never a misleading "0").
- Size: `sm | md | lg`.

`HeartButton.tsx` stays in place for now (chef/restaurant/marketing pages — Phase 2 batch). The two screens we're rebuilding switch to `<Heart />`.

## 4. `src/lib/database.types.ts`

Additive: add `is_public: boolean | null` to `thank_you_notes.Row` and `is_public?: boolean | null` to `Insert`. No other type changes.

## 5. Table page — `src/routes/table.$tableId.tsx`

Same queries, same realtime channels, same race guard, same nudge logic. **Only the JSX changes**, plus two additive reads:
- Extend dishes select to `id, dish_name, description, image_url, dietary_type, is_vegetarian, is_vegan, is_gluten_free, assigned_crew_id` (those columns already exist in the typed schema).
- Extend crew select to also return `restaurant_crew.id` (the crew-row id, needed to resolve `assigned_crew_id → chef`).
- Add a `hearts-today` count query: two `count: exact` calls (chef_profile in chefIds, dish in dishIds) filtered by `created_at >= startOfDay()`. Reuses the same realtime channel invalidation we already wire.

Visual layout (top → bottom):
1. **Verified chip strip** — tiny "Table 4 · NFC verified" tag, ember-on-cream.
2. **Hero** — Fraunces italic: *"Tonight, your table was looked after by…"* followed by crew first-names inline.
3. **The kitchen** — section heading "The kitchen tonight". Grid of crew cards (`#crew-{chefId}` anchors). Each card: monogram chip (initials on ember-tint disc), name (Fraunces), role small-caps, `<Heart variant="interactive" />` embedded in the card bottom-right with current count.
4. **Tonight's dishes** — editorial list. Each row:
   - Left: serif number `01`, dish name (Fraunces), one-line description (Inter, muted, line-clamp-1), inline chips — dietary chip + **"cooked by {chef}"** chip when `assigned_crew_id` matches a known crew row. Tapping the chip → `document.getElementById(\`crew-{chefId}\`).scrollIntoView({behavior:'smooth', block:'center'})` plus a brief ember outline flash on the target card.
   - Right: 56×56 rounded thumbnail (or warm placeholder), then `<Heart variant="interactive" size="sm" />`.
5. **Prove you ate here** — existing `<VisitProofForm />`, rewrapped in a warm card.
6. **Thank-you ritual** — three-step folded card, single `<form>`:
   - Step 1: "Who do you want to thank?" → chef chips (multi-state radio).
   - Step 2 (reveals after pick): Fraunces italic placeholder *"Tell them what they made you feel…"* in a cream textarea. Count nudge bar fills as user types; submit unlocks at 3 chars (existing rule).
   - Step 3 (on submit): button morphs to a folded note via `animate-note-fly`, then card flips to a Delivered stamp: *"Delivered to {chef}'s pass · 7:42pm"*. Same Supabase insert as today.
7. **Ambient Love Meter ticker** — sticky bottom-of-content (above NudgeBanner zone): small ember dot + serif sentence *"{N} diners have loved this kitchen tonight"*. Hidden when N is null/0 (warm prompt: *"Be the first heart tonight."*). Uses `animate-ticker-pulse` on the dot.
8. **NudgeBanner** — unchanged logic, restyled to warm card style.

## 6. /ops — `src/routes/_authenticated/ops.tsx`

Same data fetching (chef IDs, dish IDs, table IDs, hearts, notes, connections). Add three additive computed slices, no new tables/columns:
- `heartsToday` — hearts list filtered to `created_at >= startOfDay()`.
- `heartsThisWeek` / `notesThisWeek` / `repeatDinersThisWeek` — derived in-memory from the data we already pull (extend hearts query to include `created_at`; notes query already has `created_at`; pull a 7-day slice of `table_connections` filtered server-side by `tableIds`).
- Notes feed filter: add `.eq("is_public", true)` to the existing notes query (defense-in-depth alongside any RLS).

Realtime: keep current `postgres_changes` subscription on `hearts`. Read the `new` payload — if `target_type === 'chef_profile'` increment that chef's `pulseKey`; if `target_type === 'dish'`, resolve the dish's `assigned_crew_id` → crewRow → chefId and bump that chef's `pulseKey`. Also increment a global `topMeterPulseKey`.

Visual layout:
1. **Top band — Love Meter today.** Full-width warm card. Tiny eyebrow "Tonight at {restaurant}". Big Fraunces number = hearts today. `<Heart variant="pulse" pulseKey={topMeterPulseKey} size="lg" />` to the right. Sub-line: notes today + tables connected today, in muted ink.
2. **On the pass right now.** Horizontal scroll of crew chips. Each chip: monogram disc on ember-tint, name (Inter medium), `<Heart variant="pulse" pulseKey={chefPulse[chefId] ?? 0} count={heartsToday[chefId]} size="sm" />`. Empty crew → warm prompt.
3. **Tonight's most loved dishes.** Numbered list, dish name (Fraunces), heart count right-aligned. Ranked live from today's hearts.
4. **Three weekly tiles.** Grid of three warm cards: *Repeat diners (7d)*, *Hearts (7d)*, *Notes (7d)*. Each: small label, Fraunces number, one-line context.
5. **Recent thank-you notes (public).** Vertical feed. Each card slides in with `animate-slide-in-soft`. Card: folded-note look, body in Fraunces italic, attribution: *"to Chef {name} · from a diner at table {n}"*. Resolves table number via the table_connections data we already have (best-effort; falls back to "a diner"). "Copy" button per card → clipboard with `"{body}" — to Chef {name} at {restaurant}`. Only public notes are ever rendered or copied.
6. **Live table connections.** Kept, restyled as warm rows.

Empty states everywhere are warm prompts ("The pass is quiet — first heart of the night coming up.") not raw zeros. `—` only while loading.

## Out of scope (this batch)

- `/kitchens`, `/cooks`, share-card route, `/ops/notes` page.
- Chef profile, `/me`, marketing home — next batch after review.
- Any schema change. The `is_public` field is already in the DB; we only add it to the hand-curated types file.

## Files touched

- `src/styles.css` — tokens, fonts, animations.
- `src/routes/__root.tsx` — Google Fonts links.
- `src/components/Heart.tsx` — new.
- `src/lib/database.types.ts` — add `is_public` to `thank_you_notes`.
- `src/routes/table.$tableId.tsx` — full JSX rewrite, queries unchanged (additive selects).
- `src/routes/_authenticated/ops.tsx` — full JSX rewrite, queries unchanged (additive `.eq("is_public", true)` on notes feed, additive `created_at` slicing for weekly tiles).

`HeartButton.tsx`, chef/restaurant/me pages, marketing home — all untouched this batch.
