const dino = document.getElementById('dino');
const game = document.getElementById('game');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const skillsDiv = document.getElementById('skills');
const startOverlay = document.getElementById('startOverlay'); // Get the start overlay element

let isJumping = false;
let score = 0;
let gameSpeed = 5;
let lives = 1;
let xp = 0;
let level = 1;
let skillPoints = 0;

const maxInventorySize = 5;
const jumpDuration = 600;
const shootCooldown = 500;
const maxBounces = 10;
let minObstacleDistance = 1000; // Increased from 800 to 1000

let lastTime = 0;
let jumpStartTime = 0;
let lastFireballTime = 0;
let lastObstaclePosition = -200;
let lastCoinPosition = -300;
let lastBirdPosition = -400;

let highScore = parseInt(localStorage.getItem('highScore')) || 0;
highScoreElement.textContent = highScore;

let maxJumpHeight = 100;
let inventory = [];
const skills = { jumpHeight: 1, fireballPower: 1, speed: 1 };
const items = {
    speedBoost: { name: 'Speed Boost', emoji: '⚡', effect: () => { gameSpeed += 2; setTimeout(() => { gameSpeed -= 2; }, 5000); } },
    shield: { name: 'Shield', emoji: '🛡️', effect: () => { lives++; updateUI(); } },
    doubleJump: { name: 'Double Jump', emoji: '🦘', effect: () => { maxJumpHeight *= 1.5; setTimeout(() => { maxJumpHeight /= 1.5; }, 10000); } }
};

let isPaused = false;
let difficulty = null; // Change from const to let and initialize to null

let gameStarted = false; // Add a flag to check if the game has started

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('pauseOverlay').style.display = 'flex';
    } else {
        document.getElementById('pauseOverlay').style.display = 'none';
        lastTime = null; // Reset lastTime to avoid large delta on unpause
    }
}

function initGame() {
    createSkillButtons();
    initializeRPGElements();
    dino.style.bottom = '-10px';
    updateUI(); // Update UI without starting the game
}

function createSkillButtons() {
    Object.keys(skills).forEach(skill => {
        const button = document.createElement('button');
        button.classList.add('skill-button');
        button.textContent = `Upgrade ${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
        button.onclick = () => upgradeSkill(skill);
        skillsDiv.appendChild(button);
    });
}

function upgradeSkill(skill) {
    if (skillPoints > 0 && skills[skill] < 5) {
        skills[skill]++;
        skillPoints--;
        updateUI();
        applySkillEffects();
    }
}

function applySkillEffects() {
    maxJumpHeight = 100 + (skills.jumpHeight - 1) * 20;
    gameSpeed = 5 + (skills.speed - 1);
}

function addXP(amount) {
    xp += amount;
    if (xp >= level * 100) levelUp();
    updateUI();
}

function levelUp() {
    level++;
    xp = 0;
    skillPoints++;
    updateUI();
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('lives').textContent = lives;
    document.getElementById('xp').textContent = xp;
    document.getElementById('level').textContent = level;
    document.getElementById('skillPoints').textContent = skillPoints;
    updateInventoryUI();
}

function updateInventoryUI() {
    const inventoryElement = document.getElementById('inventory-items');
    inventoryElement.innerHTML = '';
    inventory.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.classList.add('inventory-item');
        itemElement.textContent = item.emoji;
        itemElement.title = item.name;
        itemElement.onclick = () => useItem(index);
        inventoryElement.appendChild(itemElement);
    });
}

function startJump(event) {
    if (event.code === 'Space' && !isJumping) {
        isJumping = true;
        jumpStartTime = Date.now();
        requestAnimationFrame(jumpAnimation);
    }
}

function jumpAnimation() {
    let elapsedTime = Date.now() - jumpStartTime;
    let progress = Math.min(1, elapsedTime / jumpDuration);
    let easeProgress = Math.sin(progress * Math.PI);
    let height = maxJumpHeight * easeProgress;
    
    dino.style.bottom = (height - 10) + 'px';
    
    if (progress < 1) {
        requestAnimationFrame(jumpAnimation);
    } else {
        isJumping = false;
        dino.style.bottom = '-10px';
    }
}

function shootFireball() {
    const currentTime = Date.now();
    if (currentTime - lastFireballTime < shootCooldown) return;

    lastFireballTime = currentTime;
    const fireball = createFireball();
    moveFireball(fireball);
}

function createFireball() {
    const fireball = document.createElement('div');
    fireball.classList.add('fireball');
    fireball.textContent = '🔥';
    game.appendChild(fireball);

    const gameRect = game.getBoundingClientRect();
    const dinoRect = dino.getBoundingClientRect();
    fireball.style.bottom = (gameRect.bottom - dinoRect.bottom + 20) + 'px';
    fireball.style.left = (dinoRect.right - gameRect.left) + 'px';

    return fireball;
}

function moveFireball(fireball) {
    const gameRect = game.getBoundingClientRect();
    let position = parseInt(fireball.style.left);
    let bottomPosition = parseInt(fireball.style.bottom);
    let yVelocity = 3;
    let bounceCount = 0;

    function animate() {
        position += 2;
        yVelocity -= 0.2;
        bottomPosition += yVelocity;

        if (bottomPosition <= 0 && bounceCount < maxBounces) {
            bottomPosition = 0;
            yVelocity = Math.abs(yVelocity) * 0.6;
            bounceCount++;
        }

        fireball.style.left = position + 'px';
        fireball.style.bottom = bottomPosition + 'px';

        if (position >= gameRect.width || (bottomPosition <= 0 && bounceCount >= maxBounces)) {
            game.removeChild(fireball);
        } else {
            const obstacles = document.querySelectorAll('.bird'); // Only check for birds
            let hitObstacle = false;
            for (let obstacle of obstacles) {
                if (isFireballCollision(fireball, obstacle) && isOnScreen(obstacle)) {
                    destroyObstacle(obstacle);
                    hitObstacle = true;
                    break;
                }
            }
            if (hitObstacle) {
                game.removeChild(fireball);
            } else {
                requestAnimationFrame(animate);
            }
        }
    }

    requestAnimationFrame(animate);
}

function destroyObstacle(obstacle) {
    const obstacleRect = obstacle.getBoundingClientRect();
    const gameRect = game.getBoundingClientRect();

    // Create explosion effect
    const explosion = document.createElement('div');
    explosion.classList.add('explosion');
    explosion.textContent = '💥';
    explosion.style.position = 'absolute';
    explosion.style.left = (obstacleRect.left - gameRect.left) + 'px';
    explosion.style.bottom = (gameRect.bottom - obstacleRect.bottom) + 'px';
    game.appendChild(explosion);

    // Remove the obstacle
    game.removeChild(obstacle);

    // Add points
    score += 20;
    addXP(10);
    updateUI();

    // Remove explosion after a short delay
    setTimeout(() => {
        game.removeChild(explosion);
    }, 300);
}

function startGame() {
    score = 0;
    lives = 1;
    lastObstaclePosition = minObstacleDistance;
    lastCoinPosition = 0;
    lastBirdPosition = 0;
    updateUI();
    
    // Clear existing obstacles
    const existingObstacles = document.querySelectorAll('.cactus, .bird, .coin, .item');
    existingObstacles.forEach(obstacle => obstacle.remove());
    
    // Reset lastTime to ensure smooth start
    lastTime = null;
    
    // Start the game loop immediately
    gameLoop(performance.now());
}

let scoreIncrementTime = 0; // Track time for score increment

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    if (!isPaused) {
        scoreIncrementTime += delta;
        if (scoreIncrementTime >= 1000) { // Increment score every second
            score += 10; // 100 points per 10 seconds = 10 points per second
            scoreIncrementTime = 0;
            updateUI();
        }

        moveElements('.cactus, .bird, .coin, .item', delta);
        generateObstacles(delta);

        // Remove any elements that have gone off-screen
        const offScreenElements = document.querySelectorAll('.cactus, .bird, .coin, .item');
        offScreenElements.forEach(element => {
            if (parseFloat(element.style.left) <= -40) {
                element.remove();
            }
        });
    }

    requestAnimationFrame(gameLoop);
}

function generateObstacles(delta) {
    lastObstaclePosition += gameSpeed * (delta / 16);

    if (lastObstaclePosition >= minObstacleDistance) {
        const randomNumber = Math.random();
        if (randomNumber < 0.9) { // 90% chance of obstacle generation
            if (Math.random() < 0.9) { // 90% chance for cactus, 10% for bird
                createCactus();
                console.log('Cactus created');
            } else {
                createBird();
                console.log('Bird created');
            }
            lastObstaclePosition = 0; // Reset position after creating an obstacle
        } else {
            lastObstaclePosition = Math.random() * 30; // Small random delay
        }
    }

    // Generate coins/items separately
    lastCoinPosition += gameSpeed * (delta / 16);
    if (lastCoinPosition >= 800 && Math.random() < 0.05) {
        createCoin();
        console.log('Coin created');
        lastCoinPosition = 0;
    }
}

function moveElements(selector, delta) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
        let position = parseFloat(element.style.left);
        if (isNaN(position)) {
            position = 600; // Default to 600 if not set
        }
        position -= gameSpeed * (delta / 16);
        element.style.left = `${position}px`;

        if (position <= -40) {
            element.remove();
        } else if (element.classList.contains('coin') || element.classList.contains('item')) {
            if (isCoinCollision(element)) {
                element.remove();
                if (element.classList.contains('coin')) {
                    score += 50;
                    addXP(5);
                } else {
                    acquireItem(items[element.dataset.itemType]);
                }
                updateUI();
            }
        } else if (isObstacleCollision(element)) {
            gameOver();
        }
    });
}

function createCoin() {
    if (lastObstaclePosition < 150) return;

    const isItem = Math.random() < 0.05; // 5% chance to spawn an item instead of a coin
    const element = document.createElement('div');
    element.classList.add(isItem ? 'item' : 'coin');
    
    if (isItem) {
        const itemKeys = Object.keys(items);
        const randomItemKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
        element.textContent = items[randomItemKey].emoji;
        element.dataset.itemType = randomItemKey;
    } else {
        element.textContent = '🪙';
    }
    
    game.appendChild(element);
    
    let position = 620;
    let height = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 100) + 20;
    
    element.style.position = 'absolute';
    element.style.bottom = height + 'px';
    element.style.left = position + 'px';
}

function createCactus() {
    const cactus = document.createElement('div');
    cactus.classList.add('cactus');
    cactus.textContent = '🌵';
    cactus.style.position = 'absolute';
    cactus.style.left = '600px';
    cactus.style.bottom = '0px';
    
    // Randomly adjust cactus size
    const scale = 0.8 + Math.random() * 0.4; // Random scale between 0.8 and 1.2
    cactus.style.transform = `scale(${scale})`;
    
    game.appendChild(cactus);
}

function createBird() {
    const bird = document.createElement('div');
    bird.classList.add('bird');
    bird.textContent = '🦅';
    bird.style.fontSize = '30px';
    bird.style.position = 'absolute';
    bird.style.left = '600px';
    bird.style.bottom = `${Math.floor(Math.random() * 100) + 20}px`;
    game.appendChild(bird);
}

function isCoinCollision(coin) {
    const dinoRect = dino.getBoundingClientRect();
    const coinRect = coin.getBoundingClientRect();
    
    return !(
        dinoRect.bottom < coinRect.top || 
        dinoRect.top > coinRect.bottom || 
        dinoRect.right < coinRect.left || 
        dinoRect.left > coinRect.right
    );
}

function isObstacleCollision(obstacle) {
    if (!obstacle.isConnected) return false;

    const dinoRect = dino.getBoundingClientRect();
    const obstacleRect = obstacle.getBoundingClientRect();
    
    const dinoCollisionBox = {
        left: dinoRect.left + 15,
        right: dinoRect.right - 15,
        top: dinoRect.top + 10,
        bottom: dinoRect.bottom - 5
    };
    
    const obstacleCollisionBox = {
        left: obstacleRect.left + 5,
        right: obstacleRect.right - 5,
        top: obstacleRect.top + 5,
        bottom: obstacleRect.bottom + 5
    };
    
    return !(
        dinoCollisionBox.bottom < obstacleCollisionBox.top ||
        dinoCollisionBox.top > obstacleCollisionBox.bottom ||
        dinoCollisionBox.right < obstacleCollisionBox.left ||
        dinoCollisionBox.left > obstacleCollisionBox.right
    );
}

function isFireballCollision(fireball, obstacle) {
    const fireballRect = fireball.getBoundingClientRect();
    const obstacleRect = obstacle.getBoundingClientRect();

    return !(
        fireballRect.bottom < obstacleRect.top ||
        fireballRect.top > obstacleRect.bottom ||
        fireballRect.right < obstacleRect.left ||
        fireballRect.left > obstacleRect.right
    );
}

function isOnScreen(element) {
    const rect = element.getBoundingClientRect();
    return rect.left < window.innerWidth && rect.right > 0;
}

function updateScore() {
    if (score % 3 === 0) { // Increment score every 3 frames instead of every frame
        score++;
        if (score % 5 === 0) { // Update the displayed score every 5 points
            scoreElement.textContent = score;
            
            if (score > highScore) {
                highScore = score;
                highScoreElement.textContent = highScore;
                localStorage.setItem('highScore', highScore.toString());
            }
            
            if (score % 500 === 0) { // Changed from 1000 to 500
                gameSpeed += difficulty === 'easy' ? 0.2 : (difficulty === 'medium' ? 0.3 : 0.4);
                minObstacleDistance = Math.max(minObstacleDistance - 20, 300); // Decrease minimum distance, but not below 300
            }
        }
    }
}

function gameOver() {
    lives--;
    document.getElementById('lives').textContent = lives;
    
    if (lives > 0) {
        alert('You lost a life! Remaining lives: ' + lives);
        resetObstacles();
        gameSpeed = 3; // Reset game speed when losing a life
    } else {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('highScore', highScore.toString());
        }
        alert('Game Over! Your score: ' + score + '\nHigh Score: ' + highScore);
        location.reload();
    }
}

function resetObstacles() {
    const obstacles = document.querySelectorAll('.cactus, .bird, .coin');
    obstacles.forEach(obstacle => game.removeChild(obstacle));
    lastObstaclePosition = -200;
    lastCoinPosition = -300;
    lastBirdPosition = -400;
}

function acquireItem(item) {
    if (inventory.length < maxInventorySize) {
        inventory.push(item);
        updateInventoryUI();
    }
}

function useItem(index) {
    const item = inventory[index];
    item.effect();
    inventory.splice(index, 1);
    updateInventoryUI();
}

function initializeRPGElements() {
    updateUI();
    applySkillEffects();
    updateInventoryUI();

    const skillsDiv = document.getElementById('skills');
    if (!skillsDiv.hasChildNodes()) {
        ['jumpHeight', 'fireballPower', 'speed'].forEach(skill => {
            const button = document.createElement('button');
            button.classList.add('skill-button');
            button.textContent = `Upgrade ${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
            button.onclick = () => upgradeSkill(skill);
            skillsDiv.appendChild(button);
        });
    }
}

function setDifficulty(level) {
    difficulty = level;
    switch (level) {
        case 'easy':
            gameSpeed = 3;
            minObstacleDistance = 250; // Increased from 200 to 250
            break;
        case 'medium':
            gameSpeed = 4;
            minObstacleDistance = 200; // Increased from 150 to 200
            break;
        case 'hard':
            gameSpeed = 5;
            minObstacleDistance = 150; // Increased from 100 to 150
            break;
    }
    startOverlay.style.display = 'none'; // Hide the start overlay
    startGame(); // Start the game immediately
}

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        if (!gameStarted) {
            gameStarted = true;
            startGame();
            startOverlay.style.display = 'none'; // Hide the start overlay
        }
        startJump(event);
    } else if (event.code === 'KeyX') {
        shootFireball();
    } else if (event.code === 'KeyP') {
        togglePause();
    }
});

initGame();