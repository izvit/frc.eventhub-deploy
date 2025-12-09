#!/usr/bin/env python3
"""
Helper script to sync users from users.csv to the database.

This script:
1. Reads users.csv
2. Validates that user IDs and names match (throws error if names conflict)
3. Deletes any users in the database that are not in the CSV
4. Updates all database fields to match CSV values for existing users
5. Inserts new users from CSV that don't exist in the database
"""

import csv
import sys
from pathlib import Path
from sqlmodel import create_engine, Session, select

# Import User model and DATABASE_URL from main
from main import User, DATABASE_URL


def load_csv_users(csv_path: Path) -> dict[int, dict]:
    """Load users from CSV file and return a dict keyed by user ID."""
    users = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            user_id = int(row['id'])
            users[user_id] = {
                'id': user_id,
                'name': row['user'].strip(),  # trim whitespace
                'type': row['type'],
                'role': row['role'],
                'active': bool(int(row['active']))
            }
    return users


def load_db_users(engine) -> dict[int, dict]:
    """Load users from database and return a dict keyed by user ID."""
    users = {}
    with Session(engine) as session:
        db_users = session.exec(select(User)).all()
        for user in db_users:
            users[user.id] = {
                'id': user.id,
                'name': user.name,
                'type': user.type,
                'role': user.role,
                'active': user.active
            }
    return users


def sync_users(csv_path: Path = Path("./users.csv")):
    """Sync users from CSV to database: validate, update, and delete as needed."""
    
    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)
    
    # Load users from both sources
    print(f"Loading users from {csv_path}...")
    csv_users = load_csv_users(csv_path)
    print(f"  Found {len(csv_users)} users in CSV")
    
    print("Loading users from database...")
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    db_users = load_db_users(engine)
    print(f"  Found {len(db_users)} users in database")
    
    # Find IDs that exist in both, only in CSV, only in DB
    csv_ids = set(csv_users.keys())
    db_ids = set(db_users.keys())
    common_ids = csv_ids & db_ids
    csv_only = csv_ids - db_ids
    db_only = db_ids - csv_ids
    
    print(f"\nFound {len(common_ids)} user IDs in both CSV and database")
    if csv_only:
        print(f"Found {len(csv_only)} user ID(s) only in CSV: {sorted(csv_only)}")
    if db_only:
        print(f"Found {len(db_only)} user ID(s) only in database: {sorted(db_only)}")
    
    # First validate: check for name mismatches in common IDs
    print("\n=== VALIDATION PHASE ===")
    mismatches = []
    for user_id in sorted(common_ids):
        csv_name = csv_users[user_id]['name']
        db_name = db_users[user_id]['name']
        
        if csv_name != db_name:
            mismatches.append({
                'id': user_id,
                'csv_name': csv_name,
                'db_name': db_name
            })
    
    if mismatches:
        print("\n[ERROR] Name mismatches found!")
        print("=" * 60)
        for mismatch in mismatches:
            print(f"  User ID {mismatch['id']}:")
            print(f"    CSV name:      '{mismatch['csv_name']}'")
            print(f"    Database name: '{mismatch['db_name']}'")
        print("=" * 60)
        print(f"\nFound {len(mismatches)} name mismatch(es)")
        sys.exit(1)
    
    print("[OK] All user names match for common IDs")
    
    # Now sync: delete DB-only users, update all CSV users
    print("\n=== SYNC PHASE ===")
    
    with Session(engine) as session:
        # Delete users that are in DB but not in CSV
        if db_only:
            print(f"\nDeleting {len(db_only)} user(s) not in CSV...")
            for user_id in sorted(db_only):
                user = session.get(User, user_id)
                if user:
                    print(f"  Deleting user ID {user_id}: {user.name}")
                    session.delete(user)
            session.commit()
            print(f"[OK] Deleted {len(db_only)} user(s)")
        
        # Update or insert users from CSV
        updates_count = 0
        inserts_count = 0
        
        print(f"\nSyncing {len(csv_users)} users from CSV...")
        for user_id in sorted(csv_users.keys()):
            csv_user = csv_users[user_id]
            db_user = session.get(User, user_id)
            
            if db_user:
                # Update existing user if any field differs
                changed = False
                changes = []
                
                if db_user.name != csv_user['name']:
                    changes.append(f"name: '{db_user.name}' -> '{csv_user['name']}'")
                    db_user.name = csv_user['name']
                    changed = True
                
                if db_user.type != csv_user['type']:
                    changes.append(f"type: '{db_user.type}' -> '{csv_user['type']}'")
                    db_user.type = csv_user['type']
                    changed = True
                
                if db_user.role != csv_user['role']:
                    changes.append(f"role: '{db_user.role}' -> '{csv_user['role']}'")
                    db_user.role = csv_user['role']
                    changed = True
                
                if db_user.active != csv_user['active']:
                    changes.append(f"active: {db_user.active} -> {csv_user['active']}")
                    db_user.active = csv_user['active']
                    changed = True
                
                if changed:
                    session.add(db_user)
                    updates_count += 1
                    print(f"  Updated user ID {user_id} ({csv_user['name']}): {', '.join(changes)}")
            else:
                # Insert new user
                new_user = User(
                    id=csv_user['id'],
                    name=csv_user['name'],
                    type=csv_user['type'],
                    role=csv_user['role'],
                    active=csv_user['active']
                )
                session.add(new_user)
                inserts_count += 1
                print(f"  Inserted user ID {user_id}: {csv_user['name']}")
        
        session.commit()
        
        if updates_count > 0:
            print(f"\n[OK] Updated {updates_count} user(s)")
        if inserts_count > 0:
            print(f"[OK] Inserted {inserts_count} new user(s)")
        if updates_count == 0 and inserts_count == 0 and len(db_only) == 0:
            print("\n[OK] No changes needed - database already in sync")
    
    print("\n[OK] Sync complete!")
    return True


if __name__ == "__main__":
    csv_file = Path("./users.csv")
    
    # Allow optional command line argument for CSV path
    if len(sys.argv) > 1:
        csv_file = Path(sys.argv[1])
    
    sync_users(csv_file)
