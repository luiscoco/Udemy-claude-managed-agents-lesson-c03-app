// One-time setup: an Environment and a base Agent that DOES have capabilities
// (the built-in agent toolset), so the session override on slide 07 has
// something to clear. Agents are persistent - run once, reuse the IDs.
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const client = new Anthropic();

const environment = await client.beta.environments.create({
  name: "lesson-c03-env",
  config: { type: "cloud", networking: { type: "limited" } },
});

const agent = await client.beta.agents.create({
  name: "Lesson C03 Base Agent",
  model: process.env.CLAUDE_MODEL ?? "claude-opus-5-5",
  system: "You are a thorough research assistant. Explain your reasoning in detail.",
  tools: [{ type: "agent_toolset_20260401" }],
});

const ids = { agentId: agent.id, agentVersion: agent.version, environmentId: environment.id };
writeFileSync(".managed-ids.json", JSON.stringify(ids, null, 2));

// The slides read the IDs from process.env, so write them into .env too.
const env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const upsert = (text: string, key: string, value: string) => {
  const line = `${key}=${value}`;
  const re = new RegExp(`^#?\s*${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
};
let next = upsert(env, "CLAUDE_MANAGED_AGENT_ID", agent.id);
next = upsert(next, "CLAUDE_MANAGED_ENVIRONMENT_ID", environment.id);
writeFileSync(".env", next);

console.log("Base agent:", { id: agent.id, version: agent.version, model: agent.model, tools: agent.tools.length });
console.log("Saved .managed-ids.json and updated .env:", ids);
