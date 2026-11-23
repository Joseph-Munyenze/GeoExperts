/*
 * Geoexpert website server + land listings CMS.
 * Uses only Node.js built-in modules (Node 18 or newer). Start with:  npm start
 *
 *   Public site ........ http://localhost:3000/
 *   Admin (CMS) ........ http://localhost:3000/admin/
 *
 * Data files
 *   data/listings.geojson  all listings, including "sold" and "hidden" (private, never served)
 *   data/parcels.geojson   public copy read by the website (available + under offer only)
 *   data/backups/          automatic copy of listings.geojson before every change (private)
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Schema = require("./js/parcel-schema.js");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MASTER = path.join(DATA_DIR, "listings.geojson");
const PUBLIC = path.join(DATA_DIR, "parcels.geojson");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const ENV_FILE = path.join(ROOT, ".env");
const MAX_BODY = 15 * 1024 * 1024; // 15 MB upload limit
const SESSION_HOURS = 8;
const MAX_BACKUPS = 50;

// ---------- configuration (.env) ----------
function loadEnv() {
  if (!fs.existsSync(ENV_FILE) && !process.env.ADMIN_PASSWORD) {
    const pw = crypto.randomBytes(9).toString("base64url");
    fs.writeFileSync(ENV_FILE, "# Admin password for /admin/. Change it, then restart the server.\nADMIN_PASSWORD=" + pw + "\nPORT=3000\n");
    console.log("\n  Created .env with a new admin password: " + pw + "\n  (Change it in .env, then restart.)\n");
  }
  if (!fs.existsSync(ENV_FILE)) return;
  fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
}
loadEnv();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
if (ADMIN_PASSWORD.length < 8) {
  console.error("ADMIN_PASSWORD in .env must be at least 8 characters. Admin sign-in is disabled until you fix it.");
}

// ---------- data helpers ----------
fs.mkdirSync(BACKUP_DIR, { recursive: true });
function readMaster() {
  try { return JSON.parse(fs.readFileSync(MASTER, "utf8")); }
  catch (e) { return { type: "FeatureCollection", features: [] }; }
}
function writeAtomic(file, obj) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}
function backup(reason) {
  if (!fs.existsSync(MASTER)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = "listings-" + stamp + "-" + reason.replace(/[^a-z0-9]+/gi, "-").slice(0, 30) + ".geojson";
  fs.copyFileSync(MASTER, path.join(BACKUP_DIR, name));
  const all = listBackups();
  all.slice(MAX_BACKUPS).forEach((b) => fs.unlinkSync(path.join(BACKUP_DIR, b.name)));
  return name;
}
function listBackups() {
  return fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".geojson")).map((f) => {
    const st = fs.statSync(path.join(BACKUP_DIR, f));
    let count = null;
    try { count = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), "utf8")).features.length; } catch (e) {}
    return { name: f, time: st.mtime.toISOString(), count };
  }).sort((a, b) => b.time.localeCompare(a.time));
}
/** Save master + regenerate the public file. */
function save(features, reason) {
  const b = backup("before-" + reason);
  const updated = new Date().toISOString();
  writeAtomic(MASTER, { type: "FeatureCollection", updated, features });
  writeAtomic(PUBLIC, { type: "FeatureCollection", updated, features: features.filter(Schema.isPublic) });
  return b;
}
// Make sure the public file matches the master on start-up.
if (fs.existsSync(MASTER)) {
  const m = readMaster();
  writeAtomic(PUBLIC, { type: "FeatureCollection", updated: m.updated || new Date().toISOString(), features: (m.features || []).filter(Schema.isPublic) });
}

// ---------- auth ----------
const sessions = new Map(); // token -> expiry ms
const attempts = new Map(); // ip -> {count, until}
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function authed(req) {
  const m = (req.headers.authorization || "").match(/^Bearer (\S+)$/);
  if (!m) return false;
  const exp = sessions.get(m[1]);
  if (!exp || exp < Date.now()) { sessions.delete(m[1]); return false; }
  return true;
}

// ---------- http helpers ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".geojson": "application/geo+json; charset=utf-8", ".kml": "application/vnd.google-earth.kml+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8", ".sql": "text/plain; charset=utf-8", ".webp": "image/webp" };
const SECURITY_HEADERS = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "SAMEORIGIN" };
function send(res, code, body, type) {
  res.writeHead(code, Object.assign({ "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "no-store" }, SECURITY_HEADERS));
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error("Upload is larger than 15 MB"), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(Object.assign(new Error("Request is not valid JSON"), { code: 400 })); } });
    req.on("error", reject);
  });
}
// Never serve these over HTTP.
const BLOCKED = [/^\/\./, /\/\./, /^\/data\/listings\.geojson/, /^\/data\/backups/, /^\/server\.js$/, /^\/package(-lock)?\.json$/, /^\/node_modules/, /\.tmp$/];
function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath);
  if (BLOCKED.some((r) => r.test(p))) return send(res, 404, "Not found", "text/plain");
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 404, "Not found", "text/plain");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (!err && st.isDirectory()) { res.writeHead(301, { Location: p + "/" }); return res.end(); }
      return send(res, 404, "Not found", "text/plain");
    }
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const cache = /\/data\//.test(p) || /\.html$/.test(file) ? "no-store" : "public, max-age=300";
    res.writeHead(200, Object.assign({ "Content-Type": type, "Cache-Control": cache }, SECURITY_HEADERS));
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- API ----------
async function api(req, res, url) {
  const route = req.method + " " + url.pathname;

  if (route === "POST /api/admin/login") {
    const ip = req.socket.remoteAddress || "?";
    const a = attempts.get(ip) || { count: 0, until: 0 };
    if (a.until > Date.now()) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
    const body = await readJson(req);
    if (ADMIN_PASSWORD.length >= 8 && safeEqual(body.password || "", ADMIN_PASSWORD)) {
      attempts.delete(ip);
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, Date.now() + SESSION_HOURS * 3600e3);
      return send(res, 200, { token, hours: SESSION_HOURS });
    }
    a.count++; if (a.count >= 8) { a.until = Date.now() + 15 * 60e3; a.count = 0; }
    attempts.set(ip, a);
    return send(res, 401, { error: ADMIN_PASSWORD.length < 8 ? "Admin password is not set on the server (see .env)." : "Wrong password." });
  }

  if (!url.pathname.startsWith("/api/admin/")) return send(res, 404, { error: "Unknown API route" });
  if (!authed(req)) return send(res, 401, { error: "Please sign in again." });

  if (route === "POST /api/admin/logout") {
    sessions.delete((req.headers.authorization || "").slice(7));
    return send(res, 200, { ok: true });
  }
  if (route === "GET /api/admin/listings") return send(res, 200, readMaster());

  if (route === "POST /api/admin/upload") {
    const body = await readJson(req);
    const mode = body.mode === "replace" ? "replace" : "append";
    const result = Schema.normaliseCollection(body.featureCollection);
    if (result.errors.length && !result.features.length) return send(res, 400, { error: "Nothing was published.", errors: result.errors });
    if (result.errors.length && !body.skipInvalid) return send(res, 400, { error: "Some features have problems. Fix them or choose to skip them.", errors: result.errors });
    let features;
    if (mode === "replace") features = result.features;
    else {
      const byId = new Map(readMaster().features.map((f) => [f.id, f]));
      result.features.forEach((f) => byId.set(f.id, f)); // same id = update that listing
      features = Array.from(byId.values());
    }
    const b = save(features, mode + "-" + (body.fileName || "upload"));
    return send(res, 200, { ok: true, mode, published: result.features.length, total: features.length, skipped: result.errors, warnings: result.warnings, backup: b });
  }

  let m = url.pathname.match(/^\/api\/admin\/listings\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const features = readMaster().features;
    const idx = features.findIndex((f) => f.id === id);
    if (idx < 0) return send(res, 404, { error: "Listing not found" });
    if (req.method === "DELETE") {
      const [gone] = features.splice(idx, 1);
      save(features, "delete-" + id);
      return send(res, 200, { ok: true, deleted: gone.properties.name, total: features.length });
    }
    if (req.method === "PATCH") {
      const body = await readJson(req);
      const p = features[idx].properties;
      if (body.status !== undefined) {
        if (Schema.STATUSES.indexOf(body.status) < 0) return send(res, 400, { error: "Unknown status" });
        p.status = body.status;
      }
      if (body.price_kes !== undefined) {
        const v = body.price_kes === "" || body.price_kes === null ? null : Schema.parseMoney(body.price_kes);
        if (body.price_kes !== "" && body.price_kes !== null && v === null) return send(res, 400, { error: "Price must be a number, e.g. 2800000 or 2.8M" });
        p.price_kes = v;
      }
      save(features, "edit-" + id);
      return send(res, 200, { ok: true, feature: features[idx] });
    }
  }

  if (route === "GET /api/admin/backups") return send(res, 200, { backups: listBackups() });
  if (route === "POST /api/admin/restore") {
    const body = await readJson(req);
    const name = path.basename(String(body.name || ""));
    const file = path.join(BACKUP_DIR, name);
    if (!name.endsWith(".geojson") || !fs.existsSync(file)) return send(res, 404, { error: "Backup not found" });
    const gj = JSON.parse(fs.readFileSync(file, "utf8"));
    save(gj.features || [], "restore");
    return send(res, 200, { ok: true, total: (gj.features || []).length });
  }
  return send(res, 404, { error: "Unknown API route" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    api(req, res, url).catch((e) => send(res, e.code || 500, { error: e.message || "Server error" }));
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", "text/plain");
  serveStatic(req, res, url.pathname);
});
server.listen(PORT, HOST, () => {
  console.log("Geoexpert site running:");
  console.log("  Website: http://localhost:" + PORT + "/");
  console.log("  Admin:   http://localhost:" + PORT + "/admin/");
});
