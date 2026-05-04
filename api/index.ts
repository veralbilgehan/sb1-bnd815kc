export default async function handler(req: any, res: any) {
  res.json({ ok: true, env: !!process.env.DATABASE_URL });
}
