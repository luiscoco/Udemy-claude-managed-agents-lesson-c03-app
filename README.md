# C03 · Session Configuration and History

Creates a real text-only override session, compares configurations, opens the stream before sending, and reads recorded history. Closing the browser stops observation; it does not interrupt remote work.

## Concepts students will learn

- Session overrides without changing the base agent
- Effective and stored capability snapshots
- Live observation versus paginated recorded history

## Configure and run

Use Node.js 24 or later. In PowerShell, from this repository's folder:

```powershell
node --version
npm ci
Copy-Item .env.example .env
notepad .env
```

Use your own Anthropic API key and an existing agent ID and environment ID.

Run npm run setup once after setting your API key. It creates an environment and base agent and writes their IDs into your local .env. Reuse those IDs on later runs.

```powershell
npm run setup
npm start
```

Open `http://127.0.0.1:3003`. Navigation leads to `/guide.html#learning`, `/guide.html#run-guide`, `/architecture.html`, and the application lab. If you change `PORT`, use the configured port. Keep the terminal running; stop with Ctrl+C. `npm run dev` also starts the web application.

Open the lab, read the stated resource operation, and press the main Run button once. Inspect the returned IDs, configuration or events. Each live run can create a remote resource.

## Create your .env file

Copy `.env.example` to `.env` and enter your own values. Do not commit the real file. Restart the server after editing it. The example contains safe placeholders; optional settings may be left blank to use source defaults. Resource IDs and keys stay on the server.

```dotenv
ANTHROPIC_API_KEY=your_api_key
CLAUDE_MODEL=claude-opus-5-5
CLAUDE_SESSION_MODEL=
CLAUDE_MANAGED_AGENT_ID=your_agent_id
CLAUDE_MANAGED_ENVIRONMENT_ID=your_environment_id
PORT=3003
```

## How the application was developed

The browser collects inputs; the Node host validates requests; the lesson implementation produces observable evidence. The architecture page walks through the real source with numbered steps, prerequisite configuration, source filenames and code excerpts.

### Lesson implementation

[src/web.ts](https://github.com/luiscoco/Udemy-claude-managed-agents-lesson-c03-app/blob/main/src/web.ts)

```typescript
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
```

Read the architecture page for the remaining source excerpts and explanations, including input handling and optional provider behavior. The diagram describes this application, rather than implying that an external integration has been implemented.

## Validation

```powershell
npm run typecheck
python scripts/verify-walkthrough.py
```

The source hash check detects when walkthrough excerpts need refreshing. Browser verification covers page navigation, readable text, mobile layout, dark mode, diagram and image routes. Local scenarios and live provider calls are recorded separately in the workspace verification report; local success is not evidence of a live provider operation.

## Repository contents

Application sources, student web pages, safe configuration example and documentation images are included. `node_modules`, `presentation`, `output`, `reviewed`, `v3`, `teaching-material`, build output, local journals, credentials and local resource files are ignored. Existing teaching videos and presentations remain in the original workspace.
