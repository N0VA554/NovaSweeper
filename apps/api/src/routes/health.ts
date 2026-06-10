import { Router } from "express";
import { pool } from "../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", service: "novasweeper-api" });
  } catch (error) {
    next(error);
  }
});
