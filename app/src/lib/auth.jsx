import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

const AuthContext = createContext(null)

const DEFAULT_PROFILE = {
  stadt: 'Münster',
  umkreisKm: 10,
  ausgewaehlteFilialen: [],
  interessenKategorien: [],
  sprache: 'de',
  // Erweiterung ggü. konzept.md Punkt 3, siehe Punkt 13 (Barrierefreiheit):
  // 'klein' | 'normal' | 'gross'
  schriftgroesse: 'normal',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          setProfile(snap.data())
        } else {
          const initial = {
            ...DEFAULT_PROFILE,
            email: firebaseUser.email,
            erstelltAm: serverTimestamp(),
          }
          await setDoc(ref, initial)
          setProfile(initial)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
  }, [])

  async function updateProfile(patch) {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    await setDoc(ref, patch, { merge: true })
    setProfile((prev) => ({ ...prev, ...patch }))
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
  }

  const value = { user, profile, loading, login, logout, updateProfile }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden')
  return ctx
}
