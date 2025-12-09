import React, { useEffect, useState } from 'react'
import type { UserRead } from '../types/user'

type Props = {
  onClose: () => void
  onSelect: (userId: number) => void
  currentUserId?: number | null
}

export default function UserSelectModal({ onClose, onSelect, currentUserId }: Props) {
  const [users, setUsers] = useState<UserRead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(currentUserId ?? null)

  useEffect(() => {
    const controller = new AbortController()
    const fetchUsers = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('http://127.0.0.1:8000/users', {
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`Failed to fetch users: ${res.status} ${res.statusText}`)
        }
        const data = (await res.json()) as UserRead[]
        setUsers(data)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
    return () => controller.abort()
  }, [])

  const handleSave = () => {
    if (selectedUserId !== null) {
      onSelect(selectedUserId)
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>Select Current User</h3>
        </div>
        <div className="modal-body">
          {loading && <p>Loading users...</p>}
          {error && <p style={{ color: '#ef4444' }}>Error: {error.message}</p>}
          {!loading && !error && (
            <div className="modal-field">
              <label className="modal-label" htmlFor="user-select">
                Current User
              </label>
              <select
                id="user-select"
                value={selectedUserId ?? ''}
                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e6eef7', width: '100%' }}
              >
                <option value="">-- Select a user --</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.email ? `(${user.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={selectedUserId === null}>
            Select
          </button>
        </div>
      </div>
    </div>
  )
}
