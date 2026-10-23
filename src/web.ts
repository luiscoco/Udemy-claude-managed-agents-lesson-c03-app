import { serveStudentAsset } from "./student-assets.js";
import Anthropic from "@anthropic-ai/sdk";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";

const port = Number(process.env.PORT || 3003);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "not-configured" });
const root = new URL("../", import.meta.url);
const configured = Boolean(process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_MANAGED_AGENT_ID && process.env.CLAUDE_MANAGED_ENVIRONMENT_ID);

createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  const assets: Record<string, [string, string]> = { "/": ["index.html", "text/html; charset=utf-8"], "/style.css": ["style.css", "text/css; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"], "/astronaut.png": ["astronaut.png", "image/png"] };
  try {
    if (await serveStudentAsset(req, res)) return;
    if (req.method === "GET" && assets[pathname]) {
      const [file, type] = assets[pathname]; const content = await readFile(new URL(`public/${file}`, root));
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(content); return;
    }
    if (req.method === "GET" && pathname === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ configured })); return;
    }
    if (req.method === "POST" && pathname === "/api/run") {
      const origin = req.headers.origin;
      if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) { res.writeHead(403).end(); return; }
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 10000) throw new Error("Request too large"); }
      const data = JSON.parse(body || "{}");
      if (typeof data.prompt !== "string" || !data.prompt.trim() || data.prompt.length > 2000) throw new Error("Enter a prompt of up to 2,000 characters.");
      if (!configured) throw new Error("Configure the API key, agent ID and environment ID in .env.");
      res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" });
      const send = (type: string, value: unknown) => { if (!res.destroyed) res.write(JSON.stringify({ type, value }) + "\n"); };
      try {
        const session = await client.beta.sessions.create({ agent: { type: "agent_with_overrides", id: process.env.CLAUDE_MANAGED_AGENT_ID!, ...(process.env.CLAUDE_SESSION_MODEL ? { model: process.env.CLAUDE_SESSION_MODEL } : {}), system: "Answer in one sentence.", tools: [], mcp_servers: [], skills: [] }, environment_id: process.env.CLAUDE_MANAGED_ENVIRONMENT_ID!, budget: { type: "limit", max_list_cost: { currency: "USD", amount: "50" } } });
        writeFileSync(".last-session", session.id);
        send("session", { id: session.id, agentId: session.agent.id, version: session.agent.version, tools: session.agent.tools.length, mcp: session.agent.mcp_servers.length, skills: session.agent.skills.length });
        const stored = await client.beta.agents.retrieve(session.agent.id);
        send("stored", { version: stored.version, tools: stored.tools.length, mcp: stored.mcp_servers.length, skills: stored.skills.length });
        const live = await client.beta.sessions.events.stream(session.id);
        res.on("close", () => live.controller.abort());
        await client.beta.sessions.events.send(session.id, { events: [{ type: "user.message", content: [{ type: "text", text: data.prompt.trim() }] }] });
        for await (const event of live) {
          send("event", { id: "id" in event ? event.id : "stream update", type: event.type });
          if (event.type === "agent.message") for (const block of event.content) if (block.type === "text") send("answer", block.text);
          if (event.type === "session.status_idle" && event.stop_reason.type !== "requires_action") { send("stop", event.stop_reason.type); break; }
          if (event.type === "session.status_terminated") { send("stop", "terminated"); break; }
          if (event.type === "session.error") { send("error", "The session reported an error. Inspect its history for details."); break; }
        }
        const history: { id: string; type: string }[] = [];
        for await (const event of client.beta.sessions.events.list(session.id)) history.push({ id: event.id, type: event.type });
        send("history", history);
      } catch (error) { send("error", error instanceof Error ? error.message : "Run failed"); }
      res.end(); return;
    }
    res.writeHead(404).end("Not found");
  } catch (error) { if (!res.headersSent) res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" })); }
}).listen(port, "127.0.0.1", () => console.log(`Open http://127.0.0.1:${port}`));

