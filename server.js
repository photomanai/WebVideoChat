const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.json());

const rooms = {};

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/room/:roomId", (req, res) => {
  res.render("room", { roomId: req.params.roomId });
});

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  let currentRoomId = null;
  let currentUserId = null;

  socket.on("join-room", (roomId, userId, userName) => {
    currentRoomId = roomId;
    currentUserId = userId;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: {} };
    }

    rooms[roomId].users[userId] = {
      id: userId,
      name: userName,
      socketId: socket.id,
    };

    // Send existing users to the new user
    const existingUsers = Object.values(rooms[roomId].users).filter(
      (user) => user.id !== userId
    );

    if (existingUsers.length > 0) {
      socket.emit("existing-users", existingUsers);
    }

    // Notify other users about the new user
    socket.to(roomId).emit("user-connected", userId, userName);

    console.log(
      `${userName} (${userId}) joined room ${roomId}. Total: ${
        Object.keys(rooms[roomId].users).length
      }`
    );
  });

  // WebRTC signals - FIXED
  socket.on("offer", (data) => {
    console.log("Offer received:", data.from, "->", data.to);
    const targetSocket = findSocketByUserId(data.to);
    if (targetSocket) {
      targetSocket.emit("offer", {
        from: data.from,
        to: data.to,
        offer: data.offer,
      });
    } else {
      console.log("Target user not found:", data.to);
    }
  });

  socket.on("answer", (data) => {
    console.log("Answer received:", data.from, "->", data.to);
    const targetSocket = findSocketByUserId(data.to);
    if (targetSocket) {
      targetSocket.emit("answer", {
        from: data.from,
        to: data.to,
        answer: data.answer,
      });
    }
  });

  socket.on("ice-candidate", (data) => {
    console.log("ICE candidate:", data.from, "->", data.to);
    const targetSocket = findSocketByUserId(data.to);
    if (targetSocket) {
      targetSocket.emit("ice-candidate", {
        from: data.from,
        to: data.to,
        candidate: data.candidate,
      });
    }
  });

  socket.on("disconnect", () => {
    if (currentRoomId && currentUserId && rooms[currentRoomId]) {
      delete rooms[currentRoomId].users[currentUserId];

      if (Object.keys(rooms[currentRoomId].users).length === 0) {
        delete rooms[currentRoomId];
      } else {
        socket.to(currentRoomId).emit("user-disconnected", currentUserId);
      }

      console.log(`User disconnected: ${currentUserId}`);
    }
  });
});

function findSocketByUserId(userId) {
  for (const roomId in rooms) {
    if (rooms[roomId].users[userId]) {
      const socketId = rooms[roomId].users[userId].socketId;
      return io.sockets.sockets.get(socketId);
    }
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`For WebRTC test: http://localhost:${PORT}`);
});
