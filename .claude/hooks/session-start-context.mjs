import { existsSync, readFileSync } from "node:fs";

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const context = readIfExists("CONTEXT.md");
const notes = readIfExists("docs/AGENT_NOTES.md");

const additionalContext = [
  "# CONTEXT.md",
  "",
  context,
  "",
  "# docs/AGENT_NOTES.md",
  "",
  notes,
  "",
  "(docs/PRD.md exists at docs/PRD.md -- skim it if this task touches product scope.)",
].join("\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  })
);
