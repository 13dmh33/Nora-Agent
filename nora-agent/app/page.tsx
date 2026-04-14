"use client";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState<{role: string; content: string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });

    const data = await res.json();
    setMessages([...newMessages, { role: "assistant", content: data.message }]);
    setLoading(false);
  }

  return (
    <main className="max-w-2xl mx-auto p-4 h-screen flex flex-col">
      <h1 className="text-2xl font-bold text-center mb-4">Chat with Nora</h1>
      <div className="flex-1 overflow-y-auto border rounded p-4 mb-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center">Nora is ready. Say hello!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`p-3 rounded-lg max-w-sm ${m.role === "user" ? "bg-blue-600 text-white ml-auto" : "bg-gray-200 text-gray-900"}`}>
            <p className="text-sm font-semibold">{m.role === "user" ? "You" : "Nora"}</p>
            <p>{m.content}</p>
          </div>
        ))}
        {loading && <p className="text-gray-400">Nora is typing...</p>}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type your message..."
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </main>
  );
}
