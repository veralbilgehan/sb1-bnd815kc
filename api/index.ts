import "dotenv/config";
import type { Express } from "express";

let cachedApp: Express | null = null;
let initError: Error | null = null;

async function getApp(): Promise<Express> {
  if (initError) throw initError;
  if (!cachedApp) {
    try {
      const { initializeServer } = await import("../server/app.js");
      const result = await initializeServer({ serveClient: false, enableVite: false });
      cachedApp = result.app;
    } catch (err: any) {
      initError = err;
      throw err;
    }
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error("Handler init error:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
