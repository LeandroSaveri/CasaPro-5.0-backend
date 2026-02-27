import express, { Request, Response } from "express";
import cors from "cors";

import healthRouter from "./routes/health.route";

const app = express();

app.use(cors());
app.use(express.json());

// Root route (required for Railway health check)
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "CasaPro 5.0 Backend",
    status: "online",
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use("/health", healthRouter);

export default app;
