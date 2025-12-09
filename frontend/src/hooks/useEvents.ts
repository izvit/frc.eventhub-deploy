import { useEffect, useState, useCallback } from 'react'
import type { EventRead } from '../types/event'

type UseEventsResult = {
  events: EventRead[]
  loading: boolean
  error: Error | null
}

export default function useEvents(): UseEventsResult {
  const [events, setEvents] = useState<EventRead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEvents = useCallback(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)

    fetch('http://127.0.0.1:8000/events', { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        const data = (await res.json()) as EventRead[]
        setEvents(data)
      })
      .catch((err) => {
        if ((err as any).name !== 'AbortError') setError(err as Error)
      })
      .finally(() => setLoading(false))

    return () => ac.abort()
  }, [])

  useEffect(() => {
    const cleanup = fetchEvents()
    return () => cleanup && cleanup()
  }, [fetchEvents])

  useEffect(() => {
    // refetch when other parts of the app signal a change
    function onChanged() {
      fetchEvents()
    }
    window.addEventListener('events:changed', onChanged as EventListener)
    return () => window.removeEventListener('events:changed', onChanged as EventListener)
  }, [fetchEvents])

  return { events, loading, error }
}
