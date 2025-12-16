import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** ======= 設定（你改這裡） ======= */
const SUPABASE_URL = "https://pbuocwijhjkpgexrnlmp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1aKdi9gDUy9E2SEE9iKDQA_dvczAaia";
const FUNCTION_URL = "https://pbuocwijhjkpgexrnlmp.supabase.co/functions/v1/smooth-worker";
/** ================================= */

// sessionStorage：關分頁就登出
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true },
});

const $ = (id) => document.getElementById(id);

/** ===== Popup API (universal, module-safe) ===== */
const Popup = (() => {
  const mask   = document.getElementById("popupMask");
  const body   = document.getElementById("popupBody");
  const status = document.getElementById("popupStatus");
  const close  = document.getElementById("popupClose");
  const ok     = document.getElementById("popupOk");

  function open(message, { title = "提示", isError = true } = {}) {
    if (!mask || !body || !status) return alert(message);
    status.textContent = title;
    status.style.color = isError ? "#dc2626" : "#16a34a";
    body.textContent = message;
    mask.style.display = "flex";
  }

  function hide() {
    if (mask) mask.style.display = "none";
  }

  close?.addEventListener("click", hide);
  ok?.addEventListener("click", hide);

  return { open, hide };
})();

function setMsg(text = "", isError = true) {
  if (!text) return;
  Popup.open(text, { title: isError ? "錯誤" : "成功", isError });
}
/** ============================================= */

function showApp(ok) {
  $("loginCard")?.classList.toggle("hide", ok);
  $("app")?.classList.toggle("hide", !ok);
  $("btnLogout")?.classList.toggle("hide", !ok);
  $("btnReload")?.classList.toggle("hide", !ok);
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeEmail(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

async function requireAdminSession() {
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) return { ok: false, reason: "尚未登入" };

  // ✅ 記住 admin 自己的 id（等等用來隱藏那筆 row）
  window.__ADMIN_ID__ = user.id;

  // 查自己的 role/email
  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("role,email")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) return { ok: false, reason: "讀取 profiles 失敗：" + pErr.message };

  // ✅ 不顯示 userId（你要隱藏）
  $("meLine").textContent = `登入：${prof?.email || user.email}`;
  $("rolePill").textContent = `admin`;

  if (prof?.role !== "admin") {
    await supabase.auth.signOut();
    return { ok: false, reason: "此帳號不是 admin，已登出" };
  }

  return { ok: true, user };
}

async function loadAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,usdt_amount,btc_amount,eth_amount,ada_amount,usdt_apy,btc_apy,eth_apy,ada_apy,service_auth,created_at,role")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** ✅ 一列的 HTML（會依 service_auth 決定顯示 8 欄 or 顯示提示） */
function buildRowHTML(r) {
  const enabled = !!r.service_auth;

  return `
    <!-- Email -->
    <td>${r.email ?? ""}</td>

    <!-- Service（放在 Email 後面） -->
    <td class="toggle">
      <input type="checkbox" ${enabled ? "checked" : ""} data-k="service_auth" data-act="toggle">
      <span class="muted">${enabled ? "on" : "off"}</span>
    </td>

    ${
      enabled
        ? `
          <td><input type="number" step="0.00000001" value="${r.usdt_amount ?? 0}" data-k="usdt_amount"></td>
          <td><input type="number" step="0.00000001" value="${r.btc_amount  ?? 0}" data-k="btc_amount"></td>
          <td><input type="number" step="0.00000001" value="${r.eth_amount  ?? 0}" data-k="eth_amount"></td>
          <td><input type="number" step="0.00000001" value="${r.ada_amount  ?? 0}" data-k="ada_amount"></td>

          <td><input type="number" step="0.0001" value="${r.usdt_apy ?? 0}" data-k="usdt_apy"></td>
          <td><input type="number" step="0.0001" value="${r.btc_apy  ?? 0}" data-k="btc_apy"></td>
          <td><input type="number" step="0.0001" value="${r.eth_apy  ?? 0}" data-k="eth_apy"></td>
          <td><input type="number" step="0.0001" value="${r.ada_apy  ?? 0}" data-k="ada_apy"></td>
        `
        : `
          <td class="muted" colspan="8">（Service 關閉，未啟用資產數據）</td>
        `
    }

    <!-- Action -->
    <td><button class="btn small" data-act="save">儲存</button></td>
  `;
}

function renderRows(rows) {
  const tbody = $("rows");
  if (!tbody) return;

  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.dataset.id = r.id;
    tr.innerHTML = buildRowHTML(r);
    tbody.appendChild(tr);
  }
}

async function reloadList() {
  let rows = await loadAllProfiles();

  // ✅ 1) 隱藏 admin 自己那筆（用 id 最準）
  const me = window.__ADMIN_ID__;
  if (me) rows = rows.filter(r => r.id !== me);

  // ✅ 2) 也保險：如果 role 欄位有資料，順便把 role=admin 的 row 排除（避免你有多個 admin）
  rows = rows.filter(r => (r.role ?? "").toLowerCase() !== "admin");

  window.__ALL_ROWS__ = rows;
  applyFilter();
}

function applyFilter() {
  const q = normalizeEmail($("q")?.value || "");
  const all = window.__ALL_ROWS__ || [];

  if (!q) return renderRows(all);

  const filtered = all.filter(r => normalizeEmail(r.email).includes(q));
  renderRows(filtered);
}

async function updateRowById(id, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

async function callGenerateRecovery(email) {
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token;
  if (!jwt) throw new Error("沒有 session，請重新登入");

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + jwt,
    },
    body: JSON.stringify({ action: "generate_recovery", email }),
  });

  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}

  if (!res.ok || !data?.ok) throw new Error(data?.error || text || ("HTTP " + res.status));
  return data;
}

/** ===== 初始化：有 session 就自動進後台 ===== */
(async () => {
  const check = await requireAdminSession();
  if (!check.ok) {
    showApp(false);
    if (check.reason !== "尚未登入") setMsg(check.reason, true);
    return;
  }

  showApp(true);
  await reloadList();
  setMsg("已登入（admin），已載入全部會員", false);
})();

/** ===== 登入 / 登出 / 搜尋 ===== */
$("btnLogin")?.addEventListener("click", async () => {
  const email = normalizeEmail($("email")?.value || "");
  const password = $("password")?.value || "";

  if (!email || !password) return setMsg("請輸入 email 與 password", true);

  $("loginMsg").textContent = "登入中…";

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    $("loginMsg").textContent = "";
    return setMsg(error.message, true);
  }

  const check = await requireAdminSession();
  if (!check.ok) {
    $("loginMsg").textContent = "";
    return setMsg(check.reason, true);
  }

  $("loginMsg").textContent = "";
  showApp(true);
  await reloadList();
  setMsg("登入成功（admin），已載入全部會員", false);
});

$("btnLogout")?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showApp(false);
  setMsg("已登出", false);
});

$("btnReload")?.addEventListener("click", async () => {
  await reloadList();
  setMsg("已重新載入", false);
});

$("q")?.addEventListener("input", applyFilter);
$("btnClear")?.addEventListener("click", () => {
  $("q").value = "";
  applyFilter();
});

/** ✅ 勾/取消 Service：立刻展開/收合（不用 reload） */
$("rows")?.addEventListener("change", (e) => {
  const cb = e.target.closest("input[data-act='toggle']");
  if (!cb) return;

  const tr = cb.closest("tr");
  const id = tr?.dataset?.id;
  if (!id) return;

  const all = window.__ALL_ROWS__ || [];
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;

  all[idx].service_auth = cb.checked;
  window.__ALL_ROWS__ = all;

  tr.innerHTML = buildRowHTML(all[idx]);
});

/** ===== 儲存（事件代理） ===== */
$("rows")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act='save']");
  if (!btn) return;

  const tr = btn.closest("tr");
  const id = tr?.dataset?.id;
  if (!id) return;

  btn.disabled = true;

  try {
    const patch = {};

    tr.querySelectorAll("[data-k]").forEach((el) => {
      const k = el.getAttribute("data-k");
      if (!k) return;

      if (el.type === "checkbox") patch[k] = el.checked;
      else patch[k] = toNumber(el.value);
    });

    await updateRowById(id, patch);

    // 更新 label on/off
    const label = tr.querySelector("td.toggle .muted");
    const chk = tr.querySelector("input[type='checkbox'][data-k='service_auth']");
    if (label && chk) label.textContent = chk.checked ? "on" : "off";

    // 更新快取
    const all = window.__ALL_ROWS__ || [];
    const idx = all.findIndex(x => x.id === id);
    if (idx >= 0) all[idx] = { ...all[idx], ...patch };
    window.__ALL_ROWS__ = all;

    setMsg("已儲存", false);
  } catch (err) {
    setMsg("儲存失敗：" + (err?.message || err), true);
  } finally {
    btn.disabled = false;
  }
});

/** ===== 產生 Recovery OTP / Link ===== */
$("btnGen")?.addEventListener("click", async () => {
  const email = normalizeEmail($("targetEmail")?.value || "");
  if (!email) return setMsg("請輸入客戶 email", true);

  $("result").textContent = "處理中…";

  try {
    const data = await callGenerateRecovery(email);

    const otp = data.email_otp;
    const link = data.action_link;

    if (otp) {
      $("result").textContent = `OTP：${otp}`;
      setMsg("已產生 OTP（請人工傳給客戶）", false);
    } else if (link) {
      $("result").textContent = "已產生 recovery link（已輸出到 console）";
      console.log("recovery link:", link);
      setMsg("此版本回傳的是 recovery link（不是 6 碼 OTP）。已輸出到 console。", false);
    } else {
      $("result").textContent = "成功，但沒有回傳 otp/link";
      setMsg("成功但 function 沒回傳 otp/link（請檢查 smooth-worker 回傳格式）", true);
    }
  } catch (err) {
    $("result").textContent = "";
    setMsg("產生失敗：" + (err?.message || err), true);
  }
});
