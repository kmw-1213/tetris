/* multiplayer.js : SocketIO 기반 실시간 1:1 멀티플레이 */
let socket = null;
let mpRoom = null;
let mpSeed = null;
let mpConnected = false;
let lastStateSent = 0;

function mpInit() {
    if (socket) return;
    socket = io();

    socket.on('connect', () => { mpConnected = true; });
    socket.on('waiting', (d) => {
        document.getElementById('mm-status').innerText = 'Searching for opponent...';
    });
    socket.on('match_found', (d) => {
        mpRoom = d.room;
        mpSeed = d.seed;
        document.getElementById('mm-status').innerText = 'MATCH FOUND!';
        setTimeout(() => { closeModeSelect(); startMultiGame(d.seed, d.opponent); }, 600);
    });
    socket.on('opponent_state', (d) => { applyOpponentState(d); });
    socket.on('receive_garbage', (d) => { receiveGarbage(d.count); });
    socket.on('opponent_lost', (d) => { opponentLost(d); });
}

function mpFindMatch() {
    mpInit();
    document.getElementById('mm-status').innerText = 'Searching for opponent...';
    socket.emit('find_match', { name: 'PLAYER' });
}

function mpCancel() {
    if (socket) socket.emit('cancel_match');
}

function mpSendState(field, score, lines) {
    if (!socket || !mpRoom) return;
    let now = Date.now();
    if (now - lastStateSent < 80) return;   // 약 12fps 로 throttle
    lastStateSent = now;
    socket.emit('state_update', { field: field, score: score, lines: lines });
}

function mpSendGarbage(count) {
    if (socket && mpRoom) socket.emit('send_garbage', { count: count });
}

function mpGameOver(score) {
    if (socket && mpRoom) socket.emit('game_over', { score: score });
}
