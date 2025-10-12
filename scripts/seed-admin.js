import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/user.model.js";

dotenv.config();

// Reuse your generateUserId function
async function generateUserId(designation) {
  const designationPart = designation.toUpperCase().replace(/\s+/g, "");
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      const lastUser = await User.findOne(
        {
          designation,
          userId: new RegExp(`^${designationPart}\\d+$`),
        },
        { userId: 1 }
      ).sort({ userId: -1 });

      let nextNumber = 1;
      if (lastUser && lastUser.userId) {
        const match = lastUser.userId.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const userId = `${designationPart}${String(nextNumber).padStart(2, "0")}`;

      const existingUser = await User.findOne({ userId });
      if (!existingUser) {
        return userId;
      }

      attempts++;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) throw error;
    }
  }

  throw new Error(
    `Failed to generate unique userId after ${maxAttempts} attempts`
  );
}

const seedAdminUser = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URL_PROD, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB\n");

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      email: "ansenbeyc73@gmail.com",
    });

    if (existingAdmin) {
      console.log("⚠️  Admin user already exists!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📧 Email:", existingAdmin.email);
      console.log("🆔 User ID:", existingAdmin.userId);
      console.log("👤 Name:", existingAdmin.fullName);
      console.log("🎭 Designation:", existingAdmin.designation);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Admin user details
    const adminData = {
      fullName: "Ansen Bey",
      username: "Ansen01",
      email: "ansenbeyc73@gmail.com",
      phoneNumber: "6001137771",
      designation: "ADMIN",
    };

    // Generate userId
    const userId = await generateUserId(adminData.designation);

    // Set a known password for first-time setup
    const plainPassword = "Ansen100";
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Create admin user
    const adminUser = new User({
      fullName: adminData.fullName,
      username: adminData.username,
      email: adminData.email.toLowerCase().trim(),
      phoneNumber: adminData.phoneNumber,
      designation: adminData.designation,
      userId,
      password: hashedPassword,
      isFirstLogin: true, // Will prompt password change on first login
    });

    await adminUser.save();

    console.log("✅ Admin user created successfully!");

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedAdminUser();
