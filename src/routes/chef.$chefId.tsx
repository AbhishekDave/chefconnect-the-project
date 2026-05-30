import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { chefTierLabel } from "@/lib/chefTier";

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

      const [{ count: heartsCount }, { data: notes }] = await Promise.all([
        supabase
          .from("hearts")
          .select("*", { count: "exact", head: true })
          .eq("target_type", "chef_profile")
          .eq("target_id", chefId),
        supabase
          .from("thank_you_notes")
          .select("id, note_content, created_at")
          .eq("target_chef_id", chefId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      return {
        chef: chef as ChefProfile,
        totalHearts: heartsCount ?? 0,
        notes: (notes ?? []) as { id: string; note_content: string; created_at: string }[],
      };
    },
  });

export const Route = createFileRoute("/chef/$chefId")({
  head: ({ params }) => ({ meta: [{ title: `Chef — Cheftoman` }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(chefQuery(params.chefId)),
  component: ChefPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Chef not found.</div>,
});

function ChefPage() {
  const { chefId } = Route.useParams();
  const { data } = useSuspenseQuery(chefQuery(chefId));
  const { chef, totalHearts, notes } = data;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Home</Link>
      <div className="mt-4 flex items-center gap-4">
        {chef.photo_url ? (
          <img src={chef.photo_url} alt={chef.full_name} className="size-20 rounded-full object-cover" width={80} height={80} loading="lazy" />
        ) : (
          <div className="grid size-20 place-items-center rounded-full bg-secondary text-2xl text-secondary-foreground">
            {chef.full_name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-3xl">{chef.full_name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {chefTierLabel(totalHearts)} · <span className="text-primary tabular-nums">♥ {totalHearts}</span>
          </div>
        </div>
      </div>
      {chef.bio && <p className="mt-4 text-sm text-muted-foreground">{chef.bio}</p>}

      <section className="mt-8">
        <h2 className="mb-3 text-2xl">Thank-you notes</h2>
        {notes.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No notes yet — be the first to write one from your table.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-card-foreground">{n.note_content}</p>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
