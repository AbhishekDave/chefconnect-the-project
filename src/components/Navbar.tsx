import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "text-sm text-foreground font-medium" }}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 hidden border-b border-border/60 bg-background/80 backdrop-blur md:block">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link to="/" className="text-base tracking-tight text-foreground">
          Cheftoman
        </Link>
        <div className="flex items-center gap-6">
          <NavLink to="/">Home</NavLink>
          {user && <NavLink to="/me">Me</NavLink>}
          {user && <NavLink to="/ops">Ops</NavLink>}
          {!user && <NavLink to="/auth">Sign in</NavLink>}
        </div>
      </nav>
    </header>
  );
}
