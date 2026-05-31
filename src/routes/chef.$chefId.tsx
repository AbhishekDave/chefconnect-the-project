import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { chefTierLabel } from "@/lib/chefTier";
import { HeartButton } from "@/components/HeartButton";
import { getChefHeartTotal } from "@/lib/hearts";

type ChefProfile = { id: string; full_name: string; bio: string | null; photo_url: string | null };

const chefQuery = (chefId: string) =>
  queryOptions({
    queryKey: ["chef", chefId],
    queryFn: async () => {
      const { data: chef, error } = await supabase
        .from("chef_profiles")
        .select("id, full_name, bio, photo_url")
        .eq("id", chefId)
        .maybeSingle();
      if (error) throw error;
      if (!chef) throw notFound();

      // crew rows + assigned signature dishes for this chef
      const { data: crewRows } = await supabase
        .from("restaurant_crew")
        .select("id")
        .eq("chef_profile_id", chefId);
      const crewIds = (crewRows ?? []).map((r: { id: string }) => r.id);

      let dishes: { id: string; dish_name: string }[] = [];
      if (crewIds.length > 0) {
        const { data } = await supabase
          .from("signature_dishes")
          .select("id, dish_name")
          .in("assigned_crew_id", crewIds)
          .eq("is_active", true)
          .order("dish_name");
        dishes = (data ?? []) as { id: string; dish_name: string }[];
      }

      const [totalHearts, { data: notes }] = await Promise.all([
        getChefHeartTotal(chefId),
        supabase
          .from("thank_you_notes")
          .select("id, note_content, created_at")
          .eq("target_chef_id", chefId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      return {
        chef: chef as ChefProfile,
        totalHearts,
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
  const { chef, totalHearts, dishes, notes } = data;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Home</Link>

      <header className="mt-6 flex items-center gap-5">
        {chef.photo_url ? (
          <img
            src={chef.photo_url}
            alt={chef.full_name}
            className="size-24 rounded-full object-cover ring-2 ring-primary/20"
            width={96}
            height={96}
            loading="lazy"
          />
        ) : (
          <div className="grid size-24 place-items-center rounded-full bg-secondary font-serif text-3xl text-secondary-foreground">
            {chef.full_name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="font-serif text-4xl leading-tight">{chef.full_name}</h1>
          <div className="mt-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs uppercase tracking-wider text-primary">
            {chefTierLabel(totalHearts)}
          </div>
        </div>
      </header>

      <div className="mt-6 max-w-xs">
        <HeartButton count={totalHearts} label="Love Meter" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Hearts come from diners seated at the table.
      </p>

      {chef.bio && (
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">{chef.bio}</p>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Signature dishes</h2>
        {dishes.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No signature dishes assigned yet.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {dishes.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-border bg-card p-4 text-card-foreground"
              >
                {d.dish_name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Thank-you notes</h2>
        {notes.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No notes yet — be the first to write one from your table.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-card-foreground">{n.note_content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
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
