import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const openNext = path.join(root, ".open-next");
const output = path.join(root, "dist");
const hostingConfig = path.join(root, ".openai", "hosting.json");

if (!fs.existsSync(path.join(openNext, "worker.js"))) {
  throw new Error("OpenNext did not create .open-next/worker.js");
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, "server"), { recursive: true });
fs.cpSync(openNext, path.join(output, "server"), { recursive: true });

// Sites uploads the OpenNext module graph directly instead of running Wrangler's
// final bundle pass. Convert the remaining CommonJS Node built-in calls in the
// generated Next server into ESM imports so they work in a Cloudflare Worker.
const handlerPath = path.join(output, "server", "server-functions", "default", "handler.mjs");
let handlerSource = fs.readFileSync(handlerPath, "utf8");
const nodeShims = [
  { names: ["async_hooks", "node:async_hooks"], specifier: "node:async_hooks", binding: "__aoupaAsyncHooks" },
  { names: ["crypto", "node:crypto"], specifier: "node:crypto", binding: "__aoupaCrypto" },
  { names: ["fs"], specifier: "node:fs", binding: "__aoupaFs" },
  { names: ["path", "node:path"], specifier: "node:path", binding: "__aoupaPath" },
  { names: ["url", "node:url"], specifier: "node:url", binding: "__aoupaUrl" },
  { names: ["vm"], specifier: "node:vm", binding: "__aoupaVm" },
  { names: ["util"], specifier: "node:util", binding: "__aoupaUtil" },
  { names: ["buffer"], specifier: "node:buffer", binding: "__aoupaBuffer" },
  { names: ["stream", "node:stream"], specifier: "node:stream", binding: "__aoupaStream" },
  { names: ["node:stream/web"], specifier: "node:stream/web", binding: "__aoupaStreamWeb" },
  { names: ["node:zlib"], specifier: "node:zlib", binding: "__aoupaZlib" },
  { names: ["os"], specifier: "node:os", binding: "__aoupaOs" },
  { names: ["https"], specifier: "node:https", binding: "__aoupaHttps" },
  { names: ["http"], specifier: "node:http", binding: "__aoupaHttp" },
  { names: ["events"], specifier: "node:events", binding: "__aoupaEvents" },
  { names: ["node:process"], specifier: "node:process", binding: "__aoupaProcess" }
];

const imports = [];
const aliases = [];
for (const shim of nodeShims) {
  const namespace = `${shim.binding}Namespace`;
  imports.push(`import * as ${namespace} from ${JSON.stringify(shim.specifier)};`);
  aliases.push(`const ${shim.binding} = ${namespace}.default ?? ${namespace};`);
  for (const name of shim.names) {
    handlerSource = handlerSource.replaceAll(`require(${JSON.stringify(name)})`, shim.binding);
  }
}
handlerSource = handlerSource.replaceAll(
  'require("@builder.io/partytown/integration")',
  '__aoupaOptionalRequire("@builder.io/partytown/integration")'
);
const remainingBuiltinRequire = nodeShims
  .flatMap((shim) => shim.names)
  .find((name) => handlerSource.includes(`require(${JSON.stringify(name)})`));
if (remainingBuiltinRequire) {
  throw new Error(`Unable to convert CommonJS import for ${remainingBuiltinRequire}`);
}
handlerSource = [
  ...imports,
  ...aliases,
  'const __aoupaOptionalRequire = (name) => { throw new Error(`Optional module is not configured: ${name}`); };',
  handlerSource
].join("\n");
fs.writeFileSync(handlerPath, handlerSource, "utf8");

fs.writeFileSync(
  path.join(output, "server", "index.js"),
  'export { default } from "./worker.js";\nexport * from "./worker.js";\n',
  "utf8"
);
fs.cpSync(path.join(openNext, "assets"), path.join(output, "client"), { recursive: true });
fs.mkdirSync(path.join(output, ".openai"), { recursive: true });
fs.copyFileSync(hostingConfig, path.join(output, ".openai", "hosting.json"));

process.stdout.write("Prepared dist/ with OpenNext and Sites-compatible entrypoints.\n");
