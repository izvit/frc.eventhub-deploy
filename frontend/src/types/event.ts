export type EventRead = {
  id: number
  title: string
  description?: string | null
  date: string // YYYY-MM-DD
  start: string // HH:MM or HH:MM:SS
  // duration in minutes (new API field)
  duration_minutes?: number | null
  type?: string | null
  event_type_color?: string | null
  location?: string | null
  link?: string | null
}

export type EventUpdate = {
  title: string
  description?: string | null
  date: string
  start_time: string
  duration_minutes?: number | null
  event_type_id?: number | null
  location?: string | null
  link?: string | null
}

export async function updateEvent(eventId: number, eventData: EventUpdate): Promise<EventRead> {
  const response = await fetch(`http://127.0.0.1:8000/events/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to update event')
  }
  
  return response.json()
}
