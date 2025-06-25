const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
// Import game modules
const initializeBallGame = require('./ballgame/ball-game.js');

const app = express();
const server = http.createServer(app);

// --- Configuration ---
const PORT = process.env.PORT || 8081;
const PUBLIC_DIR = path.join(__dirname, 'dist'); // Serve files from the 'dist' directory

// --- Socket.IO Setup ---
const io = new Server(server, {
  cors: {
    // In production, you should restrict this to your domain.
    // e.g., origin: "https://dailypick.dev"
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// --- Initialize Game Modules ---
const handleBallGameConnection = initializeBallGame(io);

// --- Real-time Collaboration Logic ---
const ANIMAL_NAMES = [
    'Alligator', 'Bear', 'Cheetah', 'Dolphin', 'Eagle', 'Fox', 'Gorilla', 'Hedgehog',
    'Iguana', 'Jaguar', 'Koala', 'Lemur', 'Meerkat', 'Narwhal', 'Octopus', 'Panda',
    'Quokka', 'Rabbit', 'Sloth', 'Tiger', 'Urial', 'Vulture', 'Walrus', 'Xerus',
    'Yak', 'Zebra'
];
const connectedUsers = {};

io.on('connection', (socket) => {
    console.log(`[Socket.IO] User connected: ${socket.id}`);

    // Assign a unique, persistent animal name
    const availableAnimals = ANIMAL_NAMES.filter(name => !Object.values(connectedUsers).some(user => user.name === name));
    const animalName = availableAnimals.length > 0 
        ? availableAnimals[Math.floor(Math.random() * availableAnimals.length)] 
        : `User${Math.floor(Math.random() * 100)}`;
    
    connectedUsers[socket.id] = { id: socket.id, name: animalName };

    socket.emit('assign-identity', connectedUsers[socket.id]);
    console.log(`[Socket.IO] Assigned name "${animalName}" to ${socket.id}`);

    socket.on('mouse-move', (data) => {
        const user = connectedUsers[socket.id];
        if (user) {
            const broadcastData = { ...data, id: socket.id, name: user.name };
            socket.broadcast.emit('user-activity', broadcastData);
        }
    });

    // --- Game-Specific Connection Handling ---
    handleBallGameConnection(socket);

    socket.on('disconnect', () => {
        const disconnectedUser = connectedUsers[socket.id];
        if (disconnectedUser) {
            console.log(`[Socket.IO] User disconnected: ${disconnectedUser.name} (${socket.id})`);
            delete connectedUsers[socket.id];
            io.emit('user-left', disconnectedUser);
        }
    });
});

// --- Express Static File Server ---
app.use(express.static(PUBLIC_DIR));
// This is a catch-all middleware that sends index.html for any request that doesn't match a static file.
// It's a robust way to handle SPA routing. It will catch all methods (GET, POST, etc.),
// which is fine for this project as there's no API.
app.use((req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`   Serving static files from: ${PUBLIC_DIR}`);
});