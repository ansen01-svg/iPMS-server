import jwt from "jsonwebtoken";

const verifyJwt = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error("An error occured while veryfying jwt token");
  }
};

export default verifyJwt;
