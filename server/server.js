import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app)

// Initialize socket.io server
export const io = new Server(server, {
    cors: {origin: "*"}
})

// Store online users
export const userSocketMap = {}; // { userId: socketId }

// Socket.io connection handler
io.on("connection", (socket)=>{
    const userId = socket.handshake.query.userId;
    console.log("User Connected", userId);

    if(userId) userSocketMap[userId] = socket.id;
    
    // Emit online users to all connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // --- START: Typing Indicator Logic ---

    // Listen for the "typing" event from a client.
    // This event is sent when a user starts typing a message.
    socket.on("typing", (receiverId) => {
        // Get the socket ID of the user who should receive the typing notification.
        const receiverSocketId = userSocketMap[receiverId];
        // If the receiver is connected, emit a "typing" event to them.
        // This tells the receiver's client that the sender is typing.
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("typing", userId);
        }
    });

    // Listen for the "stopTyping" event from a client.
    // This event is sent when a user stops typing.
    socket.on("stopTyping", (receiverId) => {
        // Get the socket ID of the user who should no longer see the typing indicator.
        const receiverSocketId = userSocketMap[receiverId];
        // If the receiver is connected, emit a "stopTyping" event to them.
        // This tells the receiver's client to hide the typing indicator.
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("stopTyping", userId);
        }
    });

    // --- END: Typing Indicator Logic ---

    socket.on("disconnect", ()=>{
        console.log("User Disconnected", userId);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap))
    })
})

// Middleware setup
app.use(express.json({limit: "4mb"}));
app.use(cors());


// Routes setup
app.use("/api/status", (req, res)=> res.send("Server is live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter)


// Connect to MongoDB
await connectDB();

if(process.env.NODE_ENV !== "production"){
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, ()=> console.log("Server is running on PORT: " + PORT));
}

// Export server for Vervel
export default server;