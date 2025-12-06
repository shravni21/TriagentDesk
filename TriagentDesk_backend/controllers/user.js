import brcypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../modals/user.js";
import { inngest } from "../inggest/client.js";
import { getAllUsersWithStats } from "../utils/userManagement.js";

export const signup = async (req, res) => {
  const { email, password, skills = [], role = "user" } = req.body;
  console.log("Signup attempt for:", email, "with role:", role);
  try {
    const hashed = await brcypt.hash(password, 10);
    console.log("Password hashed successfully");
    
    const user = await User.create({ email, password: hashed, skills, role });
    console.log("User created successfully:", user._id);

    //Fire inngest event
    try {
      await inngest.send({
        name: "user/signup",
        data: {
          email,
        },
      });
      console.log("Inngest event sent successfully");
    } catch (inngestError) {
      console.log("Inngest event failed:", inngestError.message);
    }

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET
    );
    console.log("JWT token created successfully");

    res.json({ user, token });
  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(500).json({ error: "Signup failed", details: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "User not found" });

    const isMatch = await brcypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET
    );

    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: "Login failed", details: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorzed" });
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return res.status(401).json({ error: "Unauthorized" });
    });
    res.json({ message: "Logout successfully" });
  } catch (error) {
    res.status(500).json({ error: "Login failed", details: error.message });
  }
};

export const updateUser = async (req, res) => {
  const { skills = [], role, email } = req.body;
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ eeor: "Forbidden" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "User not found" });

    await User.updateOne(
      { email },
      { skills: skills.length ? skills : user.skills, role }
    );
    return res.json({ message: "User updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Update failed", details: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const users = await User.find().select("-password");
    return res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Update failed", details: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    // Only admins can get all users
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const usersWithStats = await getAllUsersWithStats();
    return res.status(200).json(usersWithStats);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateUserSkills = async (req, res) => {
  try {
    // Only admins can update user skills
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const { userId } = req.params;
    const { skills } = req.body;

    if (!skills || !Array.isArray(skills)) {
      return res.status(400).json({ message: "Skills must be an array" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { skills },
      { new: true, select: "email role skills" }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User skills updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating user skills:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};