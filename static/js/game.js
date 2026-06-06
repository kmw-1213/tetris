let pCanvas = document.getElementById('playerCanvas'), pCtx = pCanvas.getContext('2d');
let aCanvas = document.getElementById('aiCanvas'), aCtx = aCanvas.getContext('2d');
let pNextCanvas = document.getElementById('pNextCanvas'), pNextCtx = pNextCanvas.getContext('2d');
let aNextCanvas = document.getElementById('aNextCanvas'), aNextCtx = aNextCanvas.getContext('2d');

let pField, aField, pBlock, aBlock;
let pNextQueue = [], aNextQueue = [];
let pScore, pLines, pLevel, aScore, aLines;
let gameActive = false;
let mainMode = 'Single';
let currentMode = 'VS Computer';
let currentDiff = 'Easy', errorChance = 0.15;
let aiTargetX = 3, aiTargetRot = 0, aiReady = false, blitzTimer = 120, timerInterval;
let pTimeoutId, aiTimeoutId;
let pEffects = [], aEffects = [];

/* 경과 타이머 */
let elapsedSeconds = 0, elapsedInterval = null;

let playerName = localStorage.getItem('tetris_name') || '';
let lastOverData = { score: 0, lines: 0, mode: '', clearTime: null, canSave: false };

/* ===== RNG ===== */
let rngState = (Math.random() * 2 ** 31) | 0;
function rng() {
    rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function seedRng(seed) { rngState = seed | 0; }

/* ===== 7-BAG ===== */
let pBag = [], aBag = [];
function refillBag(bag) {
    let arr = [...TYPES];
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    bag.push(...arr);
}
function drawBlock(bag) {
    if (bag.length === 0) refillBag(bag);
    return { type: bag.shift(), rotation: 0, x: 3, y: -3 };
}
function fillQueue(q, bag) {
    while (q.length < 3) q.push(drawBlock(bag));
}

/* ===== 시간 포맷 ===== */
function fmtTime(sec) {
    let m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ===== 경과 타이머 ===== */
function startElapsedTimer() {
    elapsedSeconds = 0;
    clearInterval(elapsedInterval);
    document.getElementById('elapsed-val').innerText = '00:00';
    elapsedInterval = setInterval(() => {
        elapsedSeconds++;
        document.getElementById('elapsed-val').innerText = fmtTime(elapsedSeconds);
    }, 1000);
}
function stopElapsedTimer() { clearInterval(elapsedInterval); }

/* ===== Sprint 남은 줄 업데이트 ===== */
function updateSprintLinesLeft() {
    let left = Math.max(0, 40 - pLines);
    let el = document.getElementById('sll-val');
    if (el) el.innerText = left;
}

/* ===== 모달 제어 ===== */
function openModeSelect() {
    document.getElementById('mode-modal').style.display = 'flex';
    backToMain();
}
function closeModeSelect() { document.getElementById('mode-modal').style.display = 'none'; }

function backToMain() {
    document.getElementById('step-main').style.display = 'block';
    document.getElementById('step-single').style.display = 'none';
    document.getElementById('step-multi').style.display = 'none';
}

function selectMain(mode) {
    mainMode = mode;
    document.getElementById('step-main').style.display = 'none';
    if (mode === 'Multi') {
        document.getElementById('step-multi').style.display = 'block';
        mpFindMatch();
    } else {
        document.getElementById('step-single').style.display = 'block';
        currentMode = 'VS Computer';
        document.getElementById('opt-vs').classList.add('selected');
    }
}

function cancelMatch() { mpCancel(); backToMain(); }

function setDiff(diff, e) {
    e.stopPropagation();
    currentDiff = diff; currentMode = 'VS Computer';
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('#step-single .mode-option').forEach(o => o.classList.remove('selected'));
    document.getElementById('opt-vs').classList.add('selected');
}

function selectSubMode(mode) {
    currentMode = mode;
    document.querySelectorAll('#step-single .mode-option').forEach(o => o.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

function triggerStart() { closeModeSelect(); initGame(); }

/* ===== 리더보드 ===== */
let currentLbMode = 'VS Computer';
let currentVsSubMode = 'VS Computer (Easy)';

function showLeaderboard() {
    currentLbMode = 'VS Computer';
    currentVsSubMode = 'VS Computer (Easy)';
    document.querySelectorAll('.lb-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    document.getElementById('lb-vs-subtabs').style.display = 'flex';
    document.querySelectorAll('.lb-subtab').forEach((t, i) => t.classList.toggle('active', i === 0));
    document.getElementById('lb-modal').style.display = 'flex';
    loadLeaderboard();
}

function switchLbTab(mode, e) {
    currentLbMode = mode;
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    // VS CPU 탭만 서브탭 표시
    let subEl = document.getElementById('lb-vs-subtabs');
    if (mode === 'VS Computer') {
        subEl.style.display = 'flex';
        currentVsSubMode = 'VS Computer (Easy)';
        document.querySelectorAll('.lb-subtab').forEach((t, i) => t.classList.toggle('active', i === 0));
    } else {
        subEl.style.display = 'none';
    }
    loadLeaderboard();
}

function switchVsSubTab(subMode, e) {
    currentVsSubMode = subMode;
    document.querySelectorAll('.lb-subtab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    loadLeaderboard();
}

async function loadLeaderboard() {
    let list = document.getElementById('lb-list');
    list.innerHTML = '<div class="lb-empty">불러오는 중...</div>';
    // VS Computer: 난이도 서브모드로 조회
    let queryMode = (currentLbMode === 'VS Computer') ? currentVsSubMode : currentLbMode;
    let data = await fetchLeaderboard(queryMode);
    if (!data || data.length === 0) {
        list.innerHTML = '<div class="lb-empty">아직 기록이 없습니다.</div>';
        return;
    }
    let showTime = (currentLbMode === 'Sprint' || currentLbMode === 'VS Computer');
    list.innerHTML = data.map((r, i) =>
        `<div class="lb-row">
            <span class="rank">${i + 1}</span>
            <span class="name">${r.name}</span>
            ${showTime && r.clear_time != null
                ? `<span class="score lb-time">${fmtTime(r.clear_time)}</span>`
                : `<span class="score">${r.score.toLocaleString()}</span>`
            }
        </div>`
    ).join('');
}

/* ===== 멀티플레이 진입 ===== */
function startMultiGame(seed, oppName) {
    currentMode = 'Multi';
    seedRng(seed);
    initGame();
    document.getElementById('ai-title').innerText = 'OPPONENT';
}

/* ===== 게임 초기화 ===== */
function initGame() {
    pField = Array(20).fill().map(()=>Array(10).fill(0));
    aField = Array(20).fill().map(()=>Array(10).fill(0));
    pScore = 0; pLines = 0; pLevel = 1; aScore = 0; aLines = 0; blitzTimer = 120;
    aiTargetX = 3; aiTargetRot = 0; aiReady = false;
    pEffects = []; aEffects = [];
    pBag = []; aBag = [];
    gameActive = true;
    document.getElementById('main-content').classList.remove('danger-alert');

    if (currentMode !== 'Multi') rngState = (Math.random() * 2 ** 31) | 0;
    pNextQueue = []; fillQueue(pNextQueue, pBag);
    pBlock = pNextQueue.shift(); fillQueue(pNextQueue, pBag);

    /* 타이머 UI 전부 숨기고 시작 */
    document.getElementById('top-timer').style.display = 'none';
    document.getElementById('ingame-timer').style.display = 'none';
    document.getElementById('sprint-lines-left').style.display = 'none';

    clearInterval(timerInterval);
    stopElapsedTimer();
    clearTimeout(pTimeoutId); clearTimeout(aiTimeoutId);

    let aiPanel = document.getElementById('ai-panel');

    if (currentMode === 'VS Computer') {
        aiPanel.classList.remove('hidden-mode');
        document.getElementById('main-content').classList.add('vs-mode');
        document.getElementById('ai-title').innerText = `AI BOT - ${currentDiff.toUpperCase()}`;
        errorChance = currentDiff === 'Easy' ? 0.01 : currentDiff === 'Normal' ? 0.003 : currentDiff === 'Hard' ? 0.0005 : 0.0;
        aNextQueue = []; fillQueue(aNextQueue, aBag);
        aBlock = aNextQueue.shift(); fillQueue(aNextQueue, aBag);
        askAIBackend();
        runAiTick();
        /* VS Computer: 경과 타이머 */
        document.getElementById('ingame-timer').style.display = 'flex';
        document.getElementById('ingame-timer-label').innerText = 'TIME';
        startElapsedTimer();
    } else if (currentMode === 'Multi') {
        aiPanel.classList.remove('hidden-mode');
        document.getElementById('main-content').classList.add('vs-mode');
        document.getElementById('ai-title').innerText = 'OPPONENT';
        aBlock = null; aNextQueue = [];
    } else {
        aiPanel.classList.add('hidden-mode');
        document.getElementById('main-content').classList.remove('vs-mode');
    }

    if (currentMode === 'Blitz') {
        /* Blitz: 카운트다운 */
        document.getElementById('top-timer').style.display = 'block';
        document.getElementById('timer-val').innerText = blitzTimer;
        timerInterval = setInterval(() => {
            blitzTimer--;
            document.getElementById('timer-val').innerText = blitzTimer;
            if (blitzTimer <= 0) endGame("TIME UP!");
        }, 1000);
    }

    if (currentMode === 'Sprint') {
        /* Sprint: 경과 타이머 + 남은 줄 */
        document.getElementById('ingame-timer').style.display = 'flex';
        document.getElementById('ingame-timer-label').innerText = 'TIME';
        document.getElementById('sprint-lines-left').style.display = 'flex';
        updateSprintLinesLeft();
        startElapsedTimer();
    }

    runPlayerTick();
    requestAnimationFrame(renderLoop);
}

/* ===== 필드 유틸 ===== */
function getFieldHeight(field) {
    for (let i = 0; i < 20; i++) if (field[i].some(c => c !== 0)) return 20 - i;
    return 0;
}

function sendGarbageLines(targetField, count) {
    if (count <= 0) return;
    for (let c = 0; c < count; c++) {
        targetField.shift();
        let g = Array(10).fill('G');
        g[Math.floor(Math.random() * 10)] = 0;
        targetField.push(g);
    }
    // 플레이어 필드에 garbage가 들어왔을 때 낙하 중인 블록이 파묻히지 않도록 y 보정
    if (targetField === pField && pBlock) {
        pBlock.y -= count;
        // 보정 후에도 충돌이면(이미 꽉 찼으면) 강제 lock
        if (checkCollide(pBlock, pField)) {
            clearTimeout(pTimeoutId);
            lockPlayerBlock(false);
        }
    }
}

function checkDangerZone() {
    let h = getFieldHeight(pField);
    let s = document.getElementById('main-content');
    if (h >= 17) s.classList.add('danger-alert'); else s.classList.remove('danger-alert');
}

function isTopOut(field) {
    return field[0].some(c => c !== 0) || field[1].some(c => c !== 0);
}

/* ===== 낙하 속도 =====
   Sprint / Blitz 는 고정 500ms
   VS Computer / Multi 는 레벨+높이 기반 + 점수차 패널티
*/
function getDropSpeed(isAi) {
    if (currentMode === 'Blitz' || currentMode === 'Sprint') return 500;
    let h = isAi ? getFieldHeight(aField) : getFieldHeight(pField);
    let levelSpeed = Math.max(100, 800 - (pLevel * 70));
    let base = Math.max(50, levelSpeed - (h * 25));

    // VS Computer / Multi: 점수차 패널티 (점수가 낮은 쪽 블록이 빨리 내려옴)
    // 100점 차이마다 5%씩 빠르게, 최대 60% 가속
    if (currentMode === 'VS Computer' || currentMode === 'Multi') {
        let myScore  = isAi ? aScore : pScore;
        let oppScore = isAi ? pScore  : aScore;
        let gap = oppScore - myScore; // 내가 뒤처질수록 양수
        if (gap > 0) {
            // 100점마다 5% 가속, 최대 60% 가속
            let penalty = Math.min(0.6, Math.floor(gap / 100) * 0.05);
            base = Math.max(50, Math.round(base * (1 - penalty)));
        }
    }
    return base;
}

/* ===== 플레이어 블록 잠금 ===== */
function lockPlayerBlock(isHardDrop = false) {
    if (!gameActive) return;
    clearTimeout(pTimeoutId);
    freezeBlock(pBlock, pField);
    if (isHardDrop) triggerHardDropEffect(pBlock, pEffects);

    if (isTopOut(pField)) { endGame("GAME OVER"); return; }

    let cleared = clearLines(pField, true);
    if (cleared > 0) {
        pLines += cleared;
        pScore += cleared * cleared * 100;
        /* Sprint/Blitz 는 레벨 고정 */
        if (currentMode !== 'Blitz' && currentMode !== 'Sprint') {
            pLevel = Math.floor(pLines / 10) + 1;
        }
        if (currentMode === 'VS Computer') sendGarbageLines(aField, cleared);
        if (currentMode === 'Multi') mpSendGarbage(cleared);
    }
    checkDangerZone();

    if (currentMode === 'Sprint') {
        updateSprintLinesLeft();
        if (pLines >= 40) { endGame("SPRINT WIN!"); return; }
    }

    pBlock = pNextQueue.shift(); fillQueue(pNextQueue, pBag);
    updateUiStats();
    runPlayerTick();
}

function runPlayerTick() {
    if (!gameActive) return;
    pBlock.y++;
    if (checkCollide(pBlock, pField)) { pBlock.y--; lockPlayerBlock(false); return; }
    updateUiStats();
    pTimeoutId = setTimeout(runPlayerTick, getDropSpeed(false));
}

/* ===== AI 틱 ===== */

function lockAiBlock() {
    if (!gameActive) return;
    freezeBlock(aBlock, aField);
    if (isTopOut(aField)) { endGame("AI DEFEATED!"); return; }
    let cleared = clearLines(aField, false);
    if (cleared > 0) {
        aLines += cleared; aScore += cleared * cleared * 100;
        sendGarbageLines(pField, cleared); checkDangerZone();
    }
    aBlock = aNextQueue.shift(); fillQueue(aNextQueue, aBag);
    if (checkCollide(aBlock, aField)) { endGame("AI DEFEATED!"); return; }
    aiReady = false;
    askAIBackend();
}

function runAiTick() {
    if (!gameActive || currentMode !== 'VS Computer') return;
    let speed = getDropSpeed(true);

    /* ── Extreme: AI 응답이 오면 즉시 회전+이동+하드드롭 (스페이스바 수준) ── */
    if (currentDiff === 'Extreme') {
        if (!aiReady) {
            // 응답 대기 중: 짧은 간격으로 재확인 (최대 16ms 대기)
            aiTimeoutId = setTimeout(runAiTick, 16);
            return;
        }
        // 응답 도착 즉시: 회전/x 텔레포트 후 하드드롭
        aBlock.rotation = aiTargetRot;
        aBlock.x = aiTargetX;
        // x가 충돌 시 조금 조정
        let tries = 0;
        while (checkCollide(aBlock, aField) && tries < 5) {
            if (aBlock.x > 0) aBlock.x--; else aBlock.x++;
            tries++;
        }
        // y를 맨 위(-3)부터 시작해서 충돌 없는 첫 위치 확보 후 하드드롭
        aBlock.y = -3;
        while (aBlock.y < 20 && checkCollide(aBlock, aField)) aBlock.y++;
        // 착지 가능한 공간이 없으면(y가 이미 20 이상) AI 패배
        if (aBlock.y >= 20) { endGame("AI DEFEATED!"); return; }
        // 하드드롭: 바닥까지 즉시 이동
        while (!checkCollide(aBlock, aField)) aBlock.y++;
        aBlock.y--;
        // 착지 위치가 topOut 영역(row 0~1)이면 AI 패배
        if (aBlock.y <= 1) { freezeBlock(aBlock, aField); endGame("AI DEFEATED!"); return; }
        updateUiStats();
        lockAiBlock();
        aiTimeoutId = setTimeout(runAiTick, speed);
        return;
    }

    /* ── Hard: 이동할 때도 동시에 낙하 ── */
    if (currentDiff === 'Hard') {
        if (aBlock.y < 0) { aBlock.y++; updateUiStats(); aiTimeoutId = setTimeout(runAiTick, speed); return; }
        if (!aiReady) {
            aBlock.y++;
            if (checkCollide(aBlock, aField)) { aBlock.y--; lockAiBlock(); }
            updateUiStats(); aiTimeoutId = setTimeout(runAiTick, speed); return;
        }
        let needsMove = (aBlock.rotation !== aiTargetRot) || (aBlock.x !== aiTargetX);
        if (needsMove) {
            if (aBlock.rotation !== aiTargetRot) aBlock.rotation = (aBlock.rotation + 1) % SHAPES[aBlock.type].length;
            else if (aBlock.x < aiTargetX) aBlock.x++;
            else if (aBlock.x > aiTargetX) aBlock.x--;
            // 이동하면서 동시에 낙하
            aBlock.y++;
            if (checkCollide(aBlock, aField)) { aBlock.y--; lockAiBlock(); updateUiStats(); aiTimeoutId = setTimeout(runAiTick, speed); return; }
            updateUiStats(); aiTimeoutId = setTimeout(runAiTick, speed); return;
        }
        // 목표 도달 → 하드드롭
        while (!checkCollide(aBlock, aField)) aBlock.y++;
        aBlock.y--;
        updateUiStats(); lockAiBlock(); aiTimeoutId = setTimeout(runAiTick, speed); return;
    }

    /* ── Normal / Easy: 이동하면서 낙하, 목표 도달 후 하드드롭 ── */
    if (aBlock.y < 0) { aBlock.y++; updateUiStats(); aiTimeoutId = setTimeout(runAiTick, speed); return; }
    if (!aiReady) {
        aBlock.y++;
        if (checkCollide(aBlock, aField)) { aBlock.y--; lockAiBlock(); }
        updateUiStats(); aiTimeoutId = setTimeout(runAiTick, speed); return;
    }
    let needsMove = (aBlock.rotation !== aiTargetRot) || (aBlock.x !== aiTargetX);
    if (needsMove) {
        if (aBlock.rotation !== aiTargetRot) aBlock.rotation = (aBlock.rotation + 1) % SHAPES[aBlock.type].length;
        else if (aBlock.x < aiTargetX) aBlock.x++;
        else if (aBlock.x > aiTargetX) aBlock.x--;
        aBlock.y++;
        if (checkCollide(aBlock, aField)) { aBlock.y--; lockAiBlock(); updateUiStats(); aiTimeoutId = setTimeout(runAiTick, speed); return; }
        updateUiStats(); aiTimeoutId = setTimeout(runAiTick, speed); return;
    }
    // 목표 도달 → 하드드롭
    while (!checkCollide(aBlock, aField)) aBlock.y++;
    aBlock.y--;
    updateUiStats(); lockAiBlock(); aiTimeoutId = setTimeout(runAiTick, speed);
}

/* ===== 멀티플레이 ===== */
function applyOpponentState(d) {
    if (currentMode !== 'Multi') return;
    aField = d.field; aScore = d.score; aLines = d.lines;
    updateUiStats();
}
function receiveGarbage(count) {
    if (currentMode !== 'Multi' || !gameActive) return;
    sendGarbageLines(pField, count); checkDangerZone();
}
function opponentLost(d) {
    if (currentMode !== 'Multi' || !gameActive) return;
    endGame("YOU WIN! (Opponent defeated)");
}

/* ===== 충돌/물리 ===== */
function checkCollide(b, field) {
    let shape = SHAPES[b.type][b.rotation];
    for(let i=0;i<4;i++) for(let j=0;j<4;j++) if(shape.includes(i*4+j)){
        let ny=b.y+i, nx=b.x+j;
        if(nx<0||nx>=10||ny>=20) return true;
        if(ny>=0 && field[ny][nx]!==0) return true;
    }
    return false;
}

function tryRotate(b, field) {
    let old = b.rotation;
    b.rotation = (b.rotation + 1) % SHAPES[b.type].length;
    const kicks = [0, -1, 1, -2, 2];
    for (let k of kicks) { b.x += k; if (!checkCollide(b, field)) return true; b.x -= k; }
    b.y -= 1;
    for (let k of kicks) { b.x += k; if (!checkCollide(b, field)) return true; b.x -= k; }
    b.y += 1;
    b.rotation = old;
    return false;
}

function freezeBlock(b, field) {
    let shape = SHAPES[b.type][b.rotation];
    for(let i=0;i<4;i++) for(let j=0;j<4;j++) if(shape.includes(i*4+j))
        if(b.y+i>=0 && b.y+i<20) field[b.y+i][b.x+j]=b.type;
}

function clearLines(field, isPlayer) {
    let rows = [];
    for (let i=0;i<20;i++) if (field[i].every(c=>c!==0)) rows.push(i);
    if (rows.length>0) {
        if (isPlayer) rows.forEach(r=>pEffects.push({type:'lineFlash',y:r,life:12,maxLife:12}));
        rows.forEach(r=>{ field.splice(r,1); field.unshift(Array(10).fill(0)); });
    }
    return rows.length;
}

function triggerHardDropEffect(b, arr) {
    let shape = SHAPES[b.type][b.rotation];
    for(let i=0;i<4;i++) for(let j=0;j<4;j++) if(shape.includes(i*4+j))
        if(b.y+i>=0) arr.push({type:'blockFlash',x:b.x+j,y:b.y+i,color:COLOR_MAP[b.type].border,life:10,maxLife:10});
}

function getRenderField() {
    let f = pField.map(r => r.slice());
    if (pBlock) {
        let shape = SHAPES[pBlock.type][pBlock.rotation];
        for(let i=0;i<4;i++) for(let j=0;j<4;j++) if(shape.includes(i*4+j)){
            let y=pBlock.y+i, x=pBlock.x+j;
            if(y>=0 && y<20 && x>=0 && x<10) f[y][x]=pBlock.type;
        }
    }
    return f;
}

function updateUiStats() {
    document.getElementById('p-score').innerText = pScore.toLocaleString();
    document.getElementById('p-lines').innerText = pLines.toLocaleString();
    document.getElementById('p-level').innerText = pLevel;
    document.getElementById('a-score').innerText = aScore.toLocaleString();
    document.getElementById('a-lines').innerText = aLines.toLocaleString();
}

/* ===== 게임 종료 ===== */
function endGame(msg) {
    gameActive = false;
    stopElapsedTimer();
    document.getElementById('main-content').classList.remove('danger-alert');
    clearInterval(timerInterval); clearTimeout(pTimeoutId); clearTimeout(aiTimeoutId);

    /*
      기록 저장 조건:
        VS Computer → AI 이겼을 때만  (msg === "AI DEFEATED!")
        Sprint      → 40줄 클리어 시만  (msg === "SPRINT WIN!")
        Blitz       → 항상
        Classic     → 항상
        Multi       → 내가 이겼을 때만
    */
    let canSave = false;
    let clearTime = null;

    if (currentMode === 'VS Computer') {
        canSave = (msg === 'AI DEFEATED!');
        if (canSave) clearTime = elapsedSeconds;
        // 저장 모드명에 난이도 포함
        if (canSave) lastOverData.mode = `VS Computer (${currentDiff})`;
    } else if (currentMode === 'Sprint') {
        canSave = (msg === 'SPRINT WIN!');
        if (canSave) clearTime = elapsedSeconds;
    } else if (currentMode === 'Blitz') {
        canSave = true;
    } else if (currentMode === 'Classic') {
        canSave = true;
    } else if (currentMode === 'Multi') {
        canSave = msg.startsWith('YOU WIN');
        if (!canSave) mpGameOver(pScore);
    }

    lastOverData = { score: pScore, lines: pLines, mode: currentMode, clearTime, canSave };
    // VS Computer 승리: 모드명에 난이도 포함 (위에서 이미 설정됐으면 유지)
    if (currentMode === 'VS Computer' && canSave) {
        lastOverData.mode = `VS Computer (${currentDiff})`;
    }
    // 게임오버 메시지 변환: AI 이겼으면 VICTORY!
    let displayMsg = (currentMode === 'VS Computer' && msg === 'AI DEFEATED!') ? 'VICTORY!' : msg;
    showGameOver(displayMsg);
}

/* ===== 게임오버 화면 ===== */
function showGameOver(msg) {
    let { score, lines, clearTime, canSave } = lastOverData;

    // 아이콘: VICTORY! 또는 WIN 이면 트로피, 아니면 깃발
    let isVictory = (msg === 'VICTORY!' || msg.startsWith('YOU WIN') || msg === 'SPRINT WIN!');
    let iconEl = document.querySelector('.over-icon i');
    iconEl.className = isVictory ? 'fa-solid fa-trophy' : 'fa-solid fa-skull';
    document.querySelector('.over-icon').style.color = isVictory ? 'var(--neon-green)' : 'var(--neon-red)';
    iconEl.style.textShadow = isVictory
        ? '0 0 25px var(--neon-green)'
        : '0 0 25px var(--neon-red)';

    document.getElementById('over-title').innerText = msg;
    document.getElementById('over-score').innerText = score.toLocaleString();
    document.getElementById('over-lines').innerText = lines.toLocaleString();

    /* 클리어 시간 칸: VS Computer 승리 / Sprint 클리어 시 표시 */
    let timeStatEl = document.getElementById('over-time-stat');
    let timeValEl  = document.getElementById('over-time-val');
    if (clearTime !== null && clearTime !== undefined) {
        timeStatEl.style.display = 'block';
        timeValEl.innerText = fmtTime(clearTime);
    } else {
        timeStatEl.style.display = 'none';
    }

    /* 닉네임 입력 + 저장 버튼: canSave 일 때만 */
    let nameArea = document.getElementById('over-name-area');
    let saveBtn  = document.getElementById('over-save-btn');
    let skipLabel = document.getElementById('over-skip-label');
    if (canSave) {
        nameArea.style.display = 'block';
        saveBtn.style.display  = 'inline-block';
        skipLabel.innerText = 'SKIP';
        document.getElementById('over-name').value = playerName || '';
    } else {
        nameArea.style.display = 'none';
        saveBtn.style.display  = 'none';
        skipLabel.innerText = 'CLOSE';
    }

    document.getElementById('over-modal').style.display = 'flex';
    if (canSave) setTimeout(() => document.getElementById('over-name').focus(), 100);
}

function confirmGameOver() {
    let name = (document.getElementById('over-name').value || 'PLAYER').trim().slice(0, 12);
    if (!name) name = 'PLAYER';
    playerName = name;
    localStorage.setItem('tetris_name', name);
    submitScore(lastOverData.mode, lastOverData.score, lastOverData.lines, lastOverData.clearTime);
    document.getElementById('over-modal').style.display = 'none';
    openModeSelect();
}

function skipGameOver() {
    document.getElementById('over-modal').style.display = 'none';
    openModeSelect();
}

/* ===== 렌더 루프 ===== */
function renderLoop() {
    pEffects = pEffects.filter(e=>e.life>0);
    aEffects = aEffects.filter(e=>e.life>0);
    drawGrid(pCtx, pField, pBlock, pNextQueue, pNextCtx, pEffects);
    if (currentMode === 'VS Computer') drawGrid(aCtx, aField, aBlock, aNextQueue, aNextCtx, aEffects);
    if (currentMode === 'Multi') {
        drawGrid(aCtx, aField, null, null, null, aEffects);
        mpSendState(getRenderField(), pScore, pLines);
    }
    if (gameActive) requestAnimationFrame(renderLoop);
}

/* ===== 키 입력 ===== */
window.addEventListener('keydown', e => {
    if(!gameActive) return;
    if(e.key==='ArrowLeft'){ pBlock.x--; if(checkCollide(pBlock,pField)) pBlock.x++; }
    if(e.key==='ArrowRight'){ pBlock.x++; if(checkCollide(pBlock,pField)) pBlock.x--; }
    if(e.key==='ArrowDown'){
        pBlock.y++;
        if(checkCollide(pBlock,pField)) { pBlock.y--; }
        else { pScore += 1; updateUiStats(); }
    }
    if(e.key==='ArrowUp'){ tryRotate(pBlock, pField); }
    if(e.key===' '){
        e.preventDefault();
        let startY = pBlock.y;
        while(!checkCollide(pBlock,pField)){ pBlock.y++; }
        pBlock.y--;
        let dist = pBlock.y - startY;
        if (dist > 0) pScore += dist;
        lockPlayerBlock(true);
    }
});

openModeSelect();