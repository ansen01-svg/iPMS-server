import mongoose from "mongoose";
import app from "./app.js";
import { validateEnv } from "./config/validate-env.js";
import connectDB from "./lib/connectDb.js";

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
  try {
    validateEnv();
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}...`);
    });
  } catch (error) {
    console.error("Error starting server:", error.message);
    process.exit(1);
  }
};

// Graceful shutdown function
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log("HTTP server closed.");

      try {
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
        process.exit(0);
      } catch (error) {
        console.error("Error during MongoDB shutdown:", error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error("Forcing shutdown after timeout...");
      process.exit(1);
    }, 10000);
  }
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start the server
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
