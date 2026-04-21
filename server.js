const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const host = process.env.HOST || "localhost";
const port = Number(process.env.PORT || 3000);
const roomMessages = new Map();
const knownRooms = new Set();

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${host}:${port}`);
    if (req.method === "GET" && requestUrl.pathname === "/api/public-feed") {
      const rooms = Array.from(knownRooms.values()).map((roomId) => ({
        roomId,
        participantCount: io.sockets.adapter.rooms.get(roomId)?.size || 0,
        encryptedMessages: roomMessages.get(roomId) || [],
      }));

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ rooms }));
      return;
    }

    handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    socket.on("join-chat", ({ roomId, username }) => {
      if (typeof roomId !== "string" || typeof username !== "string") {
        return;
      }

      const room = io.sockets.adapter.rooms.get(roomId);
      const roomSize = room ? room.size : 0;

      if (roomSize >= 2) {
        socket.emit("room-full");
        return;
      }

      knownRooms.add(roomId);
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.username = username;
      io.to(roomId).emit("system-message", `${username} joined the chat.`);
    });

    socket.on("encrypted-message", (payload) => {
      const roomId = socket.data.roomId;
      if (!roomId || typeof payload !== "object" || !payload) {
        return;
      }

      if (!roomMessages.has(roomId)) {
        roomMessages.set(roomId, []);
      }
      const encryptedHistory = roomMessages.get(roomId);
      encryptedHistory.push(payload);
      if (encryptedHistory.length > 50) {
        encryptedHistory.shift();
      }

      io.to(roomId).emit("encrypted-message", payload);
    });

    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      const username = socket.data.username;
      if (roomId && username) {
        io.to(roomId).emit("system-message", `${username} left the chat.`);
      }
    });
  });

  httpServer.listen(port, host, () => {
    console.log(`> Server listening at http://${host}:${port}`);
  });
});
