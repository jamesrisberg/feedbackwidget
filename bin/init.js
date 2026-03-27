#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const skillDir = path.join(process.cwd(), ".claude", "skills", "setup-feedback");
const skillSrc = path.join(__dirname, "..", "skills", "setup-feedback", "SKILL.md");

if (!fs.existsSync(skillSrc)) {
  console.error("Could not find SKILL.md in package. Try reinstalling dropin-feedback-widget.");
  process.exit(1);
}

fs.mkdirSync(skillDir, { recursive: true });
fs.copyFileSync(skillSrc, path.join(skillDir, "SKILL.md"));

console.log("");
console.log("  dropin-feedback-widget skill installed!");
console.log("");
console.log("  Open Claude Code and run:");
console.log("");
console.log("    /setup-feedback");
console.log("    /setup-feedback linear");
console.log("    /setup-feedback firestore");
console.log("    /setup-feedback supabase");
console.log("    /setup-feedback slack");
console.log("");
