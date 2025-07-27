import sqlite3

conn = sqlite3.connect('chat.db')
cursor = conn.cursor()

# "status" sütunu varsa eklemez, yoksa ekler
try:
    cursor.execute("ALTER TABLE message ADD COLUMN status TEXT DEFAULT 'sent';")
    print("status sütunu eklendi.")
except sqlite3.OperationalError:
    print("status sütunu zaten var.")

conn.commit()
conn.close()
