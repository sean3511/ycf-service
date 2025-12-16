import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** ======= 設定（你改這裡） ======= */
const PROJECT_REF = "pbuocwijhjkpgexrnlmp";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_ANON_KEY = "sb_publishable_1aKdi9gDUy9E2SEE9iKDQA_dvczAaia";
const HOME_URL = "index.html";
/** ================================= */

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** ===== Popup API：永不 alert，缺節點就自動注入 ===== */
const Popup = (() => {
  const TEMPLATE = `
  <div id="popupMask" class="popup-mask" style="display:none">
    <div class="popup" role="dialog" aria-modal="true">
      <div class="popup-head">
        <div class="popup-title"><span id="popupStatus">提示</span></div>
        <button class="popup-close" id="popupClose" aria-label="Close">×</button>
      </div>
      <div class="popup-body" id="popupBody"></div>
      <div class="popup-foot">
        <button class="popup-btn primary" id="popupOk">OK</button>
      </div>
    </div>
  </div>`;

  function ensure() {
    // 如果頁面沒放 popup 組件，這裡自動補上（所以不會再 alert）
    let mask = document.getElementById("popupMask");
    if (!mask) {
      document.body.insertAdjacentHTML("beforeend", TEMPLATE);
    }
    return {
      mask: document.getElementById("popupMask"),
      popup: document.querySelector("#popupMask .popup"),
      body: document.getElementById("popupBody"),
      status: document.getElementById("popupStatus"),
      close: document.getElementById("popupClose"),
      ok: document.getElementById("popupOk"),
    };
  }

  function open(message, { title = "提示", isError = true } = {}) {
    const { mask, body, status } = ensure();
    if (!mask || !body || !status) return; // 理論上不會發生

    status.textContent = title;
    status.style.color = isError ? "#dc2626" : "#16a34a"; // 白底 popup
    body.textContent = message;
    mask.style.display = "flex";
  }

  function hide() {
    const { mask } = ensure();
    if (mask) mask.style.display = "none";
  }

  // ✅ 只要 popup 出現後，點「任意地方」就 redirect（遮罩/卡片/按鈕/叉叉）
  function bindRedirectOnAnyClick(redirectFn) {
    const { mask, popup, close, ok } = ensure();
    if (!mask) return;

    // 避免重複綁定
    if (mask.dataset.redirectBound === "1") return;
    mask.dataset.redirectBound = "1";

    const go = (e) => {
      // 避免多次觸發
      e?.preventDefault?.();
      e?.stopPropagation?.();
      try { hide(); } catch {}
      redirectFn?.();
    };

    // 捕獲階段，避免被其他 handler 擋掉
    mask.addEventListener("click", go, true);
    popup?.addEventListener("click", go, true);
    close?.addEventListener("click", go, true);
    ok?.addEventListener("click", go, true);
  }

  return { open, hide, bindRedirectOnAnyClick };
})();

function setMsg(text = "", isError = true) {
  if (!text) return;
  Popup.open(text, { title: isError ? "錯誤" : "成功", isError });
}

/** ===== helpers ===== */
function stripPercent(v) {
  const s = (v ?? "").toString().trim().replace("%", "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtAmount(n) {
  const num = Number(n);
  const v = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(v);
}

function redirectHomeAfterPopup(msg) {
  // ✅ account.html：只要顯示這種訊息，就「必須走」
  setMsg(msg, true);
  Popup.bindRedirectOnAnyClick(() => location.replace(HOME_URL));
}

function findEmailSpan() {
  return document.querySelector(
    "#container span.bg-gradient-to-r.from-gray-800.to-gray-600.bg-clip-text.text-base.font-semibold.text-transparent"
  );
}

function findAssetCards() {
  const cards = Array.from(document.querySelectorAll("#container .grid > div"));
  const map = new Map();

  for (const card of cards) {
    const h3 = card.querySelector("h3");
    const symbol = (h3?.textContent || "").trim().toUpperCase();
    if (!["USDT", "BTC", "ETH", "ADA"].includes(symbol)) continue;

    const principalP = card.querySelector("p.text-2xl");
    const apySpan = card.querySelector("span.text-lg.font-bold");
    map.set(symbol, { principalP, apySpan });
  }
  return map;
}

function setPrincipal(nodeP, amountNumber, unit) {
  if (!nodeP) return;
  const unitSpan = nodeP.querySelector("span");

  nodeP.textContent = "";
  nodeP.append(document.createTextNode(fmtAmount(amountNumber)));

  if (unitSpan) nodeP.append(unitSpan);
  else {
    const s = document.createElement("span");
    s.className = "ml-1 text-sm font-normal text-gray-400";
    s.textContent = unit;
    nodeP.append(s);
  }
}

function setApy(nodeSpan, apyValue) {
  if (!nodeSpan) return;

  const dot = nodeSpan.querySelector("span"); // 綠點
  const n = stripPercent(apyValue);

  nodeSpan.textContent = "";
  nodeSpan.append(document.createTextNode(`${n}%`)); // ✅ 補回 %
  if (dot) nodeSpan.append(dot);
}

async function loadMyProfile() {
  const { data: sessData, error: sErr } = await supabase.auth.getSession();
  if (sErr) throw sErr;

  const user = sessData?.session?.user;
  if (!user) return { ok: false, reason: "你尚未登入，請先登入後再查看此頁。" };

  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("email,service_auth,usdt_amount,btc_amount,eth_amount,ada_amount,usdt_apy,btc_apy,eth_apy,ada_apy")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) return { ok: false, reason: "讀取 profiles 失敗：" + pErr.message };
  if (!prof) return { ok: false, reason: "找不到你的 profiles 資料，請聯繫管理員。" };

  prof.email = prof.email || user.email || "";
  return { ok: true, profile: prof };
}

async function boot() {
  // ✅ session 掉了：popup + 點哪都回首頁
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) redirectHomeAfterPopup("你已登出或登入已失效，將返回首頁。");
  });

  const res = await loadMyProfile();
  if (!res.ok) return redirectHomeAfterPopup(res.reason);

  const prof = res.profile;

  // ✅ service_auth off：popup + 點哪都回首頁
  if (!prof.service_auth) {
    return redirectHomeAfterPopup("此帳號尚未開通會員服務（service_auth = off）。");
  }

  // 填 email
  const emailSpan = findEmailSpan();
  if (emailSpan) emailSpan.textContent = prof.email;

  // 填四張卡
  const cards = findAssetCards();
  const pairs = [
    ["USDT", prof.usdt_amount, prof.usdt_apy, "USDT"],
    ["BTC",  prof.btc_amount,  prof.btc_apy,  "BTC"],
    ["ETH",  prof.eth_amount,  prof.eth_apy,  "ETH"],
    ["ADA",  prof.ada_amount,  prof.ada_apy,  "ADA"],
  ];

  for (const [sym, amount, apy, unit] of pairs) {
    const ui = cards.get(sym);
    if (!ui) continue;
    setPrincipal(ui.principalP, amount ?? 0, unit);
    setApy(ui.apySpan, apy ?? 0);
  }
}

// ✅ 關鍵：等 DOM 完整後再跑，避免抓不到 popup 節點 → 走到 alert
window.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => {
    console.error(e);
    redirectHomeAfterPopup("系統發生錯誤：" + (e?.message || e));
  });
});
