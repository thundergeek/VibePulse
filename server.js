const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingQueue = [];
const pairs = {}; 
const botTimers = {};
let onlineCount = 0;

const bots = [
    { name: "VibeBot Alpha", bio: "The original AI vibe.", responses: ["Cool vibe!", "I'm feeling the rhythm.", "You're pulsing!"] },
    { name: "Neon Soul", bio: "A digital spirit in the machine.", responses: ["The lights look good from here.", "Digital dreams...", "Are you real?"] },
    { name: "Zenith AI", bio: "Top-tier conversationalist.", responses: ["Analyzing your pulse...", "High frequency detected.", "Interesting."] }
];

function broadcastOnlineCount() {
    io.emit('onlineCount', onlineCount + Object.keys(botTimers).length);
}

io.on('connection', (socket) => {
    onlineCount++;
    broadcastOnlineCount();

    socket.on('findPair', () => {
        // Clear any existing bot pairings
        if (pairs[socket.id] && pairs[socket.id].isBot) {
            delete pairs[socket.id];
            clearTimeout(botTimers[socket.id]);
        }

        if (pairs[socket.id]) {
            const partnerId = pairs[socket.id];
            delete pairs[socket.id];
            delete pairs[partnerId];
            io.to(partnerId).emit('partnerDisconnected');
        }

        if (waitingQueue.length > 0) {
            const partnerId = waitingQueue.shift();
            if (io.sockets.sockets.has(partnerId)) {
                pairs[socket.id] = partnerId;
                pairs[partnerId] = socket.id;
                io.to(socket.id).emit('paired', { initiator: true });
                io.to(partnerId).emit('paired', { initiator: false });
            } else {
                waitingQueue.push(socket.id);
            }
        } else {
            if (!waitingQueue.includes(socket.id)) {
                waitingQueue.push(socket.id);
            }
            socket.emit('waiting');

            // Spawn a bot if waiting too long
            botTimers[socket.id] = setTimeout(() => {
                if (waitingQueue.includes(socket.id)) {
                    waitingQueue = waitingQueue.filter(id => id !== socket.id);
                    const bot = bots[Math.floor(Math.random() * bots.length)];
                    pairs[socket.id] = { ...bot, isBot: true };
                    socket.emit('paired', { initiator: false, isBot: true, botName: bot.name });
                    
                    // Bot intro
                    setTimeout(() => {
                        socket.emit('chatMessage', `Hello! I'm ${bot.name}. ${bot.bio}`);
                    }, 1000);
                }
            }, 5000);
        }
    });

    socket.on('chatMessage', (message) => {
        const partner = pairs[socket.id];
        if (partner) {
            if (partner.isBot) {
                // Simple Bot Logic
                setTimeout(() => {
                    const reply = partner.responses[Math.floor(Math.random() * partner.responses.length)];
                    socket.emit('chatMessage', reply);
                }, 1000 + Math.random() * 2000);
            } else {
                io.to(partner).emit('chatMessage', message);
            }
        }
    });

    socket.on('sendPulse', () => {
        const partner = pairs[socket.id];
        if (partner) {
            if (partner.isBot) {
                setTimeout(() => socket.emit('receivePulse'), 500);
            } else {
                io.to(partner).emit('receivePulse');
            }
        }
    });

    socket.on('disconnect', () => {
        onlineCount--;
        clearTimeout(botTimers[socket.id]);
        broadcastOnlineCount();
        waitingQueue = waitingQueue.filter(id => id !== socket.id);
        const partner = pairs[socket.id];
        if (partner && !partner.isBot) {
            delete pairs[socket.id];
            delete pairs[partner];
            io.to(partner).emit('partnerDisconnected');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`VibePulse Server active on port ${PORT}`);
});
