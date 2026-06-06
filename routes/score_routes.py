"""score_routes.py: 점수 저장 및 리더보드 API"""
from flask import Blueprint, request, jsonify
from db.database import get_connection

score_bp = Blueprint('score', __name__)


@score_bp.route('/api/score', methods=['POST'])
def save_score():
    data = request.json or {}
    name       = data.get('name', 'PLAYER')
    mode       = data.get('mode', 'Unknown')
    score      = int(data.get('score', 0))
    lines      = int(data.get('lines', 0))
    clear_time = data.get('clear_time')   # 초 단위 정수 or None
    if clear_time is not None:
        clear_time = int(clear_time)

    conn = get_connection()
    conn.execute(
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

    # Sprint/VS Computer 등 clear_time이 있는 모드는 시간 오름차순 우선
    time_modes = ('Sprint', 'VS Computer (Easy)', 'VS Computer (Normal)', 'VS Computer (Hard)', 'VS Computer (Extreme)')
    if mode in time_modes:
        order = "clear_time ASC, score DESC"
    else:
        order = "score DESC"

    if mode:
        rows = conn.execute(
            f"SELECT name, mode, score, lines, clear_time, created FROM scores "
            f"WHERE mode = ? ORDER BY {order} LIMIT 20", (mode,)
        ).fetchall()
    else:
        rows = conn.execute(
            f"SELECT name, mode, score, lines, clear_time, created FROM scores "
            f"ORDER BY score DESC LIMIT 20"
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])