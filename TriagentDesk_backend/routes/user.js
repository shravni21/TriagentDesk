import express from "express";
import {
  getUsers,
  login,
  signup,
  updateUser,
  logout,
  getAllUsers,
  updateUserSkills,
} from "../controllers/user.js";

import { authenticate } from "../middelware/auth.js";
const router = express.Router();

router.post("/update-user", authenticate, updateUser);
router.get("/users", authenticate, getUsers);

// Admin routes for user management
router.get("/all-users", authenticate, getAllUsers);
router.put("/users/:userId/skills", authenticate, updateUserSkills);

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

export default router;