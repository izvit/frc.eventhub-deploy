export interface EventResponseCreate {
  user_id: number
  status: string // 'Yes', 'No', 'Maybe' (capitalized as required by backend)
  note?: string | null
}

export interface EventResponse {
  id?: number | null
  user_id: number
  event_id: number
  status: string
  note?: string | null
  created_at: string
  updated_at: string
}

export async function createOrUpdateResponse(
  eventId: number,
  data: EventResponseCreate
): Promise<EventResponse> {
  const res = await fetch(`http://127.0.0.1:8000/events/${eventId}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const errorText = await res.text()
    console.error('Response error:', { status: res.status, body: errorText })
    throw new Error(`Failed to update response: ${res.status} - ${errorText}`)
  }
  return res.json()
}

export async function listResponses(eventId: number): Promise<EventResponse[]> {
  const res = await fetch(`http://127.0.0.1:8000/events/${eventId}/responses`)
  if (!res.ok) {
    throw new Error(`Failed to fetch responses: ${res.status}`)
  }
  return res.json()
}

export async function deleteResponse(eventId: number, userId: number): Promise<void> {
  const res = await fetch(`http://127.0.0.1:8000/events/${eventId}/responses/${userId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const errorText = await res.text()
    console.error('Delete response error:', { status: res.status, body: errorText })
    throw new Error(`Failed to delete response: ${res.status} - ${errorText}`)
  }
}

export interface ResponseSummary {
  total?: number
  yes: number
  no: number
  maybe: number
  students_attending: number
  mentors_attending: number
}

export async function getResponsesSummary(eventId: number): Promise<ResponseSummary> {
  const res = await fetch(`http://127.0.0.1:8000/events/${eventId}/responses/summary`)
  if (!res.ok) {
    throw new Error(`Failed to fetch responses summary: ${res.status}`)
  }
  return res.json()
}
