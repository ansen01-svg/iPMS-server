import bcrypt from "bcryptjs";
import NewUser from "../../models/user.model.js";

// Function to generate random password
function generatePassword(length = 8) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// Helper function to generate userId
async function generateUserId(designation, roleId) {
  const designationPart = designation.toUpperCase().replace(/\s+/g, "");
  const rolePart = roleId.toUpperCase();

  // Count how many users already exist with same designation + roleId
  const count = await NewUser.countDocuments({ designation, roleId });

  // Pad the sequence with leading zeros (e.g., 01, 02)
  return `${designationPart}${rolePart}${String(count + 1).padStart(2, "0")}`;
}

const createUser = async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      phoneNumber,
      departmentName,
      departmentId,
      designation,
      officeLocation,
      roleId,
    } = req.body;

    // Generate custom userId
    const userId = await generateUserId(designation, roleId);

    // Generate random password
    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const newUser = new NewUser({
      fullName,
      username,
      email,
      phoneNumber,
      departmentName,
      departmentId,
      designation,
      officeLocation,
      roleId,
      userId, // new field
      password: hashedPassword,
      isFirstLogin: true,
    });

    const savedUser = await newUser.save();

    res.status(201).json({
      success: true,
      message: "User created successfully",
      password: plainPassword, // Only shown once to admin
      user: {
        id: savedUser._id,
        userId: savedUser.userId, // show generated userId
        username: savedUser.username,
        email: savedUser.email,
        phoneNumber: savedUser.phoneNumber,
        isFirstLogin: savedUser.isFirstLogin,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default createUser;
