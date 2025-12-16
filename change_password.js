import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== Popup API (universal) =====
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
// ================================

// Supabase
const SUPABASE_URL = "https://pbuocwijhjkpgexrnlmp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1aKdi9gDUy9E2SEE9iKDQA_dvczAaia";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const resetForm = document.getElementById("resetForm");
const resetEmailEl = document.getElementById("resetEmail");
const resetOtpEl = document.getElementById("resetOtp");
const newPasswordEl = document.getElementById("newPassword");
const confirmPasswordEl = document.getElementById("confirmPassword");

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

function normalizeOtp(v) {
  // 只留數字 + 最多 6 碼（你想保留非數字就刪掉這行）
  return (v ?? "").toString().replace(/\D/g, "").slice(0, 8);
}

if (resetOtpEl) {
  resetOtpEl.addEventListener("input", () => {
    resetOtpEl.value = normalizeOtp(resetOtpEl.value);
  });
}

if (!resetForm) {
  setMsg("找不到 resetForm，請確認表單 id='resetForm'", true);
} else {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      requireEl(resetEmailEl, "#resetEmail");
      requireEl(resetOtpEl, "#resetOtp");
      requireEl(newPasswordEl, "#newPassword");
      requireEl(confirmPasswordEl, "#confirmPassword");

      const email = normalizeEmail(resetEmailEl.value);
      const otp = normalizeOtp(resetOtpEl.value);
      const pw = newPasswordEl.value ?? "";
      const pw2 = confirmPasswordEl.value ?? "";

      if (!email || !otp || !pw || !pw2) return setMsg("請填完整：Email / OTP / 新密碼 / 確認密碼");
      if (pw.length < 6) return setMsg("密碼至少 6 個字元");
      if (pw !== pw2) return setMsg("兩次密碼不一致");

      // 1) verify OTP (recovery)
      setMsg("OTP 驗證中…", false);
      const { error: vErr } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "recovery",
      });
      if (vErr) return setMsg("OTP 驗證失敗：" + vErr.message, true);

      // 2) update password
      setMsg("更新密碼中…", false);
      const { error: uErr } = await supabase.auth.updateUser({ password: pw });
      if (uErr) return setMsg("更新密碼失敗：" + uErr.message, true);

      setMsg("✅ 密碼更新成功，請用新密碼登入。", false);

      // 可選：更新完自動登出（避免 session 留著）
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    }
  });
}
