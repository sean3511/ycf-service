import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://pbuocwijhjkpgexrnlmp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1aKdi9gDUy9E2SEE9iKDQA_dvczAaia";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const msgEl = document.getElementById("authMsg");

const loginEmailEl = document.getElementById("loginEmail");
const loginPasswordEl = document.getElementById("loginPassword");

const signupEmailEl = document.getElementById("signupEmail");
const signupWalletEl = document.getElementById("signupWallet");
const signupPasswordEl = document.getElementById("signupPassword");

const forms = document.querySelectorAll(".forms_form");
const loginForm = forms?.[0] ?? null;
const signupForm = forms?.[1] ?? null;

function setMsg(text = "", isError = true) {
  if (!msgEl) {
    if (text) console[isError ? "error" : "log"]("[AuthMsg]", text);
    return;
  }
  msgEl.textContent = text;
  msgEl.style.color = isError ? "#b00" : "#0a7";
}

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

  // 如果沒有 pending wallet（例如老用戶登入），就不強制覆蓋 wallet
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
    setMsg("");

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

      // ✅ 登入後一定拿得到 user（且 auth.uid() 有值）
      const user = data?.user;
      if (user) {
        try {
          await upsertProfileAfterLogin(user, email);
        } catch (e2) {
          // 如果 profiles 寫入失敗，先把錯誤顯示出來（通常就是 RLS / 欄位 / unique index）
          return setMsg(`登入成功但寫入 profiles 失敗：${e2.message || e2}`, true);
        }
      }

      setMsg("登入成功，跳轉中…", false);
      location.replace("member.html");
    } catch (err) {
      console.error(err);
    }
  });
} else {
  setMsg("找不到 Login form（.forms_form[0]），請確認 HTML 結構", true);
}

// --- Signup ---
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");

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

      // 先把 wallet 暫存（就算 Email Confirm，等登入後也能寫入）
      savePendingProfile(email, wallet_address);

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setMsg(toZhErrorMessage(error), true);

      // 如果你開了 Email Confirm，這裡通常沒有 session → 不能寫 profiles（會被 RLS 擋）
      if (!data?.session) {
        setMsg("註冊成功！請到信箱完成驗證，驗證後再用 Email/密碼登入（會自動寫入 profiles）。", false);
        return;
      }

      // 沒開 Email Confirm：當下就是登入狀態 → 直接寫 profiles
      const user = data?.user;
      if (user) {
        await upsertProfileAfterLogin(user, email);
      }

      setMsg("註冊成功，跳轉中…", false);
      location.replace("member.html");
    } catch (err) {
      console.error(err);
    }
  });
} else {
  setMsg("找不到 Signup form（.forms_form[1]），請確認 HTML 結構", true);
}
