// server.js
console.log("Server file loaded");

require("dotenv").config();
const express = require("express");
const projectRoutes = require("./routes/projectRoutes");
const userRouter = require("./routes/admin/users/users");
const LeadRouter = require("./routes/Leads");
const connectDB = require("./config/db");
const { initQueue } = require("./services/queueService");
const cors = require("cors");

const app = express();

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(cors({
  origin: "*", // or your deployed frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

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
    return initQueue(require("mongoose")); // Pass mongoose to the initQueue
  })
  .catch((error) => {
    console.error("Error initializing server:", error.message);
    process.exit(1); // Exit the process if connection or initialization fails
  });

// Start server once MongoDB and queue are ready
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
