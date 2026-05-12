import { collection, addDoc, getDocs, orderBy, limit, query, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export interface LeaderboardEntry {
  name: string
  score: number
}

const SUBMIT_KEY = 'yuki_last_submitted_score'

export function alreadySubmitted(score: number): boolean {
  return localStorage.getItem(SUBMIT_KEY) === String(score)
}

export async function submitScore(name: string, email: string, score: number): Promise<void> {
  await addDoc(collection(db, 'yuki_scores'), {
    name: name.trim().slice(0, 30),
    email: email.trim().toLowerCase(),
    score,
    submittedAt: serverTimestamp(),
  })
  localStorage.setItem(SUBMIT_KEY, String(score))
}

export async function getTopScores(n = 10): Promise<LeaderboardEntry[]> {
  const q = query(collection(db, 'yuki_scores'), orderBy('score', 'desc'), limit(n))
  const snap = await getDocs(q)
  return snap.docs.map(doc => {
    const d = doc.data()
    return { name: d.name as string, score: d.score as number }
  })
}
