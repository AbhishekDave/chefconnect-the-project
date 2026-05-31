import { useEffect, useRef, useState } from "react";

type Props = { href: string; sentinelId: string };

const KEY = "cheftoman.scrollpopup.dismissed";

export function ScrollPopup({ href, sentinelId }: Props) {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(KEY) === "1") return;
    const el = document.getElementById(sentinelId);
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !shownRef.current) {
            shownRef.current = true;
            setOpen(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelId]);

  function dismiss() {
    sessionStorage.setItem(KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="scroll-popup-title"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/30 sm:right-5 sm:left-auto sm:bottom-24"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
      <h3 id="scroll-popup-title" className="text-xl text-card-foreground">
        Want a free sample stand for your tables?
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        We'll send one over so your kitchen can hear from real diners — no cost, no lock-in.
      </p>
      <div className="mt-4 flex gap-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Yes, send one
        </a>
        <button
          onClick={dismiss}
          className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
        >
          Later
        </button>
      </div>
    </div>
  );
}
