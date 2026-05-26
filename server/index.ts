import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleQuote } from "./routes/quote";
import { getPierreAccounts, getPierreTransactions } from "./routes/pierre";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/quote/:type", handleQuote);

  // Pierre Finance API routes
  app.get("/api/pierre/accounts", getPierreAccounts);
  app.get("/api/pierre/transactions", getPierreTransactions);

  return app;
}
