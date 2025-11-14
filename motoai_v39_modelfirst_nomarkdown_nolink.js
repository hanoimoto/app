/* motoai_v39_modelfirst_nomarkdown_nolink.js
   - Bubble + chat card on LEFT side (desktop & mobile)
   - UI mượt hơn: open/close animation, message fade, typing dots
   - Default replies EN or VI (auto detect language)
   - Focus: Hanoi motorbike rental/sale (pricing + FAQ intents)
   - No markdown, no links inside reply text
*/

(function(){
  if (window.MotoAI_v39_LOADED) return;
  window.MotoAI_v39_LOADED = true;

  /* ====== CONFIG ====== */
  const DEF = {
    brand: "Nguyen Tu",
    phone: "0942467674",
    zalo:  "",
    map:   "",
    avatar: "👩‍💼",
    themeColor: "#0084FF",

    autolearn: true,    // learn from current page text
    viOnly: true,       // favor Vietnamese content when parsing
    deepContext: true,
    maxContextTurns: 5,

    extraSites: [location.origin],
    crawlDepth: 1,
    refreshHours: 24,

    smart: {
      semanticSearch: true,
      extractiveQA:   true,
      autoPriceLearn: true
    },

    debug: true,
    noLinksInReply: true,
    noMarkdownReply: true,
    preferModelOverFamily: true
  };

  const ORG = (window.MotoAI_CONFIG || {});
  if (!ORG.zalo && (ORG.phone || DEF.phone)) {
    ORG.zalo = 'https://zalo.me/' + String(ORG.phone || DEF.phone).replace(/\s+/g,'');
  }
  const CFG = Object.assign({}, DEF, ORG);
  CFG.smart = Object.assign({}, DEF.smart, (ORG.smart || {}));

  /* ====== HELPERS ====== */
  const $ = s => document.querySelector(s);
  const safe = s => { try { return JSON.parse(s); } catch { return null; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (n,min,max)=> Math.max(min, Math.min(max,n));
  const nfVND = n => (n || 0).toLocaleString("vi-VN");

  function naturalize(t){
    if (!t) return "";
    let s = (" " + t + " ").replace(/\s+/g," ");
    // VN cleanup (harmless for EN)
    s = s.replace(/\s+ạ([.!?,\s]|$)/gi, "$1")
         .replace(/\s+nhé([.!?,\s]|$)/gi, "$1")
         .replace(/\s+nha([.!?,\s]|$)/gi, "$1");
    s = s.trim();
    if (!/[.!?]$/.test(s)) s += ".";
    return s.replace(/\.\./g,".");
  }

  function looksVN(s){
    if (/[ăâêôơưđà-ỹ]/i.test(s)) return true;
    const hits = (s.match(/\b(xe|thuê|giá|liên hệ|hà nội|cọc|giấy tờ)\b/gi)||[]).length;
    return hits >= 2;
  }

  function detectLang(text){
    const s = String(text || "");
    if (!s.trim()) return "en";
    if (looksVN(s)) return "vi";
    // simple EN heuristic
    if (/[a-z]/i.test(s)) return "en";
    return "en";
  }

  // no markdown, no links
  function sanitizeReply(s){
    let out = String(s || "");
    if (CFG.noLinksInReply){
      out = out.replace(/\bhttps?:\/\/\S+/gi,"")
               .replace(/\bwww\.\S+/gi,"");
    }
    if (CFG.noMarkdownReply){
      out = out
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
        .replace(/[*_`~>]+/g,"");
    }
    return out.trim();
  }

  /* ====== STORAGE KEYS ====== */
  const K = {
    sess:  "MotoAI_v39_session",
    ctx:   "MotoAI_v39_ctx",
    learn: "MotoAI_v39_learn",
    autoprices: "MotoAI_v39_auto_prices"
  };

  function getSess(){
    const arr = safe(localStorage.getItem(K.sess)) || [];
    return Array.isArray(arr) ? arr : [];
  }
  function saveSess(a){
    try { localStorage.setItem(K.sess, JSON.stringify(a)); } catch {}
  }

  function getCtx(){
    return safe(localStorage.getItem(K.ctx)) || { turns: [] };
  }
  function pushCtx(delta){
    try{
      const ctx = getCtx();
      ctx.turns.push(Object.assign({ t: Date.now() }, delta || {}));
      ctx.turns = ctx.turns.slice(-clamp(CFG.maxContextTurns || 5,3,8));
      localStorage.setItem(K.ctx, JSON.stringify(ctx));
    }catch{}
  }

  function loadLearn(){
    return safe(localStorage.getItem(K.learn)) || { pages: [] };
  }
  function saveLearn(o){
    try { localStorage.setItem(K.learn, JSON.stringify(o)); } catch {}
  }

  /* ====== PRICE & NLP ====== */
  const TYPE_MAP = [
    // models
    {k:'air blade', re:/\bair\s*blade\b|airblade|\bab\b/i,    canon:'air blade'},
    {k:'vision',    re:/\bvision\b/i,                         canon:'vision'},
    {k:'wave',      re:/\bwave\b/i,                           canon:'wave'},
    {k:'sirius',    re:/\bsirius\b/i,                         canon:'sirius'},
    {k:'blade',     re:/\bblade\b/i,                          canon:'blade'},
    {k:'jupiter',   re:/\bjupiter\b/i,                        canon:'jupiter'},
    {k:'lead',      re:/\blead\b/i,                           canon:'lead'},
    {k:'liberty',   re:/\bliberty\b/i,                        canon:'liberty'},
    {k:'vespa',     re:/\bvespa\b/i,                          canon:'vespa'},
    {k:'grande',    re:/\bgrande\b/i,                         canon:'grande'},
    {k:'janus',     re:/\bjanus\b/i,                          canon:'janus'},
    {k:'sh',        re:/\bsh\b/i,                             canon:'sh'},

    // families
    {k:'xe côn tay',re:/côn\s*tay|tay\s*côn|exciter|winner|raider|cb150|cbf190|w175|msx|manual clutch/i, canon:'xe côn tay'},
    {k:'50cc',      re:/\b50\s*cc\b|\b50cc\b/i,               canon:'50cc'},
    {k:'xe điện',   re:/xe\s*điện|vinfast|yadea|dibao|gogo|klara|electric\s+(bike|scooter|motorbike)/i, canon:'xe điện'},
    {k:'xe ga',     re:/\bxe\s*ga\b|\bscooter\b/i,            canon:'xe ga'},
    {k:'xe số',     re:/\bxe\s*số\b|semi-automatic|gear\s*(bike|motorbike)/i, canon:'xe số'}
  ];

  function detectType(t){
    const raw = String(t || "");
    for (const it of TYPE_MAP){
      if (it.re.test(raw)) return it.canon;
    }
    return null;
  }

  /* ====== DATE RANGE & QTY DETECT ====== */

  function yearFromStr(y){
    const n = parseInt(y,10);
    if (!n) return new Date().getFullYear();
    if (n < 100) return 2000 + n;
    return n;
  }

  function parseDateRange(s){
    if (!s) return null;
    const text = String(s);
    // pattern: 10/2 - 25/2 or 10/02/2025 to 25/02/2025 (VN style)
    const m = text.match(/(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\D+(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?/);
    if (!m) return null;
    const d1 = parseInt(m[1],10), mo1 = parseInt(m[2],10)-1;
    const y1 = yearFromStr(m[3] || "");
    const d2 = parseInt(m[4],10), mo2 = parseInt(m[5],10)-1;
    const y2 = yearFromStr(m[6] || m[3] || "");
    const start = new Date(y1, mo1, d1);
    const end   = new Date(y2, mo2, d2);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
    const diffDays = Math.round((end - start)/(1000*60*60*24));
    if (diffDays <= 0) return null;
    return {
      n: diffDays,
      unit: "day",
      range: true,
      startISO: start.toISOString().slice(0,10),
      endISO:   end.toISOString().slice(0,10)
    };
  }

  function detectQty(t){
    const s = String(t || "");
    const range = parseDateRange(s);
    if (range) return range;

    const m = s.match(/(\d+)\s*(ngày|day|days|tuần|tuan|week|weeks|tháng|thang|month|months)?/i);
    if (!m) return null;
    const n = parseInt(m[1],10);
    if (!n) return null;
    let unit = "day";
    if (m[2]){
      if (/tuần|tuan|week/i.test(m[2])) unit = "week";
      else if (/tháng|thang|month/i.test(m[2])) unit = "month";
      else unit = "day";
    }
    return { n, unit };
  }

  function detectIntent(t){
    return {
      needPrice:   /(giá|bao nhiêu|thuê|tính tiền|cost|price|rent|how much)/i.test(t),
      needDocs:    /(thủ tục|giấy tờ|cccd|passport|hộ chiếu|document|paperwork|id card|license)/i.test(t),
      needContact: /(liên hệ|zalo|gọi|hotline|sđt|sdt|phone|call|whatsapp|contact)/i.test(t),
      needDelivery:/(giao|ship|tận nơi|đưa xe|mang xe|delivery|deliver|drop off|pickup)/i.test(t),
      needReturn:  /(trả xe|gia hạn|đổi xe|kết thúc thuê|return|extend|extension|buy back)/i.test(t),
      needPolicy:  /(điều kiện|chính sách|bảo hiểm|hư hỏng|sự cố|đặt cọc|cọc|deposit|insurance|damage)/i.test(t)
    };
  }

  function detectProfile(t){
    const s = String(t || "").toLowerCase();
    if (/(tourist|travel|holiday|backpacker|ha giang|ninh binh|sapa|old quarter)/i.test(s) ||
        /du lịch|khách du lịch|phượt/.test(s)) {
      return "tourist";
    }
    if (/(work permit|teacher|teaching|long term|long-term|6 months|one year|apartment|living in hanoi|expat|resident)/i.test(s) ||
        /(sống ở|ở hà nội|làm việc tại|định cư)/.test(s)) {
      return "expat";
    }
    if (/(mua xe|sang tên|đứng tên|cavet|giấy tờ xe|biển hà nội)/.test(s)) {
      return "local";
    }
    return "general";
  }

  const PRICE_TABLE = {
    'xe số':      { day:[150000],          week:[600000,700000],     month:[850000,1200000] },
    'xe ga':      { day:[150000,200000],   week:[600000,1000000],    month:[1100000,2000000] },
    'air blade':  { day:[200000],          week:[800000],            month:[1600000,1800000] },
    'vision':     { day:[200000],          week:[700000,850000],     month:[1400000,1900000] },
    'xe điện':    { day:[170000],          week:[800000],            month:[1600000] },
    '50cc':       { day:[200000],          week:[800000],            month:[1700000] },
    'xe côn tay': { day:[300000],          week:[1200000],           month:null }
  };
  PRICE_TABLE['wave']   = PRICE_TABLE['wave']   || { day:[150000], week:[600000,700000], month:[850000,1200000] };
  PRICE_TABLE['sirius'] = PRICE_TABLE['sirius'] || { day:[150000], week:[600000,700000], month:[850000,1200000] };
  PRICE_TABLE['blade']  = PRICE_TABLE['blade']  || { day:[150000], week:[600000,700000], month:[850000,1200000] };
  PRICE_TABLE['jupiter']= PRICE_TABLE['jupiter']|| { day:[150000], week:[600000,700000], month:[850000,1200000] };
  PRICE_TABLE['lead']   = PRICE_TABLE['lead']   || { day:[200000], week:[800000],        month:[1600000,1900000] };
  PRICE_TABLE['liberty']= PRICE_TABLE['liberty']|| { day:[220000], week:[900000],        month:[1700000,2000000] };
  PRICE_TABLE['vespa']  = PRICE_TABLE['vespa']  || { day:[300000], week:[1200000],       month:[2400000,2800000] };
  PRICE_TABLE['grande'] = PRICE_TABLE['grande'] || { day:[220000], week:[900000],        month:[1700000,2000000] };
  PRICE_TABLE['janus']  = PRICE_TABLE['janus']  || { day:[200000], week:[800000],        month:[1500000,1900000] };
  PRICE_TABLE['sh']     = PRICE_TABLE['sh']     || { day:[450000], week:[1800000],       month:[4500000] };

  function modelFamily(model){
    switch((model || "").toLowerCase()){
      case 'vision':
      case 'air blade':
      case 'lead':
      case 'liberty':
      case 'vespa':
      case 'grande':
      case 'janus':
      case 'sh':
        return 'xe ga';
      case 'wave':
      case 'sirius':
      case 'blade':
      case 'jupiter':
      case 'future':
      case 'dream':
        return 'xe số';
      default:
        return null;
    }
  }

  function baseForModel(model, unitKey){
    if (!model) return null;
    const entry = PRICE_TABLE[model];
    const key = unitKey || "day";
    if (entry && entry[key]){
      const arr = Array.isArray(entry[key]) ? entry[key] : [entry[key]];
      return arr[0];
    }
    const fam = modelFamily(model);
    if (fam && PRICE_TABLE[fam] && PRICE_TABLE[fam][key]){
      const arr = Array.isArray(PRICE_TABLE[fam][key]) ? PRICE_TABLE[fam][key] : [PRICE_TABLE[fam][key]];
      return arr[0];
    }
    return null;
  }

  /* ====== SIMPLE BM25 on current page text ====== */
  function tk(s){
    return (s || "")
      .toLowerCase()
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}\s]+/gu," ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function buildDocFromPage(){
    const learn = loadLearn();
    if (learn.pages && learn.pages.length){
      return learn.pages[0];
    }
    const text = document.body ? document.body.innerText || "" : "";
    const trimmed = text.replace(/\s+/g," ").trim().slice(0, 4000);
    const doc = { title: document.title || "", text: trimmed };
    saveLearn({ pages: [doc] });
    return doc;
  }

  function bestSentences(text, query, k){
    const normalized = String(text || "").replace(/\s+/g," ");
    const sents = (normalized.match(/[^.!?]+[.!?]/g) || []).slice(0, 50);
    if (!sents.length) return [];
    const qToks = new Set(tk(query));
    const scored = sents.map(s => {
      const toks = tk(s);
      let hit = 0;
      qToks.forEach(t => { if (toks.includes(t)) hit++; });
      const lenp = Math.max(0.4, 12 / Math.max(12, toks.length || 1));
      return { s: s.trim(), score: hit * lenp };
    }).filter(x => x.score > 0);
    scored.sort((a,b) => b.score - a.score);
    return scored.slice(0, k || 2).map(x => x.s);
  }

  /* ====== UI (UPGRADED) ====== */
  const CSS = `
  :root{
    --mta-z:2147483647;
    --m-blue:${CFG.themeColor};
    --m-bg:#fff;
    --m-text:#0b1220;
    --m-in-h:34px;
    --m-in-fs:15px;
    --m-send-size:36px;
  }
  #mta-root{
    position:fixed;
    left:16px;
    bottom:calc(16px + env(safe-area-inset-bottom,0));
    z-index:var(--mta-z);
    font-family:-apple-system,system-ui,Segoe UI,Roboto,"Helvetica Neue",Arial,sans-serif;
  }
  #mta-bubble{
    width:56px;height:56px;border:none;border-radius:999px;
    background:radial-gradient(circle at 30% 0,var(--m-blue),#00B2FF);
    display:flex;align-items:center;justify-content:center;cursor:pointer;
    box-shadow:0 12px 32px rgba(0,0,0,.25);color:#fff;font-size:22px;
    position:relative;
    transform-origin:center bottom;
    transition:transform .18s ease, box-shadow .18s ease;
    animation:mta-bounce 3.5s ease-in-out infinite;
  }
  #mta-bubble::after{
    content:"Chat";
    position:absolute;
    right:-6px;
    bottom:3px;
    font-size:10px;
    background:rgba(0,0,0,.72);
    padding:2px 6px;
    border-radius:999px;
    pointer-events:none;
    opacity:.9;
  }
  #mta-bubble:hover{
    transform:translateY(-2px) scale(1.03);
    box-shadow:0 16px 40px rgba(0,0,0,.32);
  }
  @keyframes mta-bounce{
    0%,80%,100%{transform:translateY(0) scale(1)}
    85%{transform:translateY(-3px) scale(1.02)}
    90%{transform:translateY(0) scale(1)}
  }
  #mta-backdrop{
    position:fixed;inset:0;background:rgba(0,0,0,.24);
    opacity:0;pointer-events:none;transition:opacity .18s ease;
  }
  #mta-backdrop.show{opacity:1;pointer-events:auto}

  #mta-card{
    position:fixed;
    left:16px;
    bottom:16px;
    width:min(420px,calc(100% - 24px));
    height:clamp(60vh, 520px, 80vh);
    max-height:740px;
    background:var(--m-bg);color:var(--m-text);
    border-radius:22px;
    box-shadow:0 18px 48px rgba(0,0,0,.34);
    display:flex;flex-direction:column;overflow:hidden;
    transform:translateY(110%) scale(.98);
    opacity:0;
    transition:transform .22s cubic-bezier(.22,1,.36,1),opacity .18s ease;
  }
  #mta-card.open{
    transform:translateY(0) scale(1);
    opacity:1;
  }

  #mta-header{
    background:linear-gradient(130deg,var(--m-blue),#00B2FF);
    color:#fff;
    box-shadow:0 8px 18px rgba(0,0,0,.22);
  }
  #mta-header .bar{
    display:flex;align-items:center;gap:10px;padding:10px 12px 8px;
  }
  #mta-header .avatar{
    width:32px;height:32px;border-radius:50%;
    background:rgba(255,255,255,.25);display:flex;align-items:center;
    justify-content:center;font-size:16px;
  }
  #mta-header .info{display:flex;flex-direction:column}
  #mta-header .name{font-weight:700;font-size:14px;line-height:1.1}
  #mta-header .status-line{
    font-size:11px;opacity:.9;display:flex;align-items:center;gap:6px;
  }
  #mta-header .status-dot{
    width:8px;height:8px;border-radius:50%;background:#3fff6c;
    box-shadow:0 0 0 4px rgba(63,255,108,.35);
  }
  #mta-header .sub{
    font-size:11px;opacity:.82;margin-top:1px;
  }
  #mta-header .actions{
    margin-left:auto;display:flex;gap:6px;align-items:center;
  }
  #mta-header .act{
    width:28px;height:28px;border-radius:999px;background:rgba(255,255,255,.16);
    border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;
    justify-content:center;color:#fff;font-size:13px;text-decoration:none;
    transition:background .15s ease, transform .15s ease;
  }
  #mta-header .act:hover{
    background:rgba(255,255,255,.25);
    transform:translateY(-1px);
  }
  #mta-close{
    background:none;border:none;color:#fff;font-size:20px;cursor:pointer;
    padding:0 2px 0 4px;
  }

  #mta-body{
    flex:1;overflow-y:auto;
    background:linear-gradient(180deg,#E9EEF5 0%, #D7E0EC 40%, #E4EAF3 100%);
    padding:12px 10px 12px;scroll-behavior:smooth;
  }
  #mta-body::-webkit-scrollbar{width:6px}
  #mta-body::-webkit-scrollbar-thumb{
    background:rgba(0,0,0,.15);border-radius:999px;
  }
  .m-msg{
    max-width:78%;margin:6px 0;padding:8px 11px;border-radius:20px;
    line-height:1.45;word-break:break-word;box-shadow:0 1px 3px rgba(0,0,0,.08);
    font-size:14px;
    opacity:0;
    transform:translateY(4px) scale(.98);
    animation:mta-msg-in .18s ease-out forwards;
  }
  .m-msg.bot{
    background:#fff;color:#0d1117;border:1px solid rgba(0,0,0,.03);
    border-bottom-left-radius:4px;
  }
  .m-msg.user{
    background:#0084FF;color:#fff;margin-left:auto;border-bottom-right-radius:4px;
  }
  @keyframes mta-msg-in{
    to{
      opacity:1;
      transform:translateY(0) scale(1);
    }
  }

  #mta-typing{
    display:inline-flex;gap:6px;align-items:center;margin:6px 0 2px;
  }
  #mta-typing .bubble{
    background:#fff;padding:6px 10px;border-radius:999px;font-size:11px;
    display:flex;align-items:center;gap:6px;
    box-shadow:0 4px 10px rgba(0,0,0,.1);
  }
  #mta-typing .dot-wrap{display:flex;gap:3px}
  #mta-typing .dot{
    width:4px;height:4px;border-radius:50%;background:#888;
    animation:mta-typing 1.1s infinite ease-in-out;
  }
  #mta-typing .dot:nth-child(2){animation-delay:.15s}
  #mta-typing .dot:nth-child(3){animation-delay:.3s}
  @keyframes mta-typing{
    0%,100%{transform:translateY(0);opacity:.4}
    50%{transform:translateY(-2px);opacity:1}
  }

  #mta-tags{
    background:#f6f7f9;border-top:1px solid rgba(0,0,0,.05);
    transition:max-height .2s ease,opacity .2s ease;
  }
  #mta-tags.hidden{max-height:0;opacity:0;overflow:hidden}
  #mta-tags .track{
    display:block;white-space:nowrap;overflow-x:auto;padding:7px 10px 8px;
  }
  #mta-tags .track::-webkit-scrollbar{height:4px}
  #mta-tags .track::-webkit-scrollbar-thumb{
    background:rgba(0,0,0,.12);border-radius:999px;
  }
  #mta-tags button{
    display:inline-block;margin-right:8px;background:#fff;border:1px solid rgba(0,0,0,.04);
    border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;
    box-shadow:0 1px 3px rgba(0,0,0,.08);
    transition:background .12s ease, transform .12s ease;
  }
  #mta-tags button:hover{
    background:#edf1f7;
    transform:translateY(-1px);
  }

  #mta-input{
    background:#fff;border-top:1px solid rgba(0,0,0,.05);
    padding:7px 7px;display:flex;gap:8px;align-items:center;
    position:sticky;bottom:0;
  }
  #mta-in{
    flex:1;border:1px solid rgba(0,0,0,.12);
    height:var(--m-in-h);line-height:var(--m-in-h);
    padding:0 14px;border-radius:calc(var(--m-in-h)/2);
    background:#F2F4F7;color:#0b1220;font-size:var(--m-in-fs);
    box-sizing:border-box;-webkit-appearance:none;appearance:none;
    outline:none;
    transition:border-color .12s ease, box-shadow .12s ease, background .12s ease;
    -webkit-text-fill-color:#0b1220;
  }
  #mta-in:focus{
    border-color:var(--m-blue);
    box-shadow:0 0 0 1px rgba(0,132,255,.35);
    background:#fff;
  }
  #mta-in::placeholder{color:rgba(0,0,0,.45)}
  #mta-send{
    width:var(--m-send-size);height:var(--m-send-size);
    border:none;border-radius:50%;
    background:linear-gradient(160deg,#0084FF,#00B2FF);
    color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,132,255,.4);
    font-size:15px;display:flex;align-items:center;justify-content:center;
    transition:transform .12s ease, box-shadow .12s ease, opacity .12s ease;
  }
  #mta-send[disabled]{
    opacity:.4;
    box-shadow:none;
    cursor:default;
  }
  #mta-send:not([disabled]):active{
    transform:scale(.95) translateY(1px);
    box-shadow:0 3px 10px rgba(0,132,255,.35);
  }

  /* FIX: đảm bảo input luôn chữ đen ở light mode, chống override từ CSS ngoài + iOS */
  #mta-root input,
  #mta-root textarea{
    color:#0b1220 !important;
    -webkit-text-fill-color:#0b1220 !important;
    background:#F2F4F7;
  }

  @media(max-width:520px){
    #mta-card{right:8px;left:8px;width:auto;height:70vh}
    #mta-body{padding-bottom:8px}
  }

  @media(prefers-color-scheme:dark){
    :root{--m-bg:#111318;--m-text:#ecf0f5}
    #mta-card{
      box-shadow:0 20px 60px rgba(0,0,0,.7);
    }
    #mta-body{
      background:linear-gradient(180deg,#05060a 0%, #12141a 40%, #151822 100%);
    }
    .m-msg.bot{
      background:#20232b;color:#fff;border:1px solid rgba(255,255,255,.03);
    }
    #mta-input{
      background:#111318;border-top:1px solid rgba(255,255,255,.06);
    }
    #mta-in{
      background:#151822;color:#fff;border:1px solid rgba(255,255,255,.12);
      -webkit-text-fill-color:#fff;
    }
    #mta-in::placeholder{color:rgba(255,255,255,.6)}
    #mta-tags{
      background:#141720;border-top:1px solid rgba(255,255,255,.06);
    }
    #mta-tags button{
      background:#20232b;color:#fff;border:1px solid rgba(255,255,255,.08);
    }
    #mta-typing .bubble{
      background:#20232b;color:#fff;box-shadow:none;
    }
    #mta-root input,
    #mta-root textarea{
      color:#fff !important;
      -webkit-text-fill-color:#fff !important;
      background:#151822;
    }
  }

  /* === FINAL HARD FIX: input luôn nền tối, chữ trắng – chống lỗi iOS 26.1 === */
  #mta-root #mta-in{
    background:#111827 !important;              /* nền xám đậm, nhìn được cả light/dark */
    color:#ffffff !important;                   /* chữ trắng rõ */
    -webkit-text-fill-color:#ffffff !important; /* iOS Safari */
    caret-color:#60a5fa !important;             /* màu con trỏ xanh */
  }
  #mta-root #mta-in::placeholder{
    color:rgba(148,163,184,0.9) !important;         /* placeholder xám */
    -webkit-text-fill-color:rgba(148,163,184,0.9) !important;
  }
  `;

  const HTML = `
  <div id="mta-root" aria-live="polite">
    <button id="mta-bubble" aria-label="Open chat with ${CFG.brand}">💬</button>
    <div id="mta-backdrop"></div>
    <section id="mta-card" role="dialog" aria-label="Chat with ${CFG.brand}" aria-hidden="true">
      <header id="mta-header">
        <div class="bar">
          <div class="avatar">${CFG.avatar || "👩‍💼"}</div>
          <div class="info">
            <div class="name">${CFG.brand} — Hanoi Motorbike Assistant</div>
            <div class="status-line">
              <span class="status-dot"></span>
              <span>Usually replies within a few minutes</span>
            </div>
            <div class="sub">Ask about rental, sale, price, or documents.</div>
          </div>
          <div class="actions">
            ${CFG.phone ? `<a class="act" href="tel:${CFG.phone}" title="Call now">📞</a>` : ""}
            ${CFG.zalo  ? `<a class="act" href="${CFG.zalo}" target="_blank" rel="noopener" title="Chat on Zalo">Z</a>` : ""}
            ${CFG.map   ? `<a class="act q-map" href="${CFG.map}" target="_blank" rel="noopener" title="View on map">📍</a>` : ""}
          </div>
          <button id="mta-close" aria-label="Close">×</button>
        </div>
      </header>
      <main id="mta-body" role="log"></main>
      <div id="mta-tags" role="toolbar" aria-label="Quick suggestions">
        <div class="track" id="mta-tag-track"></div>
      </div>
      <footer id="mta-input">
        <input id="mta-in" placeholder="Message ${CFG.brand} about a motorbike..." autocomplete="off" />
        <button id="mta-send" aria-label="Send message" disabled>➤</button>
      </footer>
    </section>
  </div>`;

  /* ====== DOM ATTACH ====== */
  function injectUI(){
    if (document.getElementById("mta-root")) return;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement("div");
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap.firstElementChild);
  }

  function appendMsg(role, text){
    if (!text) return;
    const body = $("#mta-body"); if (!body) return;
    const el = document.createElement("div");
    el.className = "m-msg " + (role === "user" ? "user" : "bot");
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  function renderSess(lang){
    const body = $("#mta-body"); if (!body) return;
    body.innerHTML = "";
    const arr = getSess();
    if (arr.length){
      arr.forEach(m => appendMsg(m.role, m.text));
    } else {
      const greet = naturalize(
        lang === "vi"
          ? `Xin chào, mình là trợ lý của ${CFG.brand}. Bạn đang muốn thuê xe ga, xe số hay mua xe máy cũ tại Hà Nội?`
          : `Hello, I am the assistant of ${CFG.brand}. Are you looking to rent a scooter, semi-automatic bike, or buy a used motorbike in Hanoi?`
      );
      appendMsg("bot", greet);
      saveSess([{ role: "bot", text: greet, t: Date.now() }]);
    }
    body.scrollTop = body.scrollHeight;

    // Welcome quick scenarios
    setTagsFor({ mode:"welcome", lang });
  }

  function addHistory(role, text){
    if (!text) return;
    const arr = getSess();
    arr.push({ role, text, t: Date.now() });
    const trimmed = arr.slice(-10);
    saveSess(trimmed);
  }

  /* ====== STATIC QA (EN + VI) ====== */

  const STATIC_QA = [
    {
      key: /(document|paperwork|passport|id|license|giấy tờ|thủ tục)/i,
      ans: (lang)=> lang === "vi"
        ? "Thuê xe máy thường cần hộ chiếu hoặc CCCD/CMND gốc và một khoản đặt cọc nhỏ tuỳ loại xe. Nếu bạn mua xe, mình sẽ chuẩn bị cà vẹt (cavet) và giấy tờ sang tên đầy đủ."
        : "For motorbike rental in Hanoi, we usually need your original passport or ID card and a small refundable deposit depending on the model. If you buy a bike, we provide the Blue Card and full paperwork for transfer."
    },
    {
      key: /(deposit|cọc|insurance|hư hỏng|damage)/i,
      ans: (lang)=> lang === "vi"
        ? "Tiền cọc tuỳ theo dòng xe và thời gian thuê. Với xe ga phổ biến, cọc thường khoảng một đến vài triệu hoặc giữ hộ chiếu/CCCD. Bảo dưỡng cơ bản đã gồm trong giá; nếu có hư hỏng lớn hay tai nạn thì sẽ trao đổi rõ với bạn trước khi tính thêm."
        : "Deposit depends on the motorbike model and rental period. For normal scooters, deposit is usually around one or two million VND or your passport. Basic maintenance is included; large damages or accidents are handled case by case."
    },
    {
      key: /(delivery|pickup|giao|ship|tận nơi)/i,
      ans: (lang)=> lang === "vi"
        ? "Mình có thể giao hoặc nhận xe trong khu vực trung tâm Hà Nội (Hoàn Kiếm, Long Biên, Tây Hồ...) trong giờ làm việc. Phí giao nhận tuỳ khoảng cách và thời gian; bạn có thể gửi vị trí cụ thể qua Zalo hoặc WhatsApp để mình báo chi tiết."
        : "We can usually deliver or collect the motorbike around central Hanoi (Old Quarter, Long Bien, Tay Ho) during working hours. Delivery fee depends on distance and time; you can send us your exact location on Zalo or WhatsApp."
    },
    {
      key: /(open|opening|hours|time|when.*open|mấy giờ|giờ mở cửa)/i,
      ans: (lang)=> lang === "vi"
        ? "Giờ mở cửa thông thường là 09:00 – 21:00 mỗi ngày. Nếu bạn đến sớm hơn hoặc muộn hơn, hãy báo trước qua điện thoại hoặc Zalo để mình sắp xếp."
        : "Our typical opening hours are 09:00 – 21:00 every day. If you arrive earlier or later, please contact us in advance via phone or Zalo to arrange."
    }
  ];

  function quickContactAnswer(q, lang, intents){
    const phone = CFG.phone || "0812050090";

    if (intents.needContact){
      return lang === "vi"
        ? `Bạn có thể liên hệ trực tiếp qua số điện thoại ${phone}. Mình cũng hỗ trợ chat qua Zalo và WhatsApp trong khung giờ 09:00 – 21:00.`
        : `You can contact us directly by phone at ${phone}. We also support chat via Zalo and WhatsApp during 09:00 – 21:00.`;
    }
    if (/zalo/i.test(q)){
      return lang === "vi"
        ? `Trên Zalo, bạn chỉ cần tìm số ${phone} hoặc dùng link Zalo trên website. Thường mình trả lời rất nhanh trong khung giờ 09:00 – 21:00.`
        : `For Zalo, please search our number ${phone} or use our Zalo chat link on the website. We usually reply quickly between 09:00 and 21:00.`;
    }
    if (/whatsapp|what.?sapp/i.test(q)){
      const wa = "WhatsApp (+" + phone.replace(/^0/,"84") + ")";
      return lang === "vi"
        ? `Mình cũng có hỗ trợ WhatsApp với số ${wa}. Bạn có thể nhắn trước ngày giờ, khu vực ở Hà Nội và loại xe muốn thuê.`
        : `Yes, we also support WhatsApp. You can message us using the same phone number in international format ${wa}. Please share your dates, area in Hanoi and bike type.`;
    }
    if (/map|address|địa chỉ|where.*shop/i.test(q)){
      return lang === "vi"
        ? "Cửa hàng ở Long Biên, Hà Nội, gần trung tâm và cầu Chương Dương / Long Biên. Nếu bạn gửi vị trí hiện tại, mình có thể hướng dẫn đường hoặc sắp xếp giao xe."
        : "Our shop is in Long Biên, Hanoi, close to the center and the Old Quarter. If you send us your current location, we can guide you or arrange delivery.";
    }
    return null;
  }

  function formatDateVN(iso){
    if (!iso) return "";
    const [y,m,d] = iso.split("-");
    return `${d}/${m}`;
  }
  function formatDateEN(iso){
    if (!iso) return "";
    const [y,m,d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function priceAnswer(q, lang, intents){
    if (!intents.needPrice) return null;

    const type = detectType(q) || "xe ga";
    const qty  = detectQty(q) || { n: 1, unit: "day" };

    const unitKey = qty.unit === "week" ? "week" : (qty.unit === "month" ? "month" : "day");

    let model = null;
    for (const it of TYPE_MAP){
      if (it.re.test(q) && it.canon && !/xe\s+ga|xe\s+số|xe điện|xe côn tay/i.test(it.canon)){
        model = it.canon;
        break;
      }
    }

    let base = model ? baseForModel(model, unitKey) : null;
    if (!base){
      const fam = modelFamily(type) || type;
      const table = PRICE_TABLE[fam] || PRICE_TABLE["xe ga"];
      const arr = table && table[unitKey] ? (Array.isArray(table[unitKey]) ? table[unitKey] : [table[unitKey]]) : null;
      base = arr ? arr[0] : null;
    }

    if (!base){
      return lang === "vi"
        ? "Giá thuê phụ thuộc vào loại xe và thời gian thuê. Bạn cho mình biết muốn thuê xe gì và khoảng bao nhiêu ngày để mình ước lượng giúp nhé."
        : "Rental price depends on the motorbike model and duration. Please tell me what type of bike you want and for roughly how many days so I can estimate.";
    }

    let min = base;
    let max = Math.round(base * 1.2);
    if (qty.unit === "week"){
      min = base;
      max = Math.round(base * 1.25);
    } else if (qty.unit === "month"){
      min = base;
      max = Math.round(base * 1.3);
    }

    const labelUnit = qty.unit === "week"
      ? (lang === "vi" ? "tuần" : "week")
      : (qty.unit === "month" ? (lang === "vi" ? "tháng" : "month") : (lang === "vi" ? "ngày" : "day"));

    const modelLabel = model
      || (type === "xe ga"
          ? (lang === "vi" ? "xe ga (scooter)" : "scooter")
          : (type === "xe số"
              ? (lang === "vi" ? "xe số (semi-automatic)" : "semi-automatic bike")
              : (lang === "vi" ? "xe máy" : "motorbike")));

    let text;
    if (lang === "vi"){
      text = "Với " + modelLabel + " thuê tại Hà Nội";
      if (qty.n && qty.n > 0){
        text += " khoảng " + qty.n + " " + labelUnit + (qty.n > 1 ? "" : "");
      }
      if (qty.range && qty.startISO && qty.endISO){
        text += " (từ " + formatDateVN(qty.startISO) + " đến " + formatDateVN(qty.endISO) + ")";
      }
      text += ", giá thường rơi vào khoảng " + nfVND(min) + " – " + nfVND(max) + " VND";
      if (qty.unit === "month"){
        text += " mỗi tháng";
      } else if (qty.unit === "week"){
        text += " mỗi tuần";
      } else {
        text += " mỗi ngày";
      }
      text += ". Giá cụ thể còn tuỳ tình trạng xe và thời điểm.";
      // follow-up hỏi thêm cho rõ
      text += " Bạn có thể cho mình biết khu vực bạn ở (Hoàn Kiếm, Tây Hồ, Long Biên...) và thời gian chính xác muốn thuê không để mình tư vấn kỹ hơn?";
    } else {
      text = "For a " + modelLabel + " rental in Hanoi";
      if (qty.n && qty.n > 0){
        text += " for about " + qty.n + " " + labelUnit + (qty.n > 1 ? "s" : "");
      }
      if (qty.range && qty.startISO && qty.endISO){
        text += " (from " + formatDateEN(qty.startISO) + " to " + formatDateEN(qty.endISO) + ")";
      }
      text += ", the typical price is around " + nfVND(min) + " – " + nfVND(max) + " VND";
      if (qty.unit === "month"){
        text += " per month";
      } else if (qty.unit === "week"){
        text += " per week";
      } else {
        text += " per day";
      }
      text += ". Exact price also depends on bike condition and current stock.";
      text += " Please also tell me your area in Hanoi (Old Quarter, Tay Ho, Long Bien...) and exact dates so I can suggest a more accurate option.";
    }

    return text;
  }

  function faqAnswer(q, lang, intents){
    for (const item of STATIC_QA){
      if (item.key.test(q)) return item.ans(lang);
    }
    return null;
  }

  function extractiveAnswer(q){
    if (!CFG.smart.extractiveQA) return null;
    const doc = buildDocFromPage();
    if (!doc || !doc.text) return null;
    const sents = bestSentences(doc.text, q, 2);
    if (!sents.length) return null;
    return sents.join(" ");
  }

  function fallbackAnswer(q, lang, profile){
    if (lang === "vi"){
      if (profile === "tourist"){
        return "Mình cung cấp dịch vụ thuê xe máy và bán xe cũ tại Hà Nội. Nhiều khách du lịch chọn xe ga như Honda Vision hoặc Air Blade để đi trong thành phố hoặc đi Ninh Bình, Hà Giang. Giá thuê linh hoạt theo ngày hoặc tuần, có thể giao nhận xe khu vực trung tâm. Bạn cho mình biết lịch trình (ngày đến, ngày đi) và khu vực ở Hà Nội để mình gợi ý loại xe phù hợp nhé.";
      }
      if (profile === "expat"){
        return "Mình có cả thuê xe dài hạn và bán xe cũ cho người đang sinh sống/làm việc tại Hà Nội. Nhiều khách là giáo viên hoặc expat chọn thuê theo tháng hoặc mua xe đứng tên để dùng lâu dài, có hỗ trợ mua lại khi không cần nữa. Bạn cho mình biết bạn muốn thuê hay mua, dự định dùng khoảng bao lâu và khu vực ở (ví dụ Tây Hồ, Long Biên, Hoàn Kiếm) để mình tư vấn gói phù hợp.";
      }
      if (profile === "local"){
        return "Mình chuyên xe máy cũ giấy tờ rõ ràng tại Hà Nội, phù hợp cho bạn mua để đi lâu dài. Hỗ trợ cavet, sang tên, biển Hà Nội hoặc các tỉnh. Bạn cho mình biết ngân sách, loại xe mong muốn (xe số, xe ga, côn tay) và mục đích sử dụng để mình gợi ý vài lựa chọn cụ thể.";
      }
      return "Mình có dịch vụ thuê xe máy và bán xe cũ tại Hà Nội. Phổ biến nhất là xe ga (Vision, Air Blade...) và xe số với giá thuê theo ngày, tuần hoặc tháng. Bạn cho mình biết bạn đang quan tâm thuê hay mua, thời gian sử dụng dự kiến và khu vực ở Hà Nội để mình tư vấn rõ hơn.";
    }

    // English
    if (profile === "tourist"){
      return "We provide motorbike rental and used motorbike sale in Hanoi. Most tourists choose scooters like Honda Vision or Air Blade for a few days or weeks to explore the city or trips like Ninh Binh or Ha Giang. Prices are flexible by day or week and we can deliver around central Hanoi. Tell me your travel dates and where you stay so I can suggest a suitable option.";
    }
    if (profile === "expat"){
      return "We offer both long-term rental and used bike sales for people living or working in Hanoi. Many expats and teachers choose monthly rental or buy a used bike with a buy-back option when they leave. Let me know whether you prefer renting or buying, how long you plan to stay, and which area you live in so I can recommend a good setup.";
    }
    if (profile === "local"){
      return "We focus on quality used motorbikes with clear paperwork in Hanoi, suitable if you want to buy a bike to use long term. We can support registration, Blue Card and ownership transfer. Please tell me your budget, preferred type (scooter, semi-automatic, manual clutch) and purpose so I can suggest some specific models.";
    }
    return "We provide motorbike rental and used motorbike sale in Hanoi. Most customers choose scooters like Honda Vision or Air Blade with flexible daily, weekly or monthly prices. You can tell me your dates, area in Hanoi and budget, and I will suggest a suitable option.";
  }

  /* ====== CHAT LOOP ====== */
  const API = {}; // to expose open/close

  function setTyping(on){
    const body = $("#mta-body");
    if (!body) return;
    let node = document.getElementById("mta-typing");
    if (on){
      if (!node){
        node = document.createElement("div");
        node.id = "mta-typing";
        node.innerHTML = `
          <div class="bubble">
            <span>${CFG.brand} is typing</span>
            <div class="dot-wrap">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </div>`;
        body.appendChild(node);
      }
      body.scrollTop = body.scrollHeight;
    }else{
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }
  }

  function buildAnswer(q){
    const text = String(q || "").trim();
    if (!text){
      return {
        answer: "Please type your question about motorbike rental or sale in Hanoi.",
        lang: "en",
        intents: detectIntent(""),
        profile: "general"
      };
    }
    const lang = detectLang(text);
    const intents = detectIntent(text);
    const profile = detectProfile(text);

    let ans =
      quickContactAnswer(text, lang, intents) ||
      priceAnswer(text, lang, intents) ||
      faqAnswer(text, lang, intents) ||
      extractiveAnswer(text) ||
      fallbackAnswer(text, lang, profile);

    return { answer: ans, lang, intents, profile };
  }

  /* ====== QUICK TAGS / FOLLOW-UPS ====== */

  function setTagsHTML(html){
    const track = $("#mta-tag-track");
    const bar = $("#mta-tags");
    if (!track || !bar) return;
    track.innerHTML = html || "";
    if (html && html.trim()){
      bar.classList.remove("hidden");
    } else {
      bar.classList.add("hidden");
    }
  }

  function setTagsFor(meta){
    const lang = (meta && meta.lang) || "en";
    const mode = meta.mode || "answer";
    const intents = meta.intents || {};

    if (mode === "welcome"){
      const html = lang === "vi"
        ? `
          <button data-q="Tôi là khách du lịch cần thuê xe 3–7 ngày.">Tôi là khách du lịch</button>
          <button data-q="Tôi sống và làm việc ở Hà Nội, cần thuê xe theo tháng.">Tôi sống ở Hà Nội</button>
          <button data-q="Tôi muốn mua xe máy cũ giấy tờ đầy đủ tại Hà Nội.">Tôi muốn mua xe cũ</button>
        `
        : `
          <button data-q="I am a tourist and need a motorbike for 3–7 days.">Tourist 3–7 days</button>
          <button data-q="I live and work in Hanoi and need a monthly rental.">Expat / Monthly rental</button>
          <button data-q="I want to buy a used motorbike with full paperwork in Hanoi.">Buy used motorbike</button>
        `;
      setTagsHTML(html);
      return;
    }

    // Answer follow-ups
    if (intents.needPrice){
      const html = lang === "vi"
        ? `
          <button data-q="Thủ tục thuê xe và giấy tờ cần những gì?">Giấy tờ thuê xe</button>
          <button data-q="Tiền cọc và quy định hư hỏng khi thuê xe thế nào?">Tiền cọc & hư hỏng</button>
          <button data-q="Bạn có giao nhận xe tận nơi khu vực phố cổ hoặc Tây Hồ không?">Giao nhận xe tận nơi</button>
        `
        : `
          <button data-q="What documents do I need to rent a motorbike?">Documents</button>
          <button data-q="How much is the deposit and what about damage or insurance?">Deposit & damage</button>
          <button data-q="Can you deliver and collect the bike in Old Quarter or Tay Ho?">Delivery options</button>
        `;
      setTagsHTML(html);
      return;
    }

    if (intents.needDocs){
      const html = lang === "vi"
        ? `
          <button data-q="Giá thuê xe ga theo ngày và theo tháng khoảng bao nhiêu?">Hỏi giá thuê xe</button>
          <button data-q="Tiền cọc thuê xe và trường hợp hư hỏng xử lý sao?">Cọc & hư hỏng</button>
          <button data-q="Bạn có giao nhận xe ở khu vực tôi ở không?">Hỏi giao xe</button>
        `
        : `
          <button data-q="What is the daily and monthly price for scooters?">Prices</button>
          <button data-q="How much do I need to leave as a deposit?">Deposit</button>
          <button data-q="Do you deliver to my area in Hanoi?">Delivery</button>
        `;
      setTagsHTML(html);
      return;
    }

    if (intents.needDelivery){
      const html = lang === "vi"
        ? `
          <button data-q="Giá thuê xe ga theo ngày ở khu vực Hà Nội khoảng bao nhiêu?">Hỏi giá thuê</button>
          <button data-q="Thủ tục thuê xe và giấy tờ cần những gì?">Giấy tờ</button>
          <button data-q="Tiền cọc khi thuê xe ga là bao nhiêu?">Tiền cọc</button>
        `
        : `
          <button data-q="How much is scooter rental per day in Hanoi?">Rental price</button>
          <button data-q="What documents do you need from me?">Documents</button>
          <button data-q="How much deposit is required for scooter rental?">Deposit</button>
        `;
      setTagsHTML(html);
      return;
    }

    // Generic
    const html = lang === "vi"
      ? `
        <button data-q="Giá thuê xe ga theo ngày, tuần và tháng là bao nhiêu?">Giá thuê xe</button>
        <button data-q="Tôi muốn thuê xe theo tháng, có gói dài hạn không?">Thuê theo tháng</button>
        <button data-q="Thủ tục, giấy tờ và tiền cọc thuê xe như thế nào?">Thủ tục & cọc</button>
      `
      : `
        <button data-q="What are your scooter rental prices by day and month?">Prices</button>
        <button data-q="Do you have monthly rental packages for expats?">Monthly rental</button>
        <button data-q="What documents and deposit do you require?">Documents & deposit</button>
      `;
    setTagsHTML(html);
  }

  /* ====== USER INPUT HANDLER ====== */

  async function handleUserInput(raw){
    const q = String(raw || "").trim();
    if (!q) return;

    const cleanUser = q;
    appendMsg("user", cleanUser);
    addHistory("user", cleanUser);
    pushCtx({ role:"user", text: cleanUser });

    setTyping(true);

    if (CFG.autolearn){
      buildDocFromPage();
    }

    await sleep(350 + Math.random()*350);
    const meta = buildAnswer(cleanUser);
    let ans = meta.answer || "";
    ans = sanitizeReply(naturalize(ans));

    setTyping(false);
    appendMsg("bot", ans);
    addHistory("bot", ans);
    pushCtx({ role:"assistant", text: ans });

    // update suggestion tags based on last intent
    setTagsFor({ lang: meta.lang, intents: meta.intents });
  }

  /* ====== WIRING ====== */
  function initEvents(){
    const bubble = $("#mta-bubble");
    const card   = $("#mta-card");
    const close  = $("#mta-close");
    const backdrop = $("#mta-backdrop");
    const input  = $("#mta-in");
    const send   = $("#mta-send");

    if (!bubble || !card || !close || !backdrop || !input || !send) return;

    // === FIX: ép màu chữ input theo theme (chống bị CSS ngoài override) ===
    function applyInputTheme(){
      const inp = document.getElementById("mta-in");
      if (!inp) return;

      const html = document.documentElement;
      const body = document.body;

      const isDark =
        (html && (html.dataset.theme === "dark" || html.classList.contains("dark"))) ||
        (body && (body.dataset.theme === "dark" || body.classList.contains("dark"))) ||
        (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

      if (isDark){
        inp.style.background = "#151822";
        inp.style.color = "#ffffff";
        inp.style.webkitTextFillColor = "#ffffff";
      } else {
        inp.style.background = "#F2F4F7";
        inp.style.color = "#0b1220";
        inp.style.webkitTextFillColor = "#0b1220";
      }
    }

    function openCard(){
      card.classList.add("open");
      card.setAttribute("aria-hidden","false");
      backdrop.classList.add("show");
      setTimeout(()=>{ try{ input.focus(); }catch{} }, 80);
    }
    function closeCard(){
      card.classList.remove("open");
      card.setAttribute("aria-hidden","true");
      backdrop.classList.remove("show");
    }

    API.openCard = openCard;
    API.closeCard = closeCard;

    bubble.addEventListener("click", ()=>{
      const isOpen = card.classList.contains("open");
      if (isOpen) closeCard(); else openCard();
    });
    close.addEventListener("click", closeCard);
    backdrop.addEventListener("click", closeCard);

    input.addEventListener("input", ()=>{
      const v = input.value.trim();
      if (!v) send.setAttribute("disabled","disabled");
      else send.removeAttribute("disabled");
    });

    input.addEventListener("keydown", e=>{
      if (e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return;
        input.value = "";
        send.setAttribute("disabled","disabled");
        handleUserInput(v);
      }
    });

    send.addEventListener("click", ()=>{
      if (send.hasAttribute("disabled")) return;
      const v = input.value.trim();
      if (!v) return;
      input.value = "";
      send.setAttribute("disabled","disabled");
      handleUserInput(v);
    });

    const track = $("#mta-tag-track");
    if (track){
      track.addEventListener("click", e=>{
        const btn = e.target.closest("button[data-q]");
        if (!btn) return;
        const q = btn.getAttribute("data-q") || "";
        if (!q) return;
        handleUserInput(q);
      });
    }

    // Gọi lần đầu
    applyInputTheme();

    // Nếu user đổi system theme (light/dark)
    if (window.matchMedia){
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const h = () => applyInputTheme();
      if (mq.addEventListener) mq.addEventListener("change", h);
      else if (mq.addListener) mq.addListener(h); // iOS cũ
    }

    // Nếu site đang dùng html[data-theme="dark"] hoặc class .dark
    try{
      const mo = new MutationObserver(applyInputTheme);
      mo.observe(document.documentElement, {
        attributes:true,
        attributeFilter:["data-theme","class"]
      });
      if (document.body){
        mo.observe(document.body, {
          attributes:true,
          attributeFilter:["data-theme","class"]
        });
      }
    }catch(e){}
  }

  function boot(){
    injectUI();
    const lang = detectLang(navigator.language || "");
    renderSess(lang);
    initEvents();
    if (CFG.debug){
      console.log("%cMotoAI v39 — Left + EN/VI + follow-ups active","color:"+CFG.themeColor+";font-weight:bold");
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Public API: mở chat từ nút ngoài
  window.MotoAI_open = function(initialText){
    try{
      if (API.openCard) API.openCard();
      if (initialText){
        handleUserInput(initialText);
      }
    }catch(e){}
  };

})();
