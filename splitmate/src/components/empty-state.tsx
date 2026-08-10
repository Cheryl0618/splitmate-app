import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  tone = "neutral",
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  tone?: "neutral" | "success";
}) {
  const isSuccess = tone === "success";

  return (
    <section
      className={`rounded-3xl border px-5 py-10 text-center shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:px-8 sm:py-12 ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <span
        className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl font-black ${
          isSuccess
            ? "bg-emerald-600 text-white"
            : "bg-teal-50 text-teal-700"
        }`}
        aria-hidden="true"
      >
        {isSuccess ? "✓" : "+"}
      </span>
      <h2
        className={`mt-5 text-xl font-extrabold ${
          isSuccess ? "text-emerald-900" : "text-slate-900"
        }`}
      >
        {title}
      </h2>
      <p
        className={`mx-auto mt-2 max-w-lg text-sm leading-6 ${
          isSuccess ? "text-emerald-700" : "text-slate-500"
        }`}
      >
        {description}
      </p>
      <Link
        href={actionHref}
        className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          isSuccess
            ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
            : "bg-teal-600 hover:bg-teal-700 focus-visible:ring-teal-500"
        }`}
      >
        {actionLabel}
      </Link>
    </section>
  );
}
