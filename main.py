"""main.py: 실행 진입점 (앱 팩토리 호출 + SocketIO 서버 구동)"""
import os
from server import create_app, socketio

app = create_app()

if __name__ == '__main__':
    debug = os.environ.get('FLASK_ENV') == 'development'
    socketio.run(app, host='0.0.0.0', port=5000, debug=debug, allow_unsafe_werkzeug=True)