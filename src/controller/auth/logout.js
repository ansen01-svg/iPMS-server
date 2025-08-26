const logout = (req, res) => {
  // 1. Clear main token cookie
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  // 2. Clear backup token cookie
  res.clearCookie("backup-token", {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    path: "/",
  });

  // 3. Clear encoded auth cookie
  res.clearCookie("encoded-token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  // 4. Additional fallback cookies (if using approach with multiple names)
  res.clearCookie("auth-token");
  res.clearCookie("auth-fallback");

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

export default logout;
