export const storage = {
  async get(key, fallback = null) {
    const r = await chrome.storage.local.get([key]);
    return r[key] ?? fallback;
  },
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
  async remove(key) {
    await chrome.storage.local.remove([key]);
  },
  
  // 자동 기록 설정 관련
  async getAutoRecordSetting() {
    return await this.get("algostack_auto_record", true); // 기본값: 활성화
  },
  
  async setAutoRecordSetting(enabled) {
    await this.set("algostack_auto_record", enabled);
  }
};


