// server.js
console.log("Server file loaded");

require("dotenv").config();
const express = require("express");
const projectRoutes = require("./routes/projectRoutes");
const userRouter = require("./routes/admin/users/users");
const LeadRouter = require("./routes/Leads");
const connectDB = require("./config/db");
const { initQueue } = require("./services/queueService");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5174", // Adjust according to your client URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(cors());

// Routes
app.use("/api/projects", projectRoutes);
app.use("/", LeadRouter);
app.get("/", (req, res) => {
  res.send("Welcome to the API")
});
app.use("/auth/users", userRouter);

// Initialize MongoDB connection and queue initialization
connectDB()
  .then(() => {
    // After MongoDB connection is established, initialize the queue
    console.log("MongoDB connected successfully");

    // Wait for queue initialization to complete before continuing
    return initQueue(io, require("mongoose")); // Pass mongoose to the initQueue
  })
  .catch((error) => {
    console.error("Error initializing server:", error.message);
    process.exit(1); // Exit the process if connection or initialization fails
  });

// Start server once MongoDB and queue are ready
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Handle socket connection
io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});
