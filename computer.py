"""computer.py: VS COMPUTER 모드의 컴퓨터 플레이어 두뇌 로직

Extreme 난이도:
  - 항상 생존 최우선
  - 구멍·높이를 극단적으로 회피
  - 라인 클리어가 최고 우선순위
  - 고득점보다 오래 버티는 것이 목표
"""
import copy
import random

ROWS, COLUMNS = 20, 10

SHAPES = {
    'I': [[4, 5, 6, 7], [1, 5, 9, 13]],
    'O': [[1, 2, 5, 6]],
    'T': [[1, 4, 5, 6], [1, 5, 6, 9], [4, 5, 6, 9], [1, 4, 5, 9]],
    'S': [[1, 2, 4, 5], [1, 5, 6, 10]],
    'Z': [[0, 1, 5, 6], [2, 5, 6, 9]],
    'J': [[0, 4, 5, 6], [1, 2, 5, 9], [4, 5, 6, 10], [1, 5, 8, 9]],
    'L': [[2, 4, 5, 6], [1, 5, 9, 10], [4, 5, 6, 8], [0, 1, 5, 9]],
}

# 난이도별 가중치 (Easy/Normal/Hard)
WEIGHTS_BY_DIFF = {
    'Easy': {
        'height': 6.0, 'holes': 14.0, 'bumpiness': 2.5, 'lines': -12.0,
    },
    'Normal': {
        'height': 7.5, 'holes': 20.0, 'bumpiness': 3.5, 'lines': -15.0,
        'well_bonus': -3.0,
    },
    'Hard': {
        'height': 9.0, 'holes': 28.0, 'bumpiness': 4.5, 'lines': -20.0,
        'well_bonus': -5.0, 'covered_holes': 8.0,
    },
}

# Extreme: 생존 전용 가중치 (항상 적용, 상황 무관)
EXTREME_WEIGHTS = {
    'height':        50.0,   # 높이 쌓임 강하게 회피
    'holes':        100.0,   # 구멍은 절대 만들지 않음
    'bumpiness':     12.0,   # 울퉁불퉁함 회피
    'lines':       -200.0,   # 라인 클리어가 압도적 최우선
    'well_bonus':   -15.0,   # 한쪽 칸 비워두기(I블록용 우물)
    'covered_holes': 50.0,   # 덮인 구멍 강한 패널티
    'flat_bonus':   -8.0,    # 평탄한 표면 보너스
}


def _column_metrics(board, weights):
    heights = [0] * COLUMNS
    holes = 0
    covered_holes = 0
    for j in range(COLUMNS):
        seen = False
        col_holes = 0
        for i in range(ROWS):
            if board[i][j] != 0:
                if not seen:
                    heights[j] = ROWS - i
                    seen = True
            elif seen:
                holes += 1
                col_holes += 1
        if col_holes > 0:
            covered_holes += col_holes * heights[j]

    bumpiness = sum(abs(heights[j] - heights[j + 1]) for j in range(COLUMNS - 1))

    well_bonus = 0
    if 'well_bonus' in weights:
        for j in range(COLUMNS):
            left  = heights[j - 1] if j > 0          else 99
            right = heights[j + 1] if j < COLUMNS - 1 else 99
            depth = min(left, right) - heights[j]
            if depth > 0:
                well_bonus += depth

    flat_bonus = 0
    if 'flat_bonus' in weights:
        avg      = sum(heights) / COLUMNS
        variance = sum((h - avg) ** 2 for h in heights) / COLUMNS
        flat_bonus = variance ** 0.5

    return heights, holes, bumpiness, covered_holes, well_bonus, flat_bonus


def _count_full_lines(board):
    return sum(1 for row in board if all(c != 0 for c in row))


def _max_height(field):
    for i in range(ROWS):
        if any(cell != 0 for cell in field[i]):
            return ROWS - i
    return 0


def evaluate_board(board, weights):
    heights, holes, bumpiness, covered_holes, well_bonus, flat_bonus = _column_metrics(board, weights)
    lines      = _count_full_lines(board)
    max_height = max(heights)
    avg_height = sum(heights) / COLUMNS

    score = (
        max_height * weights['height']
        + avg_height * weights['height'] * 0.4
        + holes     * weights['holes']
        + bumpiness * weights['bumpiness']
        + lines     * weights['lines']
    )
    if 'well_bonus'    in weights: score += well_bonus    * weights['well_bonus']
    if 'covered_holes' in weights: score += covered_holes * weights['covered_holes']
    if 'flat_bonus'    in weights: score += flat_bonus    * weights['flat_bonus']

    # 위험 높이(10칸) 초과 시 지수 패널티
    danger = 10
    if max_height > danger:
        score += (max_height - danger) ** 3.0 * weights['height'] * 3.0

    return score


def simulate_drop(field, shape, x):
    cells_rel = [(idx // 4, idx % 4) for idx in shape]

    for i, j in cells_rel:
        if x + j < 0 or x + j >= COLUMNS:
            return None

    # y=-3부터 시작 (실제 스폰과 동일)
    y = -3
    while y < ROWS:
        collide = False
        for i, j in cells_rel:
            r, c = y + i, x + j
            if r < 0:
                continue
            if r >= ROWS or field[r][c] != 0:
                collide = True
                break
        if not collide:
            break
        y += 1

    if y >= ROWS:
        return None

    while True:
        ny  = y + 1
        hit = False
        for i, j in cells_rel:
            r, c = ny + i, x + j
            if r >= ROWS or (r >= 0 and field[r][c] != 0):
                hit = True
                break
        if hit:
            break
        y = ny

    visible = any((y + i) >= 0 for i, j in cells_rel)
    if not visible:
        return None

    board = copy.deepcopy(field)
    for i, j in cells_rel:
        r, c = y + i, x + j
        if 0 <= r < ROWS and 0 <= c < COLUMNS:
            board[r][c] = 1
        elif r < 0:
            return None  # topOut 위치 → 무효

    return board


def clear_full_lines(board):
    new_board = [row for row in board if not all(c != 0 for c in row)]
    cleared   = ROWS - len(new_board)
    new_board = [[0] * COLUMNS for _ in range(cleared)] + new_board
    return new_board


class ComputerPlayer:
    DIFFICULTY = {
        'Easy':    (0.01,   False),
        'Normal':  (0.003,  True),
        'Hard':    (0.0005, True),
        'Extreme': (0.0,    True),
    }

    def __init__(self, difficulty='Normal'):
        self.difficulty    = difficulty
        ec, self.lookahead = self.DIFFICULTY.get(difficulty, (0.003, True))
        self.error_chance  = ec
        if difficulty == 'Extreme':
            self.weights = EXTREME_WEIGHTS
        else:
            self.weights = WEIGHTS_BY_DIFF.get(difficulty, WEIGHTS_BY_DIFF['Normal'])

    def best_move(self, field, block_type, next_type=None):
        rotations  = SHAPES.get(block_type, [[0]])
        best_score = float('inf')
        best_x, best_rot = 3, 0
        w = self.weights

        for rot in range(len(rotations)):
            shape = rotations[rot]
            for x in range(-2, COLUMNS):
                board1 = simulate_drop(field, shape, x)
                if board1 is None:
                    continue
                board1 = clear_full_lines(board1)

                if self.lookahead and next_type:
                    next_rots = SHAPES.get(next_type, [[0]])
                    min_next  = float('inf')
                    for nr in range(len(next_rots)):
                        nshape = next_rots[nr]
                        for nx in range(-2, COLUMNS):
                            board2 = simulate_drop(board1, nshape, nx)
                            if board2 is None:
                                continue
                            board2 = clear_full_lines(board2)
                            s = evaluate_board(board2, w)
                            if s < min_next:
                                min_next = s
                    score = min_next if min_next < float('inf') else evaluate_board(board1, w)
                else:
                    score = evaluate_board(board1, w)

                if score < best_score:
                    best_score, best_x, best_rot = score, x, rot

        return best_x, best_rot

    def decide(self, field, block_type, next_type=None, error_chance=None):
        ec = self.error_chance if error_chance is None else error_chance
        if ec > 0 and random.random() < ec:
            return {'target_x': random.randint(1, 6),
                    'target_rot': random.randint(0, 3)}
        x, rot = self.best_move(field, block_type, next_type)
        return {'target_x': x, 'target_rot': rot}