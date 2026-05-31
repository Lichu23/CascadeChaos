import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-4 py-10">
        <div className="text-center">
          <p className="mx-auto inline-flex items-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-bold text-indigo-600 shadow">
            Party game / 3-8 players
          </p>
          <h1 className="mt-7 text-5xl font-black leading-none text-indigo-950">
            Cascade <span className="text-pink-500">Chaos</span>
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            See some HTML. Draw what you think the page looks like. Laugh
            together when the real page is revealed. Vote for the best chaos.
          </p>
        </div>

        <div className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
          <div className="grid gap-4">
            <Link
              className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-indigo-500 px-5 text-lg font-bold text-white shadow-lg shadow-indigo-300 transition hover:bg-indigo-600 active:scale-[0.98]"
              href="/join"
            >
              + Create Room
            </Link>
            <Link
              className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-indigo-50 px-5 text-lg font-bold text-indigo-800 transition hover:bg-indigo-100 active:scale-[0.98]"
              href="/join"
            >
              Join Room
            </Link>
            <Link
              className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-white px-5 text-lg font-bold text-slate-600 ring-1 ring-indigo-100 transition hover:bg-indigo-50 hover:text-indigo-800 active:scale-[0.98]"
              href="/practice"
            >
              Practice solo
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-3xl border border-white/70 bg-white/70 p-4 text-center shadow-sm">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-amber-100 text-amber-600">
              <svg
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.4"
                viewBox="0 0 24 24"
              >
                <path d="m8 9-4 3 4 3" />
                <path d="m16 9 4 3-4 3" />
                <path d="m14 5-4 14" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-700">Read code</p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/70 p-4 text-center shadow-sm">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-pink-100 text-pink-500">
              <svg
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="10.5" cy="15.5" r=".5" fill="currentColor" />
                <path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-700">Draw fast</p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/70 p-4 text-center shadow-sm">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <svg
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <path d="M4 5h14v14H4z" />
                <path d="m8 12 2.5 2.5L15 10" />
                <path d="M3 21h18" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-700">Vote chaos</p>
          </div>
        </div>

      </section>
    </main>
  );
}

