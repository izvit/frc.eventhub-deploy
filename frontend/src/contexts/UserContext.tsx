import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from '../types/user'

interface UserContextType {
  currentUserId: number | null
  setCurrentUserId: (userId: number | null) => void
  currentUser: User | null
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<number | null>(() => {
    const saved = localStorage.getItem('currentUserId')
    return saved ? Number(saved) : null
  })
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Fetch user details when userId changes
  useEffect(() => {
    if (!currentUserId) {
      setCurrentUser(null)
      return
    }
    const controller = new AbortController()
    fetch('http://127.0.0.1:8000/users', { signal: controller.signal })
      .then((res) => res.json())
      .then((users: User[]) => {
        const user = users.find((u) => u.id === currentUserId)
        setCurrentUser(user ?? null)
      })
      .catch(() => {
        // ignore errors
      })
    return () => controller.abort()
  }, [currentUserId])

  useEffect(() => {
    if (currentUserId !== null) {
      localStorage.setItem('currentUserId', currentUserId.toString())
    } else {
      localStorage.removeItem('currentUserId')
    }
  }, [currentUserId])

  return (
    <UserContext.Provider value={{ currentUserId, setCurrentUserId, currentUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useCurrentUser must be used within a UserProvider')
  }
  return context
}
