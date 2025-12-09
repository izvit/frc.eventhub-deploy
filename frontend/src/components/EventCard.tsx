import React, { useMemo, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCurrentUser } from '../contexts/UserContext'
import { createOrUpdateResponse, listResponses, deleteResponse, getResponsesSummary, type EventResponse, type ResponseSummary } from '../types/response'
import { updateEvent, type EventRead, type EventUpdate } from '../types/event'
import type { User } from '../types/user'
import { EditEventModal } from './EditEventModal'

type Props = {
  event: EventRead
}

export default function EventCard({ event }: Props) {
  const [open, setOpen] = useState(false)
  const { currentUserId, currentUser } = useCurrentUser()
  const [userResponse, setUserResponse] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [eventResponses, setEventResponses] = useState<EventResponse[]>([])
  const [users, setUsers] = useState<Map<number, User>>(new Map())
  const [loadingAttendees, setLoadingAttendees] = useState(false)
  const [summary, setSummary] = useState<ResponseSummary | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  // Fetch response summary on mount and refresh
  const fetchSummary = async () => {
    try {
      const summaryData = await getResponsesSummary(event.id)
      setSummary(summaryData)
    } catch (err) {
      console.error('Failed to fetch summary:', err)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [event.id])

  // Fetch all users once on mount
  useEffect(() => {
    const controller = new AbortController()
    fetch('http://127.0.0.1:8000/users', { signal: controller.signal })
      .then((res) => res.json())
      .then((userList: User[]) => {
        const userMap = new Map<number, User>()
        userList.forEach((u) => userMap.set(u.id, u))
        setUsers(userMap)
      })
      .catch(() => {
        // ignore errors
      })
    return () => controller.abort()
  }, [])

  // Fetch user's current response for this event
  useEffect(() => {
    if (!currentUserId) return
    const controller = new AbortController()
    listResponses(event.id)
      .then((responses) => {
        const myResponse = responses.find((r) => r.user_id === currentUserId)
        setUserResponse(myResponse?.status ?? null)
      })
      .catch(() => {
        // ignore errors for now
      })
    return () => controller.abort()
  }, [event.id, currentUserId])

  // Fetch all event responses when expanded
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoadingAttendees(true)
    listResponses(event.id)
      .then((responses) => {
        setEventResponses(responses)
      })
      .catch(() => {
        // ignore errors
      })
      .finally(() => {
        setLoadingAttendees(false)
      })
    return () => controller.abort()
  }, [event.id, open])

  const handleResponseClick = async (status: 'Yes' | 'No' | 'Maybe') => {
    if (!currentUserId || responding) return
    
    // If clicking the already-selected response, delete it
    if (userResponse === status) {
      try {
        setResponding(true)
        // eslint-disable-next-line no-console
        console.log('Deleting RSVP:', { eventId: event.id, userId: currentUserId })
        await deleteResponse(event.id, currentUserId)
        setUserResponse(null)
        // Refresh summary and attendee list
        await fetchSummary()
        if (open) {
          const responses = await listResponses(event.id)
          setEventResponses(responses)
        }
        // eslint-disable-next-line no-console
        console.log('RSVP deleted successfully')
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete response:', err)
        alert(`Failed to delete response: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setResponding(false)
      }
      return
    }

    // Otherwise, create or update the response
    try {
      setResponding(true)
      const payload = { user_id: currentUserId, status }
      // eslint-disable-next-line no-console
      console.log('Sending RSVP:', { eventId: event.id, payload })
      const response = await createOrUpdateResponse(event.id, payload)
      // eslint-disable-next-line no-console
      console.log('RSVP response:', response)
      setUserResponse(status)
      // Refresh summary and attendee list
      await fetchSummary()
      if (open) {
        const responses = await listResponses(event.id)
        setEventResponses(responses)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update response:', err)
      alert(`Failed to update response: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setResponding(false)
    }
  }

  // Handle event update from edit modal
  const handleUpdateEvent = async (eventId: number, eventData: EventUpdate) => {
    try {
      await updateEvent(eventId, eventData)
      // Trigger events list refresh
      window.dispatchEvent(new CustomEvent('events:changed'))
    } catch (err) {
      console.error('Failed to update event:', err)
      throw err // Re-throw so modal can show error
    }
  }

  // derive a color from the event type when explicit color is not provided
  const stripeColor =
    event.event_type_color ??
    ((): string => {
      const t = ((event as any).type || (event as any).event_type_name || (event as any).event_type?.name || '').toLowerCase()
      if (t.includes('meet')) return '#2563eb' // blue for meetings
      if (t.includes('work')) return '#16a34a' // green for workshops
      if (t.includes('holiday')) return '#ef4444' // red for holidays
      if (t.includes('social')) return '#f59e0b' // amber
      return '#9ca3af' // neutral gray fallback
    })()

  const formatTime = (t?: string | null) => {
    if (!t) return ''
    // trim seconds if present: 15:00:00 -> 15:00
    return t.split(':').slice(0, 2).join(':')
  }

  const startVal = (event as any).start ?? (event as any).start_time ?? ''

  // compute a user-friendly type label from possible backend shapes
  const typeLabel =
    (event as any).type ?? (event as any).event_type_name ?? (event as any).event_type?.name ?? (event as any).event_type?.title ?? ''

  // Get student and mentor counts from summary
  const studentCount = summary?.students_attending ?? 0
  const mentorCount = summary?.mentors_attending ?? 0

  const parseTimeToMinutes = (t: string) => {
    const parts = t.split(':')
    const hh = Number(parts[0] ?? 0)
    const mm = Number(parts[1] ?? 0)
    return hh * 60 + mm
  }

  const formatMinutesToTime = (totalMinutes: number) => {
    const minutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
    const hh = Math.floor(minutes / 60)
    const mm = minutes % 60
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }

  const duration = (event as any).duration_minutes ?? null
  const endComputed = startVal && duration != null && !Number.isNaN(Number(duration))
    ? formatMinutesToTime(parseTimeToMinutes(startVal) + Number(duration))
    : ''

  // parse event.date (YYYY-MM-DD) for display in date column
  const parseISODate = (d?: string | null) => {
    if (!d) return null
    const [y, m, day] = d.split('-').map((s) => Number(s))
    if (!y || !m || !day) return null
    return new Date(y, m - 1, day)
  }

  const dateObj = parseISODate(event.date)
  const weekday = dateObj ? dateObj.toLocaleDateString(undefined, { weekday: 'short' }) : ''
  const monthShort = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short' }) : ''
  const dayOfMonth = dateObj ? String(dateObj.getDate()) : ''

  // choose readable text color (black or white) depending on background luminance
  const readableTextColor = (hex: string) => {
    // remove #
    const h = hex.replace('#', '')
    const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    // relative luminance
    const [sr, sg, sb] = [r, g, b].map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    const lum = 0.2126 * sr + 0.7152 * sg + 0.0722 * sb
    return lum > 0.5 ? '#0f172a' : '#ffffff'
  }

  const dateBg = stripeColor || '#9ca3af'
  const dateText = readableTextColor(dateBg)

  return (
    <article className="event-card" aria-labelledby={`event-${event.id}-title`}>
      {/* colored stripe indicating event type */}
      <div className="type-stripe" style={{ background: stripeColor }} aria-hidden="true" />

      <div className="event-card-content">
        <div className="event-inner">
          <div className="date-column" aria-hidden="true" style={{background: dateBg, color: dateText, borderRadius: '10px 0 0 10px'}}>
            <div className="date-day">{weekday}</div>
            <div className="date-month-day">{monthShort} {dayOfMonth}</div>
          </div>

          <div className="content-column">
            <div className="event-top">
              <div className="event-card-left">
                <h4 id={`event-${event.id}-title`}>
                  <span className="event-time-prefix">({formatTime(startVal)}{endComputed ? `–${endComputed}` : ''})</span>
                  {' '}
                  {event.title}
                </h4>
              </div>

              {/* small attendance icons positioned top-right */}
              <div className="attendance-icons" aria-hidden="false">
                <button
                  className={`attendance-icon-btn attendance-yes ${userResponse === 'Yes' ? 'active' : ''}`}
                  title="Yes"
                  aria-label="Attend Yes"
                  onClick={() => handleResponseClick('Yes')}
                  disabled={!currentUserId || responding}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <button
                  className={`attendance-icon-btn attendance-maybe ${userResponse === 'Maybe' ? 'active' : ''}`}
                  title="Maybe"
                  aria-label="Attend Maybe"
                  onClick={() => handleResponseClick('Maybe')}
                  disabled={!currentUserId || responding}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M8.228 9.558a3.198 3.198 0 114.544 2.884c-.732.39-1.007.7-.868 1.37" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <button
                  className={`attendance-icon-btn attendance-no ${userResponse === 'No' ? 'active' : ''}`}
                  title="No"
                  aria-label="Attend No"
                  onClick={() => handleResponseClick('No')}
                  disabled={!currentUserId || responding}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isAdmin && (
                  <button
                    className="attendance-icon-btn edit-btn"
                    title="Edit Event"
                    aria-label="Edit Event"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="event-footer">
              <div className="footer-left">
                {typeLabel ? <div className="event-type-badge">{typeLabel}</div> : null}

                <div className="event-attendee-summary" title={`Students: ${studentCount}, Mentors: ${mentorCount}`} aria-hidden="false">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M16 11c1.657 0 3-1.567 3-3.5S17.657 4 16 4s-3 1.567-3 3.5S14.343 11 16 11zM8 11c1.657 0 3-1.567 3-3.5S9.657 4 8 4 5 5.567 5 7.5 6.343 11 8 11zM8 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zM16 13c-.29 0-.62.02-.98.06C15.68 13.37 16 14.12 16 15v1h6v-1.5c0-2.33-4.67-3.5-6-3.5z" stroke="currentColor" strokeWidth="0" fill="currentColor" />
                  </svg>
                  <span className="attendee-count">{studentCount} | {mentorCount}</span>
                </div>

                {event.location ? <div className="event-location-inline">{event.location}</div> : null}
              </div>

              <div className="footer-right">
                <button
                  className={`expand-btn ${open ? 'open' : ''}`}
                  onClick={() => setOpen((s) => !s)}
                  aria-expanded={open}
                  aria-controls={`details-${event.id}`}
                  aria-label={open ? 'Collapse details' : 'Expand details'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div id={`details-${event.id}`} className={`event-details ${open ? 'open' : ''}`}>
              {event.description ? (
                <div className="event-desc">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(event.description)}</ReactMarkdown>
                </div>
              ) : null}
              {loadingAttendees ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Loading attendees...</p>
              ) : eventResponses.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No responses yet.</p>
              ) : (
                <div className="attendee-grid">
                  {eventResponses.map((response) => {
                    const user = users.get(response.user_id)
                    const userName = user?.name ?? `User ${response.user_id}`
                    const statusIcon =
                      response.status === 'Yes'
                        ? '✓'
                        : response.status === 'No'
                        ? '✗'
                        : '?'
                    const statusColor =
                      response.status === 'Yes'
                        ? '#16a34a'
                        : response.status === 'No'
                        ? '#ef4444'
                        : '#6b7280'
                    return (
                      <div key={response.user_id} className="attendee-item">
                        <span className="attendee-icon" style={{ color: statusColor }}>
                          {statusIcon}
                        </span>
                        <span className="attendee-name">{userName}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <EditEventModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateEvent}
        event={event}
      />
    </article>
  )
}
