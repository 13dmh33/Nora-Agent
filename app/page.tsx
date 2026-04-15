"use client";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => setOpen(!open)} style={{ position: "fixed", bottom: "24px", right: "24px", width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "#2E5B8A", color: "white", fontSize: "28px", border: "none", cursor: "pointer", zIndex: 1000 }}>
        {open ? "X" : "+"}
      </button>
      {open && (
        <div style={{ position: "fixed", bottom: "100px", right: "24px", width: "360px", height: "500px", backgroundColor: "white", borderRadius: "16px", display: "flex", flexDirection: "column", zIndex: 999, overflow: "hidden" }}>
          <div style={{ backgroundColor: "#2E5B8A", color: "white", padding: "16px", fontWeight: "bold" }}>Chat with Nora</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {messages.length === 0 && (<p style={{ color: "#aaa", textAlign: "center" }}>Nora is ready. Say hello!</p>)}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", backgroundColor: m.role === "user" ? "#2E5B8A" : "#F0F0F0", color: m.role === "user" ? "white" : "#111", padding: "10px 14px", borderRadius: "12px", maxWidth: "80%", fontSize: "14px" }}>
                {m.content}
              </div>
            ))}
            {loading && <p style={{ color: "#aaa" }}>Nora is typing...</p>}
          </div>
          <div style={{ display: "flex", padding: "10px", borderTop: "1px solid #eee", gap: "8px" }}>
            <input style={{ flex: 1, border: "1px solid #ddd", borderRadius: "8px", padding: "8px 12px", fontSize: "14px", outline: "none" }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Type your message..." />
            <button onClick={sendMessage} style={{ backgroundColor: "#2E5B8A", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer" }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
