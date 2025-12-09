import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  onClose: () => void
  onSave?: (data: any) => void
}

export default function NewEventModal({ onClose, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descMode, setDescMode] = useState<'edit' | 'preview'>('edit')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  // default duration to 60 minutes (1 hour)
  const [duration, setDuration] = useState('60')
  // store selected event type id as string (empty = none)
  const [type, setType] = useState('')
  const [typeError, setTypeError] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [types, setTypes] = useState<Array<{ id: number; name: string; color?: string }>>([])
  const [typesLoading, setTypesLoading] = useState(false)
  const [typesError, setTypesError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const canSave =
    title.trim() !== '' && date.trim() !== '' && start.trim() !== '' && duration.trim() !== '' && type.trim() !== ''

  function handleSave() {
    // ensure event type is selected
    if (!type) {
      setTypeError('Event type is required')
      return
    }
    // normalize time fields to backend expected format (HH:MM:SS)
    const normalizeTime = (t: string) => {
      if (!t) return t
      // if already has seconds
      if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t
      if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
      return t
    }

    const payload: any = {
      title,
      description,
      date,
      start_time: normalizeTime(start),
      location,
    }

    // duration in minutes
    const dm = Number(duration)
    if (!Number.isNaN(dm)) payload.duration_minutes = dm

    // prefer event_type_id if available
    if (type) {
      const id = Number(type)
      if (!Number.isNaN(id)) payload.event_type_id = id
      else payload.event_type = type
    }
    setSaving(true)
    setSaveError(null)
    fetch('http://127.0.0.1:8000/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Server error ${res.status}`)
        }
        const data = await res.json()
        if (onSave) onSave(data)
        // notify other parts of the app to refetch events
        try {
          window.dispatchEvent(new CustomEvent('events:changed'))
        } catch (e) {
          // ignore
        }
        onClose()
      })
      .catch((err) => {
        setSaveError(err?.message || 'Failed to save')
      })
      .finally(() => setSaving(false))
  }

  useEffect(() => {
    let mounted = true
    setTypesLoading(true)
    setTypesError(null)
    fetch('http://127.0.0.1:8000/event-types')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (!mounted) return
        setTypes(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!mounted) return
        setTypesError(err.message || 'Failed to load event types')
      })
      .finally(() => {
        if (!mounted) return
        setTypesLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <header className="modal-header">
          <h3>Create Event</h3>
        </header>

        <div className="modal-body">
          <label className="modal-field">
            <div className="modal-label">Title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="modal-field">
            <div className="modal-label">Description</div>

            <div className="md-toggle" role="tablist" aria-label="Description edit preview toggle">
              <button
                type="button"
                role="tab"
                aria-selected={descMode === 'edit'}
                className={`md-btn ${descMode === 'edit' ? 'active' : ''}`}
                onClick={() => setDescMode('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={descMode === 'preview'}
                className={`md-btn ${descMode === 'preview' ? 'active' : ''}`}
                onClick={() => setDescMode('preview')}
              >
                Preview
              </button>
            </div>

            {descMode === 'edit' ? (
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} />
            ) : (
              <div className="markdown-preview" style={{border:'1px solid #eef2f7',padding:10,borderRadius:8,background:'#fff',marginTop:6}}>
                {description.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                ) : (
                  <div style={{color:'var(--muted)'}}>Nothing to preview</div>
                )}
              </div>
            )}
          </label>

          <div className="modal-row">
            <label className="modal-field">
              <div className="modal-label">Date</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label className="modal-field">
              <div className="modal-label">Start</div>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>

            <label className="modal-field">
              <div className="modal-label">Duration</div>
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="">-- Select duration --</option>
                {Array.from({ length: 48 }).map((_, i) => {
                  const minutes = (i + 1) * 15
                  const hrs = Math.floor(minutes / 60)
                  const mins = minutes % 60
                  const label = hrs > 0 ? `${hrs}h${mins ? ` ${mins}m` : ''}` : `${mins}m`
                  return (
                    <option key={minutes} value={String(minutes)}>
                      {label}
                    </option>
                  )
                })}
              </select>
            </label>
          </div>

          <label className="modal-field">
            <div className="modal-label">Type</div>
            {typesLoading ? (
              <select disabled>
                <option>Loading...</option>
              </select>
            ) : typesError ? (
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">(Error loading types)</option>
              </select>
            ) : (
              <>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value)
                    setTypeError(null)
                  }}
                  aria-invalid={!!typeError}
                >
                  <option value="">-- Select type --</option>
                  {types.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {typeError ? <div className="field-error">{typeError}</div> : null}
              </>
            )}
          </label>

          <label className="modal-field">
            <div className="modal-label">Location</div>
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
        </div>

        <footer className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>Save</button>
        </footer>
      </div>
    </div>
  )
}
