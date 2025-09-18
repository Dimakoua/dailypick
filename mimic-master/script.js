(() => {
    const video = document.getElementById('video');
    const overlay = document.getElementById('overlay');
    const ctx = overlay.getContext('2d');
    const promptDisplay = document.getElementById('promptDisplay');
    const statusMessage = document.getElementById('statusMessage');
    const roundHint = document.getElementById('roundHint');
    const playerNameInput = document.getElementById('playerNameInput');
    const saveNameBtn = document.getElementById('saveNameBtn');
    const startRoomBtn = document.getElementById('startRoomBtn');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const enableCameraBtn = document.getElementById('enableCameraBtn');
    const startRoundBtn = document.getElementById('startRoundBtn');
    const sessionStatus = document.getElementById('sessionStatus');
    const leaderboardList = document.getElementById('leaderboardList');

    const LOCAL_NAME_KEY = 'mimicMasterDisplayName';
    const PROMPTS = [
        {
            id: 'one',
            label: '1',
            check: (state) => state.index && !state.middle && !state.ring && !state.pinky && !state.thumb,
        },
        {
            id: 'victory',
            label: '✌️',
            check: (state) => state.index && state.middle && !state.ring && !state.pinky && !state.thumb,
        },
        {
            id: 'three',
            label: '3',
            check: (state) => state.index && state.middle && state.ring && !state.pinky && !state.thumb,
        },
        {
            id: 'four',
            label: '4',
            check: (state) => state.index && state.middle && state.ring && state.pinky && !state.thumb,
        },
        {
            id: 'palm',
            label: '✋',
            check: (state) => state.index && state.middle && state.ring && state.pinky && state.thumb,
        },
        {
            id: 'thumbs',
            label: '👍',
            check: (state) => state.thumb && !state.index && !state.middle && !state.ring && !state.pinky,
        },
    ];

    let detector = null;
    let cameraActive = false;
    let ws = null;
    let sessionId = null;
    let userId = null;
    let playerName = localStorage.getItem(LOCAL_NAME_KEY) || '';
    let roundActive = false;
    let currentPrompt = null;
    let roundStartTime = null;
    let pendingDelayTimer = null;
    let consecutiveMatches = 0;
    const MATCH_STABILITY_FRAMES = 4;

    playerNameInput.value = playerName;

    function formatMs(value) {
        return `${Math.round(value)} ms`;
    }

    function setStatus(text) {
        statusMessage.textContent = text;
    }

    function setRoundReadyState() {
        promptDisplay.textContent = 'Ready?';
        setStatus('Tap “Start Reaction Round” to begin.');
        consecutiveMatches = 0;
        roundActive = false;
        currentPrompt = null;
    }

    function updateLeaderboard(entries) {
        leaderboardList.innerHTML = '';

        if (!entries || entries.length === 0) {
            const placeholder = document.createElement('li');
            placeholder.textContent = 'Be the first to set a time.';
            leaderboardList.appendChild(placeholder);
            return;
        }

        entries.forEach((entry, index) => {
            const li = document.createElement('li');
            const displayName = entry.name || `Player ${index + 1}`;
            const best = typeof entry.bestTime === 'number' ? formatMs(entry.bestTime) : '—';
            li.innerHTML = `<strong>${displayName}</strong> · ${best}`;
            leaderboardList.appendChild(li);
        });
    }

    async function ensureDetector() {
        if (detector) {
            return detector;
        }
        if (!window.handPoseDetection) {
            throw new Error('Hand Pose Detection library not loaded yet.');
        }
        detector = await window.handPoseDetection.createDetector(
            window.handPoseDetection.SupportedModels.MediaPipeHands,
            {
                runtime: 'tfjs',
                modelType: 'lite',
                maxHands: 1,
            }
        );
        return detector;
    }

    async function enableCamera() {
        if (cameraActive) {
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            video.srcObject = stream;
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play().then(resolve).catch(resolve);
                };
            });

            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            cameraActive = true;
            enableCameraBtn.disabled = true;
            roundHint.textContent = 'Camera ready. Start a round when you are connected to a room.';
            setStatus('Camera enabled. Waiting for a round to start.');
            requestAnimationFrame(detectHandsLoop);
        } catch (err) {
            console.error('Camera access denied', err);
            setStatus('Camera permission is required to play.');
        }
    }

    function generateSessionId() {
        return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    }

    function updateUrlWithSession(id) {
        const url = new URL(window.location.href);
        url.searchParams.set('session_id', id);
        window.history.replaceState({}, '', url.toString());
    }

    function copyInviteLink() {
        if (!sessionId) return;
        const url = `${window.location.origin}/mimic-master/?session_id=${sessionId}`;
        navigator.clipboard.writeText(url).then(() => {
            setStatus('Invite link copied.');
        }).catch(() => {
            setStatus('Unable to copy link, please copy it manually.');
        });
    }

    function connectToRoom(targetSessionId) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }

        sessionId = targetSessionId;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/api/mimic-master/websocket?session_id=${sessionId}`);

        ws.onopen = () => {
            sessionStatus.textContent = `Connected to room ${sessionId}`;
            copyLinkBtn.disabled = false;
            startRoundBtn.disabled = !cameraActive;
            if (playerName) {
                sendPlayerName(playerName);
            }
            setStatus('Connected. Start a reaction round when ready.');
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleServerMessage(message);
            } catch (err) {
                console.error('Invalid WS message', err);
            }
        };

        ws.onclose = () => {
            sessionStatus.textContent = 'Disconnected.';
            copyLinkBtn.disabled = true;
            startRoundBtn.disabled = true;
            setStatus('Connection closed. Start a new room to play again.');
        };

        ws.onerror = () => {
            setStatus('WebSocket error.');
        };
    }

    function handleServerMessage(message) {
        switch (message.type) {
            case 'user-id':
                userId = message.id;
                break;
            case 'leaderboard':
                updateLeaderboard(message.entries);
                break;
            case 'user-list':
                // Optional to use in the future; no UI needed now.
                break;
            default:
                break;
        }
    }

    function sendPlayerName(name) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        ws.send(JSON.stringify({ type: 'set-name', name }));
    }

    function reportReactionTime(durationMs) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        if (!currentPrompt) return;
        ws.send(JSON.stringify({
            type: 'report-score',
            promptId: currentPrompt.id,
            promptLabel: currentPrompt.label,
            reactionTime: Math.round(durationMs),
            name: playerName || null,
        }));
    }

    function pickPrompt() {
        return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    }

    function startReactionRound() {
        if (!cameraActive) {
            setStatus('Enable your camera first.');
            return;
        }
        if (!sessionId || !ws || ws.readyState !== WebSocket.OPEN) {
            setStatus('Connect to a room before starting a round.');
            return;
        }
        if (!playerName) {
            setStatus('Set your display name so the leaderboard can track you.');
            return;
        }

        startRoundBtn.disabled = true;
        consecutiveMatches = 0;
        roundActive = false;
        currentPrompt = null;
        promptDisplay.textContent = 'Get ready…';
        setStatus('Wait for the prompt.');

        if (pendingDelayTimer) {
            clearTimeout(pendingDelayTimer);
        }
        const delay = 800 + Math.random() * 1200;
        pendingDelayTimer = setTimeout(() => {
            currentPrompt = pickPrompt();
            promptDisplay.textContent = currentPrompt.label;
            roundStartTime = performance.now();
            roundActive = true;
            consecutiveMatches = 0;
            setStatus('Match the prompt with your hand!');
        }, delay);
    }

    function getFingerState(hand) {
        const points = hand?.keypoints;
        if (!points || points.length < 21) {
            return null;
        }
        const handedness = (hand.handedness || 'Right').toLowerCase();
        const isRight = handedness.startsWith('r');

        const wristY = points[0].y;
        const thumbTip = points[4];
        const thumbIP = points[3];
        const thumbCMC = points[1];
        const indexTip = points[8];
        const indexPip = points[6];
        const middleTip = points[12];
        const middlePip = points[10];
        const ringTip = points[16];
        const ringPip = points[14];
        const pinkyTip = points[20];
        const pinkyPip = points[18];

        const fingerThreshold = 8;
        const thumbHorizontalThreshold = 12;

        const thumbExtended = ((isRight && thumbTip.x > thumbIP.x + thumbHorizontalThreshold) ||
            (!isRight && thumbTip.x < thumbIP.x - thumbHorizontalThreshold)) &&
            (thumbTip.y < thumbCMC.y + 12);

        const indexExtended = indexTip.y < indexPip.y - fingerThreshold && indexTip.y < wristY - 6;
        const middleExtended = middleTip.y < middlePip.y - fingerThreshold && middleTip.y < wristY - 6;
        const ringExtended = ringTip.y < ringPip.y - fingerThreshold && ringTip.y < wristY - 6;
        const pinkyExtended = pinkyTip.y < pinkyPip.y - fingerThreshold && pinkyTip.y < wristY - 6;

        return {
            thumb: thumbExtended,
            index: indexExtended,
            middle: middleExtended,
            ring: ringExtended,
            pinky: pinkyExtended,
        };
    }

    function drawHandLandmarks(hand) {
        const points = hand.keypoints;
        if (!points) return;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        points.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function detectHandsLoop() {
        if (!cameraActive || !detector) {
            requestAnimationFrame(detectHandsLoop);
            return;
        }

        detector.estimateHands(video, { flipHorizontal: true }).then((hands) => {
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            if (hands && hands.length > 0) {
                hands.forEach(drawHandLandmarks);
            }

            if (roundActive && currentPrompt) {
                let matched = false;
                if (hands && hands.length > 0) {
                    for (const hand of hands) {
                        const state = getFingerState(hand);
                        if (!state) continue;
                        if (currentPrompt.check(state, hand)) {
                            matched = true;
                            break;
                        }
                    }
                }

                if (matched) {
                    consecutiveMatches += 1;
                    if (consecutiveMatches >= MATCH_STABILITY_FRAMES) {
                        const reactionMs = performance.now() - roundStartTime;
                        roundActive = false;
                        promptDisplay.textContent = `✅ ${currentPrompt.label}`;
                        setStatus(`Matched in ${formatMs(reactionMs)}.`);
                        startRoundBtn.disabled = false;
                        reportReactionTime(reactionMs);
                        currentPrompt = null;
                    }
                } else {
                    consecutiveMatches = 0;
                }
            } else {
                consecutiveMatches = 0;
            }

            requestAnimationFrame(detectHandsLoop);
        }).catch((err) => {
            console.error('Hand detection error:', err);
            requestAnimationFrame(detectHandsLoop);
        });
    }

    saveNameBtn.addEventListener('click', () => {
        const trimmed = playerNameInput.value.trim();
        if (!trimmed) {
            setStatus('Display name cannot be empty.');
            return;
        }
        playerName = trimmed;
        localStorage.setItem(LOCAL_NAME_KEY, playerName);
        setStatus(`Saved display name as ${playerName}.`);
        if (ws && ws.readyState === WebSocket.OPEN) {
            sendPlayerName(playerName);
        }
    });

    startRoomBtn.addEventListener('click', () => {
        const id = generateSessionId();
        updateUrlWithSession(id);
        connectToRoom(id);
        setRoundReadyState();
    });

    copyLinkBtn.addEventListener('click', copyInviteLink);

    enableCameraBtn.addEventListener('click', async () => {
        await enableCamera();
        await ensureDetector().catch((err) => {
            console.error('Detector init failed', err);
            setStatus('Unable to load hand detector. Try refreshing.');
        });
        if (cameraActive && ws && ws.readyState === WebSocket.OPEN) {
            startRoundBtn.disabled = false;
        }
    });

    startRoundBtn.addEventListener('click', startReactionRound);

    window.addEventListener('beforeunload', () => {
        if (ws) {
            ws.close();
        }
        if (video?.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }
    });

    setRoundReadyState();

    const existingSessionId = new URLSearchParams(window.location.search).get('session_id');
    if (existingSessionId) {
        connectToRoom(existingSessionId);
        updateUrlWithSession(existingSessionId);
        setStatus('Joined room. Save your name and enable camera to play.');
    }
})();
