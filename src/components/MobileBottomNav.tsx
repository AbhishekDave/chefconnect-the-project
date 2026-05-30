import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

function Item({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground transition-colors"
      activeProps={{ className: "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-primary" }}
    >
      <span aria-hidden className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function MobileBottomNav() {
  const { user } = useAuth();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <Item to="/" icon="🏠" label="Home" />
      {user ? <Item to="/me" icon="♥" label="Me" /> : <Item to="/auth" icon="→" label="Sign in" />}
      {user && <Item to="/ops" icon="◎" label="Ops" />}
    </nav>
  );
}
