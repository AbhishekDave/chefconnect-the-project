import { supabase } from "./supabaseClient";

export type CrewContext = {
  chefProfileIds: string[];
  restaurantIds: string[];
  roles: { restaurant_id: string; crew_role: string; chef_profile_id: string }[];
};

export async function getCrewContextForCurrentUser(userId: string): Promise<CrewContext> {
  const { data: chefs, error: e1 } = await supabase
    .from("chef_profiles")
    .select("id")
    .eq("user_id", userId);
  if (e1) throw e1;
  const chefProfileIds = (chefs ?? []).map((c: { id: string }) => c.id);
  if (chefProfileIds.length === 0) {
    return { chefProfileIds: [], restaurantIds: [], roles: [] };
  }
  const { data: crew, error: e2 } = await supabase
    .from("restaurant_crew")
    .select("restaurant_id, crew_role, chef_profile_id")
    .in("chef_profile_id", chefProfileIds);
  if (e2) throw e2;
  const roles = (crew ?? []) as CrewContext["roles"];
  const restaurantIds = Array.from(new Set(roles.map((r) => r.restaurant_id)));
  return { chefProfileIds, restaurantIds, roles };
}
