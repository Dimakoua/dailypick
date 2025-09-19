(() => {
  const video = document.getElementById("video");
  const overlay = document.getElementById("overlay");
  const ctx = overlay.getContext("2d");
  const promptDisplay = document.getElementById("promptDisplay");
  const statusMessage = document.getElementById("statusMessage");
  const roundHint = document.getElementById("roundHint");
  const playerNameInput = document.getElementById("playerNameInput");
  const saveNameBtn = document.getElementById("saveNameBtn");
  const startRoomBtn = document.getElementById("startRoomBtn");
  const joinRoomBtn = document.getElementById("joinRoomBtn");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const enableCameraBtn = document.getElementById("enableCameraBtn");
  const startGameBtn = document.getElementById("startGameBtn");
  const waitingMessage = document.getElementById("waitingMessage");
  const sessionStatus = document.getElementById("sessionStatus");
  const leaderboardList = document.getElementById("leaderboardList");

  // enable via ?debug=true in URL
  const debug =
    new URLSearchParams(window.location.search).get("debug") === "true";

  const LOCAL_NAME_KEY = "mimicMasterDisplayName";
  const PROMPTS = [
    {
      id: "one",
      label: "1",
      check: (s) => s.index && !s.middle && !s.ring && !s.pinky && !s.thumb,
    },
    {
      id: "victory",
      label: "✌️",
      check: (s) => s.index && s.middle && !s.ring && !s.pinky && !s.thumb,
    },
    {
      id: "three",
      label: "3",
      check: (s) => s.index && s.middle && s.ring && !s.pinky && !s.thumb,
    },
    {
      id: "four",
      label: "4",
      check: (s) => s.index && s.middle && s.ring && s.pinky && !s.thumb,
    },
    {
      id: "palm",
      label: "✋",
      check: (s) => s.index && s.middle && s.ring && s.pinky && s.thumb,
    },
    {
      id: "thumbs",
      label: "👍",
      check: (s) => s.thumb && !s.index && !s.middle && !s.ring && !s.pinky,
    },
  ];

  let detector = null;
  let cameraActive = false;
  let ws = null;
  let sessionId = null;
  let userId = null;
  const ADJECTIVES = [
    "Quick",
    "Lazy",
    "Sleepy",
    "Noisy",
    "Hungry",
    "Happy",
    "Funny",
    "Crazy",
    "Angry",
    "Lucky",
  ];
  const NOUNS = [
    "Fox",
    "Dog",
    "Cat",
    "Cow",
    "Pig",
    "Duck",
    "Hen",
    "Horse",
    "Lion",
    "Tiger",
  ];

  function generateRandomName() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
  }

  let playerName = localStorage.getItem(LOCAL_NAME_KEY) || generateRandomName();
  let isHost = false;
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
    promptDisplay.textContent = "Ready?";
    setStatus("Tap “Start Reaction Round” to begin.");
    consecutiveMatches = 0;
    roundActive = false;
    currentPrompt = null;
  }

  function updatePlayerList(entries) {
    leaderboardList.innerHTML = "";
    if (!entries || entries.length === 0) {
      const placeholder = document.createElement("li");
      placeholder.textContent = "No players in the room yet.";
      leaderboardList.appendChild(placeholder);
      return;
    }
    entries.forEach((entry, index) => {
      const li = document.createElement("li");
      let displayName = entry.name || `Player ${index + 1}`;
      if (entry.id === userId) {
        displayName += " (You)";
      }
      const best =
        typeof entry.bestTime === "number"
          ? formatMs(entry.bestTime)
          : "Waiting…";
      li.innerHTML = `<strong>${displayName}</strong> · ${best}`;
      leaderboardList.appendChild(li);
    });
  }

  async function ensureDetector() {
    if (detector) return detector;
    if (!window.handPoseDetection)
      throw new Error("Hand Pose Detection library not loaded yet.");
    detector = await window.handPoseDetection.createDetector(
      window.handPoseDetection.SupportedModels.MediaPipeHands,
      {
        runtime: "mediapipe",
        solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
        modelType: "lite",
      }
    );
    return detector;
  }

  async function enableCamera() {
    if (cameraActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false,
      });
      video.srcObject = stream;
      await new Promise((resolve) => {
        video.onloadedmetadata = () =>
          video.play().then(resolve).catch(resolve);
      });
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      cameraActive = true;
      enableCameraBtn.disabled = true;
      roundHint.textContent =
        "Camera ready. Start a round when you are connected to a room.";
      setStatus("Camera enabled. Waiting for a round to start.");
      requestAnimationFrame(detectHandsLoop);
    } catch (err) {
      console.error("Camera access denied", err);
      setStatus("Camera permission is required to play.");
    }
  }

  function generateSessionId() {
    return (
      Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
    );
  }
  function updateUrlWithSession(id) {
    const url = new URL(window.location.href);
    url.searchParams.set("session_id", id);
    window.history.replaceState({}, "", url.toString());
  }
  function copyInviteLink() {
    if (!sessionId) return;
    const url = `${window.location.origin}/mimic-master/?session_id=${sessionId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => setStatus("Invite link copied."))
      .catch(() => setStatus("Unable to copy link."));
  }

  function connectToRoom(targetSessionId, isHostPlayer = false) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    sessionId = targetSessionId;
    isHost = isHostPlayer;
    if (isHost) {
      sessionStorage.setItem(`mimic-master-host-${sessionId}`, "true");
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = new URL(
      `/api/mimic-master/websocket?session_id=${sessionId}`,
      window.location.href
    );
    wsUrl.protocol = protocol;
    ws = new WebSocket(wsUrl.href);

    ws.onopen = () => {
      sessionStatus.textContent = `Connected to room ${sessionId}`;
      copyLinkBtn.disabled = false;
      startGameBtn.disabled = !cameraActive || !isHost;
      waitingMessage.style.display = isHost ? "none" : "block";
      startGameBtn.style.display = isHost ? "block" : "none"; // Ensure button visibility
      if (playerName) sendPlayerName(playerName, isHost);
      setStatus("Connected. Start a reaction round when ready.");
    };
    ws.onmessage = (event) => {
      try {
        handleServerMessage(JSON.parse(event.data));
      } catch (err) {
        console.error("Invalid WS message", err);
      }
    };
    ws.onclose = () => {
      sessionStatus.textContent = "Disconnected.";
      copyLinkBtn.disabled = true;
      if (isHost) {
        startGameBtn.disabled = true;
      }
      waitingMessage.style.display = "none";
      setStatus("Connection closed.");
    };
    ws.onerror = () => setStatus("WebSocket error.");
  }

  function handleServerMessage(message) {
    switch (message.type) {
      case "user-id":
        userId = message.id;
        break;
      case "leaderboard":
        updatePlayerList(message.entries);
        break;
      case "user-list":
        updatePlayerList(message.users);
        break;
      case "game-start":
        handleGameStart();
        break;
    }
  }

  function sendPlayerName(name) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "set-name", name }));
  }

  function reportReactionTime(durationMs) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !currentPrompt) return;
    ws.send(
      JSON.stringify({
        type: "report-score",
        promptId: currentPrompt.id,
        promptLabel: currentPrompt.label,
        reactionTime: Math.round(durationMs),
        name: playerName || null,
      })
    );
  }

  function pickPrompt() {
    return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  }

  function requestStartReactionRound() {
    if (!isHost) return;
    if (!cameraActive) return setStatus("Enable your camera first.");
    if (!sessionId || !ws || ws.readyState !== WebSocket.OPEN)
      return setStatus("Connect to a room first.");
    if (!playerName) return setStatus("Set your display name.");
    ws.send(JSON.stringify({ type: "game-start" }));
  }

  function handleGameStart() {
    startGameBtn.disabled = true;
    consecutiveMatches = 0;
    roundActive = false;
    currentPrompt = null;
    promptDisplay.textContent = "Get ready…";
    setStatus("Wait for the prompt.");
    if (pendingDelayTimer) clearTimeout(pendingDelayTimer);
    const delay = 800 + Math.random() * 1200;
    pendingDelayTimer = setTimeout(() => {
      currentPrompt = pickPrompt();
      promptDisplay.textContent = currentPrompt.label;
      roundStartTime = performance.now();
      roundActive = true;
      consecutiveMatches = 0;
      setStatus("Match the prompt with your hand!");
    }, delay);
  }

  function getFingerState(hand, sensitivity = 0.25) {
    const points = hand?.keypoints;
    if (!points || points.length < 21) return null;

    // Palm size = wrist (0) → middle knuckle (9)
    const palmSize = Math.hypot(
      points[0].x - points[9].x,
      points[0].y - points[9].y
    );

    // === Thumb landmarks ===
    const thumbTip = points[4];
    const thumbIP = points[3];
    const thumbCMC = points[1];
    const indexMCP = points[5];
    const pinkyMCP = points[17];

    const palmCenter = {
      x: (points[0].x + points[9].x + points[5].x + points[17].x) / 4,
      y: (points[0].y + points[9].y + points[5].y + points[17].y) / 4,
    };

    const thumbVec = { x: thumbTip.x - thumbIP.x, y: thumbTip.y - thumbIP.y };
    const palmAxis = {
      x: points[9].x - points[0].x,
      y: points[9].y - points[0].y,
    };
    const radialDir = {
      x: indexMCP.x - pinkyMCP.x,
      y: indexMCP.y - pinkyMCP.y,
    };

    const dot = (a, b) =>
      (a.x * b.x + a.y * b.y) /
      (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y) || 1);

    // Thumb considered extended if:
    // (A) sideways relative to palm,
    // (B) vertical (thumbs-up),
    // (C) clearly separated from palm center (open ✋ case)
    const thumbSideways = dot(thumbVec, radialDir) > 0.35; // relaxed a bit
    const thumbVertical = Math.abs(dot(thumbVec, palmAxis)) > 0.6;
    const thumbLong =
      Math.hypot(thumbTip.x - thumbIP.x, thumbTip.y - thumbIP.y) >
      palmSize * 0.25;
    const thumbFar =
      Math.hypot(thumbTip.x - palmCenter.x, thumbTip.y - palmCenter.y) >
      palmSize * 0.6;

    const thumbExtended =
      thumbLong && (thumbSideways || thumbVertical || thumbFar);

    // === Other fingers ===
    const indexExtended = points[8].y < points[6].y - palmSize * sensitivity;
    const middleExtended = points[12].y < points[10].y - palmSize * sensitivity;
    const ringExtended =
      points[16].y < points[14].y - palmSize * (sensitivity * 0.8);
    const pinkyExtended =
      points[20].y < points[18].y - palmSize * (sensitivity * 0.6);

    return {
      thumb: thumbExtended,
      index: indexExtended,
      middle: middleExtended,
      ring: ringExtended,
      pinky: pinkyExtended,
    };
  }

  // ✨ NEW: Draw hand skeleton in debug mode
  function drawHandDebug(hand) {
    const points = hand.keypoints;
    if (!points) return;
    ctx.fillStyle = "rgba(0,255,0,0.8)";
    ctx.strokeStyle = "rgba(0,200,255,0.8)";
    ctx.lineWidth = 2;

    // Draw landmarks
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(overlay.width - p.x, p.y, 4, 0, Math.PI * 2); // Flipped X coordinate
      ctx.fill();
    });

    // Draw simple connections (thumb, index, middle, ring, pinky chains)
    const chains = [
      [0, 1, 2, 3, 4],
      [0, 5, 6, 7, 8],
      [0, 9, 10, 11, 12],
      [0, 13, 14, 15, 16],
      [0, 17, 18, 19, 20],
    ];
    chains.forEach((chain) => {
      ctx.beginPath();
      chain.forEach((idx, i) => {
        // Flipped X coordinate for drawing lines
        if (i === 0) ctx.moveTo(overlay.width - points[idx].x, points[idx].y);
        else ctx.lineTo(overlay.width - points[idx].x, points[idx].y);
      });
      ctx.stroke();
    });
  }

  function detectHandsLoop() {
    if (!cameraActive || !detector)
      return requestAnimationFrame(detectHandsLoop);
    detector
      .estimateHands(video, { flipHorizontal: true })
      .then((hands) => {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        if (hands && hands.length > 0) {
          if (debug) hands.forEach(drawHandDebug);
          else hands.forEach(() => {}); // normal mode, overlay stays empty
          if (debug) {
            const state = getFingerState(hands[0]);
            statusMessage.textContent = state
              ? `Debug: ${
                  Object.entries(state)
                    .filter(([, v]) => v)
                    .map(([k]) => k)
                    .join(", ") || "none"
                }`
              : "Debug: No hand state";
          }
        } else if (debug) {
          statusMessage.textContent = "Debug: No hands detected";
        }

        // Matching logic
        if (roundActive && currentPrompt) {
          let matched = false;
          if (hands && hands.length > 0) {
            for (const hand of hands) {
              const state = getFingerState(hand);
              if (state && currentPrompt.check(state, hand)) {
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
              startGameBtn.disabled = false;
              reportReactionTime(reactionMs);
              currentPrompt = null;
            }
          } else consecutiveMatches = 0;
        } else consecutiveMatches = 0;
        requestAnimationFrame(detectHandsLoop);
      })
      .catch((err) => {
        console.error("Hand detection error:", err);
        requestAnimationFrame(detectHandsLoop);
      });
  }

  // UI hooks
  saveNameBtn.addEventListener("click", () => {
    const trimmed = playerNameInput.value.trim();
    if (!trimmed) return setStatus("Display name cannot be empty.");
    playerName = trimmed;
    localStorage.setItem(LOCAL_NAME_KEY, playerName);
    setStatus(`Saved display name as ${playerName}.`);
    if (ws && ws.readyState === WebSocket.OPEN) sendPlayerName(playerName);
  });

  startRoomBtn.addEventListener("click", () => {
    const id = generateSessionId();
    updateUrlWithSession(id);
    isHost = true;
    connectToRoom(id, true);
    setRoundReadyState();
  });
  copyLinkBtn.addEventListener("click", copyInviteLink);

  enableCameraBtn.addEventListener("click", async () => {
    await enableCamera();
    await ensureDetector().catch((err) => {
      console.error("Detector init failed", err);
      setStatus("Unable to load hand detector.");
    });
    if (cameraActive && ws && ws.readyState === WebSocket.OPEN && isHost)
      startGameBtn.disabled = false;
  });

  startGameBtn.addEventListener("click", requestStartReactionRound);

  window.addEventListener("beforeunload", () => {
    if (ws) ws.close();
    if (video?.srcObject)
      video.srcObject.getTracks().forEach((track) => track.stop());
  });

  setRoundReadyState();
  const existingSessionId = new URLSearchParams(window.location.search).get(
    "session_id"
  );
  if (existingSessionId) {
    const wasHost =
      sessionStorage.getItem(`mimic-master-host-${existingSessionId}`) ===
      "true";
    connectToRoom(existingSessionId, wasHost);
    updateUrlWithSession(existingSessionId);
    setStatus("Joined room. Save your name and enable camera to play.");
  }
})();
