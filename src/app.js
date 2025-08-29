// ----------------------------------------
// 1. IMPORTS
// ----------------------------------------

// Core libraries
import cookieParser from "cookie-parser";
import cors from "cors";
import * as dotenv from "dotenv";
import express from "express";
// import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import morgan from "morgan";
// import xss from "xss-clean";

// Custom middleware and utilities
import { AppError, errorController } from "./utils/errorHandler.js";

// Routes
import archiveProjectRoute from "./routes/archive-project.route.js";
import authRoute from "./routes/auth.route.js";
import mbRoute from "./routes/mb.route.js";
import projectRoute from "./routes/project.route.js";
import userRoute from "./routes/user.route.js";

// ----------------------------------------
// 2. CONFIGURATION
// ----------------------------------------

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://ipms-dev.vercel.app",
    process.env.FRONTEND_URL,
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
};

// ----------------------------------------
// 3. ERROR HANDLING (PROCESS LEVEL)
// ----------------------------------------

// Uncaught exception handler
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

// Unhandled promise rejection handler
process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

// ----------------------------------------
// 4. MIDDLEWARE SETUP
// ----------------------------------------

// Security and request parsing
app.use(cors(corsOptions));
// app.use(
//   rateLimit({
//     windowMs: 15 * 60 * 1000,
//     limit: 60,
//   })
// );
app.use(helmet()); // Set security HTTP headers
app.use(morgan("tiny")); // API logging for development

// Cookie parser
app.use(cookieParser());

// Body parsers
app.use(
  express.json({
    limit: "100mb",
    strict: true,
    type: "application/json",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
  })
);
app.use(express.static("./public"));

// Security middleware
// app.use(mongoSanitize()); // NoSQL injection protection
// app.use(xss()); // XSS protection

// ----------------------------------------
// 5. ROUTES
// ----------------------------------------

// // Root route
app.get("/", (req, res) => {
  res.send("iPMS API is running");
});

// API routes
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/project", projectRoute);
app.use("/api/archive-project", archiveProjectRoute);
app.use("/api/mb", mbRoute);

// ----------------------------------------
// 6. ERROR HANDLING (APPLICATION LEVEL)
// ----------------------------------------

// Handle undefined routes
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(errorController);

// ----------------------------------------
// 7. EXPORTS
// ----------------------------------------

export default app;
