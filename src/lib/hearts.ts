import { supabase } from "./supabaseClient";

/**
 * Read-time rollup: total recognition for a chef =
 *   hearts where (target_type='chef_profile' AND target_id = chefProfileId)
 *   PLUS hearts where (target_type='dish' AND target_id IN the chef's signature dishes).
 *
 * Dish ownership: signature_dishes.assigned_crew_id → restaurant_crew.id (where chef_profile_id = chefProfileId).
 * MVP is single-cook per dish via assigned_crew_id. Multi-cook is Phase 2.
 *
 * No schema changes. Heart insert shape is untouched.
 */
export async function getChefHeartTotal(chefProfileId: string): Promise<number> {
  // 1. crew rows for this chef
  const { data: crewRows, error: e1 } = await supabase
    .from("restaurant_crew")
    .select("id")
    .eq("chef_profile_id", chefProfileId);
  if (e1) throw e1;
  const crewIds = (crewRows ?? []).map((r: { id: string }) => r.id);

  // 2. signature dishes assigned to this chef
  let dishIds: string[] = [];
  if (crewIds.length > 0) {
    const { data: dishes, error: e2 } = await supabase
      .from("signature_dishes")
      .select("id")
      .in("assigned_crew_id", crewIds);
    if (e2) throw e2;
    dishIds = (dishes ?? []).map((d: { id: string }) => d.id);
  }

  // 3. count hearts on chef profile
  const { count: chefHearts, error: e3 } = await supabase
    .from("hearts")
    .select("*", { count: "exact", head: true })
    .eq("target_type", "chef_profile")
    .eq("target_id", chefProfileId);
  if (e3) throw e3;

  // 4. count hearts on assigned dishes
  let dishHearts = 0;
  if (dishIds.length > 0) {
    const { count, error: e4 } = await supabase
      .from("hearts")
      .select("*", { count: "exact", head: true })
      .eq("target_type", "dish")
      .in("target_id", dishIds);
    if (e4) throw e4;
    dishHearts = count ?? 0;
  }

  return (chefHearts ?? 0) + dishHearts;
}
