import User from "../models/user.model.js";
import verifyJwt from "../utils/verifyJwt.js";

// Middleware to check if user is authenticated
// and optionally check for specific roles
// If no roles are specified, it just checks if the user is authenticated
// If roles are specified, it checks if the user has one of those roles
// Returns a 401 status if not authenticated, 403 if unauthorized
// and 500 for any internal errors
const requireAuth = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const token =
        req.cookies?.token || req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access denied. No token provided",
        });
      }

      const verifiedToken = verifyJwt(token);
      if (!verifiedToken) {
        return res.status(401).json({
          success: false,
          message: "Access denied. Invalid token",
        });
      }

      const user = await User.findById(verifiedToken.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Access denied. User not found",
        });
      }

      // Check role authorization if roles specified
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.designation)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You have no access to perform this action.",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Authentication error",
      });
    }
  };
};

// Convenience functions
const requireLogin = () => requireAuth();
const requireJe = () => requireAuth(["JE"]);
const requireAdmin = () => requireAuth(["ADMIN", "SUPER_ADMIN"]);

export { requireAdmin, requireJe, requireLogin };
