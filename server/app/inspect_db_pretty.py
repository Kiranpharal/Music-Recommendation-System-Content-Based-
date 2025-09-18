import sqlite3
from tabulate import tabulate

DB_FILE = "music_recommender.db"

# Connect to the SQLite database
conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()

# Get all table names
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print(f"Found tables: {[t[0] for t in tables]}")

# Print data for each table
for table_name in tables:
    table = table_name[0]
    print(f"\nTable: {table}")
    
    # Get column names
    cursor.execute(f"PRAGMA table_info({table});")
    columns_info = cursor.fetchall()
    column_names = [col[1] for col in columns_info]
    
    # Get all rows
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    
    if rows:
        print(tabulate(rows, headers=column_names, tablefmt="grid"))
    else:
        print("No data in this table.")

# Close connection
conn.close()
