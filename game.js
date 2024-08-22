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
const baseGameSpeed = 4;
const baseJumpDuration = 600; // Current jump duration at game speed 4
const shootCooldown = 300;
const maxBounces = 20;
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
    extraLife: { name: 'Extra Life', emoji: '❤️', effect: () => { lives++; updateUI(); } },
    doubleJump: { name: 'Double Jump', emoji: '🦘', effect: () => { maxJumpHeight *= 1.5; setTimeout(() => { maxJumpHeight /= 1.5; }, 10000); } },
    invincibility: { name: 'Invincibility', emoji: '🛡️', effect: () => { activateInvincibility(5000); } }, // 5 seconds of invincibility
    slowMotion: { name: 'Slow Motion', emoji: '🐢', effect: () => { activateSlowMotion(5000); } } // 5 seconds of slow motion
};

let isPaused = false;
let difficulty = null; // Change from const to let and initialize to null

let gameStarted = false; // Add a flag to check if the game has started

// Add these variables at the top of the file
let isMobile = false;
let gameContainerWidth = 600;
let gameContainerHeight = 200;
let isInvincible = false; // Track invincibility state
let originalGameSpeed = gameSpeed; // Store original game speed for slow motion

let isNightMode = false;
const nightModeInterval = 1000; // Switch between day and night every 1000 points
const increaseSpeedInterval = 1000; // Increase game speed every 1000 points

let lastScoreUpdateTime = 0;
const pointsPerMinute = 1000;

function toggleNightMode() {
    isNightMode = !isNightMode;
    const gameElement = document.getElementById('game');
    const sunMoon = document.getElementById('sun');
    
    if (isNightMode) {
        gameElement.style.backgroundColor = '#001f3f';
        sunMoon.textContent = '🌙';
        sunMoon.style.color = '#f1c40f';
    } else {
        gameElement.style.backgroundColor = '#87CEEB';
        sunMoon.textContent = '☀️';
        sunMoon.style.color = '#f39c12';
    }
}

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
    checkMobile();
    resizeGame();
    dino.style.bottom = '-10px';
    updateUI(); // Update UI without starting the game
    
    // Add event listeners for mobile controls
    document.getElementById('jumpButton').addEventListener('touchstart', startJump);
    document.getElementById('fireButton').addEventListener('touchstart', shootFireball);
    document.getElementById('pauseButton').addEventListener('touchstart', togglePause);
    
    // Add resize event listener
    window.addEventListener('resize', resizeGame);
    
    // Set up initial day mode
    const sunMoon = document.getElementById('sun');
    sunMoon.textContent = '☀️';
    sunMoon.style.color = '#f39c12';

    // reset night mode
    if (isNightMode) {
        toggleNightMode();
    }
}

function formatSkillName(skill) {
    return skill
        .replace(/([A-Z])/g, ' $1') // Add a space before each uppercase letter
        .replace(/^./, str => str.toUpperCase()); // Capitalize the first letter
}

function createSkillButtons() {
    Object.keys(skills).forEach(skill => {
        const button = document.createElement('button');
        button.classList.add('skill-button');
        button.textContent = `Upgrade ${formatSkillName(skill)}`;
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
    gameSpeed = gameSpeed + (skills.speed - 1);
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

// Modify the startJump function to work with both keyboard and touch events
function startJump(event) {
    if ((event.type === 'keydown' && event.code === 'Space') || event.type === 'touchstart') {
        if (!isJumping) {
            isJumping = true;
            jumpStartTime = Date.now();
            requestAnimationFrame(jumpAnimation);
        }
        event.preventDefault(); // Prevent default behavior for touch events
    }
}

function calculateJumpDuration() {
    return baseJumpDuration * (baseGameSpeed / gameSpeed);
}

function jumpAnimation() {
    let elapsedTime = Date.now() - jumpStartTime;
    let jumpDuration = calculateJumpDuration();
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

// Modify the shootFireball function to work with both keyboard and touch events
function shootFireball(event) {
    if ((event.type === 'keydown' && event.code === 'KeyX') || event.type === 'touchstart') {
        const currentTime = Date.now();
        if (currentTime - lastFireballTime < shootCooldown) return;

        lastFireballTime = currentTime;
        const fireball = createFireball();
        moveFireball(fireball);
        event.preventDefault(); // Prevent default behavior for touch events
    }
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

    // 10% chance to drop an item
    if (Math.random() < 0.1) {
        dropItem();
    }

    // Remove explosion after a short delay
    setTimeout(() => {
        game.removeChild(explosion);
    }, 300);
}

function dropItem() {
    const itemKeys = Object.keys(items);
    const randomItemKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
    const item = items[randomItemKey];

    acquireItem(item);
}

function startGame() {
    score = 0;
    lives = 1;
    lastObstaclePosition = minObstacleDistance;
    lastCoinPosition = 0;
    lastBirdPosition = 0;
    lastScoreUpdateTime = null;
    
    // Reset game speed based on difficulty
    switch (difficulty) {
        case 'easy':
            gameSpeed = 3;
            break;
        case 'medium':
            gameSpeed = 4;
            break;
        case 'hard':
            gameSpeed = 5;
            break;
        default:
            gameSpeed = 4; // Default to medium if difficulty is not set
    }
    
    // Reset night mode
    if (isNightMode) {
        toggleNightMode();
    }
    
    updateUI();
    
    // Clear existing obstacles
    const existingObstacles = document.querySelectorAll('.cactus, .bird, .coin, .item');
    existingObstacles.forEach(obstacle => obstacle.remove());
    
    // Reset lastTime to ensure smooth start
    lastTime = null;
    
    // Start the game loop immediately
    gameLoop(performance.now());
}

function updateScore(timestamp) {
    if (!lastScoreUpdateTime) lastScoreUpdateTime = timestamp;
    
    const elapsedTime = timestamp - lastScoreUpdateTime;
    const pointsToAdd = Math.floor((elapsedTime / 60000) * pointsPerMinute);
    
    if (pointsToAdd > 0) {
        const oldScore = score;
        score += pointsToAdd;
        lastScoreUpdateTime = timestamp;
        scoreElement.textContent = score;

        // Check for speed increase
        if (Math.floor(score / increaseSpeedInterval) > Math.floor(oldScore / increaseSpeedInterval)) {
            gameSpeed += difficulty === 'easy' ? 0.2 : (difficulty === 'medium' ? 0.3 : 0.4);
            minObstacleDistance = Math.max(minObstacleDistance - 20, 300);
        }
    
        // Check for night mode toggle
        if (Math.floor(score / nightModeInterval) > Math.floor(oldScore / nightModeInterval)) {
            toggleNightMode();
        }
    
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('highScore', highScore.toString());
        }
    }
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    if (!isPaused) {
        moveElements('.cactus, .bird, .coin, .item', delta);
        generateObstacles(delta);

        // Remove any elements that have gone off-screen
        const offScreenElements = document.querySelectorAll('.cactus, .bird, .coin, .item');
        offScreenElements.forEach(element => {
            if (parseFloat(element.style.left) <= -40) {
                element.remove();
            }
        });
        updateScore(timestamp);
    }

    requestAnimationFrame(gameLoop);
}

function generateObstacles(delta) {
    lastObstaclePosition += gameSpeed * (delta / 16);

    if (lastObstaclePosition >= minObstacleDistance) {
        const randomNumber = Math.random();
        if (randomNumber < 0.9) { // 90% chance of obstacle generation
            if (Math.random() < 0.8) { // 90% chance for cactus, 10% for bird
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
            if (!isInvincible) {
                gameOver();
            }
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

function gameOver() {
    lives--;
    document.getElementById('lives').textContent = lives;
    
    if (lives > 0) {
        alert('You lost a life! Remaining lives: ' + lives);
        resetObstacles();
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
            minObstacleDistance = 250;
            break;
        case 'medium':
            minObstacleDistance = 200;
            break;
        case 'hard':
            minObstacleDistance = 200;
            break;
    }
    startOverlay.style.display = 'none'; // Hide the start overlay
    startGame(); // Start the game after setting the difficulty
}

function checkMobile() {
    isMobile = window.innerWidth <= 600;
    gameContainerWidth = isMobile ? window.innerWidth : 600;
    gameContainerHeight = isMobile ? 150 : 200;
}

function resizeGame() {
    checkMobile();
    const gameContainer = document.getElementById('game-container');
    const game = document.getElementById('game');
    
    gameContainer.style.width = `${gameContainerWidth}px`;
    game.style.width = `${gameContainerWidth}px`;
    game.style.height = `${gameContainerHeight}px`;
    
    // Adjust game elements positions if needed
    // For example, adjust the sun's position
    const sun = document.getElementById('sun');
    sun.style.right = `${gameContainerWidth * 0.05}px`;
    sun.style.top = `${gameContainerHeight * 0.1}px`;
}

// Modify the togglePause function to work with both keyboard and touch events
function togglePause(event) {
    if ((event.type === 'keydown' && event.code === 'KeyP') || event.type === 'touchstart') {
        isPaused = !isPaused;
        if (isPaused) {
            document.getElementById('pauseOverlay').style.display = 'flex';
        } else {
            document.getElementById('pauseOverlay').style.display = 'none';
            lastTime = null; // Reset lastTime to avoid large delta on unpause
        }
        event.preventDefault(); // Prevent default behavior for touch events
    }
}

// Modify the event listeners to use the updated functions
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        startJump(event);
    } else if (event.code === 'KeyX') {
        shootFireball(event);
    } else if (event.code === 'KeyP') {
        togglePause(event);
    }
});

function activateInvincibility(duration) {
    isInvincible = true;
    setTimeout(() => {
        isInvincible = false;
    }, duration);
}

function activateSlowMotion(duration) {
    originalGameSpeed = gameSpeed;
    gameSpeed = 2;
    setTimeout(() => {
        gameSpeed = originalGameSpeed;
    }, duration);
}

initGame();