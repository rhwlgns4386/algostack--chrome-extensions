import { api } from "./api/client.js";
import { storage } from "./storage.js";

const el = (id) => document.getElementById(id);

function setText(id, text, cls) {
  const e = el(id);
  if (e) {
    e.textContent = text || "";
    e.className = `status ${cls || ""}`;
    e.style.display = text ? 'block' : 'none';
  }
}

function showScreen(screenId) {
  // 모든 화면 숨기기
  const screens = ['loginScreen', 'mainScreen'];
  screens.forEach(id => {
    const screen = el(id);
    if (screen) screen.style.display = 'none';
  });
  
  // 선택된 화면 보이기
  const targetScreen = el(screenId);
  if (targetScreen) targetScreen.style.display = 'block';
}

async function initAuthStatus() {
  const auth = await storage.get("algostack_auth", null);
  if (auth?.nickname && auth?.expiresAt && auth.expiresAt > Date.now()) {
    // 로그인됨 - 메인 화면 표시
    showScreen('mainScreen');
    const userNameEl = el('userName');
    if (userNameEl) userNameEl.textContent = auth.nickname;
  } else {
    // 로그인 안됨 - 로그인 화면 표시
    showScreen('loginScreen');
  }
}

async function login() {
  setText("authStatus", "로그인 중...", "info");
  try {
    const email = el("email").value.trim();
    const password = el("password").value;
    
    if (!email || !password) {
      setText("authStatus", "이메일과 비밀번호를 입력하세요", "error");
      return;
    }
    
    const data = await api.login({ email, password });
    setText("authStatus", `환영합니다! 🎉`, "success");
    
    // 로그인 성공 후 메인 화면으로 전환
    setTimeout(() => {
      initAuthStatus();
    }, 1500);
  } catch (e) {
    setText("authStatus", `로그인 실패: ${e.message}`, "error");
  }
}

async function signup() {
  setText("authStatus", "회원가입 중...");
  try {
    const email = el("email").value.trim();
    const password = el("password").value;
    const nickName = el("nickName").value.trim();
    await api.signin({ email, password, nickName });
    setText("authStatus", "회원가입 성공. 이제 로그인하세요.", "ok");
  } catch (e) {
    setText("authStatus", `회원가입 실패: ${e.message}`, "err");
  }
}

async function logout() {
  try {
    await api.logout();
    // 로그아웃 후 로그인 화면으로 전환
    showScreen('loginScreen');
    setText("authStatus", "로그아웃되었습니다", "info");
    
    // 입력 필드 초기화
    const emailEl = el("email");
    const passwordEl = el("password");
    if (emailEl) emailEl.value = "";
    if (passwordEl) passwordEl.value = "";
  } catch (e) {
    setText("authStatus", `로그아웃 실패: ${e.message}`, "error");
  }
}

async function sniffProblem() {
  setText("sniffStatus", "추출 중...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "SNIFF_PROBLEM" });
    if (!resp?.ok || !resp?.data) {
      setText("sniffStatus", "지원되지 않는 페이지", "err");
      return;
    }
    const d = resp.data;
    if (d.platform) el("platform").value = d.platform;
    if (d.id) el("pid").value = d.id;
    if (d.title) el("title").value = d.title;
    if (d.url) el("url").value = d.url;
    setText("sniffStatus", "완료", "ok");
  } catch (e) {
    setText("sniffStatus", `실패: ${e.message}`, "err");
  }
}

async function createRecord() {
  setText("createStatus", "생성 중...");
  try {
    const id = Number(el("pid").value);
    const title = el("title").value.trim();
    const platform = el("platform").value;
    const result = el("result").value;
    const url = el("url").value.trim();

    if (!id || !title || !platform || !result || !url) {
      setText("createStatus", "필수값 누락", "err");
      return;
    }

    await api.createAlgorithm({ id, title, platform, result, url });
    setText("createStatus", "생성 성공", "ok");
  } catch (e) {
    setText("createStatus", `실패: ${e.message}`, "err");
  }
}

function renderList(data) {
  const box = el("list");
  if (!data || typeof data !== "object") {
    box.innerHTML = "<div class='muted'>결과 없음</div>";
    return;
  }
  const months = Object.keys(data).sort();
  const html = months.map((m) => {
    const arr = data[m]?.list || [];
    const items = arr.map((it) => {
      return `<div>
        <b>[${it.platform}] #${it.id}</b> ${it.title} - ${it.result}
        <div class="muted"><a href="${it.url}" target="_blank">${it.url}</a></div>
      </div>`;
    }).join("<hr/>");
    return `<div><h4>${m}</h4>${items || "<div class='muted'>없음</div>"}</div>`;
  }).join("<hr/>");
  box.innerHTML = html || "<div class='muted'>결과 없음</div>";
}

async function fetchHistory() {
  const year = el("qYear").value ? Number(el("qYear").value) : undefined;
  const month = el("qMonth").value ? Number(el("qMonth").value) : undefined;
  const day = el("qDay").value ? Number(el("qDay").value) : undefined;
  try {
    const data = await api.getMyAlgorithmHistory({ year, month, day });
    renderList(data);
  } catch (e) {
    el("list").innerHTML = `<div class="err">조회 실패: ${e.message}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // 로그인 버튼
  el("btnLogin")?.addEventListener("click", login);
  
  // 로그아웃 버튼
  el("btnLogout")?.addEventListener("click", logout);
  
  // Enter 키로 로그인
  el("email")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") login();
  });
  el("password")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") login();
  });
  
  // 초기 상태 확인
  initAuthStatus();
});


