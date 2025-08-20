const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    domain: process.env.NODE_ENV === "production" ? ".aptdcl.in" : undefined,
  });

  return res
    .status(200)
    .json({ success: true, message: "Logged out successfully" });
};

export default logout;
