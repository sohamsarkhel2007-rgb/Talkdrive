const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve files from 'public' folder OR root directory automatically
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Direct fallback route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    });
});

const users = {};

io.on('connection', (socket) => {
    socket.on('registerUser', (userName) => {
        users[socket.id] = userName;
        io.emit('updateUserList', users);
    });

   socket.on('privateMessage', (data) => {
        const targetSocket = io.sockets.sockets.get(data.targetSocketId);
        
        // Check if recipient is online
        const isOnline = targetSocket ? true : false;
        data.status = isOnline ? 'delivered' : 'sent'; // 'delivered' = double tick, 'sent' = single tick

        io.to(data.targetSocketId).emit('privateMessage', data);
        socket.emit('privateMessage', data);
    });
    });

    socket.on('callUser', (data) => {
        io.to(data.targetSocketId).emit('incomingCall', {
            offer: data.offer,
            senderSocketId: socket.id,
            senderName: data.senderName,
            isVideo: data.isVideo
        });
    });

    socket.on('acceptCall', (data) => {
        io.to(data.targetSocketId).emit('callAccepted', { answer: data.answer });
    });

    socket.on('iceCandidate', (data) => {
        io.to(data.targetSocketId).emit('iceCandidate', { candidate: data.candidate });
    });

    socket.on('endCall', (data) => {
        io.to(data.targetSocketId).emit('callEnded');
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('updateUserList', users);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
