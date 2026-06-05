"""multiplayer.py: SocketIO 기반 1:1 실시간 멀티플레이

흐름
  1) 클라이언트 'find_match' -> 대기열에 등록
  2) 두 명이 모이면 방(room) 생성, 동일 seed 전송 -> 양쪽 동일한 블록 순서
  3) 진행 중 'state_update' 상대 보드 중계, 'send_garbage' 공격 라인 전달
  4) 'game_over' 시 상대에게 승리 통보
"""
import random
import time

from flask_socketio import join_room, leave_room, emit

# 매치 대기열 (sid 리스트)
waiting = []
# sid -> room 매핑
rooms = {}


def register_socket_events(socketio):

    @socketio.on('connect')
    def on_connect():
        emit('connected', {'sid': 'ok'})

    @socketio.on('find_match')
    def on_find_match(data):
        from flask import request
        sid = request.sid
        name = (data or {}).get('name', 'PLAYER')

        # 이미 대기 중이면 무시
        if sid in waiting:
            return

        if waiting:
            # 대기자와 매칭
            opp_sid = waiting.pop(0)
            room = f'room_{int(time.time()*1000)}_{random.randint(0,9999)}'
            seed = random.randint(1, 2**31 - 1)

            join_room(room, sid=sid)
            join_room(room, sid=opp_sid)
            rooms[sid] = room
            rooms[opp_sid] = room

            # 동일 seed 로 양쪽 동기화
            socketio.emit('match_found',
                          {'room': room, 'seed': seed, 'opponent': name},
                          to=opp_sid)
            socketio.emit('match_found',
                          {'room': room, 'seed': seed, 'opponent': 'OPPONENT'},
                          to=sid)
        else:
            waiting.append(sid)
            emit('waiting', {'msg': 'Searching for opponent...'})

    @socketio.on('cancel_match')
    def on_cancel():
        from flask import request
        sid = request.sid
        if sid in waiting:
            waiting.remove(sid)

    @socketio.on('state_update')
    def on_state(data):
        """내 보드 상태를 같은 방의 상대에게 중계"""
        from flask import request
        room = rooms.get(request.sid)
        if room:
            emit('opponent_state', data, to=room, include_self=False)

    @socketio.on('send_garbage')
    def on_garbage(data):
        from flask import request
        room = rooms.get(request.sid)
        if room:
            emit('receive_garbage', {'count': data.get('count', 0)},
                 to=room, include_self=False)

    @socketio.on('game_over')
    def on_game_over(data):
        from flask import request
        room = rooms.get(request.sid)
        if room:
            emit('opponent_lost', data, to=room, include_self=False)

    @socketio.on('disconnect')
    def on_disconnect():
        from flask import request
        sid = request.sid
        if sid in waiting:
            waiting.remove(sid)
        room = rooms.pop(sid, None)
        if room:
            emit('opponent_lost', {'reason': 'disconnect'}, to=room, include_self=False)
            leave_room(room, sid=sid)
