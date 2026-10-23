// Slides 07-09 in one run:
//   07 · create a text-only session override
//   08 · inspect the resolved snapshot
//   09 · watch live, then read the recorded history
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";

const client = new Anthropic();

if (!process.env.CLAUDE_MANAGED_AGENT_ID || !process.env.CLAUDE_MANAGED_ENVIRONMENT_ID) {
  throw new Error("CLAUDE_MANAGED_AGENT_ID / CLAUDE_MANAGED_ENVIRONMENT_ID missing - run `npm run setup` first.");
}

// ---- Slide 07 · Code 1 · A text-only session override ----------------------
const session = await client.beta.sessions.create({
  agent: {
    type: "agent_with_overrides",
    id: process.env.CLAUDE_MANAGED_AGENT_ID!,
    model: process.env.CLAUDE_SESSION_MODEL!,
    system: "Answer in one sentence.",
    tools: [], mcp_servers: [], skills: []
  },
  environment_id:
    process.env.CLAUDE_MANAGED_ENVIRONMENT_ID!,
  budget: { type: "limit",
    max_list_cost: { currency: "USD", amount: "50" } }
});

// ---- Slide 08 · Code 2 · Inspect the resolved snapshot ---------------------
console.log("\n== Slide 08 · resolved snapshot ==");
console.log(session.id, session.status);
console.log(session.agent.id, session.agent.version);
console.log(session.agent.model);
console.log(session.agent.system);

const counts = {
  tools: session.agent.tools.length,
  mcp: session.agent.mcp_servers.length,
  skills: session.agent.skills.length
};
console.log(counts);
// Expected: { tools: 0, mcp: 0, skills: 0 }

// The stored agent is unchanged: it still has its own model, system and tools.
const stored = await client.beta.agents.retrieve(session.agent.id);
console.log("stored agent (unchanged):", {
  version: stored.version,
  model: stored.model,
  system: stored.system,
  tools: stored.tools.length,
});

// ---- Slide 09 · Code 3 · Watch live --------------------------------------
// Open before sending work. A live stream does not replay prior events.
const prompt = process.argv.slice(2).join(" ") || "Why is the sky blue?";
console.log(`\n== Slide 09 · watch live ==\nuser> ${prompt}`);

const live = await client.beta.sessions.events
  .stream(session.id);
await client.beta.sessions.events.send(session.id, {
  events: [{ type: "user.message", content: [{ type: "text", text: prompt }] }],
});

loop: for await (const event of live) {
  console.log(event.type);
  if (event.type === "agent.message") {
    for (const block of event.content) if (block.type === "text") console.log(`  claude> ${block.text}`);
  }
  if (event.type === "session.status_idle") {
    // end_turn = done; budget_reached = paused at the 50-cent cap.
    if (event.stop_reason.type !== "requires_action") break loop;
  }
  if (event.type === "session.status_terminated") break loop;
  if (event.type === "session.error") console.error("  session error:", event);
}

// ---- Slide 09 · Code 3 · Read the record ---------------------------------
// List recorded events to inspect previous activity in this session.
console.log("\n== Slide 09 · read the record ==");
for await (const event of
  client.beta.sessions.events.list(session.id)) {
  console.log(event.id, event.type);
}

writeFileSync(".last-session", session.id);
console.log(`\nRe-read this record any time: npm run history  (or: npm run history -- ${session.id})`);
