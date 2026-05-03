import { Header } from "@/components/Header";
import { ChatClient } from "./ChatClient";

export default function ChatPage() {
  return (
    <>
      <Header active="chat" />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <ChatClient />
      </main>
    </>
  );
}
