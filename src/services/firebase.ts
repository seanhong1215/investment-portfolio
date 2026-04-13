import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * 判斷 Firebase 是否已在 .env 中配置
 * 需要 apiKey、authDomain、projectId 三個必要欄位
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey?.trim() &&
  firebaseConfig.authDomain?.trim() &&
  firebaseConfig.projectId?.trim()
)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  console.log('🔥 Firebase 已初始化，專案:', firebaseConfig.projectId)
} else {
  console.log('💾 Firebase 未配置，使用本地 IndexedDB 存儲')
}

export { auth, db }
export default app
