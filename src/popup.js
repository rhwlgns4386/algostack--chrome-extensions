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

// 주기적으로 로그인 상태 확인 (로그인 화면에서만)
function startAuthStatusPolling() {
  const pollInterval = setInterval(async () => {
    const loginScreen = el('loginScreen');
    if (loginScreen && loginScreen.style.display !== 'none') {
      // 로그인 화면이 보이는 경우에만 상태 확인
      const auth = await storage.get("algostack_auth", null);
      if (auth?.nickname && auth?.expiresAt && auth.expiresAt > Date.now()) {
        // 로그인 상태가 감지되면 메인 화면으로 전환
        clearInterval(pollInterval);
        await initAuthStatus();
      }
    } else {
      // 메인 화면이 보이는 경우 폴링 중단
      clearInterval(pollInterval);
    }
  }, 500); // 500ms마다 확인 - 더 빠른 응답
}

// 팝업이 다시 포커스될 때 로그인 상태 재확인
function checkAuthOnFocus() {
  initAuthStatus();
}

// 팝업 가시성 변화 감지
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // 팝업이 다시 보이게 되면 로그인 상태 확인
    checkAuthOnFocus();
  }
});

// 윈도우 포커스 이벤트
window.addEventListener('focus', checkAuthOnFocus);

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
  // 프론트엔드 로그인 페이지로 리다이렉트
  const frontendUrl = 'http://localhost:3000/login?from=extension';
  chrome.tabs.create({ url: frontendUrl });
}


async function logout() {
  try {
    await api.logout();
    // 로그아웃 후 로그인 화면으로 전환
    showScreen('loginScreen');
    setText("authStatus", "로그아웃되었습니다", "info");
    
    // 웹사이트에 로그아웃 신호 전송 (content script를 통해)
    try {
      const tabs = await chrome.tabs.query({
        url: ["http://localhost:3000/*", "https://your-domain.com/*"]
      });
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: "NOTIFY_WEBSITE_LOGOUT"
        }).catch(() => {
          // content script가 없을 수 있으므로 에러 무시
        });
      }
    } catch (error) {
      console.log("웹사이트 로그아웃 알림 전송 실패:", error);
    }
    
  } catch (e) {
    setText("authStatus", `로그아웃 실패: ${e.message}`, "error");
  }
}

async function openHomepage() {
  try {
    const frontendUrl = 'http://localhost:3000';
    chrome.tabs.create({ url: frontendUrl });
  } catch (error) {
    console.error("❌ Error opening homepage:", error);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  // 로그인 버튼
  el("btnLogin")?.addEventListener("click", login);
  
  // 로그아웃 버튼
  el("btnLogout")?.addEventListener("click", logout);
  
  // 자동 기록 토글
  el("autoRecordToggle")?.addEventListener("change", toggleAutoRecord);
  
  // 홈페이지 열기 버튼
  el("btnOpenHomepage")?.addEventListener("click", openHomepage);
  
  // chrome.storage 변화 감지
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.algostack_auth) {
        // 로그인 상태가 변경되면 UI 업데이트
        initAuthStatus();
      }
    });
  }
  
  // 초기 상태 확인
  initAuthStatus();
  
  // 로그인 상태 폴링 시작
  startAuthStatusPolling();
});


