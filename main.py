"""main.py: 실행 진입점 (앱 팩토리 호출 + SocketIO 서버 구동)"""
from server import create_app, socketio

app = create_app()

if __name__ == '__main__':
    # SocketIO(멀티플레이) 를 사용하므로 socketio.run 으로 구동
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
