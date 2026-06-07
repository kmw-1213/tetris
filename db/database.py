"""database.py: DB 연결 및 테이블 초기화
- DATABASE_URL 환경변수가 있으면 PostgreSQL (Render 배포용)
- 없으면 SQLite (로컬 개발용)
"""
import os
import sqlite3

DATABASE_URL = os.environ.get('DATABASE_URL', '')

# Render는 postgres:// 로 주는데 psycopg2는 postgresql:// 를 요구함
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

USE_PG = bool(DATABASE_URL)

if USE_PG:
    import psycopg2
    import psycopg2.extras

SQLITE_PATH = os.path.join(os.path.dirname(__file__), 'tetris.db')


def get_connection():
    if USE_PG:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return conn


def execute(conn, sql, params=()):
    """SQLite / PostgreSQL 통합 실행 (? → %s 자동 변환)"""
    if USE_PG:
        sql = sql.replace('?', '%s')
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    else:
        cur = conn.cursor()
    cur.execute(sql, params)
    return cur


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    if USE_PG:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS scores (
                id          SERIAL PRIMARY KEY,
                name        TEXT NOT NULL DEFAULT 'PLAYER',
                mode        TEXT NOT NULL,
                score       INTEGER NOT NULL,
                lines       INTEGER NOT NULL DEFAULT 0,
                clear_time  INTEGER,
                created     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    else:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS scores (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL DEFAULT 'PLAYER',
                mode        TEXT NOT NULL,
                score       INTEGER NOT NULL,
                lines       INTEGER NOT NULL DEFAULT 0,
                clear_time  INTEGER,
                created     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            cur.execute("ALTER TABLE scores ADD COLUMN clear_time INTEGER")
        except Exception:
            pass

    conn.commit()
    conn.close()