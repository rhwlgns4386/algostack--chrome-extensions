import { api } from "./api/client.js";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "GET_CONFIG") {
    api.getConfig().then(cfg => sendResponse({ ok: true, cfg })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "SET_CONFIG") {
    api.setConfig(msg.cfg).then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg?.type === "CREATE_RECORD") {
    const { id, title, platform, result, url } = msg.payload || {};
    console.log("CREATE_RECORD received:", { id, title, platform, result, url });
    
    // API 호출 및 결과 처리
    api.createAlgorithm({ id, title, platform, result, url })
      .then((success) => {
        console.log("CREATE_RECORD API success:", success);
        if (success === true) {
          console.log("Algorithm record created successfully");
          sendResponse({ ok: true, created: true });
        } else {
          console.error("Algorithm creation returned false");
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
        
        sendResponse({ ok: false, error: String(e.message || e) });
      });
    return true;
  }
});


