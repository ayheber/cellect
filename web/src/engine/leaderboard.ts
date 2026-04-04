import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export interface LeaderboardEntry {
  name: string
  steps: number
  time: number  // seconds
}

function dateKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function storageKey(): string {
  return `cellect_daily_${dateKey()}_submitted`
}

export function alreadySubmitted(): boolean {
  return localStorage.getItem(storageKey()) === 'true'
}

export async function submitScore(name: string, steps: number, time: number): Promise<void> {
  const date = dateKey()
  await addDoc(collection(db, 'daily_scores', date, 'scores'), {
    name: name.trim().slice(0, 20),
    steps,
    time,
    submittedAt: serverTimestamp(),
  })
  localStorage.setItem(storageKey(), 'true')
}

export async function getTopScores(limit = 10): Promise<LeaderboardEntry[]> {
  const date = dateKey()
  const snap = await getDocs(collection(db, 'daily_scores', date, 'scores'))
  const entries: LeaderboardEntry[] = snap.docs.map(doc => doc.data() as LeaderboardEntry)
  entries.sort((a, b) => a.steps !== b.steps ? a.steps - b.steps : a.time - b.time)
  return entries.slice(0, limit)
}
