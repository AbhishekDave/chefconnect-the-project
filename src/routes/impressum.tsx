import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum — Cheftoman" },
      { name: "description", content: "Legal disclosure for Cheftoman." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImpressumPage,
});

function ImpressumPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="font-serif text-4xl">Impressum</h1>
        <p className="mt-6 text-muted-foreground">
          Legal disclosure coming soon. For inquiries, contact{" "}
          <a
            href="mailto:cheftoman_official@outlook.com"
            className="underline hover:text-foreground"
          >
            cheftoman_official@outlook.com
          </a>
          .
        </p>
        <div className="mt-10">
          <Link to="/" className="text-sm underline hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
