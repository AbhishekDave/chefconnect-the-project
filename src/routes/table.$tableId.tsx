import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getOrCreateAnonymousSessionToken, bumpNudgeCount, getNudgeCount } from "@/lib/anonymousSession";
import { useAuth } from "@/lib/auth";
import { HeartButton as UIHeartButton } from "@/components/HeartButton";
import { VisitProofForm } from "@/components/VisitProofForm";
import { toast } from "sonner";

const SearchSchema = z.object({
  src: z.enum(["nfc", "qr", "link"]).default("link").catch("link"),
});

export const Route = createFileRoute("/table/$tableId")({
  validateSearch: zodValidator(SearchSchema),
  head: () => ({ meta: [{ title: "At the table — Cheftoman" }] }),
  component: TablePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
});

type Dish = { id: string; dish_name: string };
type Chef = { id: string; full_name: string };
type TableInfo = {
  id: string;
  table_number: string | number | null;
  restaurant: { id: string; name: string; slug: string };
};

async function fetchTableContext(tableId: string) {
  const { data: t, error } = await supabase
    .from("restaurant_tables")
    .select("id, table_number, restaurant_id, restaurants:restaurant_id(id, name, slug)")
    .eq("id", tableId)
    .maybeSingle();
  if (error) throw error;
  if (!t) throw new Error("Table not found");
  const restaurant = (t as any).restaurants as { id: string; name: string; slug: string };

  const [{ data: dishes }, { data: crew }] = await Promise.all([
    supabase.from("signature_dishes").select("id, dish_name").eq("restaurant_id", restaurant.id).eq("is_active", true).limit(20),
    supabase
      .from("restaurant_crew")
      .select("chef_profile_id, crew_role, chef_profiles:chef_profile_id(id, full_name)")
      .eq("restaurant_id", restaurant.id),
  ]);

  const chefs: Chef[] = (crew ?? [])
    .map((r: any) => r.chef_profiles)
    .filter(Boolean)
    .map((c: any) => ({ id: c.id, full_name: c.full_name }));

  return {
    table: { id: t.id, table_number: (t as any).table_number, restaurant } as TableInfo,
    dishes: (dishes ?? []) as Dish[],
    chefs,
  };
}

async function fetchHeartCount(targetType: string, targetId: string): Promise<number> {
  const { count } = await supabase
    .from("hearts")
    .select("*", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  return count ?? 0;
}

function HeartRow({ targetType, targetId, label }: { targetType: string; targetId: string; label: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["hearts-count", targetType, targetId];
  const { data: count = 0 } = useQuery({
    queryKey: key,
    queryFn: () => fetchHeartCount(targetType, targetId),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`hearts-${targetType}-${targetId}`)
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

  async function tap() {
    const token = getOrCreateAnonymousSessionToken();
    const payload: Record<string, unknown> = {
      target_type: targetType,
      target_id: targetId,
      anonymous_session_token: token,
    };
    if (user) payload.from_user_id = user.id;
    const { error } = await supabase.from("hearts").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!user) bumpNudgeCount();
    qc.invalidateQueries({ queryKey: key });
  }

  return <UIHeartButton interactive count={count} label={label} onHeart={tap} />;
}

function TablePage() {
  const { tableId } = Route.useParams();
  const { src } = Route.useSearch();
  const { user, foodieProfileId } = useAuth();

  const tableQuery = useQuery({
    queryKey: ["table-ctx", tableId],
    queryFn: () => fetchTableContext(tableId),
  });

  // Log table_connection once on mount
  useEffect(() => {
    if (!tableQuery.data) return;
    const token = getOrCreateAnonymousSessionToken();
    const key = `cheftoman.connected.${tableId}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) return;
    void supabase
      .from("table_connections")
      .insert({
        table_id: tableId,
        anonymous_session_token: token,
        entry_method: src,
        is_verified_presence: src === "nfc",
      })
      .then(({ error }) => {
        if (!error && typeof window !== "undefined") window.sessionStorage.setItem(key, "1");
        else if (error) console.warn("table_connections insert", error);
      });
  }, [tableQuery.data, tableId, src]);

  if (tableQuery.isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (tableQuery.error) return <p className="p-6 text-sm text-destructive">{(tableQuery.error as Error).message}</p>;
  if (!tableQuery.data) return null;

  const { table, dishes, chefs } = tableQuery.data;
  const nudge = !user ? getNudgeCount() : 0;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-32">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Table {table.table_number ?? ""} {src === "nfc" && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary">NFC verified</span>}
      </div>
      <h1 className="mt-1 text-3xl">{table.restaurant.name}</h1>
      <Link to="/restaurant/$slug" params={{ slug: table.restaurant.slug }} className="text-xs text-muted-foreground underline">
        View restaurant
      </Link>

      <Section title="Chefs on duty">
        {chefs.length === 0 ? (
          <Empty>No chefs listed yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {chefs.map((c) => (
              <li key={c.id}>
                <HeartRow targetType="chef_profile" targetId={c.id} label={c.full_name} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Tonight's dishes">
        {dishes.length === 0 ? (
          <Empty>No dishes listed yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {dishes.map((d) => (
              <li key={d.id}>
                <HeartRow targetType="dish" targetId={d.id} label={d.dish_name} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Prove you ate here">
        <VisitProofForm tableId={tableId} restaurantId={table.restaurant.id} foodieProfileId={foodieProfileId} />
      </Section>

      <Section title="Write a thank-you note">
        <ThankYouForm chefs={chefs} foodieProfileId={foodieProfileId} />
      </Section>

      {!user && nudge > 0 && <NudgeBanner count={nudge} />}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</p>;
}


function ThankYouForm({ chefs, foodieProfileId }: { chefs: Chef[]; foodieProfileId: string | null }) {
  const [chefId, setChefId] = useState<string>("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  if (chefs.length === 0) return <Empty>No chefs to thank yet.</Empty>;

  const chefName = chefs.find((c) => c.id === chefId)?.full_name ?? "the chef";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!chefId || content.trim().length < 1 || content.length > 500) return;
    setBusy(true);
    try {
      const token = getOrCreateAnonymousSessionToken();
      const payload: Record<string, unknown> = {
        target_chef_id: chefId,
        note_content: content.trim(),
        anonymous_session_token: token,
      };
      if (foodieProfileId) payload.from_foodie_id = foodieProfileId;
      const { error } = await supabase.from("thank_you_notes").insert(payload);
      if (error) throw error;
      setContent("");
      if (!user) bumpNudgeCount();
      toast.success(`Goes straight to ${chefName}'s kitchen team.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <select
        value={chefId}
        onChange={(e) => setChefId(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        required
      >
        <option value="">Pick a chef…</option>
        {chefs.map((c) => (
          <option key={c.id} value={c.id}>{c.full_name}</option>
        ))}
      </select>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={500}
        rows={4}
        placeholder="Say thanks…"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        required
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Goes straight to {chefName}'s kitchen team.</span>
        <span className="tabular-nums">{content.length}/500</span>
      </div>
      <button
        type="submit"
        disabled={busy || !chefId || content.trim().length === 0}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}

function NudgeBanner({ count }: { count: number }) {
  if (count === 1) {
    return (
      <Link to="/auth" className="fixed bottom-4 right-4 z-50 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg">
        Claim your profile
      </Link>
    );
  }
  if (count === 2) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 rounded-lg border border-primary/30 bg-card p-4 shadow-lg">
        <div className="text-sm font-medium text-foreground">Claim your profile</div>
        <div className="mt-1 text-xs text-muted-foreground">Your {count} hearts come with you.</div>
        <Link to="/auth" className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          Continue
        </Link>
      </div>
    );
  }
  return (
    <Link
      to="/auth"
      className="fixed inset-x-0 bottom-0 z-50 block bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground"
    >
      Claim your profile — your {count} hearts come with you.
    </Link>
  );
}
