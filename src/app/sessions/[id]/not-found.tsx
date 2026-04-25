import Link from "next/link";

export default function SessionNotFound() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <p className="text-2xl">🧭</p>
      <h1 className="mt-2 text-xl font-semibold text-gray-900">Session not found</h1>
      <p className="mt-1 text-sm text-gray-500">
        The requested session may have been removed or the link is invalid.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Go to session list
      </Link>
    </div>
  );
}
