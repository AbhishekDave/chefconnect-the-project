import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: "Datenschutz — Cheftoman" },
      { name: "description", content: "Privacy policy for Cheftoman." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DatenschutzPage,
});

function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="font-serif text-4xl">Datenschutz</h1>
        <p className="mt-6 text-muted-foreground">
          Our full privacy policy is being prepared. We handle your data under
          GDPR. For data requests, contact{" "}
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
