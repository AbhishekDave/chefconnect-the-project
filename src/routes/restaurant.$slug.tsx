import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { HeartButton } from "@/components/HeartButton";
import { getChefHeartTotal } from "@/lib/hearts";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
};

type Chef = { id: string; full_name: string; crew_role: string };

const restaurantQuery = (slug: string) =>
  queryOptions({
    queryKey: ["restaurant", slug],
    queryFn: async () => {
      const { data: r, error } = await supabase
        .from("restaurants")
        .select("id, name, slug, cover_image_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!r) throw notFound();

      const [{ data: dishes }, { data: crew }] = await Promise.all([
        supabase
          .from("signature_dishes")
          .select("id, dish_name")
          .eq("restaurant_id", r.id)
          .eq("is_active", true)
          .order("dish_name"),
        supabase
          .from("restaurant_crew")
          .select("crew_role, chef_profiles:chef_profile_id(id, user_id, users:user_id(full_name))")
          .eq("restaurant_id", r.id),
      ]);

      const chefs: Chef[] = (crew as unknown as Array<{
        crew_role: string;
        chef_profiles: { id: string; users: { full_name: string | null } | null } | null;
      }> ?? [])
        .map((row) => ({
          id: row.chef_profiles?.id ?? "",
          full_name: row.chef_profiles?.users?.full_name ?? "Chef",
          crew_role: row.crew_role,
        }))
        .filter((c) => c.id)
        .sort((a, b) =>
          a.crew_role === "Head Chef" ? -1 : b.crew_role === "Head Chef" ? 1 : 0,
        );

      return {
        restaurant: r as Restaurant,
        dishes: (dishes ?? []) as { id: string; dish_name: string }[],
        chefs,
      };
    },
  });

export const Route = createFileRoute("/restaurant/$slug")({
  head: ({ params, loaderData }) => {
    const d = loaderData as { restaurant?: Restaurant } | undefined;
    const name = d?.restaurant?.name ?? params.slug;
    const title = `${name} — Cheftoman`;
    const description = `${name} on Cheftoman — recognition for the kitchen team from diners at the table.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `/restaurant/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `/restaurant/${params.slug}` }],
    };
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(restaurantQuery(params.slug)),
  component: RestaurantPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Restaurant not found.</div>,
});

function ChefRollupBadge({ chefProfileId }: { chefProfileId: string }) {
  const { data } = useQuery({
    queryKey: ["chef-rollup", chefProfileId],
    queryFn: () => getChefHeartTotal(chefProfileId),
  });
  return <span className="text-xs text-primary tabular-nums">♥ {data ?? 0}</span>;
}

function useVenueRollup(chefIds: string[]) {
  return useQuery({
    queryKey: ["venue-rollup", chefIds.join(",")],
    enabled: chefIds.length > 0,
    queryFn: async () => {
      if (chefIds.length === 0) return 0;
      const totals = await Promise.all(chefIds.map((id) => getChefHeartTotal(id)));
      return totals.reduce((a, b) => a + b, 0);
    },
  });
}

function DishHeartBadge({ dishId }: { dishId: string }) {
  const { data } = useQuery({
    queryKey: ["hearts-count", "dish", dishId],
    queryFn: async () => {
      const { count } = await supabase
        .from("hearts")
        .select("*", { count: "exact", head: true })
        .eq("target_type", "dish")
        .eq("target_id", dishId);
      return count ?? 0;
    },
  });
  return <span className="text-xs text-primary tabular-nums">♥ {data ?? 0}</span>;
}

function RestaurantPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(restaurantQuery(slug));
  const { restaurant, dishes, chefs } = data;
  const venue = useVenueRollup(chefs.map((c) => c.id));

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Home</Link>
      <h1 className="mt-3 text-4xl">{restaurant.name}</h1>
      <div className="mt-4 max-w-xs">
        <HeartButton count={venue.data ?? 0} label="Love Meter" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Hearts come from diners at the table — sum of all chef and dish hearts.
      </p>

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
                  params={{ chefId: c.id }}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary"
                >
                  <span>
                    <span className="text-card-foreground">{c.full_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.crew_role}</span>
                  </span>
                  <ChefRollupBadge chefProfileId={c.id} />
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
                <DishHeartBadge dishId={d.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
