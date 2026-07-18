/**
 * Firebase 環境設定的輕量檢查 —— 這個檔案刻意「不 import firebase」。
 *
 * 原因：storage.ts 需要知道「有沒有設定雲端」來決定用哪個後端，
 * 但如果它為了這個判斷去 import firebase.ts，整包 Firebase SDK（約 500KB）
 * 就會被靜態打進主 bundle，連沒設定雲端的使用者也得下載。
 * 把純環境判斷抽到這裡，SDK 就能留在只有動態 import 才載入的 chunk。
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** apiKey / authDomain / projectId 三個必要欄位都有值才算已設定 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey?.trim() &&
  firebaseConfig.authDomain?.trim() &&
  firebaseConfig.projectId?.trim()
)
