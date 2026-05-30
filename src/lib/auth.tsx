import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { getAnonymousSessionToken } from "./anonymousSession";

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  foodieProfileId: string | null;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
  foodieProfileId: null,
  signOut: async () => {},
});

const FOODIE_KEY = "cheftoman.foodie_profile_id";

async function reconcileIdentity(user: User): Promise<string | null> {
  // 1. users upsert — keep existing full_name if present
  const incomingName = (user.user_metadata?.full_name as string | undefined)?.trim() || "";
  const { data: existing } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  let full_name: string;
  if (existing?.full_name) {
    full_name = existing.full_name;
  } else if (incomingName) {
    full_name = incomingName;
  } else {
    full_name = user.email ?? "Diner";
  }

  const { error: uErr } = await supabase
    .from("users")
    .upsert(
      { id: user.id, email: user.email, full_name, user_type: "foodie" },
      { onConflict: "id" },
    );
  if (uErr) console.warn("users upsert", uErr);

  // 2. foodie_profiles ensure-one
  let foodieProfileId: string | null = null;
  const { data: fp } = await supabase
    .from("foodie_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (fp?.id) {
    foodieProfileId = fp.id;
  } else {
    const { data: newFp, error: fErr } = await supabase
      .from("foodie_profiles")
      .insert({ user_id: user.id })
      .select("id")
      .maybeSingle();
    if (fErr) console.warn("foodie_profiles insert", fErr);
    foodieProfileId = newFp?.id ?? null;
  }
  if (foodieProfileId) {
    window.localStorage.setItem(FOODIE_KEY, foodieProfileId);
  }

  // 3. stitch anon session
  const token = getAnonymousSessionToken();
  if (token && foodieProfileId) {
    const { error: sErr } = await supabase.rpc("stitch_anonymous_session", {
      target_user_id: user.id,
      target_foodie_profile_id: foodieProfileId,
      anon_token: token,
    });
    if (sErr) console.warn("stitch_anonymous_session", sErr);
  }

  return foodieProfileId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [foodieProfileId, setFoodieProfileId] = useState<string | null>(
    typeof window !== "undefined" ? window.localStorage.getItem(FOODIE_KEY) : null,
  );
  const reconciledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) void runReconcile(data.session.user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) void runReconcile(s.user);
      if (!s) setFoodieProfileId(null);
    });

    async function runReconcile(user: User) {
      if (reconciledRef.current.has(user.id)) return;
      reconciledRef.current.add(user.id);
      try {
        const id = await reconcileIdentity(user);
        if (mounted && id) setFoodieProfileId(id);
      } catch (e) {
        console.warn("reconcile failed", e);
        reconciledRef.current.delete(user.id);
      }
    }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    foodieProfileId,
    signOut: async () => {
      await supabase.auth.signOut();
      window.localStorage.removeItem(FOODIE_KEY);
      setFoodieProfileId(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
