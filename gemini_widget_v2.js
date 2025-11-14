/* ============================================================
   GEMINI WEBSITE WIDGET V2 (MOBILE-ONLY)
   - Hiện bên PHẢI màn hình trên điện thoại (< 768px)
   - Ẩn trên tablet / laptop / desktop
   - Đọc HTML trang (hero, bike-card, FAQ...) để làm "local context"
   - Ưu tiên trả lời theo HTML trang chủ trước rồi mới dùng internet
   - Tự sync dark/light theo html[data-theme] hiện tại
   - UI dạng mini chat giống app, gọn như MotoAI
   ============================================================ */

(function(){
  if (window.GeminiWidgetV2Loaded) return;
  window.GeminiWidgetV2Loaded = true;

  /* ========== CONFIG ========== */
  const CFG = {
    apiKey: "PASTE_YOUR_GEMINI_API_KEY_HERE",   // <- ĐIỀN API KEY CỦA ANH VÀO ĐÂY
    model:  "gemini-1.5-flash",                 // hoặc flash-8b nếu anh muốn
    maxContextChars: 5500,                      // giới hạn context từ HTML
    debug: true
  };

  if (!CFG.apiKey || CFG.apiKey.includes("PASTE_YOUR")) {
    console.warn("GeminiWidgetV2: Chưa điền API KEY.");
  }

  /* ========== SMALL HELPERS ========== */
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  function looksVN(s){
    if (!s) return false;
    return /[ăâêôơưđà-ỹ]/i.test(s) ||
           /(xe|thuê|giá|hà nội|cọc|giấy tờ|mua|bán|cho thuê)/i.test(s);
  }

  function detectLang(text){
    const s = String(text || "");
    if (!s.trim()) return "en";
    if (looksVN(s)) return "vi";
    if (/[a-z]/i.test(s)) return "en";
    return "en";
  }

  function nowISO(){
    return new Date().toISOString();
  }

  /* ========== BUILD CONTEXT FROM HTML ========== */

  function collectBikes(){
    const cards = $$("#bikes-for-sale .bike-card");
    if (!cards.length) return "";

    let out = "Motorbikes for sale (from HTML):\n";
    cards.forEach((card, idx)=>{
      const title = $("h4", card)?.textContent?.trim() || "";
      const imgAlt = $("img", card)?.getAttribute("alt") || "";
      const desc = $("p", card)?.textContent?.trim() || "";
      if (!title && !desc && !imgAlt) return;

      out += `- Bike ${idx+1}: `;
      if (title) out += title + ". ";
      if (desc) out += desc + ". ";
      if (imgAlt && imgAlt !== title) out += "(Alt: " + imgAlt + "). ";
      out += "\n";
    });

    return out + "\n";
  }

  function collectHero(){
    const hero = $("#hero");
    if (!hero) return "";
    let text = hero.innerText || "";
    text = text.replace(/\s+/g," ").trim();
    if (!text) return "";
    if (text.length > 1200) text = text.slice(0, 1200) + " ...";
    return "Hero section snapshot (from HTML):\n" + text + "\n\n";
  }

  function collectFAQ(){
    const faq = $("#faqAccordion");
    if (!faq) return "";
    const items = $$(".accordion-item", faq).slice(0, 6);
    if (!items.length) return "";

    let out = "FAQ from this page:\n";
    items.forEach((it, idx)=>{
      const q = $(".accordion-button", it)?.innerText?.trim() || "";
      const a = $(".accordion-body", it)?.innerText?.trim() || "";
      if (!q && !a) return;
      out += `Q${idx+1}: ${q}\nA${idx+1}: ${a}\n\n`;
    });
    return out;
  }

  function collectMeta(){
    const title = document.title || "";
    const desc = $('meta[name="description"]')?.getAttribute("content") || "";
    const kw   = $('meta[name="keywords"]')?.getAttribute("content") || "";
    let out = "Page meta:\n";
    if (title) out += "- Title: " + title + "\n";
    if (desc)  out += "- Description: " + desc + "\n";
    if (kw)    out += "- Keywords: " + kw + "\n";
    out += "\n";
    return out;
  }

  function buildHtmlContext(){
    let ctx = "";
    ctx += collectMeta();
    ctx += collectHero();
    ctx += collectBikes();
    ctx += collectFAQ();

    // Giới hạn độ dài để không nổ tokens
    if (ctx.length > CFG.maxContextChars){
      ctx = ctx.slice(0, CFG.maxContextChars) + "\n...[HTML context truncated]...";
    }

    if (CFG.debug){
      console.log("GeminiWidgetV2 HTML_CONTEXT length:", ctx.length);
    }
    return ctx;
  }

  const HTML_CONTEXT = buildHtmlContext();

  /* ========== SYSTEM INSTRUCTION ========== */

  const SYSTEM_PROMPT = `
You are an AI assistant for "Hanoi Motorbike Rental and Sale" in Long Bien, Hanoi.

You MUST always:
1. PRIORITIZE local data from the HTML context (bikes, prices, location, FAQs).
2. If information is missing, THEN you may use your general knowledge or internet-based data.
3. If the user writes Vietnamese → answer in Vietnamese.
4. If the user writes English → answer in English.
5. Do not invent very specific prices outside the local list. If not sure, say that the price depends and ask the user to contact via Zalo/WhatsApp.
6. You can answer general questions too (travel, Vietnam, English, etc.) but still mention that you are from a motorbike rental/sale shop when it's relevant.

LOCAL_HTML_CONTEXT:
"""` + HTML_CONTEXT + `"""
`;

  /* ========== CSS (SCOPED) ========== */

  const CSS = `
    #gmini2-root{
      position:fixed;
      right:16px;
      bottom:calc(16px + env(safe-area-inset-bottom,0));
      z-index:2147483646;
      font-family:-apple-system,system-ui,Segoe UI,Roboto,"Helvetica Neue",Arial,sans-serif;
    }

    /* FAB BUTTON */
    #gmini2-fab{
      width:54px;height:54px;border-radius:999px;border:none;
      background:linear-gradient(135deg,#4285F4,#34A853);
      box-shadow:0 10px 30px rgba(0,0,0,.35);
      color:#fff;display:flex;align-items:center;justify-content:center;
      cursor:pointer;
      position:relative;
      overflow:hidden;
    }
    #gmini2-fab-icon{
      font-size:22px;
    }
    #gmini2-fab-tag{
      position:absolute;
      bottom:4px;
      right:6px;
      font-size:10px;
      padding:1px 5px;
      border-radius:999px;
      background:rgba(0,0,0,.6);
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    /* PANEL */
    #gmini2-panel{
      position:absolute;
      right:0;
      bottom:64px;
      width:min(340px, calc(100vw - 32px));
      max-height:60vh;
      background:#020617;
      color:#e5e7eb;
      border-radius:18px;
      box-shadow:0 16px 48px rgba(0,0,0,.7);
      display:flex;
      flex-direction:column;
      overflow:hidden;
      opacity:0;
      transform:translateY(8px);
      pointer-events:none;
      transition:opacity .18s ease, transform .18s ease;
    }
    #gmini2-panel.open{
      opacity:1;transform:translateY(0);pointer-events:auto;
    }

    #gmini2-header{
      padding:8px 10px 6px;
      border-bottom:1px solid rgba(148,163,184,0.3);
      display:flex;
      align-items:center;
      gap:8px;
      background:linear-gradient(135deg,#020617,#111827);
    }
    #gmini2-header-main{
      flex:1;
      display:flex;
      flex-direction:column;
      font-size:11px;
    }
    #gmini2-header-title{
      font-weight:700;
      font-size:12px;
    }
    #gmini2-header-status{
      font-size:11px;
      opacity:0.85;
    }
    #gmini2-header-dot{
      width:7px;height:7px;border-radius:50%;
      background:#22c55e;
      box-shadow:0 0 0 4px rgba(34,197,94,0.4);
      margin-right:4px;
    }
    #gmini2-header-badge{
      font-size:10px;
      padding:2px 6px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,0.5);
      opacity:0.85;
    }

    /* MESSAGES */
    #gmini2-messages{
      flex:1;
      padding:8px 8px 4px;
      overflow-y:auto;
      font-size:13px;
    }
    .gmini2-msg{
      max-width:82%;
      padding:6px 9px;
      margin:4px 0;
      border-radius:12px;
      line-height:1.45;
      word-break:break-word;
    }
    .gmini2-msg.user{
      margin-left:auto;
      background:#1d4ed8;
      color:#eef2ff;
      border-bottom-right-radius:4px;
    }
    .gmini2-msg.bot{
      background:#020617;
      border:1px solid rgba(148,163,184,0.5);
      border-bottom-left-radius:4px;
      color:#e5e7eb;
    }

    #gmini2-footer{
      padding:6px 7px 7px;
      border-top:1px solid rgba(148,163,184,0.4);
      background:#020617;
      display:flex;
      flex-direction:column;
      gap:4px;
    }
    #gmini2-input-row{
      display:flex;
      gap:6px;
      align-items:center;
    }
    #gmini2-input{
      flex:1;
      border-radius:999px;
      border:1px solid rgba(148,163,184,0.6);
      background:#020617;
      color:#e5e7eb;
      padding:6px 10px;
      font-size:13px;
      outline:none;
      -webkit-appearance:none;
      appearance:none;
      -webkit-text-fill-color:#e5e7eb;
    }
    #gmini2-input::placeholder{
      color:rgba(148,163,184,0.8);
    }
    #gmini2-send{
      border:none;
      border-radius:999px;
      padding:6px 11px;
      background:#22c55e;
      color:#052e16;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
    }
    #gmini2-send[disabled]{
      opacity:.5;
      cursor:default;
    }
    #gmini2-footer-note{
      font-size:10px;
      color:rgba(148,163,184,0.9);
    }

    /* Typing indicator */
    #gmini2-typing{
      display:flex;
      align-items:center;
      gap:5px;
      font-size:11px;
      color:#a5b4fc;
      margin:2px 0 0;
    }
    .gmini2-dot{
      width:4px;height:4px;border-radius:999px;
      background:#a5b4fc;
      animation:gmini2-dot 1.2s infinite ease-in-out;
    }
    .gmini2-dot:nth-child(2){animation-delay:.16s}
    .gmini2-dot:nth-child(3){animation-delay:.32s}
    @keyframes gmini2-dot{
      0%,100%{transform:translateY(0);opacity:.4}
      50%{transform:translateY(-2px);opacity:1}
    }

    /* Dark/light sync – dựa trên html[data-theme] */
    html[data-theme="light"] #gmini2-panel{
      background:#ffffff;
      color:#020617;
    }
    html[data-theme="light"] #gmini2-header{
      background:linear-gradient(135deg,#f8fafc,#e2e8f0);
      border-bottom-color:rgba(148,163,184,0.5);
    }
    html[data-theme="light"] #gmini2-messages{
      background:#f9fafb;
    }
    html[data-theme="light"] .gmini2-msg.bot{
      background:#ffffff;
      border-color:rgba(148,163,184,0.6);
      color:#020617;
    }
    html[data-theme="light"] #gmini2-footer{
      background:#f9fafb;
      border-top-color:rgba(148,163,184,0.6);
    }
    html[data-theme="light"] #gmini2-input{
      background:#ffffff;
      color:#020617;
      -webkit-text-fill-color:#020617;
    }
    html[data-theme="light"] #gmini2-footer-note{
      color:#6b7280;
    }

    /* iOS Safari chống CSS ngoài override */
    html #gmini2-input{
      color:inherit !important;
      -webkit-text-fill-color:inherit !important;
    }

    /* Mobile only */
    @media (min-width:768px){
      #gmini2-root{display:none !important;}
    }
  `;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  /* ========== HTML ROOT ========== */

  const root = document.createElement("div");
  root.id = "gmini2-root";
  root.innerHTML = `
    <button id="gmini2-fab" type="button" aria-label="Open Gemini assistant">
      <span id="gmini2-fab-icon">✨</span>
      <span id="gmini2-fab-tag">AI</span>
    </button>

    <section id="gmini2-panel" aria-label="Gemini chat for Hanoi Motorbike">
      <header id="gmini2-header">
        <div id="gmini2-header-dot" aria-hidden="true"></div>
        <div id="gmini2-header-main">
          <div id="gmini2-header-title">Gemini – Online</div>
          <div id="gmini2-header-status">
            From this website + Google
          </div>
        </div>
        <div id="gmini2-header-badge">Hanoi Motorbike</div>
      </header>

      <div id="gmini2-messages" role="log" aria-live="polite"></div>

      <footer id="gmini2-footer">
        <div id="gmini2-input-row">
          <input id="gmini2-input" type="text"
                 placeholder="Ask in English or Vietnamese..."
                 autocomplete="off">
          <button id="gmini2-send" type="button" disabled>Send</button>
        </div>
        <div id="gmini2-footer-note">
          Gemini 1.5 · ưu tiên dữ liệu HTML trang chủ trước khi dùng internet.
        </div>
      </footer>
    </section>
  `;
  document.body.appendChild(root);

  const fab    = $("#gmini2-fab", root);
  const panel  = $("#gmini2-panel", root);
  const msgBox = $("#gmini2-messages", root);
  const input  = $("#gmini2-input", root);
  const send   = $("#gmini2-send", root);

  /* ========== UI FUNCTIONS ========== */

  function appendMsg(role, text){
    if (!text) return;
    const div = document.createElement("div");
    div.className = "gmini2-msg " + role;
    div.textContent = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function setTyping(on){
    let node = $("#gmini2-typing", msgBox);
    if (on){
      if (!node){
        node = document.createElement("div");
        node.id = "gmini2-typing";
        node.innerHTML = `
          <div>Gemini is thinking</div>
          <div style="display:flex;gap:3px;">
            <div class="gmini2-dot"></div>
            <div class="gmini2-dot"></div>
            <div class="gmini2-dot"></div>
          </div>
        `;
        msgBox.appendChild(node);
      }
      msgBox.scrollTop = msgBox.scrollHeight;
    } else {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }
  }

  function setSendEnabled(on){
    if (on) send.removeAttribute("disabled");
    else send.setAttribute("disabled", "disabled");
  }

  function openPanel(){
    panel.classList.add("open");
    setTimeout(()=>{ try{ input.focus(); }catch(e){} }, 80);
  }
  function closePanel(){
    panel.classList.remove("open");
  }

  fab.addEventListener("click", ()=>{
    if (panel.classList.contains("open")) closePanel();
    else openPanel();
  });

  input.addEventListener("input", ()=>{
    setSendEnabled(!!input.value.trim());
  });

  input.addEventListener("keydown", e=>{
    if (e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      triggerSend();
    }
  });
  send.addEventListener("click", triggerSend);

  /* ========== GEMINI API CALL ========== */

  async function callGemini(question){
    const lang = detectLang(question);
    const langInstruction = lang === "vi"
      ? "Dùng tiếng Việt để trả lời. "
      : "Use English to answer. ";

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                SYSTEM_PROMPT +
                "\n\n" +
                langInstruction +
                "\nUser question:\n" +
                question
            }
          ]
        }
      ]
    };

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(CFG.model) +
      ":generateContent?key=" +
      encodeURIComponent(CFG.apiKey);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok){
      const text = await res.text().catch(()=> "");
      throw new Error("Gemini HTTP " + res.status + " - " + text);
    }

    const data = await res.json();
    const ans =
      data?.candidates?.[0]?.content?.parts?.map(p=>p.text || "").join(" ") ||
      (lang === "vi"
        ? "Xin lỗi, mình không nhận được trả lời từ Gemini."
        : "Sorry, I could not get a response from Gemini.");
    return ans.trim();
  }

  /* ========== SEND HANDLER ========== */

  async function triggerSend(){
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    setSendEnabled(false);

    appendMsg("user", q);
    setTyping(true);

    try{
      const ans = await callGemini(q);
      setTyping(false);
      appendMsg("bot", ans);
    }catch(e){
      console.error("GeminiWidgetV2 error:", e);
      setTyping(false);
      appendMsg(
        "bot",
        looksVN(q)
          ? "Xin lỗi, hiện tại không kết nối được tới Gemini. Bạn có thể thử lại sau vài phút."
          : "Sorry, I cannot reach Gemini right now. Please try again in a few minutes."
      );
    }
  }

  /* ========== INITIAL GREETING ========== */

  (function initGreeting(){
    const sample = "Hanoi motorbike rental and sale in Long Bien, near Old Quarter.";
    const lang = looksVN(document.documentElement.lang) ? "vi" : detectLang(sample);
    const text = lang === "vi"
      ? "Xin chào! Đây là Gemini, trợ lý online cho dịch vụ thuê và mua bán xe máy tại Hà Nội. Bạn có thể hỏi về giá xe, thuê xe dài ngày, hoặc bất kỳ câu hỏi du lịch/tiếng Anh nào."
      : "Hi! This is Gemini, an online assistant for motorbike rental and sale in Hanoi. You can ask about bike prices, long-term rental, or any other questions (travel, English, etc.).";
    appendMsg("bot", text);
  })();

  if (CFG.debug){
    console.log("%cGemini Widget V2 — mobile, HTML-aware, online",
      "color:#34A853;font-weight:bold;");
  }

})();
