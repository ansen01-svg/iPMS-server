import User from "../models/user.model.js";
import verifyJwt from "../utils/verifyJwt.js";

const authMiddleware = async (req, _, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    throw new Error("Unauthorized user");
  }

  const verifiedToken = verifyJwt(token);

  if (!verifiedToken) {
    throw new Error("Unauthorised user");
  }

  const user = await User.findById({ _id: verifiedToken.id });
  if (!user) {
    throw new Error("User not found");
  }

  req.user = user;
  next();
};

export default authMiddleware;
