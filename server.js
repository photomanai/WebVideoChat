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
  console.log("Yeni kullanıcı bağlandı:", socket.id);

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

    // Mevcut kullanıcıları yeni kullanıcıya gönder
    const existingUsers = Object.values(rooms[roomId].users).filter(
      (user) => user.id !== userId
    );

    if (existingUsers.length > 0) {
      socket.emit("existing-users", existingUsers);
    }

    // Diğer kullanıcılara yeni kullanıcıyı bildir
    socket.to(roomId).emit("user-connected", userId, userName);

    console.log(
      `${userName} (${userId}) ${roomId} odasına katıldı. Toplam: ${
        Object.keys(rooms[roomId].users).length
      }`
    );
  });

  // WebRTC sinyalleri - DÜZELTİLMİŞ
  socket.on("offer", (data) => {
    console.log("Offer alındı:", data.from, "->", data.to);
    const targetSocket = findSocketByUserId(data.to);
    if (targetSocket) {
      targetSocket.emit("offer", {
        from: data.from,
        to: data.to,
        offer: data.offer,
      });
    } else {
      console.log("Hedef kullanıcı bulunamadı:", data.to);
    }
  });

  socket.on("answer", (data) => {
    console.log("Answer alındı:", data.from, "->", data.to);
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

      console.log(`Kullanıcı ayrıldı: ${currentUserId}`);
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
  console.log(`Server ${PORT} portunda çalışıyor`);
  console.log(`WebRTC test için: http://localhost:${PORT}`);
});
