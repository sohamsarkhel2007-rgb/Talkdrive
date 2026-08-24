const socket = io();
const msgSound = document.getElementById('msg-sound');
const ringSound = document.getElementById('ring-sound');
document.addEventListener("DOMContentLoaded", () => {
    // 1. User Registration Prompt
    const userName = prompt("Enter your name:") || "Anonymous";

    // 2. DOM Elements Selection
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

    // Action Buttons
    const emojiBtn = document.getElementById('emoji-btn');
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const audioBtn = document.getElementById('audio-btn');

    // Call Elements
    const voiceCallBtn = document.getElementById('voice-call-btn');
    const videoCallBtn = document.getElementById('video-call-btn');
    const callModal = document.getElementById('call-modal');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const acceptCallBtn = document.getElementById('accept-call-btn');
    const endCallBtn = document.getElementById('end-call-btn');
    const callUserName = document.getElementById('call-user-name');
    const callStatusText = document.getElementById('call-status-text');

    // State Variables
    let activePartner = null;
    const conversations = {};
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    let localStream = null;
    let peerConnection = null;
    let incomingCallData = null;

    // WebRTC Configuration with STUN & TURN Relays
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelay',
                credential: 'openrelay'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelay',
                credential: 'openrelay'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelay',
                credential: 'openrelay'
            }
        ],
        iceCandidatePoolSize: 10
    };

    if (myNameDisplay) myNameDisplay.textContent = `Me: ${userName}`;
    socket.emit('registerUser', userName);

    // Update Online Users List
    socket.on('updateUserList', (users) => {
        if (!contactsList) return;
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
            contactsList.innerHTML = `<li style="padding: 16px; color: #64748b; font-size: 13px;">No other users online.</li>`;
        }
    });

    function openConversation(socketId, name) {
        activePartner = { socketId, name };
        if (chatPartnerName) chatPartnerName.textContent = name;
        if (chatPartnerAvatar) chatPartnerAvatar.textContent = name.charAt(0).toUpperCase();
        if (chatsScreen) chatsScreen.classList.add('hidden');
        if (conversationScreen) conversationScreen.classList.remove('hidden');
        renderActiveMessages();
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            activePartner = null;
            if (conversationScreen) conversationScreen.classList.add('hidden');
            if (chatsScreen) chatsScreen.classList.remove('hidden');
        });
    }

    function renderActiveMessages() {
        if (!chatMessages) return;
        chatMessages.innerHTML = "";
        if (!activePartner) return;
        const msgs = conversations[activePartner.socketId] || [];
        msgs.forEach(msg => renderSingleMessage(msg));
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function renderSingleMessage(data) {
    if (!chatMessages) return;
    const isSelf = data.senderId === socket.id;
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', isSelf ? 'sent' : 'received');

    let content = '';
    if (data.image) content += `<img src="${data.image}" class="chat-img" style="max-width: 100%; border-radius: 8px; margin-bottom: 5px;" />`;
    if (data.audio) content += `<audio controls src="${data.audio}" style="max-width: 100%; margin-bottom: 5px;"></audio>`;
    if (data.text) content += `<p>${data.text}</p>`;
    
    // Status Ticks for Sent Messages
    let tickHtml = '';
    if (isSelf) {
        tickHtml = data.status === 'delivered' ? ' <span style="color: #38bdf8;">✓✓</span>' : ' <span style="color: #94a3b8;">✓</span>';
    }

    content += `<span class="time">${data.time}${tickHtml}</span>`;

    msgDiv.innerHTML = content;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

        let content = '';
        if (data.image) content += `<img src="${data.image}" class="chat-img" style="max-width: 100%; border-radius: 8px; margin-bottom: 5px;" />`;
        if (data.audio) content += `<audio controls src="${data.audio}" style="max-width: 100%; margin-bottom: 5px;"></audio>`;
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

    // Send Text Message
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            if (!messageInput) return;
            const text = messageInput.value.trim();
            if (!text || !activePartner) return;

            sendPayload({ text });
            messageInput.value = "";
        });
    }

    function sendPayload(payload) {
        if (!activePartner) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const data = {
            ...payload,
            time: time,
            senderId: socket.id,
            targetSocketId: activePartner.socketId
        };
        socket.emit('privateMessage', data);
    }

    // Emoji Feature Guard
    if (emojiBtn && messageInput) {
        const emojis = ['😊', '😂', '🔥', '❤️', '👍', '🎉', '😎', '🙌'];
        emojiBtn.addEventListener('click', () => {
            const picked = emojis[Math.floor(Math.random() * emojis.length)];
            messageInput.value += picked;
            messageInput.focus();
        });
    }

    // Attachment Feature Guard
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !activePartner) return;

            const reader = new FileReader();
            reader.onload = () => {
                sendPayload({ image: reader.result });
                fileInput.value = "";
            };
            reader.readAsDataURL(file);
        });
    }

    // Audio Recorder Feature Guard
    if (audioBtn) {
        audioBtn.addEventListener('click', async () => {
            if (!activePartner) return;

            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const reader = new FileReader();
                        reader.onload = () => sendPayload({ audio: reader.result });
                        reader.readAsDataURL(audioBlob);
                        stream.getTracks().forEach(t => t.stop());
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    audioBtn.style.color = '#ff007f';
                } catch (err) {
                    alert("Microphone permission denied.");
                }
            } else {
                if (mediaRecorder) mediaRecorder.stop();
                isRecording = false;
                audioBtn.style.color = '';
            }
        });
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && sendBtn) sendBtn.click();
        });
    }

    // WebRTC Calls
    async function startCall(isVideo) {
        if (!activePartner) return;
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
            if (localVideo) {
                localVideo.srcObject = localStream;
                await localVideo.play().catch(() => {});
            }

            if (acceptCallBtn) acceptCallBtn.classList.add('hidden');
            if (callModal) callModal.classList.remove('hidden');
            if (callUserName) callUserName.textContent = activePartner.name;
            if (callStatusText) callStatusText.textContent = isVideo ? "Calling Video..." : "Calling Voice...";

            peerConnection = new RTCPeerConnection(rtcConfig);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = (event) => {
                if (remoteVideo && event.streams && event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                    remoteVideo.play().catch(() => {});
                }
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('iceCandidate', { targetSocketId: activePartner.socketId, candidate: event.candidate });
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
            alert("Camera or Microphone permission denied.");
            endCall();
        }
    }

    socket.on('incomingCall', async (data) => {
        incomingCallData = data;
        if (callModal) callModal.classList.remove('hidden');
        if (callUserName) callUserName.textContent = data.senderName;
        if (callStatusText) callStatusText.textContent = data.isVideo ? "Incoming Video Call..." : "Incoming Voice Call...";
        if (acceptCallBtn) acceptCallBtn.classList.remove('hidden');
    });

    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', async () => {
            if (!incomingCallData) return;
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCallData.isVideo });
                if (localVideo) {
                    localVideo.srcObject = localStream;
                    await localVideo.play().catch(() => {});
                }

                peerConnection = new RTCPeerConnection(rtcConfig);
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

                peerConnection.ontrack = (event) => {
                    if (remoteVideo && event.streams && event.streams[0]) {
                        remoteVideo.srcObject = event.streams[0];
                        remoteVideo.play().catch(() => {});
                    }
                };

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('iceCandidate', { targetSocketId: incomingCallData.senderSocketId, candidate: event.candidate });
                    }
                };

                await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                socket.emit('acceptCall', { targetSocketId: incomingCallData.senderSocketId, answer: answer });
                if (callStatusText) callStatusText.textContent = "Connected";
                acceptCallBtn.classList.add('hidden');
            } catch (err) {
                alert("Could not access camera/mic.");
                endCall();
            }
        });
    }

    socket.on('callAccepted', async (data) => {
        if (callStatusText) callStatusText.textContent = "Connected";
        if (peerConnection) await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    socket.on('iceCandidate', async (data) => {
        if (peerConnection) {
            try { await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
        }
    });

    socket.on('callEnded', () => { endCallUI(); });

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
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        if (callModal) callModal.classList.add('hidden');
        incomingCallData = null;
    }

    if (voiceCallBtn) voiceCallBtn.addEventListener('click', () => startCall(false));
    if (videoCallBtn) videoCallBtn.addEventListener('click', () => startCall(true));
    if (endCallBtn) endCallBtn.addEventListener('click', endCall);
});
