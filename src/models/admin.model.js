// models/Admin.js
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    aid: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: { type: Number, default: 1 },
    refreshToken: { type: String },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

adminSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();
    const saltRounds = 12;
    const salt = await bcrypt.genSalt(saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

adminSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

adminSchema.statics.findByUserId = function (userId) {
  return this.findOne({ $or: [{ aid: userId }, { email: userId }] });
};

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
