"use strict"

// Bypassed for standalone desktop dev — node_modules is local.
// Allow standalone builds by checking local node_modules too.
const fs = require("fs")
const path = require("path")
const localNm = path.resolve(__dirname, "..", "node_modules", "vite", "package.json")
const repoRoot = path.resolve(__dirname, "..", "..", "..", "node_modules", "vite", "package.json")
if (!fs.existsSync(localNm) && !fs.existsSync(repoRoot)) {
  console.error("Run npm install first (node_modules not found)")
  process.exit(1)
}

