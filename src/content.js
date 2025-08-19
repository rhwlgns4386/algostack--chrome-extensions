(function () {
  console.log("🚀 AlgoStack content.js loaded!");
  
  function sniff() {
    const host = location.hostname;

    if (host.includes("leetcode.com")) {
      let id = null;
      let title = null;

      const nextData = document.querySelector("#__NEXT_DATA__");
      if (nextData?.textContent) {
        try {
          const txt = nextData.textContent;
          const m = txt.match(/"questionId"\s*:\s*"(\d+)"/);
          if (m) id = Number(m[1]);
          const m2 = txt.match(/"questionTitle"\s*:\s*"([^"]+)"/);
          if (m2) title = m2[1];
        } catch {}
      }

      if (!title) {
        const t = document.querySelector('[data-cy="question-title"]');
        if (t) title = t.textContent.trim();
      }

      return {
        platform: "LEETCODE",
        id,
        title,
        url: location.href
      };
    }

    if (host.includes("acmicpc.net")) {
      const m = location.pathname.match(/\/problem\/(\d+)/);
      const id = m ? Number(m[1]) : null;
      const titleEl = document.querySelector("#problem_title") || document.querySelector("title");
      const title = titleEl ? titleEl.textContent.trim() : null;

      return {
        platform: "BOJ",
        id,
        title,
        url: location.href
      };
    }

    if (host.includes("programmers.co.kr")) {
      console.log("🔍 [Programmers] Sniffing on:", location.href);
      console.log("🔍 [Programmers] Pathname:", location.pathname);
      
      const m = location.pathname.match(/\/lessons\/(\d+)/);
      const id = m ? Number(m[1]) : null;
      console.log("🔍 [Programmers] Extracted ID:", id, "from match:", m);
      
      let title = null;
      // 문제 제목 찾기 - 여러 셀렉터 시도
      const titleSelectors = [
        '.lesson-title',
        '.problem-title', 
        '[class*="title"]',
        'h1',
        'h2'
      ];
      
      console.log("🔍 [Programmers] Looking for title with selectors:", titleSelectors);
      
      for (const selector of titleSelectors) {
        const titleEl = document.querySelector(selector);
        console.log(`🔍 [Programmers] Selector ${selector}:`, titleEl ? titleEl.textContent.trim() : 'not found');
        if (titleEl && titleEl.textContent.trim()) {
          title = titleEl.textContent.trim();
          console.log("✅ [Programmers] Found title:", title);
          break;
        }
      }
      
      // 타이틀에서 불필요한 부분 제거
      if (title) {
        const originalTitle = title;
        title = title.replace(/^\d+\.\s*/, ''); // 앞에 숫자. 제거
        title = title.replace(/\s*-\s*프로그래머스$/, ''); // 뒤에 - 프로그래머스 제거
        console.log("🔍 [Programmers] Title cleaned:", originalTitle, "→", title);
      }

      const result = {
        platform: "PROGRAMMERS",
        id,
        title,
        url: location.href
      };
      
      console.log("🔍 [Programmers] Final sniff result:", result);
      return result;
    }

    return null;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "SNIFF_PROBLEM") {
      sendResponse({ ok: true, data: sniff() });
      return true;
    }
  });
  
  // --- Auto-detect and send on submission result ---
  const recentlySent = new Set();
  function makeKey(payload) {
    // BOJ의 경우 더 구체적인 키 생성 (사용자 정보 포함)
    if (payload.platform === "BOJ") {
      return `${payload.platform}|${payload.id}|${payload.result}|${Date.now() - (Date.now() % 60000)}`; // 1분 단위로 그룹핑
    }
    return `${payload.platform}|${payload.id}|${payload.result}`;
  }
  function markSent(payload) {
    const key = makeKey(payload);
    recentlySent.add(key);
    setTimeout(() => recentlySent.delete(key), 15000);
  }
  function alreadySent(payload) {
    return recentlySent.has(makeKey(payload));
  }

  function sendCreate(payload) {
    if (!payload || !payload.id || !payload.title || !payload.platform || !payload.result || !payload.url) {
      return;
    }
    
    if (alreadySent(payload)) {
      return;
    }
    
    // Extension context invalidated 에러 방지
    try {
      if (!chrome.runtime?.id) {
        console.error("❌ Extension context invalidated - please refresh page");
        return;
      }
      
      chrome.runtime.sendMessage({ type: "CREATE_RECORD", payload }, (resp) => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message.includes("Extension context invalidated")) {
            console.error("🔄 Extension reloaded - please refresh page");
          }
          return;
        }
        
        if (resp?.ok && resp?.created === true) {
          markSent(payload);
          console.log("✅ Algorithm record saved");
        } else {
          console.error("❌ Failed to save record:", resp?.error);
        }
      });
    } catch (error) {
      if (error.message.includes("Extension context invalidated")) {
        console.error("🔄 Extension reloaded - please refresh page");
      }
    }
  }

  // LeetCode detector
  function initLeetCodeWatcher() {
    if (!location.hostname.includes("leetcode.com")) return;
    if (!location.pathname.includes("/problems/")) return;
    let awaiting = false;

    function lcInfo() {
      return sniff();
    }

    function parseVerdictFromText(t) {
      const s = (t || "").toLowerCase().trim();
      
      // 빈 문자열이나 너무 긴 텍스트는 무시 (페이지 전체 텍스트 방지)
      if (!s || s.length > 200) {
        return null;
      }
      
      // 정확한 탭 텍스트만 매칭 (LeetCode 탭 이름들)
      const exactSuccessPatterns = [
        "accepted",
        "✓ accepted",
        "accepted ✓"
      ];
      
      const exactFailPatterns = [
        "wrong answer",
        "wrong",
        "time limit exceeded", 
        "time limit",
        "memory limit exceeded",
        "memory limit", 
        "compile error",
        "compilation error",
        "runtime error",
        "presentation error",
        "output limit exceeded",
        "segmentation fault",
        "stack overflow",
        "internal error",
        "judge error",
        "failed"
      ];
      
      // 정확한 성공 패턴 체크
      for (const pattern of exactSuccessPatterns) {
        if (s === pattern || s.startsWith(pattern + " ") || s.endsWith(" " + pattern)) {
          return "SUCCESS";
        }
      }
      
      // 실패 패턴 체크 (더 유연하게)
      for (const pattern of exactFailPatterns) {
        if (s.includes(pattern)) {
          return "FAIL";
        }
      }
      
      // 추가 실패 감지 - 단일 단어들도 체크
      if (s === "wrong" || s === "error" || s === "failed" || s === "timeout") {
        return "FAIL";
      }
      
      return null;
    }

    function scanVerdict() {
      
      // LeetCode 탭 구조 기반 결과 감지
      const candidates = [
        // 결과 탭들 - 가장 정확한 방법
        '[role="tab"]',
        '.ant-tabs-tab',
        '.ant-tabs-tab-btn', 
        'div[role="tabpanel"]',
        // 탭 내용 및 결과 영역
        '[data-e2e-locator="submission-result"]',
        '[data-cy="submission-result"]',
        '[data-testid="submission-result"]',
        // IDE 결과 영역
        '#ide-top-btns',
        '#ide-top-btns *',
        // 실패 결과를 위한 추가 셀렉터
        '.text-red',
        '.text-danger',
        '.text-error',
        '[class*="red"]',
        '[class*="error"]',
        '[class*="fail"]',
        '[class*="wrong"]',
        '[class*="limit"]',
        // 기존 셀렉터들 
        '.submission-result',
        '.submission-status',
        '.ant-message-notice',
        '.feedback__3eUO',
        '.status-column__3SUg',
        '.text-success',
        '.text-green',
        // 클래스 기반 검색 (가장 낮은 우선순위)
        '[class*="accept"]',
        '[class*="success"]'
      ];
      
      for (const sel of candidates) {
        const nodes = document.querySelectorAll(sel);
        
        for (const n of nodes) {
          const text = n.textContent || "";
          const verdict = parseVerdictFromText(text);
          
          // 진행 중인 상태는 무시 (Judging, Debugging 등)
          if (text.toLowerCase().includes("judging") || 
              text.toLowerCase().includes("debugging") || 
              text.toLowerCase().includes("pending")) {
            continue;
          }
          
          if (verdict && awaiting) {
            console.log("🎯 LeetCode verdict:", verdict);
            const info = lcInfo();
            if (info && info.id && info.title) {
              sendCreate({ id: info.id, title: info.title, platform: "LEETCODE", result: verdict, url: info.url });
              awaiting = false;
              return;
            }
          }
        }
      }
    }

    // Watch for submit button clicks to arm the watcher
    const observer = new MutationObserver(() => {
      
      // 실제 LeetCode HTML 기반 submit 버튼 셀렉터 (우선순위 순)
      const submitSelectors = [
        'button[data-e2e-locator="console-submit-button"]',  // 실제 Submit 버튼
        'button[data-cy="submit-code-btn"]',
        'button[data-testid="submit-code-btn"]', 
        'button[class*="submit"]',
        'button[aria-label="Submit"]',
        'button[type="submit"]',
        'button[class*="Submit"]'
      ];
      
      let btn = null;
      for (const selector of submitSelectors) {
        try {
          btn = document.querySelector(selector);
          if (btn) break;
        } catch (e) {
          // 일부 셀렉터는 지원되지 않을 수 있음
        }
      }
      
      // span으로 감싸진 경우 찾기
      if (!btn) {
        const spans = document.querySelectorAll('span[data-cy="submit-code-btn"], span[data-testid="submit-code-btn"], span[data-e2e-locator="console-submit-button"]');
        for (const span of spans) {
          const parentBtn = span.closest('button');
          if (parentBtn) {
            btn = parentBtn;
            break;
          }
        }
      }
      
      // 텍스트로 찾기 (최후 수단)
      if (!btn) {
        const buttons = document.querySelectorAll('button');
        for (const button of buttons) {
          const text = button.textContent?.toLowerCase() || "";
          if (text.includes("submit") && !text.includes("submission")) {
            btn = button;
            break;
          }
        }
      }
      
      if (btn && !btn.__algostack_hooked) {
        btn.__algostack_hooked = true;
        
        const arm = () => {
          console.log("🚨 LeetCode Submit clicked");
          awaiting = true;
          
          setTimeout(() => { 
            if (awaiting) {
              awaiting = false; 
            }
          }, 60000);
        };
        
        btn.addEventListener('click', arm, true);
      }
    });
    
    // 초기 검사도 실행
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // 페이지 로드 후 약간의 지연을 두고 검사
    setTimeout(() => observer.disconnect() || observer.observe(document.documentElement, { childList: true, subtree: true }), 1000);

    const verdictObserver = new MutationObserver(() => {
      if (awaiting) {
        scanVerdict();
      }
    });
    verdictObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  // BOJ detector (submit + status pages with user correlation)
  function initBOJWatcher() {
    if (!location.hostname.includes("acmicpc.net")) return;
    
    console.log("🔍 BOJ watcher started on:", location.pathname);

    const PENDING_KEY = 'algostack_boj_pending';

    function getLoggedInUsername() {
      const a = document.querySelector('.loginbar .username');
      return a ? a.textContent.trim() : null;
    }

    function parseResultText(t) {
      const s = (t || "").trim();
      if (!s) return null;
      if (s.includes("맞았습니다")) return "SUCCESS";
      const failHints = ["틀렸습니다", "시간 초과", "메모리 초과", "컴파일 에러", "출력 형식", "런타임 에러"];
      if (failHints.some(h => s.includes(h))) return "FAIL";
      // 진행중 텍스트는 null 유지
      if (s.includes("채점 준비 중") || s.includes("채점 중")) return null;
      return null;
    }

    function savePending(p) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [PENDING_KEY]: p }, resolve);
      });
    }

    function getPending() {
      return new Promise((resolve) => {
        chrome.storage.local.get([PENDING_KEY], (r) => resolve(r[PENDING_KEY] || null));
      });
    }

    function clearPending() {
      return new Promise((resolve) => {
        chrome.storage.local.remove([PENDING_KEY], resolve);
      });
    }

    // Hook on submit page
    function hookSubmitPage() {
      const m = location.pathname.match(/^\/submit\/(\d+)/);
      if (!m) {
        console.log("🔍 BOJ: Not on submit page");
        return;
      }
      
      console.log("🎯 BOJ submit page detected for problem:", m[1]);
      
      const problemId = Number(m[1]);
      const legend = document.querySelector('form#submit_form legend');
      const title = legend ? legend.textContent.trim() : null;
      const username = getLoggedInUsername();
      const url = new URL(`/problem/${problemId}`, location.origin).toString();

      console.log("📝 BOJ problem info:", { problemId, title, username });

      const form = document.querySelector('#submit_form');
      const btn = document.querySelector('#submit_button');
      
      const handler = () => {
        console.log("🚨 BOJ Submit clicked!");
        const pending = {
          problemId,
          title,
          url,
          username,
          createdAt: Date.now(),
          ttlMs: 5 * 60 * 1000
        };
        console.log("💾 BOJ saving pending:", pending);
        savePending(pending);
      };
      
      if (form && !form.__algostack_hooked) {
        form.__algostack_hooked = true;
        form.addEventListener('submit', handler, true);
        console.log("✅ BOJ form submit listener added");
      }
      if (btn && !btn.__algostack_hooked) {
        btn.__algostack_hooked = true;
        btn.addEventListener('click', handler, true);
        console.log("✅ BOJ button click listener added");
      }
    }

    // Watch status page for the user's latest submission on the pending problem
    function hookStatusPage() {
      if (!location.pathname.startsWith('/status')) {
        console.log("🔍 BOJ: Not on status page");
        return;
      }
      
      console.log("📊 BOJ status page detected");
      
      let isScanning = false; // 중복 스캔 방지 플래그

      function scan() {
        if (isScanning) {
          console.log("⏸️ BOJ: Already scanning, skip");
          return;
        }
        
        isScanning = true;
        getPending().then((pending) => {
          if (!pending) {
            console.log("📋 BOJ: No pending submission found");
            isScanning = false;
            return;
          }
          
          if (pending.createdAt + pending.ttlMs < Date.now()) {
            console.log("⏰ BOJ: Pending submission expired");
            clearPending();
            isScanning = false;
            return;
          }
          

          const table = document.querySelector('#status-table, table.status-table');
          if (!table) {
            isScanning = false;
            return;
          }
          
          const rows = table.querySelectorAll('tbody tr');
          if (!rows || rows.length === 0) {
            isScanning = false;
            return;
          }
          

          // BOJ status는 최신 제출부터 보여주므로 첫 번째 행만 체크하면 됨
          const pendingTime = pending.createdAt;
          
          // 첫 번째 행만 체크
          const firstRow = rows[0];
          const cells = firstRow.querySelectorAll('td');
          
          if (cells.length < 5) {
            isScanning = false;
            return;
          }
          
          // BOJ status table cell 순서: 제출번호, 아이디, 문제, 결과, 메모리, 시간, 언어, 코드길이, 제출시간
          const submitNumCell = cells[0]; // 제출번호
          const userCell = cells[1]; // 아이디 
          const problemCell = cells[2]; // 문제
          const resultCell = cells[3]; // 결과
          const submitTimeCell = cells[8]; // 제출시간

          // 문제 ID 추출
          let pid = null;
          const problemLink = problemCell ? problemCell.querySelector('a[href*="/problem/"]') : null;
          if (problemLink) {
            const href = problemLink.getAttribute('href');
            const idMatch = href ? href.match(/\/problem\/(\d+)/) : null;
            pid = idMatch ? Number(idMatch[1]) : null;
          }
          
          // 문제 ID를 찾지 못한 경우 텍스트에서 숫자 추출
          if (!pid && problemCell) {
            const problemText = problemCell.textContent.trim();
            const numberMatch = problemText.match(/(\d+)/);
            pid = numberMatch ? Number(numberMatch[1]) : null;
          }

          // 사용자명 추출
          let userName = null;
          const userLink = userCell ? userCell.querySelector('a[href^="/user/"]') : null;
          if (userLink) {
            userName = userLink.textContent.trim();
          } else if (userCell) {
            userName = userCell.textContent.trim();
          }
          
          const resultText = resultCell ? resultCell.textContent : "";
          const submitTimeText = submitTimeCell ? submitTimeCell.textContent.trim() : "";
          

          if (pid !== pending.problemId) {
            isScanning = false;
            return;
          }
          
          if (pending.username && userName && pending.username !== userName) {
            isScanning = false;
            return;
          }

          // 제출 시간이 pending 시간보다 이전이면 무시 (기존 제출)
          if (submitTimeText) {
            try {
              // BOJ 시간 형식: "1초 전", "1분 전", "1시간 전", "방금 전", "MM-DD HH:mm" 등
              const now = Date.now();
              let submitTime = null;
              
              if (submitTimeText.includes("방금 전")) {
                submitTime = now; // 방금 전은 현재 시간
              } else if (submitTimeText.includes("초 전")) {
                const seconds = parseInt(submitTimeText.match(/(\d+)초 전/)?.[1] || "0");
                submitTime = now - (seconds * 1000);
              } else if (submitTimeText.includes("분 전")) {
                const minutes = parseInt(submitTimeText.match(/(\d+)분 전/)?.[1] || "0");
                submitTime = now - (minutes * 60 * 1000);
              } else if (submitTimeText.includes("시간 전")) {
                const hours = parseInt(submitTimeText.match(/(\d+)시간 전/)?.[1] || "0");
                submitTime = now - (hours * 60 * 60 * 1000);
              } else if (submitTimeText.includes("일 전")) {
                const days = parseInt(submitTimeText.match(/(\d+)일 전/)?.[1] || "0");
                submitTime = now - (days * 24 * 60 * 60 * 1000);
              } else if (submitTimeText.includes("주 전") || submitTimeText.includes("달 전") || submitTimeText.includes("년 전")) {
                // 오래된 제출들은 확실히 pending 시간보다 이전
                submitTime = 0; // 아주 오래된 시간으로 설정
              }
              
              if (submitTime !== null && submitTime < pendingTime) {
                isScanning = false;
                return;
              }
            } catch (e) {
              // 시간 파싱 실패시 그냥 진행
            }
          }

          
          const verdict = parseResultText(resultText);
          if (!verdict) {
            isScanning = false;
            return;
          }

          console.log("✅ BOJ verdict:", verdict);
          
          // 중복 요청 방지를 위해 observer 정지
          mo.disconnect();
          
          sendCreate({ id: pending.problemId, title: pending.title || String(pending.problemId), platform: "BOJ", result: verdict, url: pending.url });
          clearPending();
          isScanning = false;
          return;
          
          // 스캔 완료 후 플래그 리셋
          isScanning = false;
        });
      }

      const mo = new MutationObserver(() => {
        // 테이블 상태 로깅
        const table = document.querySelector('#status-table, table.status-table');
        if (table) {
          const rows = table.querySelectorAll('tbody tr');
          console.log(`📊 BOJ: Status table updated - ${rows.length} rows found`);
          
          // 첫 번째 행의 상태 간단 로깅
          if (rows.length > 0) {
            const firstRow = rows[0];
            const cells = firstRow.querySelectorAll('td');
            if (cells.length >= 4) {
              const resultText = cells[3]?.textContent?.trim() || '';
              const submitTimeText = cells[8]?.textContent?.trim() || '';
              console.log(`📋 BOJ: Latest row - Result: "${resultText}", Time: "${submitTimeText}"`);
            }
          }
        } else {
          console.log('📊 BOJ: No status table found in DOM update');
        }
        
        scan();
      });
      mo.observe(document.body, { childList: true, subtree: true });
      scan();
    }

    try { hookSubmitPage(); } catch {}
    try { hookStatusPage(); } catch {}
  }

  // Programmers detector
  function initProgrammersWatcher() {
    console.log("🔍 [Programmers] Checking if should init watcher...");
    console.log("🔍 [Programmers] Hostname:", location.hostname);
    console.log("🔍 [Programmers] Pathname:", location.pathname);
    
    if (!location.hostname.includes("programmers.co.kr")) {
      console.log("❌ [Programmers] Not on programmers.co.kr domain");
      return;
    }
    if (!location.pathname.includes("/lessons/")) {
      console.log("❌ [Programmers] Not on lessons page");
      return;
    }
    
    console.log("🚀 [Programmers] Watcher started!");
    
    let awaiting = false;
    let checkInterval = null;
    
    // 탭 상태 모니터링
    function isTabVisible() {
      return !document.hidden;
    }
    
    // 탭 상태 변화 감지
    document.addEventListener('visibilitychange', () => {
      console.log("🔄 [Programmers] Tab visibility changed:", isTabVisible() ? 'visible' : 'hidden');
    });

    function programmersInfo() {
      return sniff();
    }


    function scanForPopupVerdict() {
      if (!awaiting) {
        return; // 로그 줄이기
      }
      
      // 백그라운드 탭에서도 동작하도록 강제
      const tabStatus = document.hidden ? ' (background tab)' : '';
      console.log(`🔍 [Programmers] Scanning for popup verdict${tabStatus}...`);
      
      // 팝업/모달 셀렉터들 (간단하게)
      const popupSelectors = [
        '.modal',
        '.modal-content', 
        '.modal-body',
        '[class*="modal"]',
        '[class*="popup"]',
        '[class*="dialog"]',
        'div[role="dialog"]',
        'div[role="alert"]'
      ];
      
      for (const selector of popupSelectors) {
        const popups = document.querySelectorAll(selector);
        console.log(`🔍 [Programmers] Checking ${selector}: ${popups.length} popups`);
        
        for (const popup of popups) {
          // 팝업이 보이는지 확인 (페이지가 백그라운드에 있어도 관대하게 체크)
          const style = getComputedStyle(popup);
          const isHidden = style.display === 'none' || style.visibility === 'hidden';
          
          // opacity는 체크하지 않음 (애니메이션 중일 수 있음)
          if (isHidden) {
            console.log("⏸️ [Programmers] Popup hidden, skipping");
            continue;
          }
          
          console.log("👀 [Programmers] Found visible popup:", popup.className || popup.tagName);
          
          const popupText = popup.textContent || "";
          console.log(`🔍 [Programmers] Popup text: "${popupText}"`);
          
          // 간단한 정답/오답 판정
          let verdict = null;
          
          if (popupText.includes("정답")) {
            console.log("✅ [Programmers] Found '정답' in popup!");
            verdict = "SUCCESS";
          } else if (popupText.includes("틀렸") || popupText.includes("실패") || popupText.includes("오답")) {
            console.log("❌ [Programmers] Found failure text in popup!");
            verdict = "FAIL";
          }
          
          if (verdict) {
            console.log("🎯 [Programmers] Popup verdict:", verdict);
            const info = programmersInfo();
            console.log("🎯 [Programmers] Problem info:", info);
            
            if (info && info.id && info.title) {
              console.log("✅ [Programmers] Sending record...");
              sendCreate({ 
                id: info.id, 
                title: info.title, 
                platform: "PROGRAMMERS", 
                result: verdict, 
                url: info.url 
              });
              awaiting = false;
              
              // interval 정리
              if (checkInterval) {
                console.log("🛑 [Programmers] Clearing check interval after success");
                clearInterval(checkInterval);
                checkInterval = null;
              }
              return;
            }
          }
        }
      }
      
      console.log("❌ [Programmers] No popup verdict found");
    }

    // 제출 버튼 감지
    const observer = new MutationObserver(() => {
      console.log("🔍 [Programmers] Scanning for submit buttons...");
      
      const submitSelectors = [
        'button[class*="submit"]',
        'button[class*="Submit"]', 
        'button[class*="실행"]',
        'button[class*="채점"]',
        '[class*="submit-btn"]',
        '[class*="run-btn"]'
      ];
      
      console.log("🔍 [Programmers] Using selectors:", submitSelectors);
      
      let btn = null;
      for (const selector of submitSelectors) {
        try {
          btn = document.querySelector(selector);
          console.log(`🔍 [Programmers] Selector ${selector}:`, btn ? "found" : "not found");
          if (btn) break;
        } catch (e) {
          console.log(`❌ [Programmers] Error with selector ${selector}:`, e);
        }
      }
      
      // 텍스트로 찾기
      if (!btn) {
        console.log("🔍 [Programmers] No selector match, scanning all buttons by text...");
        const buttons = document.querySelectorAll('button');
        console.log(`🔍 [Programmers] Found ${buttons.length} total buttons`);
        
        // 모든 버튼 텍스트를 한눈에 보기
        const buttonTexts = Array.from(buttons).map((b, i) => `${i}: "${b.textContent?.trim() || ""}"`);
        console.log(`🔍 [Programmers] All button texts:`, buttonTexts);
        
        for (const button of buttons) {
          const text = button.textContent?.toLowerCase().trim() || "";
          const originalText = button.textContent?.trim() || "";
          
          // 제출 버튼만 찾기 (코드 실행은 제외)
          if (text.includes("제출") && !text.includes("예시")) {
            console.log("✅ [Programmers] Found SUBMIT button by text:", originalText);
            btn = button;
            break;
          }
        }
        
        // 제출 버튼이 없으면 실행 버튼이라도 찾기
        if (!btn) {
          console.log("⚠️ [Programmers] No submit button found, looking for run button...");
          for (const button of buttons) {
            const text = button.textContent?.toLowerCase().trim() || "";
            const originalText = button.textContent?.trim() || "";
            
            if ((text.includes("실행") || text.includes("채점")) && !text.includes("예시")) {
              console.log("⚠️ [Programmers] Found RUN button by text:", originalText);
              btn = button;
              break;
            }
          }
        }
      }
      
      if (btn && !btn.__algostack_hooked) {
        console.log("✅ [Programmers] Hooking submit button:", btn);
        btn.__algostack_hooked = true;
        
        const arm = () => {
          console.log("🚨 [Programmers] Submit clicked!");
          awaiting = true;
          
          // 주기적으로 팝업 체크 시작 (다른 탭에 있어도 동작)
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          
          console.log("🔄 [Programmers] Starting background check interval");
          checkInterval = setInterval(() => {
            if (awaiting) {
              const tabStatus = isTabVisible() ? 'visible' : 'hidden';
              console.log(`🕐 [Programmers] Background check (tab: ${tabStatus})...`);
              
              // 탭 상태와 관계없이 계속 체크
              try {
                scanForPopupVerdict();
              } catch (error) {
                console.error("❌ [Programmers] Error in background check:", error);
              }
            } else {
              console.log("🛑 [Programmers] Stopping background check");
              clearInterval(checkInterval);
              checkInterval = null;
            }
          }, 1500); // 1.5초마다 체크 (더 자주)
          
          // 30초 후 타임아웃
          setTimeout(() => { 
            if (awaiting) {
              console.log("⏰ [Programmers] Timeout - no result detected");
              awaiting = false;
              if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
              }
            }
          }, 30000);
        };
        
        btn.addEventListener('click', arm, true);
      } else if (btn && btn.__algostack_hooked) {
        console.log("⚠️ [Programmers] Button already hooked");
      } else {
        console.log("❌ [Programmers] No submit button found");
      }
    });
    
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const verdictObserver = new MutationObserver(() => {
      if (awaiting) {
        const tabStatus = document.hidden ? ' (background)' : '';
        console.log(`🔍 [Programmers] DOM changed${tabStatus}, checking for popup verdict...`);
        
        // 백그라운드에서도 체크
        try {
          scanForPopupVerdict();
        } catch (error) {
          console.error("❌ [Programmers] Error in DOM observer:", error);
        }
      }
    });
    verdictObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    
    console.log("✅ [Programmers] All observers setup complete!");
  }

  try { 
    initLeetCodeWatcher(); 
  } catch (e) {
    console.error("❌ LeetCode watcher failed:", e);
  }
  
  try { 
    initBOJWatcher(); 
  } catch (e) {
    console.error("❌ BOJ watcher failed:", e);
  }
  
  try { 
    initProgrammersWatcher(); 
  } catch (e) {
    console.error("❌ Programmers watcher failed:", e);
  }
})();