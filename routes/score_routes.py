"""score_routes.py: 점수 저장 및 리더보드 API"""
from flask import Blueprint, request, jsonify
from db.database import get_connection, execute, USE_PG

score_bp = Blueprint('score', __name__)


@score_bp.route('/api/score', methods=['POST'])
def save_score():
    data = request.json or {}
    name       = data.get('name', 'PLAYER')
    mode       = data.get('mode', 'Unknown')
    score      = int(data.get('score', 0))
    lines      = int(data.get('lines', 0))
    clear_time = data.get('clear_time')
    if clear_time is not None:
        clear_time = int(clear_time)

    conn = get_connection()
    execute(conn,
        "INSERT INTO scores (name, mode, score, lines, clear_time) VALUES (?, ?, ?, ?, ?)",
        (name, mode, score, lines, clear_time),
    )
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@score_bp.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    mode = request.args.get('mode')
    conn = get_connection()

    time_modes = ('Sprint', 'VS Computer (Easy)', 'VS Computer (Normal)',
                  'VS Computer (Hard)', 'VS Computer (Extreme)')
    order = "clear_time ASC, score DESC" if mode in time_modes else "score DESC"

    if mode:
        cur = execute(conn,
            f"SELECT name, mode, score, lines, clear_time, created FROM scores "
            f"WHERE mode = ? ORDER BY {order} LIMIT 20", (mode,))
    else:
        cur = execute(conn,
            f"SELECT name, mode, score, lines, clear_time, created FROM scores "
            f"ORDER BY score DESC LIMIT 20")

    rows = cur.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])