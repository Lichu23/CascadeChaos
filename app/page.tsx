import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-5 py-12 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-emerald-300">
            HTML/CSS drawing party game
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-zinc-50 sm:text-6xl">
            Cascade Chaos
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            Read a snippet, sketch what you think the interface will look like,
            then reveal the actual result. Practice mode is ready first so the
            challenge and drawing loop can be tested quickly.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex h-12 items-center justify-center rounded-md bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            href="/practice"
          >
            Start Practice
          </Link>
          <button
            className="inline-flex h-12 cursor-not-allowed items-center justify-center rounded-md border border-zinc-800 px-5 text-sm font-semibold text-zinc-500"
            disabled
            type="button"
          >
            Multiplayer Soon
          </button>
        </div>

        <div className="grid gap-3 border-t border-zinc-800 pt-6 text-sm text-zinc-400 sm:grid-cols-3">
          <p>11 hardcoded challenges</p>
          <p>Canvas drawing loop</p>
          <p>Screenshot reveal flow</p>
        </div>
      </section>
    </main>
  );
}

