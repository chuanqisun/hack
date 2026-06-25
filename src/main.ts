import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import { idbFs } from "./db/idb-fs";
import { virtualFsPlugin } from "./esbuild/vfs";
import "./style.css";

console.log("app online");

// Mock files to load into our virtual filesystem
const files = {
  "/src/index.js": `
    import { msg } from "./message.js";
    import React from "react";

    console.log(msg, React);
  `,

  "/src/message.js": `
    export const msg = "Hello from virtual file system";
  `,

  "/node_modules/react/index.js": `
    export default { version: "fake-react" };
  `,
};

export async function main() {
  // Populate the indexedDB filesystem with initial files
  for (const [path, content] of Object.entries(files)) {
    await idbFs.write(path, content);
  }

  await esbuild.initialize({ wasmURL, worker: true });

  const result = await esbuild.build({
    entryPoints: ["/src/index.js"],
    bundle: true,
    write: false,
    format: "esm",
    plugins: [virtualFsPlugin],
  });

  console.log(result.outputFiles[0].text);
}

main();
