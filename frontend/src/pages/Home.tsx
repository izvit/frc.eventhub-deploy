import React, { useMemo, useState } from 'react'
import useEvents from '../hooks/useEvents'
import EventCard from '../components/EventCard'

export default function Home() {
  const { events, loading, error } = useEvents()
  const [groupBy, setGroupBy] = useState<'week' | 'month' | 'none'>('week')
  const [search, setSearch] = useState('')

  // utility: parse YYYY-MM-DD to Date (local)
  const parseDate = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, (m || 1) - 1, day || 1)
  }

  const grouped = useMemo(() => {
    if (!events || events.length === 0) return new Map<string, typeof events>()

    // filter first by search
    const searchTerm = (search || '').trim().toLowerCase()
    const filtered = (events || []).filter((ev) => {
      if (!searchTerm) return true
      const typeName = (ev as any).type ?? (ev as any).event_type_name ?? (ev as any).event_type?.name ?? ''
      const hay = [ev.title, ev.description ?? '', ev.location ?? '', typeName, ev.date].join(' ').toLowerCase()
      return hay.includes(searchTerm)
    })

    // ensure events sorted by date
    const sorted = [...filtered].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))

    if (groupBy === 'none') {
      const m = new Map<string, typeof events>()
      m.set('', sorted)
      return m
    }

    const map = new Map<string, typeof events>()

    for (const ev of sorted) {
      const dt = parseDate(ev.date)

      if (groupBy === 'month') {
        const label = dt.toLocaleString(undefined, { month: 'long', year: 'numeric' })
        const arr = map.get(label) ?? []
        arr.push(ev)
        map.set(label, arr)
      } else if (groupBy === 'week') {
        // compute Monday of the week
        const day = dt.getDay() // 0 (Sun) - 6 (Sat)
        const diff = (day + 6) % 7 // days since Monday
        const monday = new Date(dt)
        monday.setDate(dt.getDate() - diff)
        const label = `Week of ${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        const arr = map.get(label) ?? []
        arr.push(ev)
        map.set(label, arr)
      }
    }

    return map
  }, [events, groupBy, search])

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (label: string) => {
    const key = label || '__all'
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section>
      <section aria-live="polite" className="events-section">
        <h3>Events</h3>
        <div className="events-controls">
          <input
            className="search-input"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search events"
          />
          <div className="group-by-control">
            <label>Group by</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>

        {loading && <p>Loading events…</p>}
        {error && <p className="text-muted">Error: {error.message}</p>}
        {!loading && !error && events.length === 0 && <p>No events found.</p>}

        <div className="event-list">
          {!loading && !error && (
            Array.from(grouped.entries()).map(([label, list]) => {
              const key = label || '__all'
              const isCollapsed = !!collapsedGroups[key]
              return (
                <div key={key} className="event-section-group">
                  <div className={`group-header ${isCollapsed ? 'collapsed' : ''}`}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <button
                        type="button"
                        className="group-toggle"
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleGroup(label)}
                        aria-controls={`group-${key}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {label ? <h4 className="group-label">{label}</h4> : <h4 className="group-label">All events</h4>}
                    </div>
                    <div style={{color:'var(--muted)'}}>{list.length} item{list.length !== 1 ? 's' : ''}</div>
                  </div>

                  <div id={`group-${key}`} style={{display: isCollapsed ? 'none' : 'block' }}>
                    {list.map((ev) => (
                      <EventCard key={ev.id} event={ev} />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>
    </section>
  )
}
