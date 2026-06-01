import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { HeartButton } from "@/components/HeartButton";
import { BackLink } from "@/components/BackLink";
import { countHearts, getChefHeartTotal } from "@/lib/hearts";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
};

type Chef = { id: string; full_name: string; crew_role: string };

type Dish = {
  id: string;
  dish_name: string;
  description: string | null;
  image_url: string | null;
  dietary_type: string | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
};

/** Pick the strongest dietary signal we have. Vegan > vegetarian > GF > raw dietary_type. */
function dietaryTag(d: Dish): string | null {
  if (d.is_vegan) return "Vegan";
  if (d.is_vegetarian) return "Vegetarian";
  if (d.is_gluten_free) return "Gluten-free";
  if (d.dietary_type && d.dietary_type !== "non-veg") return d.dietary_type;
  return null;
}

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
          .select("id, dish_name, description, image_url, dietary_type, is_vegetarian, is_vegan, is_gluten_free")
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
        dishes: (dishes ?? []) as Dish[],
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

function HeartCount({ value }: { value: number | null | undefined }) {
  // While loading the underlying query, render an em-dash instead of "0".
  // 0 must only ever appear when the real total is genuinely zero.
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground tabular-nums">♥ —</span>;
  }
  return <span className="text-xs text-primary tabular-nums">♥ {value}</span>;
}

function ChefRollupBadge({ chefProfileId }: { chefProfileId: string }) {
  const { data } = useQuery({
    queryKey: ["chef-rollup", chefProfileId],
    queryFn: () => getChefHeartTotal(chefProfileId),
  });
  return <HeartCount value={data ?? null} />;
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
    queryFn: () => countHearts("dish", dishId),
  });
  return <HeartCount value={data ?? null} />;
}

function RestaurantPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(restaurantQuery(slug));
  const { restaurant, dishes, chefs } = data;
  const venue = useVenueRollup(chefs.map((c) => c.id));
  const venueTotal: number | null = venue.isLoading ? null : venue.data ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 pb-16 space-y-12">
      <BackLink fallbackTo="/" />

      {/* Hero */}
      <header className="space-y-5">
        {restaurant.cover_image_url ? (
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={restaurant.cover_image_url}
              alt={restaurant.name}
              className="aspect-[16/9] w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/10 to-transparent" />
          </div>
        ) : null}
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Restaurant</div>
          <h1 className="mt-2 font-serif text-5xl leading-[1.05]">{restaurant.name}</h1>
        </div>
      </header>

      {/* Venue Love Meter */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Love Meter</div>
        <div className="mt-2 flex items-baseline gap-3">
          <span aria-hidden className="text-3xl text-primary">♥</span>
          <span className="text-5xl text-primary tabular-nums font-serif">
            {venueTotal === null ? <span className="text-muted-foreground">—</span> : venueTotal}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          From diners at the table — sum of all chef and dish hearts.
        </p>
      </section>

      {/* Crew */}
      <section>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Kitchen crew</div>
        <h2 className="mt-2 mb-4 font-serif text-3xl">Who's cooking</h2>
        {chefs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No chefs listed yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {chefs.map((c) => (
              <li key={c.id}>
                <Link
                  to="/chef/$chefId"
                  params={{ chefId: c.id }}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-serif text-lg text-secondary-foreground">
                    {c.full_name.charAt(0)}
                  </span>
                  <span className="flex-1">
                    <span className="block font-serif text-lg text-card-foreground">{c.full_name}</span>
                    <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                      {c.crew_role}
                    </span>
                  </span>
                  <ChefRollupBadge chefProfileId={c.id} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Dishes */}
      <section>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">On the menu</div>
        <h2 className="mt-2 mb-4 font-serif text-3xl">Signature dishes</h2>
        {dishes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No dishes listed yet.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {dishes.map((d) => {
              const tag = dietaryTag(d);
              return (
                <li
                  key={d.id}
                  className="flex gap-3 rounded-xl border border-border bg-card p-3"
                >
                  {d.image_url ? (
                    <img
                      src={d.image_url}
                      alt={d.dish_name}
                      className="size-20 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-secondary font-serif text-2xl text-secondary-foreground">
                      {d.dish_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-serif text-base text-card-foreground">{d.dish_name}</span>
                      <DishHeartBadge dishId={d.id} />
                    </div>
                    {tag && (
                      <span className="mt-1 inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                        {tag}
                      </span>
                    )}
                    {d.description && (
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{d.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Display-only HeartButton example removed; venue Love Meter card above is the source of truth. */}
      <HeartButton count={venue.data ?? 0} label="Recognition received" className="hidden" />
    </main>
  );
}
