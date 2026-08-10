import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-[#f6f8f7] px-4 py-10 text-slate-900">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white px-5 py-12 text-center shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:px-8">
        <p className="text-sm font-black tracking-[0.2em] text-teal-700">404</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">没有找到这个页面</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          这个群组或账单可能不存在，也可能已经被删除。请返回首页重新选择要查看的内容。
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
        >
          返回首页
        </Link>
      </section>
    </main>
  );
}
