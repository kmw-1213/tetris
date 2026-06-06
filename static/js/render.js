function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath(); ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius); ctx.closePath();
}

function getGhostY(b, field) {
    let ghostBlock = { ...b };
    while (!checkCollide(ghostBlock, field)) { ghostBlock.y++; }
    return ghostBlock.y - 1;
}

function drawGrid(ctx, field, currentBlock, nextBlock, nextCtx, effectsArr) {
    ctx.clearRect(0, 0, 300, 600);
    const BLOCK_RADIUS = 4;

    for(let i=0; i<20; i++){
        for(let j=0; j<10; j++){
            if(field[i][j]) {
                let colors = COLOR_MAP[field[i][j]];
                drawRoundRect(ctx, j*30 + 1, i*30 + 1, 28, 28, BLOCK_RADIUS);
                ctx.fillStyle = colors.fill; ctx.fill();
                ctx.strokeStyle = colors.border; ctx.lineWidth = 1.5; ctx.stroke();
            } else {
                ctx.strokeStyle = "rgba(255,255,255,0.02)"; ctx.strokeRect(j*30, i*30, 30, 30);
            }
        }
    }

    if(currentBlock) {
        // 고스트 블록: 현재 블록이 맵 밖에 있어도 항상 맵 안에서 보여야 함
        let ghostY = getGhostY(currentBlock, field);
        let shape = SHAPES[currentBlock.type][currentBlock.rotation];
        // 고스트가 맵 안에 있으면 항상 그리기
        let ghostVisible = false;
        for(let i=0; i<4; i++) for(let j=0; j<4; j++) if(shape.includes(i*4+j)) {
            if(ghostY+i >= 0) { ghostVisible = true; break; }
        }
        if (ghostVisible && ghostY > currentBlock.y) {
            ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
            ctx.lineWidth = 2; ctx.shadowBlur = 15; ctx.shadowColor = "#ffffff";
            for(let i=0; i<4; i++){
                for(let j=0; j<4; j++){
                    if(shape.includes(i*4+j)){
                        let x = (currentBlock.x+j)*30 + 1; let y = (ghostY+i)*30 + 1;
                        if(ghostY+i >= 0 && ghostY+i < 20) { drawRoundRect(ctx, x, y, 28, 28, BLOCK_RADIUS); ctx.fill(); ctx.stroke(); }
                    }
                }
            }
            ctx.restore();
        }

        // 현재 블록: 맵 안에 있는 셀만 그리기
        let colors = COLOR_MAP[currentBlock.type];
        ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = colors.border;
        ctx.fillStyle = colors.fill; ctx.strokeStyle = colors.border; ctx.lineWidth = 2;
        for(let i=0; i<4; i++){
            for(let j=0; j<4; j++){
                if(shape.includes(i*4+j)){
                    let x = (currentBlock.x+j)*30 + 1; let y = (currentBlock.y+i)*30 + 1;
                    if (currentBlock.y+i >= 0 && currentBlock.y+i < 20) { drawRoundRect(ctx, x, y, 28, 28, BLOCK_RADIUS); ctx.fill(); ctx.stroke(); }
                }
            }
        }
        ctx.restore();
    }

    if (effectsArr && effectsArr.length > 0) {
        effectsArr.forEach(eff => {
            ctx.save();
            let alpha = eff.life / eff.maxLife;
            if (eff.type === 'blockFlash') {
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
                ctx.shadowBlur = 25; ctx.shadowColor = eff.color;
                drawRoundRect(ctx, eff.x * 30 + 1, eff.y * 30 + 1, 28, 28, BLOCK_RADIUS);
                ctx.fill();
            } else if (eff.type === 'lineFlash') {
                let gradient = ctx.createLinearGradient(0, eff.y * 30, 300, eff.y * 30);
                gradient.addColorStop(0, 'rgba(255,255,255,0)');
                gradient.addColorStop(0.3, `rgba(255, 255, 255, ${alpha * 0.95})`);
                gradient.addColorStop(0.5, '#ffffff');
                gradient.addColorStop(0.7, `rgba(255, 255, 255, ${alpha * 0.95})`);
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gradient;
                ctx.shadowBlur = 30; ctx.shadowColor = '#00ff88';
                ctx.fillRect(0, eff.y * 30 - 2, 300, 34);
            }
            ctx.restore();
            eff.life--;
        });
    }

    if (nextBlock && nextCtx) {
        nextCtx.clearRect(0, 0, 80, 240);
        let queue = Array.isArray(nextBlock) ? nextBlock.slice(0, 3) : [nextBlock];
        queue.forEach((blk, idx) => {
            if (!blk) return;
            let colors = COLOR_MAP[blk.type];
            nextCtx.fillStyle = colors.fill;
            nextCtx.strokeStyle = colors.border;
            nextCtx.lineWidth = 1.5;
            let shape = SHAPES[blk.type][0];
            let offY = idx * 76 + 12;
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    if (shape.includes(i * 4 + j)) {
                        drawRoundRect(nextCtx, j * 14 + 12, i * 14 + offY, 13, 13, 3);
                        nextCtx.fill(); nextCtx.stroke();
                    }
                }
            }
        });
    }


}

function renderLoop() {
    pEffects = pEffects.filter(eff => eff.life > 0);
    aEffects = aEffects.filter(eff => eff.life > 0);
    drawGrid(pCtx, pField, pBlock, pNextQueue, pNextCtx, pEffects);
    if (currentMode === 'VS Computer') drawGrid(aCtx, aField, aBlock, aNextQueue, aNextCtx, aEffects);
    if(gameActive) requestAnimationFrame(renderLoop);
}