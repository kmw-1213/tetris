# 테트리스
# tetris

```

tetris/
│            
├── app.py              ── Flask 서버 / 소켓 진입점           
├── static/             ── 정적 파일
│   ├── css/    
│   │   └── style.css       ── 공통 스타일
│   ├── js/
│   ├── game.js             ── 게임 로직 / 블록 제어
│   └── multiplayer.js      ── 소켓 / 멀티플레이
├── db/
│   └── database.py         ── DB 연결 / ORM 설정
├── routes/             ── URL 라우터 모음
│   ├── game_routes.py      ── 게임 관련 API 엔드포인트
│   ├── score_routes.py     ── 점수 / 리더보드 API
│   └── multiplayer.py      ── 멀티플레이 소켓 라우터
├── templates/          ── HTML 템플릿
│   ├── index.html          ── 메인 화면 / 모드 선택
│   ├── modals.html         ── 팝업 / 모달 UI
│   └── sidebar.html        ── 사이드바 / 점수판 UI
├── computer.py         ── AI 컴퓨터 플레이어 로직
├── main.py             ── 앱 실행 진입점
├── Procfile            ── Render 프로세스 실행 명령
├── requirements.txt    ── Python 패키지 목록
└── server.py           ── 소켓 서버 설정 / 초기화

```