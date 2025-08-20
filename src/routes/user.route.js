import express from "express";
import createUser from "../controller/user/createUser.js";
import getAllUsers from "../controller/user/getAllUsers.js";

const router = express.Router();

router.get("/", getAllUsers);
router.post("/create", createUser);

export default router;
