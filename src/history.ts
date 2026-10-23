// Slide 09 · Read the record - for any existing session, no live connection needed.
// Defaults to the last session created by `npm run session`.
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "node:fs";

const client = new Anthropic();

const sessionId =
  process.argv[2] ?? (existsSync(".last-session") ? readFileSync(".last-session", "utf8").trim() : undefined);
if (!sessionId) throw new Error("Usage: npm run history -- sesn_...  (or run `npm run session` first)");
console.log(`session ${sessionId}`);

for await (const event of
  client.beta.sessions.events.list(sessionId)) {
  console.log(event.id, event.type);
}
