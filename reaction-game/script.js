
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const symbolContainer = document.getElementById('symbol-container');
const leaderboardList = document.getElementById('leaderboard-list');

let model;
let gameStarted = false;
let currentSymbol = null;
let startTime = null;
let players = {};

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            resolve(video);
        };
    });
}

async function loadModel() {
    const model = await handPoseDetection.createDetector(handPoseDetection.SupportedModels.MediaPipeHands, {
        runtime: 'tfjs',
    });
    return model;
}

function getHandSymbol(hand) {
    const landmarks = hand.keypoints;
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const palm = landmarks[0];

    const isThumbUp = thumbTip.y < palm.y;
    const isIndexUp = indexTip.y < palm.y;
    const isMiddleUp = middleTip.y < palm.y;
    const isRingUp = ringTip.y < palm.y;
    const isPinkyUp = pinkyTip.y < palm.y;

    if (isThumbUp && isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        return '✋';
    }
    if (!isThumbUp && isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        return '✌️';
    }
    if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        return '👍';
    }

    return null;
}


async function detectHands() {
    const hands = await model.estimateHands(video);

    context.clearRect(0, 0, canvas.width, canvas.height);

    hands.forEach(hand => {
        context.fillStyle = 'red';
        hand.keypoints.forEach(keypoint => {
            context.beginPath();
            context.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
            context.fill();
        });

        if (gameStarted && currentSymbol) {
            const symbol = getHandSymbol(hand);
            if (symbol === currentSymbol) {
                const reactionTime = Date.now() - startTime;
                const playerName = hand.handedness; // Or some other way to identify players

                if (!players[playerName] || reactionTime < players[playerName]) {
                    players[playerName] = reactionTime;
                    updateLeaderboard();
                }

                gameStarted = false;
                setTimeout(startGame, 3000);
            }
        }
    });

    requestAnimationFrame(detectHands);
}

function updateLeaderboard() {
    leaderboardList.innerHTML = '';
    const sortedPlayers = Object.entries(players).sort((a, b) => a[1] - b[1]);

    sortedPlayers.forEach(([name, time]) => {
        const li = document.createElement('li');
        li.textContent = `${name}: ${time}ms`;
        leaderboardList.appendChild(li);
    });
}

function startGame() {
    const symbols = ['✋', '✌️', '👍'];
    currentSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    symbolContainer.textContent = currentSymbol;
    startTime = Date.now();
    gameStarted = true;
}

async function main() {
    await setupCamera();
    model = await loadModel();
    detectHands();
    startGame();
}

main();
