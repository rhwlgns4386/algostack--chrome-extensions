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
  // 먼저 저장된 토큰이 있는지 확인
  const auth = await storage.get("algostack_auth", null);
  
  if (auth?.nickname && auth?.expiresAt) {
    try {
      // 토큰이 있으면 유효성 검사 (자동 갱신 포함)
      const token = await api.getValidAccessToken();
      if (token) {
        // 로그인됨 - 메인 화면 표시
        showScreen('mainScreen');
        const userNameEl = el('userName');
        if (userNameEl) userNameEl.textContent = auth.nickname;
        
        // 자동 기록 설정 로드
        await initAutoRecordToggle();
        return;
      }
    } catch (e) {
      // 토큰 갱신 실패 시 로그인 화면
      console.log('토큰 갱신 실패, 로그인 필요:', e.message);
    }
  }
  
  // 로그인 안됨 - 로그인 화면 표시
  showScreen('loginScreen');
}

// 주기적으로 로그인 상태 확인 (로그인 화면에서만)
function startAuthStatusPolling() {
  const pollInterval = setInterval(async () => {
    const loginScreen = el('loginScreen');
    if (loginScreen && loginScreen.style.display !== 'none') {
      // 로그인 화면이 보이는 경우에만 상태 확인
      try {
        const token = await api.getValidAccessToken();
        if (token) {
          const auth = await storage.get("algostack_auth", null);
          if (auth?.nickname) {
            // 로그인 상태가 감지되면 메인 화면으로 전환
            clearInterval(pollInterval);
            await initAuthStatus();
          }
        }
      } catch (e) {
        // 토큰 갱신 실패 시 계속 폴링
      }
    } else {
      // 메인 화면이 보이는 경우 폴링 중단
      clearInterval(pollInterval);
    }
  }, 2000); // 2초마다 확인 - 부하 감소
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
  try {
    const frontendUrl = 'https://www.algostack.site/login?from=extension';
    
    // 이미 열린 algostack 탭이 있는지 확인
    const tabs = await chrome.tabs.query({
      url: ["https://www.algostack.site/*"]
    });
    
    if (tabs.length > 0) {
      // 기존 탭이 있으면 해당 탭으로 이동하고 URL 변경
      const existingTab = tabs[0];
      await chrome.tabs.update(existingTab.id, { 
        url: frontendUrl,
        active: true 
      });
    } else {
      // 기존 탭이 없으면 새 탭 생성
      chrome.tabs.create({ url: frontendUrl });
    }
  } catch (error) {
    console.error("❌ Error opening login page:", error);
  }
}


async function logout() {
  try {
    const frontendUrl = 'https://www.algostack.site/logout?from=extension';
    
    // 이미 열린 algostack 탭이 있는지 확인
    const tabs = await chrome.tabs.query({
      url: ["https://www.algostack.site/*"]
    });
    
    if (tabs.length > 0) {
      // 기존 탭이 있으면 해당 탭으로 이동하고 URL 변경
      const existingTab = tabs[0];
      await chrome.tabs.update(existingTab.id, { 
        url: frontendUrl,
        active: true 
      });
    } else {
      // 기존 탭이 없으면 새 탭 생성
      chrome.tabs.create({ url: frontendUrl });
    }
  } catch (error) {
    console.error("❌ Error opening logout page:", error);
  }
}

async function openHomepage() {
  try {
    const frontendUrl = 'https://www.algostack.site';
    
    // 이미 열린 algostack 탭이 있는지 확인
    const tabs = await chrome.tabs.query({
      url: ["https://www.algostack.site/*"]
    });
    
    if (tabs.length > 0) {
      // 기존 탭이 있으면 해당 탭으로 이동하고 URL 변경
      const existingTab = tabs[0];
      await chrome.tabs.update(existingTab.id, { 
        url: frontendUrl,
        active: true 
      });
    } else {
      // 기존 탭이 없으면 새 탭 생성
      chrome.tabs.create({ url: frontendUrl });
    }
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


