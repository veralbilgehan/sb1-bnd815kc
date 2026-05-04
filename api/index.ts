import "dotenv/config";
import { initializeServer } from "../server/app";
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
  const app = await getApp();
  return app(req, res);
}
