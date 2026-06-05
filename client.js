const socket = io();
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const skipBtn = document.getElementById('skip-btn');
const pulseBtn = document.getElementById('pulse-btn');
const onlineCountDisplay = document.getElementById('count-value');

let localStream;
let peerConnection;
const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

socket.on('onlineCount', (count) => {
    if (onlineCountDisplay) onlineCountDisplay.innerText = count.toLocaleString();
});

async function init() {
    try {
        const constraints = { video: { width: 640, height: 480 }, audio: true };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        socket.emit('findPair');
    } catch (err) {
        addSystemMsg('Media access denied. Please use HTTPS and allow camera permissions.');
    }
}

function createPeerConnection(initiator) {
    if (peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection(config);
    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
    peerConnection.ontrack = (e) => remoteVideo.srcObject = e.streams[0];
    peerConnection.onicecandidate = (e) => {
        if (e.candidate) socket.emit('signal', { candidate: e.candidate });
    };

    if (initiator) {
        peerConnection.onnegotiationneeded = async () => {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('signal', { sdp: peerConnection.localDescription });
        };
    }
}

const remoteLabel = document.querySelector('.remote .video-label');

socket.on('paired', async ({ initiator, isBot, botName }) => {
    chatBox.innerHTML = '';
    if (isBot) {
        addSystemMsg(`Connected to ${botName}. This is an AI vibe.`);
        remoteLabel.innerText = botName;
        remoteVideo.srcObject = null;
        remoteVideo.classList.add('is-bot');
    } else {
        addSystemMsg("Connected to a new vibe. Pulsing enabled.");
        remoteLabel.innerText = "Stranger";
        remoteVideo.classList.remove('is-bot');
        createPeerConnection(initiator);
    }
});

socket.on('signal', async (data) => {
    if (!peerConnection) return;
    if (data.sdp) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('signal', { sdp: peerConnection.localDescription });
        }
    } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

socket.on('receivePulse', () => {
    document.body.classList.add('pulse-active');
    setTimeout(() => document.body.classList.remove('pulse-active'), 1000);
});

socket.on('chatMessage', (msg) => addMsg('Stranger', msg, 'stranger'));

socket.on('partnerDisconnected', () => {
    addSystemMsg('Stranger disconnected. Finding new vibe...');
    remoteVideo.srcObject = null;
    socket.emit('findPair');
});

function addMsg(sender, text, className) {
    const div = document.createElement('div');
    div.className = `msg ${className}`;
    div.innerHTML = `<span>${sender}: </span><span class="text"></span>`;
    div.querySelector('.text').innerText = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addSystemMsg(text) {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.innerText = text;
    chatBox.appendChild(div);
}

pulseBtn.onclick = () => {
    socket.emit('sendPulse');
    document.body.classList.add('pulse-active');
    setTimeout(() => document.body.classList.remove('pulse-active'), 1000);
};

sendBtn.onclick = () => {
    const msg = chatInput.value.trim();
    if (msg) {
        socket.emit('chatMessage', msg);
        addMsg('You', msg, 'you');
        chatInput.value = '';
    }
};

chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendBtn.onclick(); };

skipBtn.onclick = () => {
    remoteVideo.srcObject = null;
    socket.emit('findPair');
    addSystemMsg('Searching for a new connection...');
};

init();
