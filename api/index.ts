import "dotenv/config";
import { initializeServer } from "../server/app.js";
import type { Express } from "express";

let cachedApp: Express | null = null;

async function getApp(): Promise<Express> {
  if (!cachedApp) {
    const result = await initializeServer({ serveClient: false, enableVite: false });
    cachedApp = result.app;
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error("Handler init error:", err?.message, err?.stack);
    res.status(500).json({ error: err?.message });
  }
}
