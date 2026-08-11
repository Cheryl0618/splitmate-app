import Link from "next/link";
import { Check, Plus } from "lucide-react";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
  tone = "neutral",
  showPlusIcon = false,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  onAction?: () => void;
  tone?: "neutral" | "success";
  prominentAction?: boolean;
  showPlusIcon?: boolean;
}) {
  const isSuccess = tone === "success";

  return (
    <section
      className={`rounded-[14px] px-5 py-10 text-center sm:px-8 sm:py-12 ${
        isSuccess ? "bg-inset" : "bg-surface"
      }`}
    >
      <span
        className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl font-black ${
          isSuccess ? "bg-ink text-surface" : "bg-inset text-ink"
        }`}
        aria-hidden="true"
      >
        {isSuccess ? (
          <Check aria-hidden="true" size={24} strokeWidth={2.5} />
        ) : (
          <Plus aria-hidden="true" size={24} strokeWidth={2.5} />
        )}
      </span>
      <h2
        className={`mt-5 text-xl font-extrabold ${
          "text-ink"
        }`}
      >
        {title}
      </h2>
      <p
        className={`mx-auto mt-2 max-w-lg text-sm leading-6 ${
          isSuccess ? "text-ink" : "text-ink-soft"
        }`}
      >
        {description}
      </p>
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-surface transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          {showPlusIcon ? <Plus aria-hidden="true" size={18} strokeWidth={2} /> : null}
          {actionLabel}
        </button>
      ) : (
        <Link
          href={actionHref}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-surface transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          {showPlusIcon ? <Plus aria-hidden="true" size={18} strokeWidth={2} /> : null}
          {actionLabel}
        </Link>
      )}
    </section>
  );
}
