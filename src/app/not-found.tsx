import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-slate-600">
        The page you requested does not exist.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block font-semibold underline underline-offset-4"
      >
        Return to the dashboard
      </Link>
    </main>
  );
}
