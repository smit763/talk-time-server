import express from "express";
import dotenv from "dotenv/config";
import mongoDBConnect from "./mongoDB/connection.js";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import userRoutes from "./routes/user.js";
import chatRoutes from "./routes/chat.js";
import messageRoutes from "./routes/message.js";
import { Server as SocketIO } from "socket.io";

const app = express();

const PORT = process.env.PORT || 8000;

app.use(
  cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"], 
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

mongoose.set("strictQuery", false);
mongoDBConnect();

const server = app.listen(PORT, () => {
  console.log(`Server Listening at PORT - ${PORT}`);
});

const io = new SocketIO(server, { pingTimeout: 60000, cors: { origin: "*" } });

// Socket.IO Event Handlers
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join user to their personal room
  socket.on("setup", (userData) => {
    if (!userData?.id) return;
    socket.join(userData.id);
    socket.emit("connected");
  });

  // Join a chat room
  socket.on("join room", (room) => {
    if (!room) return;
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  // Emit typing events
  socket.on("typing", (room) => {
    if (!room) return;
    socket.in(room).emit("typing");
  });

  socket.on("stop typing", (room) => {
    if (!room) return;
    socket.in(room).emit("stop typing");
  });

  // Handle new messages
  socket.on("new message", (newMessageRecieve) => {
    const chat = newMessageRecieve?.chatId;
    if (!chat?.users || !newMessageRecieve?.sender) {
      console.error("Invalid message or chat data");
      return;
    }

    chat.users.forEach((user) => {
      if (user._id === newMessageRecieve.sender._id) return;
      socket.in(user._id).emit("message received", newMessageRecieve);
    });
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});
