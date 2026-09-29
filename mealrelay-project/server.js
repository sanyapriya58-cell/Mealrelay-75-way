const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const port = Number(process.env.PORT) || 3004;
const publicDir = path.join(__dirname, "public");
const storePath = path.join(__dirname, "data", "posts.json");
const demoPath = path.join(__dirname, "data", "demo.json");

async function readPosts() {
  try { return JSON.parse(await fs.readFile(storePath, "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    return JSON.parse(await fs.readFile(demoPath, "utf8"));
  }
}

async function writePosts(posts) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(posts, null, 2));
}

function validate(input) {
  const text = ["donor", "title", "address"];
  if (text.some(key => typeof input[key] !== "string" || !input[key].trim() || input[key].trim().length > 100)) return "Complete the donor, food, and pickup location fields.";
  if (!Number.isInteger(Number(input.portions)) || Number(input.portions) < 1 || Number(input.portions) > 500) return "Portions must be between 1 and 500.";
  if (!Number.isFinite(Date.parse(input.readyAt)) || !Number.isFinite(Date.parse(input.expiresAt))) return "Choose valid ready and use-by times.";
  if (Date.parse(input.expiresAt) <= Date.parse(input.readyAt)) return "Use-by time must follow ready time.";
  if (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.now()) return "Use-by time must be in the future.";
  if (!["cooked", "produce", "packaged"].includes(input.category)) return "Choose a food category.";
  if (typeof input.notes !== "string" || input.notes.length > 300) return "Notes must be 300 characters or fewer.";
  return null;
}

function safeStatus(post) {
  return post.status === "available" && Date.parse(post.expiresAt) <= Date.now() ? "expired" : post.status;
}

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function parseBody(req) {
  let value = "";
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 20_000) throw new Error("too_large");
  }
  try { return JSON.parse(value || "{}"); }
  catch { throw new Error("invalid_json"); }
}

async function serveStatic(url, res) {
  const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(publicDir, relative);
  if (!file.startsWith(publicDir + path.sep)) return json(res, 404, { error: "Not found" });
  try {
    const bytes = await fs.readFile(file);
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };
    res.writeHead(200, { "Content-Type": `${types[path.extname(file)] || "application/octet-stream"}; charset=utf-8` });
    res.end(bytes);
  } catch (error) {
    if (["ENOENT", "EISDIR"].includes(error.code)) return json(res, 404, { error: "Not found" });
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { status: "ok" });
    if (req.method === "GET" && url.pathname === "/api/posts") {
      const posts = (await readPosts()).map(post => ({ ...post, status: safeStatus(post) }));
      return json(res, 200, posts.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)));
    }
    if (req.method === "POST" && url.pathname === "/api/posts") {
      const input = await parseBody(req);
      const error = validate(input);
      if (error) return json(res, 400, { error });
      const post = {
        id: crypto.randomUUID(), donor: input.donor.trim(), title: input.title.trim(), address: input.address.trim(),
        portions: Number(input.portions), category: input.category, readyAt: new Date(input.readyAt).toISOString(),
        expiresAt: new Date(input.expiresAt).toISOString(), notes: input.notes.trim(),
        status: "available", volunteer: "", demo: false, createdAt: new Date().toISOString()
      };
      const posts = await readPosts();
      posts.push(post);
      await writePosts(posts);
      return json(res, 201, post);
    }
    const match = url.pathname.match(/^\/api\/posts\/([a-zA-Z0-9-]+)\/status$/);
    if (req.method === "PATCH" && match) {
      const input = await parseBody(req);
      const posts = await readPosts();
      const post = posts.find(item => item.id === match[1]);
      if (!post) return json(res, 404, { error: "Listing not found" });
      if (input.status === "claimed") {
        if (safeStatus(post) !== "available") return json(res, 409, { error: "This listing is no longer available." });
        if (typeof input.volunteer !== "string" || !input.volunteer.trim() || input.volunteer.length > 80) return json(res, 400, { error: "Enter a volunteer name." });
        post.status = "claimed";
        post.volunteer = input.volunteer.trim();
      } else if (input.status === "picked_up") {
        if (post.status !== "claimed") return json(res, 409, { error: "Claim this listing before marking pickup complete." });
        post.status = "picked_up";
      } else return json(res, 400, { error: "Invalid status change" });
      await writePosts(posts);
      return json(res, 200, post);
    }
    if (req.method === "GET") return serveStatic(url, res);
    json(res, 404, { error: "Not found" });
  } catch (error) {
    if (error.message === "invalid_json") return json(res, 400, { error: "Invalid JSON" });
    if (error.message === "too_large") return json(res, 413, { error: "Request too large" });
    json(res, 500, { error: "Server error" });
  }
});

if (require.main === module) server.listen(port, () => console.log(`MealRelay running at http://localhost:${port}`));
module.exports = { server, validate, safeStatus };
