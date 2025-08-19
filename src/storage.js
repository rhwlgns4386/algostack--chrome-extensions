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
  }
};


