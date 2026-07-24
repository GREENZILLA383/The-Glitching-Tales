const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30; // 300 / 10
const NEXT_BLOCK_SIZE = 25; // slightly smaller for the next box

// Scale canvases for crisp rendering if needed, but we'll stick to CSS sizing
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// Cuphead Boss Themes for colors
const COLORS = [
    null,
    '#c13a3a', // 1: Devil Red (Z)
    '#5ea9a2', // 2: Cala Maria Teal (S)
    '#d4af37', // 3: King Dice Gold (T)
    '#4b72b8', // 4: Goopy Le Grande Blue (O)
    '#e28b46', // 5: Cagney Carnation Orange (L)
    '#8b5b9e', // 6: Phantom Express Purple (J)
    '#689c56'  // 7: Ribby and Croaks Green (I)
];

const SHAPES = [
    [],
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]], // Z
    [[0, 2, 2], [2, 2, 0], [0, 0, 0]], // S
    [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
    [[4, 4], [4, 4]],                   // O
    [[0, 0, 5], [5, 5, 5], [0, 0, 0]], // L
    [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
    [[0, 0, 0, 0], [7, 7, 7, 7], [0, 0, 0, 0], [0, 0, 0, 0]] // I
];

const BOSS_QUOTES = [
    "\"A brawl is surely brewing!\"",
    "\"Good day for a swell battle!\"",
    "\"Here's a real high-class bout!\"",
    "\"A great slam and then some!\"",
    "\"You're up!\"",
    "\"WALLOP!\"",
    "\"Knockout!\""
];

function randomQuote() {
    return BOSS_QUOTES[Math.floor(Math.random() * BOSS_QUOTES.length)];
}

class Piece {
    constructor(shapeMatrix, colorIndex) {
        this.matrix = shapeMatrix;
        this.color = colorIndex;
        this.x = Math.floor(COLS / 2) - Math.floor(this.matrix[0].length / 2);
        this.y = 0;
    }
}

let currentPiece = createPiece();
let nextPiece = createPiece();

function createPiece() {
    const typeId = Math.floor(Math.random() * 7) + 1;
    return new Piece(SHAPES[typeId], typeId);
}

function drawBlock(ctx, x, y, colorId, size, xOffset = 0, yOffset = 0) {
    if (colorId === 0) return;
    const color = COLORS[colorId];
    
    // Base color
    ctx.fillStyle = color;
    ctx.fillRect(xOffset + x * size, yOffset + y * size, size, size);
    
    // Inner shadow/highlight for hand-drawn look
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(xOffset + x * size + 2, yOffset + y * size + 2, size - 4, size - 4);
    
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(xOffset + x * size + 6, yOffset + y * size + 6, size - 8, size - 8);

    // Thick hand-drawn black border
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a1614';
    ctx.strokeRect(xOffset + x * size, yOffset + y * size, size, size);
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid lightly
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    for(let r=0; r<=ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r*BLOCK_SIZE); ctx.lineTo(canvas.width, r*BLOCK_SIZE); ctx.stroke();
    }
    for(let c=0; c<=COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c*BLOCK_SIZE, 0); ctx.lineTo(c*BLOCK_SIZE, canvas.height); ctx.stroke();
    }

    // Draw settled blocks
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            drawBlock(ctx, c, r, board[r][c], BLOCK_SIZE);
        }
    }
}

function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const offsetX = (nextCanvas.width - nextPiece.matrix[0].length * NEXT_BLOCK_SIZE) / 2;
    const offsetY = (nextCanvas.height - nextPiece.matrix.length * NEXT_BLOCK_SIZE) / 2;
    
    for (let r = 0; r < nextPiece.matrix.length; r++) {
        for (let c = 0; c < nextPiece.matrix[r].length; c++) {
            if (nextPiece.matrix[r][c] !== 0) {
                drawBlock(nextCtx, c, r, nextPiece.color, NEXT_BLOCK_SIZE, offsetX, offsetY);
            }
        }
    }
}

function drawCurrentPiece() {
    for (let r = 0; r < currentPiece.matrix.length; r++) {
        for (let c = 0; c < currentPiece.matrix[r].length; c++) {
            if (currentPiece.matrix[r][c] !== 0) {
                drawBlock(ctx, currentPiece.x + c, currentPiece.y + r, currentPiece.color, BLOCK_SIZE);
            }
        }
    }
}

function collide(board, piece) {
    for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
            if (piece.matrix[r][c] !== 0 &&
               (board[piece.y + r] && board[piece.y + r][piece.x + c]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(board, piece) {
    for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
            if (piece.matrix[r][c] !== 0) {
                board[piece.y + r][piece.x + c] = piece.color;
            }
        }
    }
}

function rotate(matrix) {
    // Transpose and reverse rows
    const N = matrix.length;
    let res = [];
    for(let i=0; i<N; i++) {
        res.push(new Array(N).fill(0));
    }
    for(let r=0; r<N; r++){
        for(let c=0; c<N; c++){
            res[c][N-1-r] = matrix[r][c];
        }
    }
    return res;
}

function dropPiece() {
    currentPiece.y++;
    if (collide(board, currentPiece)) {
        currentPiece.y--;
        merge(board, currentPiece);
        clearLines();
        currentPiece = nextPiece;
        nextPiece = createPiece();
        drawNextPiece();
        
        if (collide(board, currentPiece)) {
            gameOver = true;
            document.getElementById('game-over-screen').classList.remove('hidden');
        }
    }
    dropCounter = 0;
}

function hardDrop() {
    while (!collide(board, currentPiece)) {
        currentPiece.y++;
    }
    currentPiece.y--;
    merge(board, currentPiece);
    clearLines();
    currentPiece = nextPiece;
    nextPiece = createPiece();
    drawNextPiece();
    
    if (collide(board, currentPiece)) {
        gameOver = true;
        document.getElementById('game-over-screen').classList.remove('hidden');
    }
    dropCounter = 0;
}

function clearLines() {
    let linesCleared = 0;
    outer: for (let r = ROWS - 1; r >= 0; r--) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === 0) continue outer;
        }
        
        const row = board.splice(r, 1)[0].fill(0);
        board.unshift(row);
        r++; // check same row index again since we shifted
        linesCleared++;
    }
    
    if (linesCleared > 0) {
        let pts = [0, 100, 300, 500, 800];
        score += pts[linesCleared] * level;
        lines += linesCleared;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        
        document.getElementById('score').innerText = score;
        document.getElementById('level').innerText = level;
        document.getElementById('lines').innerText = lines;

        // Change quote randomly on line clear
        document.getElementById('boss-quote').innerText = randomQuote();
    }
}

function update(time = 0) {
    if (gameOver) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    
    if (dropCounter > dropInterval) {
        dropPiece();
    }
    
    drawBoard();
    drawCurrentPiece();
    
    requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
    if (gameOver) {
        if (event.key.toLowerCase() === 'r') {
            resetGame();
        }
        return;
    }
    
    if (event.key === 'ArrowLeft') {
        currentPiece.x--;
        if (collide(board, currentPiece)) currentPiece.x++;
    } else if (event.key === 'ArrowRight') {
        currentPiece.x++;
        if (collide(board, currentPiece)) currentPiece.x--;
    } else if (event.key === 'ArrowDown') {
        dropPiece();
    } else if (event.key === 'ArrowUp') {
        const rotated = rotate(currentPiece.matrix);
        const oldMatrix = currentPiece.matrix;
        currentPiece.matrix = rotated;
        // Basic wall kick
        if (collide(board, currentPiece)) {
            currentPiece.x++;
            if (collide(board, currentPiece)) {
                currentPiece.x -= 2;
                if (collide(board, currentPiece)) {
                    currentPiece.x++;
                    currentPiece.matrix = oldMatrix; // Revert
                }
            }
        }
    } else if (event.key === ' ') {
        hardDrop();
    }
});

function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    gameOver = false;
    
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = level;
    document.getElementById('lines').innerText = lines;
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('boss-quote').innerText = "\"Ready? Wallop!\"";
    
    currentPiece = createPiece();
    nextPiece = createPiece();
    drawNextPiece();
    
    lastTime = performance.now();
    update();
}

document.getElementById('game-over-screen').addEventListener('click', resetGame);

// Init
document.getElementById('boss-quote').innerText = "\"Ready? Wallop!\"";
drawNextPiece();

let gameStarted = false;

let playlist = [
    "https://archive.org/download/cuphead-official-soundtrack/Cuphead%20OST%20MP3/13%20Floral%20Fury.mp3",
    "https://archive.org/download/cuphead-official-soundtrack/Cuphead%20OST%20MP3/15%20Clip%20Joint%20Calamity.mp3"
];
let currentSongIndex = 0;

document.getElementById('start-screen').addEventListener('click', function() {
    this.classList.add('hidden');
    
    // Play the native HTML5 audio
    let bgMusic = document.getElementById('bg-music');
    bgMusic.volume = 0.5; // Set volume to 50%
    
    // Automatically play the next song in the playlist when the current one ends
    bgMusic.addEventListener('ended', function() {
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        bgMusic.src = playlist[currentSongIndex];
        bgMusic.play().catch(e => console.error("Audio playback failed:", e));
    });
    
    bgMusic.play().catch(e => console.error("Audio playback failed:", e));
    
    if (!gameStarted) {
        gameStarted = true;
        lastTime = performance.now();
        update();
    }
});
