"""database.py: SQLite 연결 및 테이블 초기화"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), 'tetris.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL DEFAULT 'PLAYER',
            mode        TEXT NOT NULL,
            score       INTEGER NOT NULL,
            lines       INTEGER NOT NULL DEFAULT 0,
            clear_time  INTEGER,          -- 클리어 시간 (초), NULL이면 미기록
            created     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # 기존 DB에 컬럼이 없으면 추가 (마이그레이션)
    try:
        cur.execute("ALTER TABLE scores ADD COLUMN clear_time INTEGER")
    except Exception:
        pass
    conn.commit()
    conn.close()
