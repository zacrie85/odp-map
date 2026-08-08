  'use client'

import { useEffect, useState, useRef } from 'react'

/**
  * Firebase Realtime Database Presence Hook
  * Menggantikan Socket.io untuk fitur "pengguna online"
  * 
  * Menggunakan Firebase Realtime Database REST API langsung (tanpa SDK)
  * sehingga tidak perlu install firebase package.
  * 
  * Environment variables yang dibutuhkan:
  * - NEXT_PUBLIC_FIREBASE_DB_URL = https://xxxx.firebaseio.com
  * - NEXT_PUBLIC_FIREBASE_DB_SECRET = (opsional, kalau rules=auth!=null)
  */

interface PresenceState {
  activeUsers: number
  connected: boolean
}

// Global singleton: hanya 1 koneksi Firebase per tab
let globalState: {
  ref: string | null
  listeners: Set<(state: PresenceState) => void>
  heartbeatTimer: ReturnType<typeof setInterval> | null
  cleanupTimer: ReturnType<typeof setTimeout> | null
} = {
  ref: null,
  listeners: new Set(),
  heartbeatTimer: null,
  cleanupTimer: null,
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

async function firebasePut(dbUrl: string, path: string, data: any): Promise<void> {
  const url = `${dbUrl}/${path}.json`
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    console.warn('Firebase write failed:', err)
  }
}

async function firebaseGet(dbUrl: string, path: string): Promise<any> {
  const url = `${dbUrl}/${path}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('Firebase read failed:', err)
    return null
  }
}

export function useFirebasePresence(): PresenceState {
  const [state, setState] = useState<PresenceState>({ activeUsers: 0, connected: false })
  const myRef = useRef<string | null>(null)
  const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DB_URL || ''

  useEffect(() => {
    if (!dbUrl) {
      // Kalau tidak ada Firebase config, fallback ke 1 user
      setState({ activeUsers: 1, connected: false })
      return
    }

    myRef.current = generateId()
    const myPath = `presence/${myRef.current}`
    const isOnlinePath = `presence/${myRef.current}/online`
    const lastSeenPath = `presence/${myRef.current}/lastSeen`

    // Register listener for count
    const listener = (s: PresenceState) => setState(s)
    globalState.listeners.add(listener)

    // Connect function
    const connect = async () => {
      try {
        // Tulis ke Firebase: saya online
        await firebasePut(dbUrl, isOnlinePath, true)
        await firebasePut(dbUrl, lastSeenPath, Date.now())
        setState(prev => ({ ...prev, connected: true }))
      } catch (err) {
        console.warn('Firebase connect failed:', err)
      }
    }

    // Disconnect function (cleanup)
    const disconnect = async () => {
      if (myRef.current) {
        try {
          await firebasePut(dbUrl, `presence/${myRef.current}`, null)
        } catch (err) {
          console.warn('Firebase disconnect failed:', err)
        }
      }
    }

    // Poll user count setiap 5 detik
    const pollCount = async () => {
      try {
        const data = await firebaseGet(dbUrl, 'presence.json')
        let count = 0
        if (data && typeof data === 'object') {
          const now = Date.now()
          const TIMEOUT = 45000 // 45 detik timeout
          for (const key in data) {
            const user = data[key]
            if (user?.online && user?.lastSeen && (now - user.lastSeen) < TIMEOUT) {
              count++
            }
          }
        }
        globalState.listeners.forEach(l => l({ activeUsers: Math.max(count, 1), connected: true }))
      } catch (err) {
        // Silent fail
      }
    }

    // Start
    connect()
    pollCount() // Count awal
    globalState.heartbeatTimer = setInterval(pollCount, 5000)

    // Cleanup on unmount / tab close
    const cleanup = async () => {
      if (globalState.heartbeatTimer) clearInterval(globalState.heartbeatTimer)
      globalState.listeners.delete(listener)
      await disconnect()
    }

    // Cleanup saat tab ditutup
    window.addEventListener('beforeunload', disconnect)

    return cleanup
  }, [dbUrl])

  return state
}

/**
  * Auto-cleanup stale users (jalankan 1x di app level)
  * Dipanggil dari page.tsx
 */
export function useFirebaseCleanup() {
  const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DB_URL || ''
  
  useEffect(() => {
    if (!dbUrl) return

    // Cleanup setiap 30 detik: hapus user yang offline > 60 detik
    const cleanupStale = async () => {
      try {
        const data = await firebaseGet(dbUrl, 'presence.json')
        if (data && typeof data === 'object') {
          const now = Date.now()
          const STALE_LIMIT = 60000
          for (const key in data) {
            const user = data[key]
            if (user?.lastSeen && (now - user.lastSeen) > STALE_LIMIT) {
              await firebasePut(dbUrl, `presence/${key}`, null)
            }
          }
        }
      } catch {
        // Silent
      }
    }

    // Jalankan cleanup pertama setelah 10 detik
    const initialTimer = setTimeout(cleanupStale, 10000)
    // Lalu setiap 30 detik
    const intervalTimer = setInterval(cleanupStale, 30000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(intervalTimer)
    }
  }, [dbUrl])
}
