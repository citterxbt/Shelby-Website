const fs = require('fs');
const path = require('path');

// Copy clay.wasm to public/
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
const wasmSrc = path.join(__dirname, 'node_modules', '@shelby-protocol', 'clay-codes', 'dist', 'clay.wasm');
const wasmDest = path.join(publicDir, 'clay.wasm');
if (fs.existsSync(wasmSrc)) {
  fs.copyFileSync(wasmSrc, wasmDest);
  console.log('Copied clay.wasm to public/');
}

// Patch index.js
const indexJsPath = path.join(__dirname, 'node_modules', '@shelby-protocol', 'clay-codes', 'dist', 'index.js');
if (fs.existsSync(indexJsPath)) {
  let content = fs.readFileSync(indexJsPath, 'utf8');
  content = content.replace(/new URL\("\.\/clay\.wasm", import\.meta\.url\)/g, '"/clay.wasm"');
  fs.writeFileSync(indexJsPath, content);
  console.log('Patched clay-codes index.js');
}
