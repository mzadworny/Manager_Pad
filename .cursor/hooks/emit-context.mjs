import { readFileSync } from "node:fs";

const prefix = process.argv[2] ?? "";
const body = readFileSync(0, "utf8");
const text = `${prefix}${prefix && body ? "\n" : ""}${body}`.slice(0, 8000);
process.stdout.write(JSON.stringify({ additional_context: text }));
