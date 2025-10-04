export const validateEnv = () => {
  const required = ["MONGO_URL", "FRONTEND_URL", "FRONTEND_URL1"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  console.log("✓ Environment variables validated");
};
