import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useEffect } from "react";
import { HeartButton } from "@/components/HeartButton";
import { getChefHeartTotal } from "@/lib/hearts";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
};

const restaurantQuery = (slug: string) =>
  queryOptions({
    queryKey: ["restaurant", slug],
    queryFn: async () => {
      const { data: r, error } = await supabase
        .from("restaurants")
        .select("id, name, slug, description, cover_image_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!r) throw notFound();

      const [{ data: dishes }, { data: crew }] = await Promise.all([
        supabase.from("signature_dishes").select("id, dish_name").eq("restaurant_id", r.id).eq("is_active", true).order("dish_name"),
        supabase
          .from("restaurant_crew")
          .select("crew_role, chef_profiles:chef_profile_id(id, full_name)")
          .eq("restaurant_id", r.id),
      ]);

      const chefs = (crew ?? [])
        .map((row: any) => ({
          id: row.chef_profiles?.id,
          full_name: row.chef_profiles?.full_name,
          crew_role: row.crew_role as string,
        }))
        .filter((c) => c.id)
        .sort((a, b) => (a.crew_role === "Head Chef" ? -1 : b.crew_role === "Head Chef" ? 1 : 0));

      return { restaurant: r as Restaurant, dishes: (dishes ?? []) as { id: string; dish_name: string }[], chefs };
    },
  });

export const Route = createFileRoute("/restaurant/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.slug} — Cheftoman` }],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(restaurantQuery(params.slug)),
  component: RestaurantPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Restaurant not found.</div>,
});

function useLiveHeartCount(targetType: string, targetId: string) {
  const qc = useQueryClient();
  const key = ["hearts-count", targetType, targetId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { count } = await supabase
        .from("hearts")
        .select("*", { count: "exact", head: true })
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      return count ?? 0;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel(`hc-${targetType}-${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hearts", filter: `target_id=eq.${targetId}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [targetType, targetId, qc]);
  return q.data ?? 0;
}

function HeartBadge({ targetType, targetId }: { targetType: string; targetId: string }) {
  const n = useLiveHeartCount(targetType, targetId);
  return <span className="text-xs text-primary tabular-nums">♥ {n}</span>;
}

function RestaurantPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(restaurantQuery(slug));
  const { restaurant, dishes, chefs } = data;
  const restaurantHearts = useLiveHeartCount("restaurant", restaurant.id);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Home</Link>
      <h1 className="mt-3 text-4xl">{restaurant.name}</h1>
      {restaurant.description && <p className="mt-2 text-sm text-muted-foreground">{restaurant.description}</p>}
      <div className="mt-4 max-w-xs">
        <HeartButton count={restaurantHearts} label="Love Meter" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Hearts come from diners at the table.</p>

      <section className="mt-8">
        <h2 className="mb-3 text-2xl">Kitchen crew</h2>
        {chefs.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No chefs listed yet.</p>
        ) : (
          <ul className="space-y-2">
            {chefs.map((c) => (
              <li key={c.id}>
                <Link
                  to="/chef/$chefId"
                  params={{ chefId: c.id! }}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary"
                >
                  <span>
                    <span className="text-card-foreground">{c.full_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.crew_role}</span>
                  </span>
                  <HeartBadge targetType="chef_profile" targetId={c.id!} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-2xl">Dishes</h2>
        {dishes.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No dishes listed yet.</p>
        ) : (
          <ul className="space-y-2">
            {dishes.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <span className="text-card-foreground">{d.dish_name}</span>
                <HeartBadge targetType="dish" targetId={d.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
