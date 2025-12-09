import React, { useState, useEffect } from 'react'
import { useCurrentUser } from '../contexts/UserContext'
import IconButton from '../components/IconButton'
import NewEventModal from '../components/NewEventModal'
import UserSelectModal from '../components/UserSelectModal'
import type { User } from '../types/user'

type Props = {
  children: React.ReactNode
}

export default function MainLayout({ children }: Props) {
  const [showNewModal, setShowNewModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const { currentUserId, setCurrentUserId } = useCurrentUser()
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Fetch current user details when userId changes
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
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-left">
          <a href="/" className="brand-link" aria-label="Home">
            <img src="/logo.png" alt="Event logo" className="brand-logo" />
          </a>
          <h1>Event Management System</h1>
        </div>
        <div className="header-right">
          <IconButton ariaLabel="User profile" icon="person" onClick={() => setShowUserModal(true)} />
          <IconButton ariaLabel="Add item" onClick={() => setShowNewModal(true)} />
          <IconButton ariaLabel="Menu" icon="menu" />
        </div>
      </header>
      {currentUser && (
        <div className="user-indicator">
          <span className="user-indicator-label">Current User:</span>
          <span className="user-indicator-name">{currentUser.name}</span>
        </div>
      )}
      <main className="app-main">{children}</main>
      <footer className="app-footer">© {new Date().getFullYear()}</footer>
      {showNewModal && (
        <NewEventModal
          onClose={() => setShowNewModal(false)}
          onSave={(data) => {
            // currently just log the new event data. We could POST to backend here later.
            // Keep this minimal: user requested modal with save/cancel; not wired.
            // eslint-disable-next-line no-console
            console.log('Create event:', data)
          }}
        />
      )}
      {showUserModal && (
        <UserSelectModal
          onClose={() => setShowUserModal(false)}
          onSelect={(userId) => {
            setCurrentUserId(userId)
            // eslint-disable-next-line no-console
            console.log('Selected user:', userId)
          }}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}
