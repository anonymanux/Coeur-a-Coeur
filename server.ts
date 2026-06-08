import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const LOG_FILE = path.join(process.cwd(), "error.log");

  app.use(express.json());

  // API Route for logging errors from client
  app.post("/api/log-error", (req, res) => {
    const { error, context, timestamp } = req.body;
    const logEntry = `[${timestamp}] [${context}] ERROR: ${JSON.stringify(error)}\n`;
    
    fs.appendFile(LOG_FILE, logEntry, (err) => {
      if (err) console.error("Failed to write to error.log", err);
    });
    
    res.status(200).send({ status: "logged" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
