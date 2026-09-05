import { readFileSync } from "node:fs";

let data = {};
try {
  data = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  data = {};
}

const toolInput = data.tool_input && typeof data.tool_input === "object" ? data.tool_input : {};
const filePath =
  (typeof data.file_path === "string" && data.file_path) ||
  (typeof toolInput.path === "string" && toolInput.path) ||
  (typeof toolInput.file_path === "string" && toolInput.file_path) ||
  "";

process.stdout.write(filePath);
