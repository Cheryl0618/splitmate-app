export default function Loading() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f6f8f7] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-5xl animate-pulse" role="status" aria-live="polite">
        <span className="sr-only">页面加载中</span>
        <div className="h-4 w-24 rounded-full bg-slate-200" />
        <div className="mt-6 h-10 w-48 max-w-full rounded-2xl bg-slate-200" />
        <div className="mt-8 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
          <div className="h-5 w-2/3 rounded-full bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </main>
  );
}
