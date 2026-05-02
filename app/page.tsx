import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <p className="text-accent-400 font-mono text-sm tracking-widest">
          AI TUTOR · RAG OVER CLASSIC ECONOMICS TEXTS
        </p>
        <h1 className="mt-3 text-5xl font-bold text-ink-50 leading-tight">
          Economics Expert
        </h1>
        <p className="mt-4 text-lg text-ink-200 max-w-3xl">
          Ask questions, take quizzes, and get step-by-step explanations
          grounded in 4 economics textbooks. Every answer cites the source it
          came from.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-6">
        <Link
          href="/chat"
          className="group rounded-2xl border border-ink-700 bg-ink-800 p-8 hover:border-accent-500 hover:bg-ink-700/60 transition"
        >
          <div className="text-3xl">💬</div>
          <h2 className="mt-4 text-2xl font-semibold text-ink-50 group-hover:text-accent-400">
            Chat with the tutor
          </h2>
          <p className="mt-2 text-ink-200">
            Ask any question about microeconomics, supply &amp; demand,
            elasticity, market structures, GDP, and more. The tutor retrieves
            the most relevant passages from the source library before answering.
          </p>
        </Link>

        <Link
          href="/quiz"
          className="group rounded-2xl border border-ink-700 bg-ink-800 p-8 hover:border-accent-500 hover:bg-ink-700/60 transition"
        >
          <div className="text-3xl">📝</div>
          <h2 className="mt-4 text-2xl font-semibold text-ink-50 group-hover:text-accent-400">
            Test your knowledge
          </h2>
          <p className="mt-2 text-ink-200">
            Pick a topic and the tutor generates a fresh multiple-choice quiz
            from the source library. See instant feedback with full step-by-step
            explanations.
          </p>
        </Link>
      </section>

      <section className="mt-16 rounded-2xl border border-ink-700 bg-ink-800/60 p-8">
        <h3 className="text-xl font-semibold text-ink-50">How it works</h3>
        <ol className="mt-3 list-decimal pl-5 space-y-1 text-ink-200">
          <li>
            Source PDFs are parsed, chunked, and embedded with{" "}
            <code className="text-accent-400">text-embedding-3-small</code>.
          </li>
          <li>
            Your question is embedded and matched against the chunks via cosine
            similarity.
          </li>
          <li>
            The top passages are passed to{" "}
            <code className="text-accent-400">gpt-4o-mini</code> with a tutor
            system prompt that requires step-by-step reasoning and citations.
          </li>
          <li>
            For quizzes, retrieved passages constrain the model to write
            faithful, source-grounded MCQs.
          </li>
        </ol>
        <p className="mt-4 text-sm text-ink-300">
          Sources: <em>Introduction to Microeconomics</em> (Dilts, 2004),{" "}
          <em>Introduction to Economics</em> (2019), <em>Introduction to
          Economics</em> (Van Sickle &amp; Rogge, 1954), and{" "}
          <em>Economics — class notes</em>.
        </p>
      </section>
    </main>
  );
}
