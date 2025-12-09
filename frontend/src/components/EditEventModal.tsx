import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { EventRead, EventUpdate } from '../types/event';

interface EventType {
  id: number;
  name: string;
  color?: string;
}

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventId: number, eventData: EventUpdate) => Promise<void>;
  event: EventRead;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  event,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descMode, setDescMode] = useState<'edit' | 'preview'>('edit');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [eventTypeId, setEventTypeId] = useState('');
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);

  // Fetch event types
  useEffect(() => {
    fetch('http://127.0.0.1:8000/event-types')
      .then((res) => res.json())
      .then((types) => setEventTypes(types))
      .catch((err) => console.error('Failed to fetch event types:', err));
  }, []);

  // Pre-populate form when event changes or modal opens
  useEffect(() => {
    if (event && isOpen) {
      console.log('Populating form with event:', event);
      console.log('Available event types:', eventTypes);
      
      setTitle(event.title || '');
      setDescription(event.description || '');
      setDate(event.date || '');
      // Handle both 'start' and 'start_time' fields
      const startVal = (event as any).start ?? (event as any).start_time ?? '';
      // Remove seconds if present (HH:MM:SS -> HH:MM)
      setStartTime(startVal ? startVal.substring(0, 5) : '');
      setDurationMinutes(event.duration_minutes?.toString() || '');
      setLocation(event.location || '');
      
      // Match event type by name if types are loaded
      if (event.type && eventTypes.length > 0) {
        console.log('Trying to match event type:', event.type);
        const matchedType = eventTypes.find(t => t.name === event.type);
        console.log('Matched type:', matchedType);
        if (matchedType) {
          setEventTypeId(matchedType.id.toString());
        } else {
          setEventTypeId('');
        }
      } else {
        setEventTypeId('');
      }
    }
  }, [event, isOpen, eventTypes]);

  const canSave = title.trim() !== '' && date.trim() !== '' && startTime.trim() !== '' && durationMinutes.trim() !== '' && eventTypeId.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Normalize time format to HH:MM:SS
      const normalizeTime = (t: string) => {
        if (!t) return t;
        if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
        if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
        return t;
      };

      const eventData: EventUpdate = {
        title,
        description: description || null,
        date,
        start_time: normalizeTime(startTime),
        duration_minutes: parseInt(durationMinutes) || null,
        event_type_id: parseInt(eventTypeId) || null,
        location: location || null,
        link: null,
      };

      await onSave(event.id, eventData);
      onClose();
    } catch (error) {
      console.error('Failed to update event:', error);
      alert('Failed to update event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <header className="modal-header">
          <h3>Edit Event</h3>
        </header>

        <div className="modal-body">
          <label className="modal-field">
            <div className="modal-label">Title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSaving} />
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
                disabled={isSaving}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={descMode === 'preview'}
                className={`md-btn ${descMode === 'preview' ? 'active' : ''}`}
                onClick={() => setDescMode('preview')}
                disabled={isSaving}
              >
                Preview
              </button>
            </div>

            {descMode === 'edit' ? (
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} disabled={isSaving} />
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
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSaving} />
            </label>

            <label className="modal-field">
              <div className="modal-label">Start</div>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={isSaving} />
            </label>

            <label className="modal-field">
              <div className="modal-label">Duration</div>
              <select value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} disabled={isSaving}>
                <option value="">-- Select duration --</option>
                {Array.from({ length: 48 }).map((_, i) => {
                  const minutes = (i + 1) * 15;
                  const hrs = Math.floor(minutes / 60);
                  const mins = minutes % 60;
                  const label = hrs > 0 ? `${hrs}h${mins ? ` ${mins}m` : ''}` : `${mins}m`;
                  return (
                    <option key={minutes} value={String(minutes)}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <label className="modal-field">
            <div className="modal-label">Type</div>
            <select value={eventTypeId} onChange={(e) => setEventTypeId(e.target.value)} disabled={isSaving}>
              <option value="">-- Select type --</option>
              {eventTypes.map((type) => (
                <option key={type.id} value={String(type.id)}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          <label className="modal-field">
            <div className="modal-label">Location</div>
            <input value={location} onChange={(e) => setLocation(e.target.value)} disabled={isSaving} />
          </label>
        </div>

        <footer className="modal-footer">
          <button className="btn" onClick={handleCancel} disabled={isSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  );
};
