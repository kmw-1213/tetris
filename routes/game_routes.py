"""game_routes.py: VS COMPUTER 의 컴퓨터 수 계산 API"""
from flask import Blueprint, request, jsonify

from computer import ComputerPlayer

game_bp = Blueprint('game', __name__)


@game_bp.route('/api/ai', methods=['POST'])
def get_ai_move():
    data = request.json
    field = data['field']
    block_type = data['type']
    difficulty = data.get('difficulty', 'Normal')
    error_chance = data.get('error_chance')

    cpu = ComputerPlayer(difficulty)
    move = cpu.decide(field, block_type, error_chance)
    return jsonify(move)
