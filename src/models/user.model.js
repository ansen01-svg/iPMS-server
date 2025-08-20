import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    roleId: { type: String, required: true },
    departmentName: { type: String, required: true },
    departmentId: { type: String, required: true },
    designation: { type: String, required: true },
    officeLocation: { type: String, required: true },
    password: { type: String, required: true },

    // New field for custom ID
    userId: { type: String, unique: true },
  },
  { timestamps: true }
);

// Pre-save hook to generate userId
userSchema.pre("save", async function (next) {
  if (!this.userId) {
    // Format: DESIGNATION + ROLEID
    const designationPart = this.designation.toUpperCase().replace(/\s+/g, "");
    const rolePart = this.roleId.toUpperCase();

    // If you want to add incremental number for uniqueness:
    const count = await mongoose.model("User").countDocuments({
      designation: this.designation,
      roleId: this.roleId,
    });

    this.userId = `${designationPart}${rolePart}${count + 1}`;
  }
  next();
});

const User = mongoose.model("User", userSchema);

export default User;
