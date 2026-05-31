# Hearts: give-once and permanent

Revise the heart behavior shipped last turn. No schema changes, no new files.

## Behavior

- Two on-screen signals per target:
  1. **Number** = global row count of all hearts for that target (already implemented via `countHearts`). Always show the true value; never show `0` as a loading placeholder.
  2. **Button state** = whether *this* diner has already given a heart to this target (filled + locked, or empty + tappable).
- Identity for the "already given?" check: `from_user_id` if logged in, else `anonymous_session_token`.
- Tap rules:
  - No existing heart → optimistically lock the button to filled, then `insert`. On success: invalidate count + hearted keys. **On failure: roll back to not-given, show a brief `toast.error`, and re-enable the button.**
  - Existing heart → button renders filled and non-interactive. Tapping is a no-op (no delete).
- `nudge_count` bumps only on a *confirmed* fresh insert (after the insert resolves without error).

## Code changes

All in `src/routes/table.$tableId.tsx` and `src/components/HeartButton.tsx`.

### `src/routes/table.$tableId.tsx > HeartRow`

- Keep the `["hearted", identity, targetType, targetId]` query that resolves the diner's existing heart row.
- Remove the `if (myHeart) { delete… }` branch entirely.
- Add local `optimisticHearted` state (boolean, default `false`). The effective `hearted` passed to the button = `!!myHeart || optimisticHearted`.
- New `tap()`:
  ```
  if (hearted) return;                  // already given, no-op
  setOptimisticHearted(true);           // lock UI immediately
  const { error } = await supabase.from("hearts").insert({ ... });
  if (error) {
    setOptimisticHearted(false);        // roll back
    toast.error(error.message);
    return;
  }
  if (!user) bumpNudgeCount();
  qc.invalidateQueries({ queryKey: countKey });
  qc.invalidateQueries({ queryKey: heartedKey });
  ```
- While the count query has no data yet, pass `null` to the button so it renders an em-dash placeholder instead of a misleading `0`.

### `src/components/HeartButton.tsx`

- Change `count` type to `number | null`. When `null`, render `—` in the count slot so layout doesn't jump.
- When `hearted === true` on an interactive button:
  - Render the filled glyph (`♥`) with primary color.
  - Set `disabled` and `aria-disabled` to true; drop hover styles so it doesn't look tappable.
  - `aria-label` becomes `"You hearted {label}"`.
- Keep the not-hearted state as today (outline `♡`, hover border, pulse on tap).
- Pulse animation only fires on the not-yet-hearted → tap transition.

## Out of scope

- Real DB unique constraint (still Phase 2).
- Any change to venue/chef rollups, `countHearts`, ops panel, or visual polish from last turn.
- Auth-required hearts.

## Files touched

- `src/routes/table.$tableId.tsx`
- `src/components/HeartButton.tsx`
