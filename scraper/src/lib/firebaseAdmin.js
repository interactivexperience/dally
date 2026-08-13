import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT ist nicht gesetzt. Siehe scraper/.env.example bzw. README.md.',
    )
  }
  return JSON.parse(raw)
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(loadServiceAccount()),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
}

export const db = getFirestore()
export { FieldValue }
