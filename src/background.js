import { api } from "./api/client.js";

// 브라우저 알림 표시 함수
async function showBrowserNotification(title, message, type = "info") {
  try {
    console.log("🔔 Attempting to show notification:", { title, message, type });
    
    // 알림 권한 확인
    const permission = await chrome.notifications.getPermissionLevel();
    console.log("🔔 Notification permission level:", permission);
    
    if (permission === "denied") {
      console.warn("⚠️ Notification permission denied");
      return;
    }
    
    // 간단한 PNG 아이콘 사용


    // 알림 옵션 설정 (iconUrl 필수)
    let notificationOptions = {
      type: "basic",
      iconUrl: "notification-icon.png",
      title: title,
      message: message,
      priority: type === "error" ? 2 : 1
    };
    
    console.log("🔔 Creating notification with options:", notificationOptions);
    
    try {
      const notificationId = await chrome.notifications.create(notificationOptions);
      console.log("✅ Notification created successfully with ID:", notificationId);
    } catch (error) {
      console.error("❌ Failed to create notification:", error);
    }
    
    // 알림이 생성되었는지 확인
    setTimeout(async () => {
      try {
        const allNotifications = await chrome.notifications.getAll();
        console.log("🔔 All active notifications:", allNotifications);
      } catch (error) {
        console.error("❌ Error checking notifications:", error);
      }
    }, 1000);
    
  } catch (error) {
    console.error("❌ Error creating notification:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}

// 주기적으로 content script 상태 체크 및 자동 재주입
async function ensureContentScriptLoaded() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "https://leetcode.com/*",
        "https://www.acmicpc.net/*", 
        "https://school.programmers.co.kr/*"
      ]
    });

    for (const tab of tabs) {
      try {
        // content script가 살아있는지 체크
        const response = await chrome.tabs.sendMessage(tab.id, { type: "HEALTH_CHECK" });
        if (!response || !response.alive) {
          throw new Error("Content script not responding");
        }
      } catch (error) {
        // content script가 없거나 응답하지 않으면 재주입
        console.log(`🔄 Reinjecting content script to tab ${tab.id}:`, tab.url);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["src/content.js"]
          });
        } catch (injectError) {
          console.error("Failed to reinject content script:", injectError);
        }
      }
    }
  } catch (error) {
    console.error("Error in ensureContentScriptLoaded:", error);
  }
}

// 30초마다 content script 상태 체크
setInterval(ensureContentScriptLoaded, 30000);

// 탭 업데이트 시에도 체크
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const supportedSites = [
      "https://leetcode.com/",
      "https://www.acmicpc.net/",
      "https://school.programmers.co.kr/"
    ];
    
    if (supportedSites.some(site => tab.url.startsWith(site))) {
      // 1초 후 체크 (페이지 로딩 완료 대기)
      setTimeout(() => ensureContentScriptLoaded(), 1000);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Health check 응답
  if (msg?.type === "HEALTH_CHECK") {
    sendResponse({ alive: true });
    return true;
  }

  // 테스트 알림
  if (msg?.type === "TEST_NOTIFICATION") {
    console.log("🔔 Received test notification request");
    showBrowserNotification(
      "🧪 AlgoStack 테스트 알림",
      "브라우저 알림이 정상적으로 작동합니다!",
      "success"
    );
    sendResponse({ ok: true, message: "Test notification sent" });
    return true;
  }

  if (msg?.type === "GET_CONFIG") {
    api.getConfig().then(cfg => sendResponse({ ok: true, cfg })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "SET_CONFIG") {
    api.setConfig(msg.cfg).then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  // 로그인 상태 동기화 메시지 처리
  if (msg?.type === "SYNC_AUTH_FROM_WEB") {
    const { authData } = msg;
    if (authData) {
      // 웹에서 받은 인증 정보를 확장프로그램 storage에 저장
      chrome.storage.local.set({ algostack_auth: authData }).then(() => {
        sendResponse({ ok: true });
      }).catch(e => {
        sendResponse({ ok: false, error: String(e) });
      });
    } else {
      // 로그아웃 처리
      chrome.storage.local.remove("algostack_auth").then(() => {
        sendResponse({ ok: true });
      }).catch(e => {
        sendResponse({ ok: false, error: String(e) });
      });
    }
    return true;
  }

  if (msg?.type === "CREATE_RECORD") {
    const { id, title, platform, result, url, solvedAt } = msg.payload || {};
    console.log("CREATE_RECORD received:", { id, title, platform, result, url, solvedAt });
    
    // API 호출 및 결과 처리
    api.createAlgorithm({ id, title, platform, result, url, solvedAt })
      .then((success) => {
        console.log("CREATE_RECORD API success:", success);
        if (success === true) {
          console.log("Algorithm record created successfully");
          
          // 브라우저 알림 표시
          showBrowserNotification(
            "✅ 알고리즘 내역 저장됨",
            `${platform} - ${title} (${result === "SUCCESS" ? "성공" : "실패"})`,
            "success"
          );
          
          sendResponse({ ok: true, created: true });
        } else {
          console.error("Algorithm creation returned false");
          
          // 실패 알림 표시
          showBrowserNotification(
            "❌ 알고리즘 내역 저장 실패",
            "서버 오류가 발생했습니다.",
            "error"
          );
          
          sendResponse({ ok: false, error: "Algorithm creation failed" });
        }
      })
      .catch(e => {
        console.error("CREATE_RECORD error details:", {
          message: e.message,
          stack: e.stack,
          name: e.name
        });
        
        // CORS 에러인지 확인
        if (e.message.includes('CORS') || e.message.includes('cors')) {
          console.error("CORS error detected. Check backend CORS configuration.");
        }
        
        // 실패 알림 표시
        showBrowserNotification(
          "❌ 알고리즘 내역 저장 실패",
          e.message.includes('401') ? "로그인이 필요합니다." : "네트워크 오류가 발생했습니다.",
          "error"
        );
        
        sendResponse({ ok: false, error: String(e.message || e) });
      });
    return true;
  }
});


