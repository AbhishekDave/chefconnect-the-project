import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { chefTierLabel } from "@/lib/chefTier";
import { BackLink } from "@/components/BackLink";
import { getChefHeartTotal, countHearts } from "@/lib/hearts";

type ChefProfile = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
};

type ChefRow = {
  id: string;
  bio: string | null;
  user_id: string;
  users: { full_name: string | null; profile_photo_url: string | null } | null;
};

type PrimaryRestaurant = { slug: string; name: string } | null;

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

function dietaryTag(d: Dish): string | null {
  if (d.is_vegan) return "Vegan";
  if (d.is_vegetarian) return "Vegetarian";
  if (d.is_gluten_free) return "Gluten-free";
  if (d.dietary_type && d.dietary_type !== "non-veg") return d.dietary_type;
  return null;
}


const chefQuery = (chefId: string) =>
  queryOptions({
    queryKey: ["chef", chefId],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("chef_profiles")
        .select("id, bio, user_id, users:user_id(full_name, profile_photo_url)")
        .eq("id", chefId)
        .maybeSingle();
      if (error) throw error;
      if (!row) throw notFound();

      const chefRow = row as unknown as ChefRow;
      const chef: ChefProfile = {
        id: chefRow.id,
        bio: chefRow.bio,
        full_name: chefRow.users?.full_name ?? "Chef",
        photo_url: chefRow.users?.profile_photo_url ?? null,
      };

      // crew rows for ownership + back-link fallback
      const { data: crewRows } = await supabase
        .from("restaurant_crew")
        .select("id, restaurants:restaurant_id(slug, name)")
        .eq("chef_profile_id", chefId);
      const crew = (crewRows ?? []) as Array<{
        id: string;
        restaurants: { slug: string; name: string } | null;
      }>;
      const crewIds = crew.map((r) => r.id);
      const primaryRestaurant: PrimaryRestaurant =
        crew.find((r) => r.restaurants)?.restaurants ?? null;

      let dishes: Dish[] = [];
      let dishIds: string[] = [];
      if (crewIds.length > 0) {
        const { data } = await supabase
          .from("signature_dishes")
          .select("id, dish_name, description, image_url, dietary_type, is_vegetarian, is_vegan, is_gluten_free")
          .in("assigned_crew_id", crewIds)
          .eq("is_active", true)
          .order("dish_name");
        dishes = (data ?? []) as Dish[];
        dishIds = dishes.map((d) => d.id);
      }

      const [chefHearts, dishHearts, totalHearts, { data: notes }] = await Promise.all([
        countHearts("chef_profile", chefId),
        countHearts("dish", dishIds),
        getChefHeartTotal(chefId),
        supabase
          .from("thank_you_notes")
          .select("id, note_content, created_at")
          .eq("target_chef_id", chefId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      return {
        chef,
        primaryRestaurant,
        totalHearts,
        chefHearts,
        dishHearts,
        dishes,
        notes: (notes ?? []) as { id: string; note_content: string; created_at: string }[],
      };
    },
  });

export const Route = createFileRoute("/chef/$chefId")({
  head: ({ params, loaderData }) => {
    const d = loaderData as { chef?: ChefProfile } | undefined;
    const name = d?.chef?.full_name ?? "Chef";
    const title = `${name} — Cheftoman`;
    const description =
      d?.chef?.bio?.slice(0, 155) ??
      `${name}'s kitchen recognition on Cheftoman — hearts from real diners at the table.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: `/chef/${params.chefId}` },
      ],
      links: [{ rel: "canonical", href: `/chef/${params.chefId}` }],
    };
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(chefQuery(params.chefId)),
  component: ChefPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Chef not found.</div>,
});

function ChefPage() {
  const { chefId } = Route.useParams();
  const { data } = useSuspenseQuery(chefQuery(chefId));
  const { chef, primaryRestaurant, totalHearts, chefHearts, dishHearts, dishes, notes } = data;

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 pb-16 space-y-12">
      <BackLink
        fallbackTo={primaryRestaurant ? "/restaurant/$slug" : "/"}
        fallbackParams={primaryRestaurant ? { slug: primaryRestaurant.slug } : undefined}
      />

      {/* Hero */}
      <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        {chef.photo_url ? (
          <img
            src={chef.photo_url}
            alt={chef.full_name}
            className="size-32 rounded-full object-cover ring-1 ring-border"
            width={128}
            height={128}
            loading="eager"
          />
        ) : (
          <div className="grid size-32 place-items-center rounded-full bg-secondary font-serif text-5xl text-secondary-foreground">
            {chef.full_name.charAt(0)}
          </div>
        )}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Chef</div>
          <h1 className="font-serif text-5xl leading-[1.05]">{chef.full_name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {primaryRestaurant && (
              <Link
                to="/restaurant/$slug"
                params={{ slug: primaryRestaurant.slug }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                {primaryRestaurant.name}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Love Meter */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Love Meter</div>
        <div className="mt-2 flex items-baseline gap-3">
          <span aria-hidden className="text-3xl text-primary">♥</span>
          <span className="font-serif text-5xl text-primary tabular-nums">{totalHearts}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {chefHearts} for the chef · {dishHearts} for assigned dishes. Hearts come from
          diners seated at the table.
        </p>
      </section>

      {/* Bio */}
      {chef.bio && (
        <section className="max-w-prose">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">About</div>
          <p className="mt-3 font-serif text-lg leading-relaxed text-foreground">{chef.bio}</p>
        </section>
      )}

      {/* Signature dishes */}
      <section>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">From the pass</div>
        <h2 className="mt-2 mb-4 font-serif text-3xl">Signature dishes</h2>
        {dishes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No signature dishes assigned yet.
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
                    <span className="font-serif text-base text-card-foreground">{d.dish_name}</span>
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

      {/* Thank-you notes */}
      <section>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">From the dining room</div>
        <h2 className="mt-2 mb-4 font-serif text-3xl">Thank-you notes</h2>
        {notes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No notes yet — be the first to write one from your table.
          </p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-2xl bg-secondary/40 p-5 text-card-foreground"
              >
                <p className="font-serif text-base italic leading-relaxed">
                  &ldquo;{n.note_content}&rdquo;
                </p>
                <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
