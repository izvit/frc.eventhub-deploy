from typing import Optional, List
from datetime import datetime, date, time, timezone, timedelta

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from sqlmodel import SQLModel, Field, create_engine, Session, select, Relationship


DATABASE_URL = "sqlite:///./calendar.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    type: str
    role: str
    active: bool
    responses: List["EventResponse"] = Relationship(back_populates="user")


class Event(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: str
    date: date
    start_time: time
    duration_minutes: int
    event_type_id: Optional[int] = Field(default=None, foreign_key="eventtype.id")
    location: Optional[str] = None
    link: Optional[str] = None
    # relationship (optional for ORM use)
    event_type: Optional["EventType"] = Relationship(back_populates="events")
    responses: List["EventResponse"] = Relationship(back_populates="event")


class EventType(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    color: Optional[str] = None
    events: List[Event] = Relationship(back_populates="event_type")


class EventResponse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    event_id: int = Field(foreign_key="event.id")
    status: str  # "Yes", "No", or "Maybe"
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # relationships
    user: Optional[User] = Relationship(back_populates="responses")
    event: Optional[Event] = Relationship(back_populates="responses")


class EventResponseCreate(SQLModel):
    user_id: int
    status: str  # "Yes", "No", or "Maybe"
    note: Optional[str] = None



# Input model for creating/updating events (accepts either type id or type name)
class EventCreate(SQLModel):
    title: str
    description: str
    date: Optional[date]
    start_time: Optional[time]
    duration_minutes: Optional[int]
    event_type_id: Optional[int] = None
    event_type: Optional[str] = None
    location: Optional[str] = None
    link: Optional[str] = None


# Response model for events (includes resolved type name)
class EventRead(SQLModel):
    id: int
    title: str
    description: str
    date: date
    start_time: time
    duration_minutes: int
    event_type_id: Optional[int] = None
    event_type_name: Optional[str] = None
    event_type_color: Optional[str] = None
    location: Optional[str] = None
    link: Optional[str] = None


app = FastAPI(title="Calendar Management Backend")
origins = [
    "*"
    # add other origins you need (or use "*" for development)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # or ["*"] for dev
    allow_credentials=True,
    allow_methods=["*"],          # allow GET, POST, DELETE, OPTIONS, etc.
    allow_headers=["*"],          # allow Content-Type and other headers
)

# Serve frontend assets and index (works when running with uvicorn)
frontend_dir = Path(__file__).resolve().parent / "frontend"
index_file = frontend_dir / "index.html"
if frontend_dir.exists():
    assets_dir = frontend_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_frontend_index():
        if index_file.exists():
            return FileResponse(str(index_file))
        raise HTTPException(status_code=404, detail="Frontend index not found")

    # Serve top-level static files from frontend (e.g., logo.png)
    logo_file = frontend_dir / "logo.png"

    @app.get("/logo.png", include_in_schema=False)
    def serve_logo():
        if logo_file.exists():
            return FileResponse(str(logo_file))
        raise HTTPException(status_code=404, detail="logo.png not found")


@app.on_event("startup")
def on_startup():
    # Create fresh schema; assume database will be recreated externally
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


@app.post("/events/{event_id}/responses", response_model=EventResponse)
def create_or_update_response(event_id: int, resp_in: EventResponseCreate, session: Session = Depends(get_session)):
    # Ensure event exists
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Ensure user exists
    user = session.get(User, resp_in.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate status
    if resp_in.status not in ["Yes", "No", "Maybe"]:
        raise HTTPException(status_code=400, detail="status must be 'Yes', 'No', or 'Maybe'")

    # Check for existing response by this user for this event
    stmt = select(EventResponse).where((EventResponse.event_id == event_id) & (EventResponse.user_id == resp_in.user_id))
    existing = session.exec(stmt).first()
    if existing:
        existing.status = resp_in.status
        existing.note = resp_in.note
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    resp = EventResponse(user_id=resp_in.user_id, event_id=event_id, status=resp_in.status, note=resp_in.note, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
    session.add(resp)
    session.commit()
    session.refresh(resp)
    return resp


@app.get("/events/{event_id}/responses", response_model=List[EventResponse])
def list_responses(event_id: int, session: Session = Depends(get_session)):
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    responses = session.exec(select(EventResponse).where(EventResponse.event_id == event_id)).all()
    return responses


@app.delete("/events/{event_id}/responses/{user_id}")
def delete_response(event_id: int, user_id: int, session: Session = Depends(get_session)):
    # Ensure event exists
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Find the response
    stmt = select(EventResponse).where((EventResponse.event_id == event_id) & (EventResponse.user_id == user_id))
    response = session.exec(stmt).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    session.delete(response)
    session.commit()
    return {"ok": True}


@app.get("/events/{event_id}/responses/summary")
def responses_summary(event_id: int, session: Session = Depends(get_session)):
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    responses = session.exec(select(EventResponse).where(EventResponse.event_id == event_id)).all()
    yes_count = sum(1 for r in responses if r.status == "Yes")
    no_count = sum(1 for r in responses if r.status == "No")
    maybe_count = sum(1 for r in responses if r.status == "Maybe")
    
    # Count mentors and students attending (status == "Yes")
    mentor_count = 0
    student_count = 0
    for r in responses:
        if r.status == "Yes":
            user = session.get(User, r.user_id)
            if user:
                if user.type == "mentor":
                    mentor_count += 1
                elif user.type == "student":
                    student_count += 1
    
    return {
        "yes": yes_count,
        "no": no_count,
        "maybe": maybe_count,
        "mentors_attending": mentor_count,
        "students_attending": student_count
    }


@app.post("/users", response_model=User)
def create_user(user: User, session: Session = Depends(get_session)):
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.get("/users", response_model=List[User])
def list_users(session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return users


@app.delete("/users/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"ok": True}


@app.post("/events", response_model=EventRead)
def create_event(event_in: EventCreate, session: Session = Depends(get_session)):
    # Parse/validate date, start_time and duration
    if event_in.date is None or event_in.start_time is None or event_in.duration_minutes is None:
        raise HTTPException(status_code=400, detail="`date`, `start_time`, and `duration_minutes` are required")

    # normalize/parse if strings
    try:
        if not isinstance(event_in.date, date):
            event_in.date = date.fromisoformat(event_in.date)  # type: ignore[arg-type]
    except Exception:
        raise HTTPException(status_code=400, detail="`date` must be an ISO date string (YYYY-MM-DD) or a date object")

    try:
        if not isinstance(event_in.start_time, time):
            event_in.start_time = time.fromisoformat(event_in.start_time)  # type: ignore[arg-type]
    except Exception:
        raise HTTPException(status_code=400, detail="`start_time` must be an ISO time string (HH:MM[:SS]) or a time object")

    # validate duration
    try:
        if not isinstance(event_in.duration_minutes, int):
            event_in.duration_minutes = int(event_in.duration_minutes)  # type: ignore[arg-type]
    except Exception:
        raise HTTPException(status_code=400, detail="`duration_minutes` must be an integer number of minutes")

    if event_in.duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="`duration_minutes` must be a positive integer")

    # Resolve or create event type
    et_id = None
    if event_in.event_type_id is not None:
        et = session.get(EventType, event_in.event_type_id)
        if not et:
            raise HTTPException(status_code=400, detail="event_type_id not found")
        et_id = et.id
    elif event_in.event_type:
        stmt = select(EventType).where(EventType.name == event_in.event_type)
        et = session.exec(stmt).first()
        if not et:
            # Do not auto-create types; require the frontend to create via /event-types
            raise HTTPException(status_code=400, detail="event_type not found; create it via /event-types first")
        et_id = et.id

    event = Event(title=event_in.title, description=event_in.description, date=event_in.date, start_time=event_in.start_time, duration_minutes=event_in.duration_minutes, event_type_id=et_id, location=event_in.location, link=event_in.link)
    session.add(event)
    session.commit()
    session.refresh(event)

    # Build response with resolved type name
    type_name = None
    type_color = None
    if event.event_type_id:
        et = session.get(EventType, event.event_type_id)
        type_name = et.name if et else None
        type_color = et.color if et else None
    return EventRead(id=event.id, title=event.title, description=event.description, date=event.date, start_time=event.start_time, duration_minutes=event.duration_minutes, event_type_id=event.event_type_id, event_type_name=type_name, event_type_color=type_color, location=event.location, link=event.link)


@app.get("/events", response_model=List[EventRead])
def list_events(session: Session = Depends(get_session)):
    events = session.exec(select(Event)).all()
    out: List[EventRead] = []
    for ev in events:
        type_name = None
        type_color = None
        if ev.event_type_id:
            et = session.get(EventType, ev.event_type_id)
            type_name = et.name if et else None
            type_color = et.color if et else None
        out.append(EventRead(id=ev.id, title=ev.title, description=ev.description, date=ev.date, start_time=ev.start_time, duration_minutes=ev.duration_minutes, event_type_id=ev.event_type_id, event_type_name=type_name, event_type_color=type_color, location=ev.location, link=ev.link))
    return out


@app.delete("/events/{event_id}")
def delete_event(event_id: int, session: Session = Depends(get_session)):
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    session.delete(event)
    session.commit()
    return {"ok": True}


@app.put("/events/{event_id}", response_model=EventRead)
def update_event(event_id: int, event_in: EventCreate, session: Session = Depends(get_session)):
    """Replace an event's data. Expects full Event body (PUT semantics).

    The `id` in the path is authoritative; any `id` in the body is ignored.
    """
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Parse/validate date, start_time and duration
    if event_in.date is None or event_in.start_time is None or event_in.duration_minutes is None:
        raise HTTPException(status_code=400, detail="`date`, `start_time`, and `duration_minutes` are required")

    try:
        if not isinstance(event_in.date, date):
            event_in.date = date.fromisoformat(event_in.date)  # type: ignore[arg-type]
    except Exception:
        raise HTTPException(status_code=400, detail="`date` must be an ISO date string (YYYY-MM-DD) or a date object")

    try:
        if not isinstance(event_in.start_time, time):
            event_in.start_time = time.fromisoformat(event_in.start_time)  # type: ignore[arg-type]
    except Exception:
        raise HTTPException(status_code=400, detail="`start_time` must be an ISO time string (HH:MM[:SS]) or a time object")

    # validate duration
    try:
        if not isinstance(event_in.duration_minutes, int):
            event_in.duration_minutes = int(event_in.duration_minutes)  # type: ignore[arg-type]
    except Exception:
        raise HTTPException(status_code=400, detail="`duration_minutes` must be an integer number of minutes")

    if event_in.duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="`duration_minutes` must be a positive integer")

    # Resolve or create event type
    et_id = None
    if event_in.event_type_id is not None:
        et = session.get(EventType, event_in.event_type_id)
        if not et:
            raise HTTPException(status_code=400, detail="event_type_id not found")
        et_id = et.id
    elif event_in.event_type:
        stmt = select(EventType).where(EventType.name == event_in.event_type)
        et = session.exec(stmt).first()
        if not et:
            # Do not auto-create types on update either
            raise HTTPException(status_code=400, detail="event_type not found; create it via /event-types first")
        et_id = et.id

    # Update fields (ignore any body.id)
    event.title = event_in.title
    event.description = event_in.description
    event.date = event_in.date
    event.start_time = event_in.start_time
    event.duration_minutes = event_in.duration_minutes
    event.event_type_id = et_id
    event.location = event_in.location
    event.link = event_in.link

    session.add(event)
    session.commit()
    session.refresh(event)

    type_name = None
    type_color = None
    if event.event_type_id:
        et = session.get(EventType, event.event_type_id)
        type_name = et.name if et else None
        type_color = et.color if et else None
    return EventRead(id=event.id, title=event.title, description=event.description, date=event.date, start_time=event.start_time, duration_minutes=event.duration_minutes, event_type_id=event.event_type_id, event_type_name=type_name, event_type_color=type_color, location=event.location, link=event.link)


@app.get("/event-types", response_model=List[EventType])
def list_event_types(session: Session = Depends(get_session)):
    return session.exec(select(EventType)).all()


@app.post("/event-types", response_model=EventType)
def create_event_type(event_type: EventType, session: Session = Depends(get_session)):
    # allow frontend to add new types; ensure name uniqueness
    stmt = select(EventType).where(EventType.name == event_type.name)
    existing = session.exec(stmt).first()
    if existing:
        raise HTTPException(status_code=400, detail="event type already exists")
    session.add(event_type)
    session.commit()
    session.refresh(event_type)
    return event_type


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
