/**
 * Firebase SDK 初始化。
 *
 * 這個模組只會被 firestoreRepository 引用，而後者又只被 storage.ts
 * 以動態 import 載入 —— 因此整包 Firebase SDK 會被 Vite 切成獨立 chunk，
 * 只在使用者確實有設定雲端時才下載。
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
auth = getAuth(app)
db = getFirestore(app)

export { auth, db }
export default app
