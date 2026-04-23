// 網格大小
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// DOM 元素
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextCtx = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');
const levelElement = document.getElementById('level');
const gameOverScreen = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');

// 設定縮放
ctx.scale(BLOCK_SIZE, BLOCK_SIZE);
// 預覽方塊的格子大小稍微不同，配合 120x120 的 canvas
const NEXT_BLOCK_SIZE = 120 / 4; 
nextCtx.scale(NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE);

// 方塊顏色
const COLORS = [
  null,
  '#0ea5e9', // I - cyan
  '#3b82f6', // J - blue
  '#f97316', // L - orange
  '#eab308', // O - yellow
  '#22c55e', // S - green
  '#a855f7', // T - purple
  '#ef4444'  // Z - red
];

// 方塊形狀定義
const SHAPES = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 0, 0], [2, 2, 2], [0, 0, 0]], // J
  [[0, 0, 3], [3, 3, 3], [0, 0, 0]], // L
  [[4, 4], [4, 4]], // O
  [[0, 5, 5], [5, 5, 0], [0, 0, 0]], // S
  [[0, 6, 0], [6, 6, 6], [0, 0, 0]], // T
  [[7, 7, 0], [0, 7, 7], [0, 0, 0]]  // Z
];

let board = [];
let piece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let gameActive = false;
let animationId;

// --- 音效系統 (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(frequency, type, duration, vol = 0.1) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  
  gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

const sounds = {
  move: () => playTone(300, 'sine', 0.1, 0.05),
  rotate: () => playTone(400, 'square', 0.1, 0.05),
  drop: () => playTone(150, 'square', 0.15, 0.1),
  clear: () => {
    playTone(600, 'sine', 0.2, 0.1);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 100);
  },
  tetris: () => { // 一次消四行
    playTone(500, 'square', 0.2, 0.1);
    setTimeout(() => playTone(700, 'square', 0.2, 0.1), 100);
    setTimeout(() => playTone(900, 'square', 0.4, 0.1), 200);
  },
  gameover: () => {
    playTone(300, 'sawtooth', 0.5, 0.1);
    setTimeout(() => playTone(250, 'sawtooth', 0.5, 0.1), 300);
    setTimeout(() => playTone(200, 'sawtooth', 1.0, 0.1), 600);
  }
};
// ------------------------------

// 建立空白版面
function createBoard() {
  return Array.from({length: ROWS}, () => Array(COLS).fill(0));
}

// 產生隨機方塊
function randomPiece() {
  const typeId = Math.floor(Math.random() * 7) + 1;
  const shape = SHAPES[typeId];
  return {
    matrix: shape,
    pos: {x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0}
  };
}

// 繪製單格
function drawBlock(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
  
  // 增加高光與陰影產生立體感
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(x, y, 1, 0.1);
  ctx.fillRect(x, y, 0.1, 1);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x, y + 0.9, 1, 0.1);
  ctx.fillRect(x + 0.9, y, 0.1, 1);
}

// 繪製遊戲畫面
function draw() {
  // 清除畫布
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, COLS, ROWS);
  
  // 畫網格線
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  for(let i=0; i<=COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, ROWS);
    ctx.stroke();
  }
  for(let i=0; i<=ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(COLS, i);
    ctx.stroke();
  }

  // 繪製已鎖定的方塊
  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value > 0) {
        drawBlock(ctx, x, y, COLORS[value]);
      }
    });
  });

  // 繪製當前方塊
  if (piece) {
    piece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value > 0) {
          drawBlock(ctx, piece.pos.x + x, piece.pos.y + y, COLORS[value]);
        }
      });
    });
  }
}

// 繪製預覽方塊
function drawNext() {
  nextCtx.fillStyle = '#000';
  nextCtx.fillRect(0, 0, 4, 4);
  
  if (nextPiece) {
    // 置中計算
    const offsetX = (4 - nextPiece.matrix[0].length) / 2;
    const offsetY = (4 - nextPiece.matrix.length) / 2;
    
    nextPiece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value > 0) {
          drawBlock(nextCtx, x + offsetX, y + offsetY, COLORS[value]);
        }
      });
    });
  }
}

// 碰撞偵測
function collide(board, piece) {
  const m = piece.matrix;
  const o = piece.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 &&
         (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

// 將方塊合併到底板
function merge(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        board[y + piece.pos.y][x + piece.pos.x] = value;
      }
    });
  });
}

// 旋轉矩陣 (dir: 1 為順時針，-1 為逆時針)
function rotateMatrix(matrix, dir) {
  const rotated = matrix[0].map((_, index) => matrix.map(row => row[index]));
  if (dir > 0) {
    return rotated.map(row => row.reverse());
  } else {
    return rotated.reverse();
  }
}

// 方塊旋轉 (含踢牆測試簡化版)
function playerRotate(dir) {
  const pos = piece.pos.x;
  let offset = 1;
  const originalMatrix = piece.matrix;
  piece.matrix = rotateMatrix(piece.matrix, dir);
  
  // 碰到邊界時嘗試推回
  while (collide(board, piece)) {
    piece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > piece.matrix[0].length) {
      piece.matrix = originalMatrix; // 無法旋轉則復原
      piece.pos.x = pos;
      return;
    }
  }
  sounds.rotate();
}

// 方塊移動
function playerMove(dir) {
  piece.pos.x += dir;
  if (collide(board, piece)) {
    piece.pos.x -= dir;
  } else {
    sounds.move();
  }
}

// 方塊下落
function playerDrop() {
  piece.pos.y++;
  if (collide(board, piece)) {
    piece.pos.y--;
    merge(board, piece);
    sounds.drop();
    resetPiece();
    clearLines();
  }
  dropCounter = 0;
}

// 硬下落
function playerHardDrop() {
  while (!collide(board, piece)) {
    piece.pos.y++;
  }
  piece.pos.y--;
  merge(board, piece);
  sounds.drop();
  resetPiece();
  clearLines();
  dropCounter = 0;
}

// 取得新方塊
function resetPiece() {
  if (!nextPiece) {
    nextPiece = randomPiece();
  }
  piece = nextPiece;
  nextPiece = randomPiece();
  drawNext();
  
  if (collide(board, piece)) {
    gameOver();
  }
}

// 消除滿行
function clearLines() {
  let linesCleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; --y) {
    for (let x = 0; x < COLS; ++x) {
      if (board[y][x] === 0) {
        continue outer;
      }
    }

    // 移除該行並在頂部補空行
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    ++y;
    linesCleared++;
  }

  if (linesCleared > 0) {
    if (linesCleared === 4) sounds.tetris();
    else sounds.clear();
    
    // 計分公式 (簡單版)
    const lineScores = [0, 100, 300, 500, 800];
    score += lineScores[linesCleared] * level;
    lines += linesCleared;
    level = Math.floor(lines / 10) + 1;
    
    // 加速
    dropInterval = Math.max(100, 1000 - (level - 1) * 100);
    
    updateScore();
  }
}

function updateScore() {
  scoreElement.innerText = score;
  linesElement.innerText = lines;
  levelElement.innerText = level;
}

function gameOver() {
  gameActive = false;
  sounds.gameover();
  gameOverScreen.classList.remove('hidden');
  cancelAnimationFrame(animationId);
}

// 遊戲迴圈
function update(time = 0) {
  if (!gameActive) return;
  
  const deltaTime = time - lastTime;
  lastTime = time;
  
  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }
  
  draw();
  animationId = requestAnimationFrame(update);
}

// 鍵盤控制
document.addEventListener('keydown', event => {
  if (!gameActive) return;
  
  // 防止方向鍵與空白鍵捲動網頁
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }

  switch(event.key) {
    case 'ArrowLeft':
      playerMove(-1);
      break;
    case 'ArrowRight':
      playerMove(1);
      break;
    case 'ArrowDown':
      playerDrop();
      break;
    case 'ArrowUp': // 順時針 (右轉)
      playerRotate(1);
      break;
    case 'z':
    case 'Z': // 逆時針 (左轉)
      playerRotate(-1);
      break;
    case ' ': // 硬下落
      playerHardDrop();
      break;
  }
});

restartBtn.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 1000;
  updateScore();
  gameOverScreen.classList.add('hidden');
  gameActive = true;
  nextPiece = null;
  resetPiece();
  lastTime = performance.now();
  update();
});

// 初始化畫面 (尚未開始遊戲前)
board = createBoard();
draw();
drawNext();

// 顯示開始畫面
gameOverScreen.classList.remove('hidden');
gameOverScreen.querySelector('h2').innerText = 'TETRIS';
restartBtn.innerText = '開始遊戲';
