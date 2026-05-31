import { supabase } from "./supabaseClient";

/**
 * Single source of truth for heart counts.
 * ALWAYS row-count from `hearts`. Never read cached totals
 * (signature_dishes.hearts_count, chef_profiles.total_hearts, etc.) —
 * the insert trigger bumps them but the un-heart delete does not decrement,
 * so they drift the moment toggle ships.
 */
export async function countHearts(
  targetType: "chef_profile" | "dish" | "restaurant",
  targetIds: string | string[],
): Promise<number> {
  const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
  if (ids.length === 0) return 0;
  let q = supabase
    .from("hearts")
    .select("*", { count: "exact", head: true })
    .eq("target_type", targetType);
  q = ids.length === 1 ? q.eq("target_id", ids[0]) : q.in("target_id", ids);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Read-time rollup for one chef:
 *   hearts on the chef_profile + hearts on dishes assigned to that chef
 *   (signature_dishes.assigned_crew_id → restaurant_crew.id where chef_profile_id = chef).
 * MVP single-cook-per-dish. Multi-cook = Phase 2.
 */
export async function getChefHeartTotal(chefProfileId: string): Promise<number> {
  const { data: crewRows, error: e1 } = await supabase
    .from("restaurant_crew")
    .select("id")
    .eq("chef_profile_id", chefProfileId);
  if (e1) throw e1;
  const crewIds = (crewRows ?? []).map((r: { id: string }) => r.id);

  let dishIds: string[] = [];
  if (crewIds.length > 0) {
    const { data: dishes, error: e2 } = await supabase
      .from("signature_dishes")
      .select("id")
      .in("assigned_crew_id", crewIds);
    if (e2) throw e2;
    dishIds = (dishes ?? []).map((d: { id: string }) => d.id);
  }

  const [chefHearts, dishHearts] = await Promise.all([
    countHearts("chef_profile", chefProfileId),
    countHearts("dish", dishIds),
  ]);
  return chefHearts + dishHearts;
}
