CREATE TABLE studio_rooms (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, teacher_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE studio_works (id TEXT PRIMARY KEY NOT NULL, room_id TEXT NOT NULL REFERENCES studio_rooms(id), name TEXT NOT NULL, owner_hash TEXT NOT NULL, draft TEXT NOT NULL, published TEXT, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX studio_works_room ON studio_works(room_id);
--> statement-breakpoint
CREATE TABLE studio_feedback (id TEXT PRIMARY KEY NOT NULL, work_id TEXT NOT NULL REFERENCES studio_works(id), author TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL);
