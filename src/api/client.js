import { storage } from "../storage.js";
import { now, inMs, toQuery } from "../utils.js";

const DEFAULT_CONFIG = {
  baseUrl: "https://www.algostack.site"
};

const KEYS = {
  config: "algostack_config",
  auth: "algostack_auth"
};

async function getConfig() {
  return (await storage.get(KEYS.config, DEFAULT_CONFIG));
}

async function setConfig(cfg) {
  return storage.set(KEYS.config, cfg);
}

async function getAuth() {
  return (await storage.get(KEYS.auth, null));
}

async function setAuth(auth) {
  return storage.set(KEYS.auth, auth);
}

async function clearAuth() {
  return storage.remove(KEYS.auth);
}

function getCookieUrl(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return "https://www.algostack.site/";
  }
}

async function getRefreshTokenCookie(baseUrl) {
  const url = getCookieUrl(baseUrl);
  const cookie = await chrome.cookies.get({ url, name: "refreshToken" });
  return cookie?.value || null;
}

async function refreshAccessToken() {
  const { baseUrl } = await getConfig();
  
  // 리프레시 토큰은 쿠키로만 전송 (헤더 없음)
  const res = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    credentials: "include" // 쿠키만 전송
  });
  if (!res.ok) throw new Error(`REFRESH_FAILED_${res.status}`);
  const data = await res.json();
  const auth = {
    accessToken: data.accessToken,
    nickname: data.nickname,
    expiresAt: now() + inMs(4.5)
  };
  await setAuth(auth);
  return auth.accessToken;
}

async function getValidAccessToken() {
  const auth = await getAuth();
  if (auth?.accessToken && auth?.expiresAt && auth.expiresAt > now()) {
    return auth.accessToken;
  }
  return refreshAccessToken();
}

async function request(path, { method = "GET", body, auth = false, query = {}, mode } = {}) {
  const { baseUrl } = await getConfig();
  const headers = {};
  let token;

  if (auth) {
    try {
      token = await getValidAccessToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      throw e;
    }
  }

  const fetchOptions = {
    method,
    headers,
    credentials: "include"
  };

  // POST 요청일 때만 Content-Type 추가
  if (body) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  // Chrome 확장 프로그램의 origin 정보 추가
  if (chrome?.runtime?.id) {
    headers["Origin"] = `chrome-extension://${chrome.runtime.id}`;
  }

  console.log("Fetch request:", `${baseUrl}${path}${toQuery(query)}`, fetchOptions);
  console.log("Request headers:", headers);

  const res = await fetch(`${baseUrl}${path}${toQuery(query)}`, fetchOptions);

  if (res.status === 401 && auth) {
    try {
      const newToken = await refreshAccessToken();
      headers["Authorization"] = `Bearer ${newToken}`;
      
      const retryOptions = {
        method,
        headers,
        credentials: "include"
      };
      
      if (body) {
        headers["Content-Type"] = "application/json";
        retryOptions.body = JSON.stringify(body);
      }
      
      // Chrome 확장 프로그램의 origin 정보 추가
      if (chrome?.runtime?.id) {
        headers["Origin"] = `chrome-extension://${chrome.runtime.id}`;
      }
      
      const retry = await fetch(`${baseUrl}${path}${toQuery(query)}`, retryOptions);
      if (!retry.ok) throw new Error(`HTTP_${retry.status}`);
      return retry;
    } catch (e) {
      await clearAuth();
      throw e;
    }
  }

  if (!res.ok) {
    throw new Error(`HTTP_${res.status}`);
  }
  return res;
}

export const api = {
  getConfig,
  setConfig,
  getValidAccessToken,

  async login({ email, password }) {
    const { baseUrl } = await getConfig();
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include"
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const data = await res.json();
    await setAuth({
      accessToken: data.accessToken,
      nickname: data.nickname,
      expiresAt: now() + inMs(4.5)
    });
    return data;
  },

  async signin({ email, password, nickName }) {
    const res = await request("/api/auth/signin", {
      method: "POST",
      body: { email, password, nickName }
    });
    return res.status === 201;
  },

  async logout() {
    const { baseUrl } = await getConfig();
    
    // 로그아웃도 쿠키로만 전송 (헤더 없음)
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "DELETE",
      credentials: "include" // 쿠키만 전송
    });
    await clearAuth();
    return res.ok;
  },

  async getAlgorithmHistory({ year, month, day } = {}) {
    const res = await request("/api/algorithm", { auth: true, query: { year, month, day } });
    return res.json();
  },

  async createAlgorithm({ id, title, platform, result, url, solvedAt }) {
    console.log("createAlgorithm called with:", { id, title, platform, result, url, solvedAt });
    try {
      const res = await request("/api/algorithm", {
        method: "POST",
        auth: true,
        body: { id, title, platform, result, url, solvedAt }
      });
      console.log("createAlgorithm response status:", res.status);
      console.log("createAlgorithm response ok:", res.ok);
      
      if (res.status === 201) {
        console.log("Algorithm created successfully");
        return true;
      } else {
        console.error("Algorithm creation failed with status:", res.status);
        const errorText = await res.text().catch(() => "Unknown error");
        console.error("Error response:", errorText);
        throw new Error(`HTTP_${res.status}: ${errorText}`);
      }
    } catch (error) {
      console.error("createAlgorithm error:", error);
      throw error;
    }
  },

  async getSpecificAlgorithmHistory({ platform, id }) {
    const res = await request(`/api/algorithm/${encodeURIComponent(platform)}/${encodeURIComponent(id)}`, {
      auth: true
    });
    return res.json();
  },

  async getMyAlgorithmHistory({ year, month, day } = {}) {
    const res = await request("/api/my/algorithm", { auth: true, query: { year, month, day } });
    return res.json();
  },

  async getMySpecificAlgorithmHistory({ platform, id }) {
    const res = await request(`/api/my/algorithm/platform${encodeURIComponent(platform)}/id/${encodeURIComponent(id)}`, {
      auth: true
    });
    return res.json();
  }
};


