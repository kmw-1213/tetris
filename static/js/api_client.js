async function askAIBackend() {
    if (!gameActive || currentMode !== 'VS Computer') return;
    let res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: aField, type: aBlock.type,
                               difficulty: currentDiff, error_chance: errorChance })
    });
    let result = await res.json();
    aiTargetX = result.target_x;
    aiTargetRot = result.target_rot;
}

async function submitScore(mode, score, lines, clearTime) {
    try {
        let body = { name: playerName, mode: mode, score: score, lines: lines };
        if (clearTime !== undefined && clearTime !== null) body.clear_time = clearTime;
        let res = await fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) console.error('score save failed', res.status);
    } catch (e) { console.error('score save error', e); }
}

async function fetchLeaderboard(mode) {
    try {
        let url = mode ? `/api/leaderboard?mode=${encodeURIComponent(mode)}` : '/api/leaderboard';
        let res = await fetch(url);
        return await res.json();
    } catch (e) { return []; }
}
