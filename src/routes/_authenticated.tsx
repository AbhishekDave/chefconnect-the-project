import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { loading, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
        <Link to="/" className="text-lg font-medium">Cheftoman</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/me" className="text-foreground hover:text-primary">Me</Link>
          <Link to="/ops" className="text-foreground hover:text-primary">Ops</Link>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground">Sign out</button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
