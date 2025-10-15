const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
if (!fs.existsSync('public/uploads')) {
    fs.mkdirSync('public/uploads', { recursive: true });
}

// Serve static files (frontend)
app.use(express.static('public'));

// Explicit route to serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Store connected users
const connectedUsers = new Map();

// Serve static files (frontend)
app.use(express.static('public'));

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, fileUrl: fileUrl, filename: req.file.originalname, size: req.file.size });
    } else {
        res.status(400).json({ success: false, message: 'No file uploaded' });
    }
});

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for username setting
    socket.on('setUsername', (username) => {
        console.log('User set username:', username);
        connectedUsers.set(socket.id, { username, connectedAt: new Date() });
        socket.username = username;
        // Broadcast updated user list
        io.emit('updateUsers', Array.from(connectedUsers.values()).map(user => user.username));
        // Notify others of new user
        socket.broadcast.emit('userJoined', username);
    });

    // Listen for chat messages
    socket.on('sendMessage', (data) => {
        // Broadcast the message to all connected clients
        socket.broadcast.emit('receiveMessage', data);
    });

    // Listen for file messages
    socket.on('sendFile', (data) => {
        // Broadcast the file info to all connected clients
        socket.broadcast.emit('receiveFile', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.username) {
            connectedUsers.delete(socket.id);
            // Broadcast updated user list
            io.emit('updateUsers', Array.from(connectedUsers.values()).map(user => user.username));
            // Notify others of user leaving
            socket.broadcast.emit('userLeft', socket.username);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
