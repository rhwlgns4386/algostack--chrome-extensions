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
    
    // 자동 기록 설정 로드
    await initAutoRecordToggle();
  } else {
    // 로그인 안됨 - 로그인 화면 표시
    showScreen('loginScreen');
  }
}

async function initAutoRecordToggle() {
  const autoRecordEnabled = await storage.getAutoRecordSetting();
  const toggle = el('autoRecordToggle');
  if (toggle) {
    toggle.checked = autoRecordEnabled;
  }
}

async function toggleAutoRecord() {
  const toggle = el('autoRecordToggle');
  if (!toggle) return;
  
  const enabled = toggle.checked;
  await storage.setAutoRecordSetting(enabled);
  
  console.log(`🔧 Auto record ${enabled ? 'enabled' : 'disabled'}`);
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


document.addEventListener("DOMContentLoaded", () => {
  // 로그인 버튼
  el("btnLogin")?.addEventListener("click", login);
  
  // 로그아웃 버튼
  el("btnLogout")?.addEventListener("click", logout);
  
  // 자동 기록 토글
  el("autoRecordToggle")?.addEventListener("change", toggleAutoRecord);
  
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


