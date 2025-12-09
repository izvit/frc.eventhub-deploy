from pathlib import Path
import shutil
import datetime
import sys
from datetime import date, time

from sqlmodel import create_engine, Session, select, SQLModel

# Import Event and EventType and DATABASE_URL from main so models are registered
from main import Event, EventType, DATABASE_URL


def backup_db(db_path: Path) -> Path:
    ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    bak = db_path.with_name(f"{db_path.name}.bak.{ts}")
    shutil.copy(db_path, bak)
    return bak


def reset_database():
    db_path = Path("./calendar.db")
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

    if db_path.exists():
        bak = backup_db(db_path)
        print(f"Backed up existing database to: {bak}")
        db_path.unlink()

    # Create fresh schema
    SQLModel.metadata.create_all(engine)
    print("Created new database with current schema.")

    # Seed default event types with colors
    default_types = [
        ("Competition", "#e74c3c"),
        ("Training", "#3498db"),
        ("Meeting", "#2ecc71"),
        ("Outreach", "#f1c40f"),
        ("Other", "#95a5a6"),
    ]
    with Session(engine) as session:
        for name, color in default_types:
            stmt = select(EventType).where(EventType.name == name)
            if not session.exec(stmt).first():
                session.add(EventType(name=name, color=color))
        session.commit()
    print("Seeded default event types: ", [n for n, _ in default_types])

    # Optionally seed some sample events for testing when --sample or -s is passed
    if len(sys.argv) > 1 and sys.argv[1] in ("--sample", "-s"):
        sample_events = [
            {
                "title": "FLL Coaches Meeting",
                "description": "__All coaches are encouraged to attend__",
                "date": date.today().isoformat(),
                "start_time": "15:00",
                "duration_minutes": 60,
                "link": "https://example.com/team-sync",
                "type": "Meeting",
                "location": "Shop - Conference Room",
            },
            {
                "title": "Outreach Event - Bolton Library",
                "description": "Please be at the Library early to setup.  If any there are any questions please reach out to Michelle.",
                "date": (date.today() + datetime.timedelta(days=2)).isoformat(),
                "start_time": "09:00",
                "duration_minutes": 120,
                "link": "https://example.com/onboarding",
                "type": "Outreach",
                "location": "738 Main St, Bolton, MA 01740",
            },
        ]

        with Session(engine) as session:
            for s in sample_events:
                stmt = select(EventType).where(EventType.name == s["type"])
                et = session.exec(stmt).first()
                if not et:
                    print(f"Skipping sample event; event type not found: {s['type']}")
                    continue
                ev = Event(
                    title=s.get("title", s["description"]),
                    description=s["description"],
                    date=date.fromisoformat(s["date"]),
                    start_time=time.fromisoformat(s["start_time"]),
                    duration_minutes=s.get("duration_minutes", 60),
                    event_type_id=et.id,
                    location=s.get("location"),
                    link=s.get("link"),
                )
                session.add(ev)
            session.commit()
        print("Seeded sample events")


if __name__ == "__main__":
    confirm = ""
    if len(sys.argv) > 1 and sys.argv[1] in ("-y", "--yes"):
        confirm = "y"
    else:
        confirm = input("This will backup and recreate ./calendar.db. Continue? [y/N]: ")

    if confirm.lower().startswith("y"):
        reset_database()
    else:
        print("Aborted.")
