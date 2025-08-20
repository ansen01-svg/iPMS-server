import * as dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

// const CON = process.env.MONGO_URL;

// mongoose.connect(CON);

// const db = mongoose.connection;

// db.on("connected", () => {
//   console.log(" MongoDB connected successfully!");
// });

// db.on("error", (err) => {
//   console.error(" MongoDB connection error:", err);
// });

// db.on("disconnected", () => {
//   console.warn(" MongoDB disconnected");
// });

// module.exports = db;

const connectDB = async () => {
  try {
    const { connection } = await mongoose.connect(process.env.MONGO_URL);

    if (connection.readyState === 1) {
      console.log("Connected to database.");

      // Add connection event listeners for better monitoring
      mongoose.connection.on("error", (err) => {
        console.error("MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("MongoDB disconnected, attempting to reconnect...");
      });

      mongoose.connection.on("reconnected", () => {
        console.log("MongoDB reconnected successfully");
      });

      return Promise.resolve(true);
    } else {
      console.error(
        `Database connection failed. Connection state: ${connection.readyState}`
      );
      return Promise.reject(new Error("Database connection failed"));
    }
  } catch (error) {
    console.error("MongoDB connection error:", error);
    return Promise.reject(error);
  }
};

export default connectDB;
