(function () {
  const NORA_URL = window.NORA_URL || "";

  // Create bubble button
  const bubble = document.createElement("button");
  bubble.innerText = "+";
  bubble.style.cssText = `
    position: fixed; bottom: 24px; right: 24px;
    width: 60px; height: 60px; border-radius: 50%;
    background-color: #2E5B8A; color: white;
    font-size: 28px; border: none; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999;
  `;

  // Create chat window
  const chatWindow = document.createElement("div");
  chatWindow.style.cssText = `
    display: none; position: fixed; bottom: 100px; right: 24px;
    width: 360px; height: 500px; background: white;
    border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    flex-direction: column; z-index: 9998; overflow: hidden;
    font-family: Arial, sans-serif;
  `;

  chatWindow.innerHTML = `
    <div style="background:#2E5B8A;color:white;padding:16px;font-weight:bold;font-size:16px;">
      Chat with Nora
    </div>
    <div id="nora-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;">
      <p style="color:#aaa;text-align:center;margin-top:20px;">Nora is ready. Say hello!</p>
    </div>
    <div style="display:flex;padding:10px;border-top:1px solid #eee;gap:8px;">
      <input id="nora-input" placeholder="Type your message..." style="flex:1;border:1px solid #ddd;border-radius:8px;padding:8px 12px;font-size:14px;outline:none;" />
      <button id="nora-send" style="background:#2E5B8A;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:14px;">Send</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(chatWindow);

  let open = false;
  let messages = [];

  bubble.addEventListener("click", () => {
    open = !open;
    bubble.innerText = open ? "X" : "+";
    chatWindow.style.display = open ? "flex" : "none";
  });

  async function sendMessage() {
    const input = document.getElementById("nora-input");
    const text = input.value.trim();
    if (!text) return;

    messages.push({ role: "user", content: text });
    input.value = "";
    renderMessages();

    const res = await fetch(NORA_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const data = await res.json();
    messages.push({ role: "assistant", content: data.message });
    renderMessages();
  }

  function renderMessages() {
    const container = document.getElementById("nora-messages");
    container.innerHTML = "";
    messages.forEach((m) => {
      const div = document.createElement("div");
      div.innerText = m.content;
      div.style.cssText = `
        align-self: ${m.role === "user" ? "flex-end" : "flex-start"};
        background: ${m.role === "user" ? "#2E5B8A" : "#F0F0F0"};
        color: ${m.role === "user" ? "white" : "#111"};
        padding: 10px 14px; border-radius: 12px;
        max-width: 80%; font-size: 14px;
      `;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  document.getElementById("nora-send").addEventListener("click", sendMessage);
  document.getElementById("nora-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();