import * as dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      // Set up event listeners BEFORE connecting
      mongoose.connection.on("error", (err) => {
        console.error("MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        console.warn(
          "MongoDB disconnected. Mongoose will attempt to reconnect..."
        );
      });

      mongoose.connection.on("reconnected", () => {
        console.log("MongoDB reconnected successfully");
      });

      mongoose.connection.on("connected", () => {
        console.log("MongoDB connected successfully");
      });

      // Connection options
      const options = {
        maxPoolSize: 10, // Maximum number of connections
        minPoolSize: 2, // Minimum connections to maintain
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        family: 4, // Use IPv4, skip trying IPv6
      };

      // Connect with options
      await mongoose.connect(process.env.MONGO_URL, options);

      console.log("Connected to database.");
      return true;
    } catch (error) {
      console.error(
        `MongoDB connection attempt ${i + 1} failed:`,
        error.message
      );

      if (i === retries - 1) {
        console.error("Max retries reached. Exiting...");
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, i), 10000); // Exponential backoff
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export default connectDB;
