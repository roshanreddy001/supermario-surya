const holes = document.querySelectorAll('.hole');
const scoreBoard = document.querySelector('#score');
const timeBoard = document.querySelector('#time');
const startBtn = document.querySelector('#start-btn');
const friends = document.querySelectorAll('.friend');

let lastHole;
let timeUp = false;
let score = 0;
let timeLimit = 30; // 30 seconds
let gameTimer;
let popTimer;

function randomTime(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

function randomHole(holes) {
    const idx = Math.floor(Math.random() * holes.length);
    const hole = holes[idx];
    
    if (hole === lastHole) {
        return randomHole(holes);
    }
    lastHole = hole;
    return hole;
}

function peep() {
    const time = randomTime(600, 1200);
    const hole = randomHole(holes);
    hole.classList.add('up');
    
    popTimer = setTimeout(() => {
        hole.classList.remove('up');
        if (!timeUp) peep();
    }, time);
}

function updateTimer() {
    timeLimit--;
    timeBoard.textContent = timeLimit;
    
    if (timeLimit <= 0) {
        timeUp = true;
        clearInterval(gameTimer);
        startBtn.disabled = false;
        startBtn.textContent = 'Play Again!';
        holes.forEach(hole => hole.classList.remove('up'));
    }
}

function startGame() {
    scoreBoard.textContent = 0;
    timeLimit = 30;
    timeBoard.textContent = timeLimit;
    timeUp = false;
    score = 0;
    startBtn.disabled = true;
    startBtn.textContent = 'Whack \'Em!';
    
    clearInterval(gameTimer);
    clearTimeout(popTimer);
    
    holes.forEach(hole => hole.classList.remove('up'));
    
    peep();
    gameTimer = setInterval(updateTimer, 1000);
}

function bonk(e) {
    if (!e.isTrusted) return; 
    score++;
    
    this.parentNode.classList.remove('up'); 
    scoreBoard.textContent = score;
    
    scoreBoard.classList.remove('shake');
    void scoreBoard.offsetWidth; 
    scoreBoard.classList.add('shake');
}

friends.forEach(friend => friend.addEventListener('click', bonk));
startBtn.addEventListener('click', startGame);
