import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {
  console.log("Auth middleware - Authorization header:", req.headers.authorization);
  const token = req.headers.authorization?.split(" ")[1];
  console.log("Auth middleware - Extracted token:", token ? "Token exists" : "No token");

  if (!token) {
    console.log("Auth middleware - No token found");
    return res.status(401).json({ error: "Access Denied. No token found." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Auth middleware - Token verified, user:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("Auth middleware - Token verification failed:", error.message);
    res.status(401).json({ error: "Invalid token" });
  }
};