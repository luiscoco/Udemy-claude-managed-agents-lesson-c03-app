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

## How the app was build

### 1. Apply session-only capability overrides

agent_with_overrides selects the stored base agent but replaces system instructions and clears tools, MCP servers and skills for this session. It does not update the stored base definition.

Source: [src/web.ts](src/web.ts#L35)

```typescript
const session = await client.beta.sessions.create({
  agent: {
    type: "agent_with_overrides",
    id: process.env.CLAUDE_MANAGED_AGENT_ID!,
    ...(process.env.CLAUDE_SESSION_MODEL
      ? { model: process.env.CLAUDE_SESSION_MODEL }
      : {}),
    system: "Answer in one sentence.",
    tools: [],
    mcp_servers: [],
    skills: [],
  },
  environment_id: process.env.CLAUDE_MANAGED_ENVIRONMENT_ID!,
  budget: { type: "limit", max_list_cost: { currency: "USD", amount: "50" } },
});
```

### 2. Compare stored and effective configuration

The stored agent is retrieved separately from the resolved session snapshot. Comparing their versions and capability counts demonstrates what was inherited and what was overridden.

Source: [src/web.ts](src/web.ts#L38) · selected statements

```typescript
const stored = await client.beta.agents.retrieve(session.agent.id);

// ... other source statements omitted ...
send("stored", {
  version: stored.version,
  tools: stored.tools.length,
  mcp: stored.mcp_servers.length,
  skills: stored.skills.length,
});
```

### 3. Open the live stream before sending

The SDK stream is established before the user message is submitted. Browser disconnect aborts observation; it does not establish that remote work was interrupted.

Source: [src/web.ts](src/web.ts#L40) · selected statements

```typescript
const live = await client.beta.sessions.events.stream(session.id);

// ... other source statements omitted ...
await client.beta.sessions.events.send(session.id, {
  events: [
    { type: "user.message", content: [{ type: "text", text: data.prompt.trim() }] },
  ],
});
```

### 4. Read all recorded history pages

The async iterator gathers the recorded event IDs after observation ends. This history view is separate from the transient live feed and includes pagination through the SDK iterator.

Source: [src/web.ts](src/web.ts#L50) · selected statements

```typescript
const history: { id: string; type: string }[] = [];

// ... other source statements omitted ...
for await (const event of client.beta.sessions.events.list(session.id))
  history.push({ id: event.id, type: event.type });
```

## Validation

```powershell
npm run typecheck
python scripts/verify-walkthrough.py
```

The source hash check detects when walkthrough excerpts need refreshing. Browser verification covers page navigation, readable text, mobile layout, dark mode, diagram and image routes. Local scenarios and live provider calls are recorded separately in the workspace verification report; local success is not evidence of a live provider operation.

## Repository contents

Application sources, student web pages, safe configuration example and documentation images are included. `node_modules`, `presentation`, `output`, `reviewed`, `v3`, `teaching-material`, build output, local journals, credentials and local resource files are ignored. Existing teaching videos and presentations remain in the original workspace.
