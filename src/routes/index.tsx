import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Suspense } from "react";

type Restaurant = { id: string; name: string; slug: string; cover_image_url: string | null };

const featuredQuery = queryOptions({
  queryKey: ["featured-restaurants"],
  queryFn: async (): Promise<Restaurant[]> => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, slug, cover_image_url")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cheftoman — Send love to the kitchen" },
      { name: "description", content: "Tap a heart, write a thank-you note. Cheftoman sends real appreciation straight to the chefs who cooked your meal." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(featuredQuery),
  component: Landing,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Couldn't load: {error.message}</div>
  ),
});

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-2xl px-6 pt-20 pb-12 text-center">
        <h1 className="text-5xl leading-tight text-foreground">
          Send love straight to the kitchen.
        </h1>
        <p className="mt-6 text-base text-muted-foreground">
          Tap a heart, write a thank-you note. It goes straight to the team that cooked your meal — not to a review network.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Claim your profile
          </Link>
          <a
            href="#restaurants"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Browse restaurants
          </a>
        </div>
      </section>
      <section id="restaurants" className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="mb-4 text-2xl">Restaurants</h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <RestaurantList />
        </Suspense>
      </section>
    </main>
  );
}

function RestaurantList() {
  const { data } = useSuspenseQuery(featuredQuery);
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No restaurants yet.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {data.map((r) => (
        <li key={r.id}>
          <Link
            to="/restaurant/$slug"
            params={{ slug: r.slug }}
            className="block rounded-lg border border-border bg-card p-4 hover:border-primary"
          >
            <div className="text-lg text-card-foreground">{r.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">/{r.slug}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
