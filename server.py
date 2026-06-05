"""server.py: Flask 앱 팩토리 (블루프린트 + SocketIO + DB 등록)"""
from flask import Flask, render_template
from flask_socketio import SocketIO

from db.database import init_db
from routes.game_routes import game_bp
from routes.score_routes import score_bp

# 멀티플레이용 SocketIO 인스턴스 (확장처럼 분리 선언)
socketio = SocketIO(cors_allowed_origins='*')


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'tetris-secret-change-me'

    init_db()

    app.register_blueprint(game_bp)
    app.register_blueprint(score_bp)

    @app.route('/')
    def index():
        return render_template('index.html')

    # 멀티플레이 소켓 이벤트 등록
    from routes.multiplayer import register_socket_events
    register_socket_events(socketio)

    socketio.init_app(app)
    return app
