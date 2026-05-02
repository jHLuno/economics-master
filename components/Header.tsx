import Link from "next/link";

export function Header({ active }: { active: "chat" | "quiz" }) {
  return (
    <header className="border-b border-ink-700 bg-ink-900/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-ink-50">
          <span className="text-accent-400">●</span> Economics Expert
        </Link>
        <nav className="flex gap-1 text-sm">
          <Link
            href="/chat"
            className={`px-3 py-1.5 rounded-md ${
              active === "chat"
                ? "bg-ink-700 text-ink-50"
                : "text-ink-200 hover:text-ink-50 hover:bg-ink-800"
            }`}
          >
            Chat
          </Link>
          <Link
            href="/quiz"
            className={`px-3 py-1.5 rounded-md ${
              active === "quiz"
                ? "bg-ink-700 text-ink-50"
                : "text-ink-200 hover:text-ink-50 hover:bg-ink-800"
            }`}
          >
            Quiz
          </Link>
        </nav>
      </div>
    </header>
  );
}
