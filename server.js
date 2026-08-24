const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const users = {};

io.on('connection', (socket) => {
    socket.on('registerUser', (userName) => {
        users[socket.id] = userName;
        io.emit('updateUserList', users);
    });

    socket.on('privateMessage', (data) => {
        io.to(data.targetSocketId).emit('privateMessage', data);
        socket.emit('privateMessage', data);
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
