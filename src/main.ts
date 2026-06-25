import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import { virtualFsPlugin } from "./esbuild/vfs";
import "./style.css";

console.log("app online");

export async function main() {
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
