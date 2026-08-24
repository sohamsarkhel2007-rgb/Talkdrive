const socket = io();

document.addEventListener("DOMContentLoaded", () => {
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

    let localStream = null;
    let peerConnection = null;
    let incomingCallData = null;

    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
                urls: 'turn:global.relay.metered.ca:80',
                username: 'e0183b0f5e1329a239920199',
                credential: 'X4v9H9s/V2L5+4Bq'
            },
            {
                urls: 'turn:global.relay.metered.ca:443',
                username: 'e0183b0f5e1329a239920199',
                credential: 'X4v9H9s/V2L5+4Bq'
            }
        ],
        iceCandidatePoolSize: 10
    };

    if (myNameDisplay) myNameDisplay.textContent = `Me: ${userName}`;
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
            contactsList.innerHTML = `<li style="padding: 16px; color: #64748b; font-size: 13px;">No other users online right now.</li>`;
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

        let content = `<p>${data.text}</p><span class="time">${data.time}</span>`;
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

    sendBtn.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (!text || !activePartner) return;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const data = {
            text: text,
            time: time,
            senderId: socket.id,
            targetSocketId: activePartner.socketId
        };

        socket.emit('privateMessage', data);
        messageInput.value = "";
    });

    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendBtn.click(); });

    // WebRTC Calls
    async function startCall(isVideo) {
        if (!activePartner) return;

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
            localVideo.srcObject = localStream;
            await localVideo.play().catch(() => {});

            acceptCallBtn.classList.add('hidden');
            callModal.classList.remove('hidden');
            callUserName.textContent = activePartner.name;
            callStatusText.textContent = isVideo ? "Calling Video..." : "Calling Voice...";

            peerConnection = new RTCPeerConnection(rtcConfig);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = (event) => {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.play().catch(() => {});
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
            alert("Camera or Microphone permissions were blocked.");
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
            await localVideo.play().catch(() => {});

            peerConnection = new RTCPeerConnection(rtcConfig);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = (event) => {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.play().catch(() => {});
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
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    });

    socket.on('iceCandidate', async (data) => {
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {}
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
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
        callModal.classList.add('hidden');
        incomingCallData = null;
    }

    voiceCallBtn.addEventListener('click', () => startCall(false));
    videoCallBtn.addEventListener('click', () => startCall(true));
    endCallBtn.addEventListener('click', endCall);
});
