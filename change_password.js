  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

  const SUPABASE_URL = "https://pbuocwijhjkpgexrnlmp.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_1aKdi9gDUy9E2SEE9iKDQA_dvczAaia";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);
  const msg = $("authMsg");

  function setMsg(text, isError = true) {
    msg.textContent = text;
    msg.style.color = isError ? "#b00" : "#2aa86b";
  }

  $("resetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("Processing...", false);

    const email = $("resetEmail").value.trim().toLowerCase();
    const otp = $("resetOtp").value.trim();
    const pw = $("newPassword").value;
    const pw2 = $("confirmPassword").value;

    if (!email || !otp || !pw || !pw2) {
      setMsg("Please fill in all fields.");
      return;
    }

    if (pw.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    if (pw !== pw2) {
      setMsg("Passwords do not match.");
      return;
    }

    // 1) verify OTP (recovery)
    const { error: vErr } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "recovery",
    });

    if (vErr) {
      setMsg("OTP verification failed: " + vErr.message);
      return;
    }

    // 2) update password
    const { error: uErr } = await supabase.auth.updateUser({ password: pw });

    if (uErr) {
      setMsg("Update password failed: " + uErr.message);
      return;
    }

    setMsg("✅ Password updated successfully. Please log in with new password.", false);

    // 可選：更新完自動登出（避免 session 留著）
    await supabase.auth.signOut();
  });