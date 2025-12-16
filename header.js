import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROJECT_REF = "pbuocwijhjkpgexrnlmp";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_ANON_KEY = "sb_publishable_1aKdi9gDUy9E2SEE9iKDQA_dvczAaia";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 你要導去的帳戶頁（可改）
const ACCOUNT_URL = "member.html";
const LOGIN_URL = "login.html";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

function renderLoggedOut(container) {
  container.innerHTML = "";
  container.appendChild(
    el("a", { class: "btn btn-primary btn-sm", href: LOGIN_URL }, [
      el("span", { class: "icon-Lock-User" }),
      document.createTextNode(" Customer access"),
    ])
  );
}
function renderLoggedIn(container, email) {
  container.innerHTML = "";

  /* Email（小字） */
  const emailEl = document.createElement("p");
  emailEl.textContent = email || "";
  emailEl.style.fontSize = "12px";
  emailEl.style.margin = "0 0 6px 0";
  emailEl.style.opacity = "0.8";
  emailEl.style.whiteSpace = "nowrap";
  emailEl.style.textAlign ="right";

  /* Account manage */
  const accountBtn = document.createElement("a");
  accountBtn.className = "btn btn-primary btn-sm me-2";
  accountBtn.href = "account.html"; // ← 你要的頁
  accountBtn.innerHTML = `Account manage`;

  /* Logout（不是超連結） */
  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "btn btn-primary btn-sm";
  logoutBtn.innerHTML = `Logout`;

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload(); // 回到未登入 header
  });

  container.appendChild(emailEl);
  container.appendChild(accountBtn);
  container.appendChild(logoutBtn);
}


async function bootHeader() {
  const desktop = document.getElementById("headerAuthActions");
  const mobile = document.getElementById("headerAuthActionsMobile"); // 你如果有加就會同步改
  if (!desktop && !mobile) return;

  // ✅ 用 SDK 讀 localStorage 的 session（最可靠）
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error("[getSession] error =", error);

  const user = data?.session?.user;

  if (user) {
    const email = user.email ?? "";
    if (desktop) renderLoggedIn(desktop, email);
    if (mobile) renderLoggedIn(mobile, email);
  } else {
    if (desktop) renderLoggedOut(desktop);
    if (mobile) renderLoggedOut(mobile);
  }

  // ✅ 其他頁面登入/登出時同步（同網域同 storage）
  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    if (u) {
      const email = u.email ?? "";
      if (desktop) renderLoggedIn(desktop, email);
      if (mobile) renderLoggedIn(mobile, email);
    } else {
      if (desktop) renderLoggedOut(desktop);
      if (mobile) renderLoggedOut(mobile);
    }
  });
}

bootHeader();
