const socket = io();
const userName = prompt("Enter your name:") || "Anonymous";

const chatsScreen = document.getElementById('chats-screen');
const conversationScreen = document.getElementById('conversation-screen');
const contactsList = document.getElementById('contacts-list');
const backBtn = document.getElementById('back-btn');
const myNameDisplay = document.getElementById('my-name-display');
const chatPartnerName = document.getElementById('chat-partner-name');
const chatPartnerAvatar = document.getElementById('chat-partner-avatar');

const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const attachBtn = document.getElementById('attach-btn');
const imageInput = document.getElementById('image-input');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const recordBtn = document.getElementById('record-btn');

// Call elements
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const callModal = document.getElementById('call-modal');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const acceptCallBtn = document.getElementById('accept-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const callUserName = document.getElementById('call-user-name');
const callStatusText = document.getElementById('call-status-text');

let activePartner = null;
const conversations = {};

// WebRTC State
let localStream = null;
let peerConnection = null;
let incomingCallData = null;

const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

myNameDisplay.textContent = `Me: ${userName}`;
socket.emit('registerUser', userName);

socket.on('updateUserList', (users) => {
    contactsList.innerHTML = "";
    let count = 0;
    for (let id in users) {
        if (id === socket.id) continue;
        count++;

        const li = document.createElement('li');
        li.classList.add('contact-item');
        li.innerHTML = `
            <div class="avatar">${users[id].charAt(0).toUpperCase()}</div>
            <div class="contact-info">
                <h4>${users[id]}</h4>
                <p>Tap to start chatting</p>
            </div>
        `;
        li.addEventListener('click', () => openConversation(id, users[id]));
        contactsList.appendChild(li);
    }
    if (count === 0) {
        contactsList.innerHTML = `<li style="padding: 16px; color: #667781; font-size: 13px;">No other users online right now.</li>`;
    }
});

function openConversation(socketId, name) {
    activePartner = { socketId, name };
    chatPartnerName.textContent = name;
    chatPartnerAvatar.textContent = name.charAt(0).toUpperCase();

    chatsScreen.classList.add('hidden');
    conversationScreen.classList.remove('hidden');
    renderActiveMessages();
}

backBtn.addEventListener('click', () => {
    activePartner = null;
    conversationScreen.classList.add('hidden');
    chatsScreen.classList.remove('hidden');
});

function renderActiveMessages() {
    chatMessages.innerHTML = "";
    if (!activePartner) return;
    const msgs = conversations[activePartner.socketId] || [];
    msgs.forEach(msg => renderSingleMessage(msg));
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderSingleMessage(data) {
    const isSelf = data.senderId === socket.id;
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', isSelf ? 'sent' : 'received');

    let content = "";
    if (data.image) content += `<img src="${data.image}" class="chat-img"/>`;
    if (data.audio) content += `<audio controls src="${data.audio}"></audio>`;
    if (data.text) content += `<p>${data.text}</p>`;
    content += `<span class="time">${data.time}</span>`;

    msgDiv.innerHTML = content;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

socket.on('privateMessage', (data) => {
    const partnerId = (data.senderId === socket.id) ? data.targetSocketId : data.senderId;
    if (!conversations[partnerId]) conversations[partnerId] = [];
    conversations[partnerId].push(data);

    if (activePartner && activePartner.socketId === partnerId) {
        renderSingleMessage(data);
    }
});

function sendPrivatePayload(payload) {
    if (!activePartner) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const data = {
        text: payload.text || "",
        image: payload.image || null,
        audio: payload.audio || null,
        time: time,
        senderId: socket.id,
        targetSocketId: activePartner.socketId
    };
    socket.emit('privateMessage', data);
}

sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (!text) return;
    sendPrivatePayload({ text });
    messageInput.value = "";
});

messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendBtn.click(); });

emojiBtn.addEventListener('click', () => emojiPicker.classList.toggle('active'));
emojiPicker.querySelectorAll('span').forEach(span => {
    span.addEventListener('click', () => {
        messageInput.value += span.textContent;
        emojiPicker.classList.remove('active');
        messageInput.focus();
    });
});

attachBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => sendPrivatePayload({ image: evt.target.result });
    reader.readAsDataURL(file);
    imageInput.value = "";
});

let mediaRecorder, audioChunks = [], isRecording = false;
recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = (evt) => sendPrivatePayload({ audio: evt.target.result });
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            recordBtn.classList.add('recording');
        } catch (err) { alert("Mic unavailable"); }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.classList.remove('recording');
    }
});

// --- WEBRTC VIDEO/VOICE CALL HANDLERS ---

async function startCall(isVideo) {
    if (!activePartner) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: isVideo
        });
        localVideo.srcObject = localStream;

        callModal.classList.remove('hidden');
        callUserName.textContent = activePartner.name;
        callStatusText.textContent = isVideo ? "Calling Video..." : "Calling Voice...";
        acceptCallBtn.classList.add('hidden');

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('iceCandidate', {
                    targetSocketId: activePartner.socketId,
                    candidate: event.candidate
                });
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('callUser', {
            targetSocketId: activePartner.socketId,
            offer: offer,
            senderName: userName,
            isVideo: isVideo
        });

    } catch (err) {
        alert("Camera/Microphone permission denied.");
        endCall();
    }
}

socket.on('incomingCall', async (data) => {
    incomingCallData = data;
    callModal.classList.remove('hidden');
    callUserName.textContent = data.senderName;
    callStatusText.textContent = data.isVideo ? "Incoming Video Call..." : "Incoming Voice Call...";
    acceptCallBtn.classList.remove('hidden');
});

acceptCallBtn.addEventListener('click', async () => {
    if (!incomingCallData) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: incomingCallData.isVideo
        });
        localVideo.srcObject = localStream;

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('iceCandidate', {
                    targetSocketId: incomingCallData.senderSocketId,
                    candidate: event.candidate
                });
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('acceptCall', {
            targetSocketId: incomingCallData.senderSocketId,
            answer: answer
        });

        callStatusText.textContent = "Connected";
        acceptCallBtn.classList.add('hidden');

    } catch (err) {
        alert("Could not access camera/mic.");
        endCall();
    }
});

socket.on('callAccepted', async (data) => {
    callStatusText.textContent = "Connected";
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on('iceCandidate', async (data) => {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {}
    }
});

socket.on('callEnded', () => endCallUI());

function endCall() {
    if (activePartner || incomingCallData) {
        const target = activePartner ? activePartner.socketId : incomingCallData?.senderSocketId;
        if (target) socket.emit('endCall', { targetSocketId: target });
    }
    endCallUI();
}

function endCallUI() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    callModal.classList.add('hidden');
    incomingCallData = null;
}

voiceCallBtn.addEventListener('click', () => startCall(false));
videoCallBtn.addEventListener('click', () => startCall(true));
endCallBtn.addEventListener('click', endCall);