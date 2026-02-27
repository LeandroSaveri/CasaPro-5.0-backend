import express from "express";
import cors from "cors";

import healthRouter from "./routes/health.route";

const app = express();

app.use(cors());
app.use(express.json());

// Root route (required for Railway health check)
app.get("/", (req, res) => {
  res.status(200).json({
    status: "CasaPro Backend Online"
  });
});

// Routes
app.use("/health", healthRouter);

export default app;
