"""computer.py: VS COMPUTER 모드의 컴퓨터 플레이어 두뇌 로직 (순수 파이썬)

휴리스틱 평가(높이/구멍/울퉁불퉁함)를 기반으로 모든 회전 x 모든 가로 위치를
시뮬레이션하여 가장 점수가 낮은(=안정적인) 착지 지점을 선택한다.

난이도별 실수 확률:
  Easy    : 기존 Hard 수준 (실수 1%)
  Normal  : 실수 0.3%, 2-piece 룩어헤드 적용
  Hard    : 실수 0.05%, 2-piece 룩어헤드 + 공격적 평가
  Extreme : 실수 0%, 2-piece 룩어헤드 + 최강 평가 가중치
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

ALL_PIECE_TYPES = list(SHAPES.keys())

# 난이도별 평가 가중치
WEIGHTS_BY_DIFF = {
    'Easy': {
        'height': 6.0,
        'holes': 14.0,
        'bumpiness': 2.5,
        'lines': -12.0,
    },
    'Normal': {
        'height': 7.5,
        'holes': 20.0,
        'bumpiness': 3.5,
        'lines': -15.0,
        'well_bonus': -3.0,    # 한쪽 구멍 유지 보너스
    },
    'Hard': {
        'height': 9.0,
        'holes': 28.0,
        'bumpiness': 4.5,
        'lines': -20.0,
        'well_bonus': -5.0,
        'covered_holes': 8.0,  # 덮인 구멍 추가 패널티
    },
    'Extreme': {
        'height': 30.0,        # 높이 쌓임을 극도로 꺼림 (자멸 방지)
        'holes': 60.0,         # 구멍 페널티 강화
        'bumpiness': 8.0,
        'lines': -40.0,
        'well_bonus': -10.0,
        'covered_holes': 25.0, # 덮인 구멍 강한 패널티
        'flat_bonus': -4.0,
    },
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
        # 덮인 구멍: 위에 블록이 여러 칸 쌓인 구멍
        if col_holes > 0:
            covered_holes += col_holes * heights[j]

    bumpiness = sum(abs(heights[j] - heights[j + 1]) for j in range(COLUMNS - 1))

    # well bonus: 한 열이 양쪽보다 낮으면 보너스 (I피스 내리기 좋은 구조)
    well_bonus = 0
    if 'well_bonus' in weights:
        for j in range(COLUMNS):
            left = heights[j - 1] if j > 0 else 99
            right = heights[j + 1] if j < COLUMNS - 1 else 99
            depth = min(left, right) - heights[j]
            if depth > 0:
                well_bonus += depth

    # flat bonus: 높이 표준편차가 낮을수록 보너스
    flat_bonus = 0
    if 'flat_bonus' in weights:
        avg = sum(heights) / COLUMNS
        variance = sum((h - avg) ** 2 for h in heights) / COLUMNS
        flat_bonus = variance ** 0.5

    return heights, holes, bumpiness, covered_holes, well_bonus, flat_bonus


def _count_full_lines(board):
    return sum(1 for row in board if all(c != 0 for c in row))


def evaluate_board(board, weights):
    """낮을수록 좋은 보드. 컴퓨터는 이 값을 최소화한다."""
    heights, holes, bumpiness, covered_holes, well_bonus, flat_bonus = _column_metrics(board, weights)
    lines = _count_full_lines(board)
    score = (
        max(heights) * weights['height']
        + holes * weights['holes']
        + bumpiness * weights['bumpiness']
        + lines * weights['lines']
    )
    if 'well_bonus' in weights:
        score += well_bonus * weights['well_bonus']
    if 'covered_holes' in weights:
        score += covered_holes * weights['covered_holes']
    if 'flat_bonus' in weights:
        score += flat_bonus * weights['flat_bonus']
    return score


def simulate_drop(field, shape, x):
    """회전(shape)과 가로 위치 x로 블록을 하드드롭한 결과 보드 반환. 불가하면 None."""
    y = 0
    for i in range(4):
        for j in range(4):
            if i * 4 + j in shape:
                if x + j < 0 or x + j >= COLUMNS or y + i >= ROWS:
                    return None
                if field[y + i][x + j] != 0:
                    return None
    while True:
        ny = y + 1
        hit = False
        for i in range(4):
            for j in range(4):
                if i * 4 + j in shape:
                    if ny + i >= ROWS or field[ny + i][x + j] != 0:
                        hit = True
        if hit:
            break
        y = ny
    board = copy.deepcopy(field)
    for i in range(4):
        for j in range(4):
            if i * 4 + j in shape:
                if 0 <= y + i < ROWS and 0 <= x + j < COLUMNS:
                    board[y + i][x + j] = 1
    return board


def clear_full_lines(board):
    """보드에서 꽉 찬 라인을 제거한 새 보드 반환."""
    new_board = [row for row in board if not all(c != 0 for c in row)]
    cleared = ROWS - len(new_board)
    new_board = [[0] * COLUMNS for _ in range(cleared)] + new_board
    return new_board


class ComputerPlayer:
    """VS COMPUTER 의 상대 컴퓨터. 난이도에 따라 실수 확률과 탐색 깊이가 달라진다."""

    # (실수 확률, 룩어헤드 사용 여부)
    DIFFICULTY = {
        'Easy':    (0.01, False),   # 구 Hard 수준
        'Normal':  (0.003, True),   # 실수 매우 드물고 룩어헤드
        'Hard':    (0.0005, True),  # 거의 실수 없음
        'Extreme': (0.0, True),     # 절대 실수 없음
    }

    def __init__(self, difficulty='Normal'):
        self.difficulty = difficulty
        ec, self.lookahead = self.DIFFICULTY.get(difficulty, (0.003, True))
        self.error_chance = ec
        self.weights = WEIGHTS_BY_DIFF.get(difficulty, WEIGHTS_BY_DIFF['Normal'])

    def best_move(self, field, block_type, next_type=None):
        """가장 좋은 (target_x, target_rot) 결정. Normal+ 는 next_type 룩어헤드."""
        rotations = SHAPES.get(block_type, [[0]])
        best_score = float('inf')
        best_x, best_rot = 3, 0

        for rot in range(len(rotations)):
            shape = rotations[rot]
            for x in range(-2, COLUMNS):
                board1 = simulate_drop(field, shape, x)
                if board1 is None:
                    continue
                board1 = clear_full_lines(board1)

                if self.lookahead and next_type:
                    # 다음 블록까지 고려한 2-piece 룩어헤드
                    next_rots = SHAPES.get(next_type, [[0]])
                    min_next = float('inf')
                    for nr in range(len(next_rots)):
                        nshape = next_rots[nr]
                        for nx in range(-2, COLUMNS):
                            board2 = simulate_drop(board1, nshape, nx)
                            if board2 is None:
                                continue
                            board2 = clear_full_lines(board2)
                            s = evaluate_board(board2, self.weights)
                            if s < min_next:
                                min_next = s
                    score = min_next
                else:
                    score = evaluate_board(board1, self.weights)

                if score < best_score:
                    best_score, best_x, best_rot = score, x, rot

        return best_x, best_rot

    def decide(self, field, block_type, next_type=None, error_chance=None):
        """실수 확률을 반영해 최종 수를 반환."""
        ec = self.error_chance if error_chance is None else error_chance
        if ec > 0 and random.random() < ec:
            return {'target_x': random.randint(1, 6),
                    'target_rot': random.randint(0, 3)}
        x, rot = self.best_move(field, block_type, next_type)
        return {'target_x': x, 'target_rot': rot}