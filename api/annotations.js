// Private highlights & notes — one JSON document per (visitor, page).
//
// No accounts: the browser makes a long random "sync code" and sends it in the
// X-Ann-User header. It works like a password, so only a hash of it is stored.
//
// Storage: Upstash Redis over its REST API (plain fetch, no npm packages).
// Set these in Vercel → Project → Settings → Environment Variables, or add the
// Upstash integration from the Vercel Marketplace, which sets the KV_* names:
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (or KV_REST_API_URL / KV_REST_API_TOKEN)
// Without them the API answers 503 and the pages keep notes on the device only.

const crypto = require("crypto");

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const USER_RE  = /^[a-f0-9]{32,64}$/;       // sync code made by the browser
const PAGE_RE  = /^[a-z0-9/_-]{1,120}$/;     // e.g. "interview-questions/bookleaf-fullstack"
const MAX_BYTES = 256 * 1024;                // per page document
const MAX_ITEMS = 2000;
const TTL_SECONDS = 60 * 60 * 24 * 400;      // untouched data expires after ~13 months
const WRITES_PER_MINUTE = 60;                // per IP

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()).map(r => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

const hash = s => crypto.createHash("sha256").update(s).digest("hex");

function readBody(req) {
  if (req.body !== undefined) {               // Vercel usually parses JSON for us
    return Promise.resolve(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => {
      data += c;
      if (data.length > MAX_BYTES) reject(new Error("too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function isValidDoc(doc) {
  return doc && typeof doc === "object" && !Array.isArray(doc)
    && Array.isArray(doc.items) && doc.items.length <= MAX_ITEMS
    && doc.items.every(i => i && typeof i.id === "string" && i.id.length <= 64)
    && (doc.pageNote === undefined || typeof doc.pageNote === "string");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: "storage not configured" });
  }

  const user = String(req.headers["x-ann-user"] || "");
  const page = String((req.query && req.query.page) || "");
  if (!USER_RE.test(user) || !PAGE_RE.test(page)) {
    return res.status(400).json({ error: "bad user or page" });
  }
  const key = `ann:${hash(user)}:${page}`;

  try {
    if (req.method === "GET") {
      const [value] = await redis([["GET", key]]);
      return res.status(200).json(value ? JSON.parse(value) : { items: [] });
    }

    if (req.method === "PUT") {
      const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
      const rl = `rl:${hash(ip)}:${Math.floor(Date.now() / 60000)}`;
      const [count] = await redis([["INCR", rl], ["EXPIRE", rl, 120]]);
      if (count > WRITES_PER_MINUTE) return res.status(429).json({ error: "slow down" });

      const raw = await readBody(req);
      if (Buffer.byteLength(raw) > MAX_BYTES) return res.status(413).json({ error: "too large" });
      const doc = JSON.parse(raw);
      if (!isValidDoc(doc)) return res.status(400).json({ error: "bad document" });

      await redis([["SET", key, JSON.stringify(doc), "EX", TTL_SECONDS]]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    const tooBig = err.message === "too large";
    const badJson = err instanceof SyntaxError;
    return res.status(tooBig ? 413 : badJson ? 400 : 502)
      .json({ error: tooBig ? "too large" : badJson ? "bad json" : "storage error" });
  }
};
