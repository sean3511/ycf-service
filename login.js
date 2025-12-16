import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== Popup API (universal, module-safe) =====
const Popup = (() => {
  const mask   = document.getElementById("popupMask");
  const body   = document.getElementById("popupBody");
  const status = document.getElementById("popupStatus");
  const close  = document.getElementById("popupClose");
  const ok     = document.getElementById("popupOk");

  function open(message, { title = "提示", isError = true } = {}) {
    if (!mask || !body || !status) return alert(message);
    status.textContent = title;
    status.style.color = isError ? "#ff8aa1" : "#86f7c7";
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
// =============================================

// Supabase
const SUPABASE_URL = "https://pbuocwijhjkpgexrnlmp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1aKdi9gDUy9E2SEE9iKDQA_dvczAaia";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM (authMsg/msgEl 已不需要)
const loginEmailEl = document.getElementById("loginEmail");
const loginPasswordEl = document.getElementById("loginPassword");

const signupEmailEl = document.getElementById("signupEmail");
const signupWalletEl = document.getElementById("signupWallet");
const signupPasswordEl = document.getElementById("signupPassword");

const forms = document.querySelectorAll(".forms_form");
const loginForm = forms?.[0] ?? null;
const signupForm = forms?.[1] ?? null;

function requireEl(el, name) {
  if (!el) {
    setMsg(`找不到 ${name}，請確認 HTML 有加上對應的 id`, true);
    throw new Error(`Missing element: ${name}`);
  }
  return el;
}

function normalizeEmail(v) {
  return (v ?? "").toString().trim().toLowerCase();
}
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validatePassword(password) {
  return typeof password === "string" && password.length >= 6;
}
function normalizeWallet(v) {
  return (v ?? "").toString().trim();
}

function toZhErrorMessage(error) {
  if (!error) return "發生未知錯誤";
  const msg = (error.message || "").toLowerCase();

  if (msg.includes("password should be at least")) return "密碼至少 6 個字元";
  if (msg.includes("invalid login credentials")) return "帳號或密碼錯誤";
  if (msg.includes("email not confirmed")) return "此 Email 尚未完成驗證，請先到信箱點擊驗證連結";
  if (msg.includes("user already registered")) return "此 Email 已註冊，請直接登入";
  if (msg.includes("email address") && msg.includes("invalid")) return "Email 格式不正確";
  if (msg.includes("signup is disabled")) return "目前系統未開放註冊";
  if (msg.includes("too many requests")) return "請求過於頻繁，請稍後再試";

  return error.message || "操作失敗，請稍後再試";
}

// 把「註冊時填的 wallet」暫存，等登入後再寫入 profiles（避免 Email Confirm 時 RLS 擋掉）
function savePendingProfile(email, wallet_address) {
  const key = `pending_profile:${email}`;
  localStorage.setItem(key, JSON.stringify({ email, wallet_address }));
}
function popPendingProfile(email) {
  const key = `pending_profile:${email}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  localStorage.removeItem(key);
  try { return JSON.parse(raw); } catch { return null; }
}

// 登入後寫入 profiles（一定要在有 session 時做，RLS 才會過）
async function upsertProfileAfterLogin(user, emailForLookup) {
  const pending = popPendingProfile(emailForLookup);
  const wallet_address = pending?.wallet_address || null;

  const payload = {
    id: user.id,
    email: user.email ?? emailForLookup,
    ...(wallet_address ? { wallet_address } : {})
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) throw error;
}

// --- Login ---
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      requireEl(loginEmailEl, "#loginEmail");
      requireEl(loginPasswordEl, "#loginPassword");

      const email = normalizeEmail(loginEmailEl.value);
      const password = loginPasswordEl.value ?? "";

      if (!email || !password) return setMsg("請輸入 Email 與 Password");
      if (!validateEmail(email)) return setMsg("Email 格式不正確");
      if (!validatePassword(password)) return setMsg("密碼至少 6 個字元");

      setMsg("登入中…", false);

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMsg(toZhErrorMessage(error), true);

      const user = data?.user;
      if (user) {
        try {
          await upsertProfileAfterLogin(user, email);
        } catch (e2) {
          return setMsg(`登入成功但寫入 profiles 失敗：${e2.message || e2}`, true);
        }
      }

      setMsg("登入成功，跳轉中…", false);
      location.replace("index.html");
    } catch (err) {
      console.error(err);
    }
  });
} else {
  // 若這頁只有 signup 沒有 login，也不要一直跳錯，改成只在 console 提示
  console.warn("找不到 Login form（.forms_form[0]），請確認 HTML 結構");
}

// --- Signup ---
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      requireEl(signupEmailEl, "#signupEmail");
      requireEl(signupWalletEl, "#signupWallet");
      requireEl(signupPasswordEl, "#signupPassword");

      const email = normalizeEmail(signupEmailEl.value);
      const wallet_address = normalizeWallet(signupWalletEl.value);
      const password = signupPasswordEl.value ?? "";

      if (!email || !wallet_address || !password) return setMsg("註冊必填：Email、錢包地址、密碼");
      if (!validateEmail(email)) return setMsg("Email 格式不正確");
      if (!validatePassword(password)) return setMsg("密碼至少 6 個字元");

      setMsg("註冊中…", false);

      savePendingProfile(email, wallet_address);

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setMsg(toZhErrorMessage(error), true);

      if (!data?.session) {
        setMsg("註冊成功！請到信箱完成驗證，驗證後再用 Email/密碼登入（會自動寫入 profiles）。", false);
        return;
      }

      const user = data?.user;
      if (user) {
        await upsertProfileAfterLogin(user, email);
      }

      setMsg("註冊成功，跳轉中…", false);
      location.replace("index.html");
    } catch (err) {
      console.error(err);
    }
  });
} else {
  console.warn("找不到 Signup form（.forms_form[1]），請確認 HTML 結構");
}
