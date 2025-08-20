import NewUser from "../../models/user.model.js";

const getAllUsers = async (req, res) => {
  try {
    const users = await NewUser.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default getAllUsers;
