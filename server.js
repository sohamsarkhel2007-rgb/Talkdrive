const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const users = {}; // socket.id -> username

io.on('connection', (socket) => {
    socket.on('registerUser', (username) => {
        users[socket.id] = username;
        io.emit('updateUserList', users);
    });

    socket.on('privateMessage', (data) => {
        // Send to target user
        io.to(data.targetSocketId).emit('privateMessage', data);
        // Echo back to sender
        socket.emit('privateMessage', data);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('updateUserList', users);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});