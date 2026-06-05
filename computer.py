"""computer.py: VS COMPUTER 모드의 컴퓨터 플레이어 두뇌 로직 (순수 파이썬)

휴리스틱 평가(높이/구멍/울퉁불퉁함)를 기반으로 모든 회전 x 모든 가로 위치를
시뮬레이션하여 가장 점수가 낮은(=안정적인) 착지 지점을 선택한다.
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

# 난이도별 평가 가중치 / 실수 확률
WEIGHTS = {
    'height': 6.0,
    'holes': 14.0,
    'bumpiness': 2.5,
    'lines': -12.0,   # 라인 제거는 보상(음수)
}


def _column_metrics(board):
    heights = [0] * COLUMNS
    holes = 0
    for j in range(COLUMNS):
        seen = False
        for i in range(ROWS):
            if board[i][j] != 0:
                if not seen:
                    heights[j] = ROWS - i
                    seen = True
            elif seen:
                holes += 1
    bumpiness = sum(abs(heights[j] - heights[j + 1]) for j in range(COLUMNS - 1))
    return heights, holes, bumpiness


def _count_full_lines(board):
    return sum(1 for row in board if all(c != 0 for c in row))


def evaluate_board(board):
    """낮을수록 좋은 보드. 컴퓨터는 이 값을 최소화한다."""
    heights, holes, bumpiness = _column_metrics(board)
    lines = _count_full_lines(board)
    return (max(heights) * WEIGHTS['height']
            + holes * WEIGHTS['holes']
            + bumpiness * WEIGHTS['bumpiness']
            + lines * WEIGHTS['lines'])


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


class ComputerPlayer:
    """VS COMPUTER 의 상대 컴퓨터. 난이도에 따라 실수 확률이 달라진다."""

    DIFFICULTY = {'Easy': 0.15, 'Normal': 0.05, 'Hard': 0.01}

    def __init__(self, difficulty='Normal'):
        self.difficulty = difficulty
        self.error_chance = self.DIFFICULTY.get(difficulty, 0.05)

    def best_move(self, field, block_type):
        """가장 좋은 (target_x, target_rot) 결정."""
        rotations = SHAPES.get(block_type, [[0]])
        best_score = float('inf')
        best_x, best_rot = 3, 0
        for rot in range(len(rotations)):
            shape = rotations[rot]
            for x in range(-2, COLUMNS):
                board = simulate_drop(field, shape, x)
                if board is None:
                    continue
                score = evaluate_board(board)
                if score < best_score:
                    best_score, best_x, best_rot = score, x, rot
        return best_x, best_rot

    def decide(self, field, block_type, error_chance=None):
        """실수 확률을 반영해 최종 수를 반환. 가끔 일부러 엉뚱한 곳에 둔다."""
        ec = self.error_chance if error_chance is None else error_chance
        if random.random() < ec:
            return {'target_x': random.randint(1, 6),
                    'target_rot': random.randint(0, 3)}
        x, rot = self.best_move(field, block_type)
        return {'target_x': x, 'target_rot': rot}
