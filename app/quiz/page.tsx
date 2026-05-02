import { Header } from "@/components/Header";
import { QuizClient } from "./QuizClient";

export default function QuizPage() {
  return (
    <>
      <Header active="quiz" />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <QuizClient />
      </main>
    </>
  );
}
