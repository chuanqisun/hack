import type { Plugin } from "esbuild-wasm";
import { idbFs } from "../db/idb-fs";

export const virtualFsPlugin: Plugin = {
  name: "virtual-fs",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      // Entry point
      if (args.kind === "entry-point") {
        return {
          path: normalizePath(args.path),
          namespace: "virtual",
        };
      }

      // Relative imports
      if (args.path.startsWith("./") || args.path.startsWith("../")) {
        const importerDir = dirname(args.importer);
        return {
          path: normalizePath(importerDir + "/" + args.path),
          namespace: "virtual",
        };
      }

      // Bare imports, e.g. "react"
      return {
        path: `/node_modules/${args.path}/index.js`,
        namespace: "virtual",
      };
    });

    build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args) => {
      try {
        let contents = await idbFs.read(args.path);
        if (contents instanceof ArrayBuffer) {
          contents = new Uint8Array(contents);
        }

        // Guess loader based on extension
        let loader: "js" | "jsx" | "ts" | "tsx" | "css" | "json" | "text" = "js";
        const ext = args.path.split(".").pop();
        if (ext === "js" || ext === "mjs" || ext === "cjs") loader = "js";
        else if (ext === "jsx") loader = "jsx";
        else if (ext === "ts") loader = "ts";
        else if (ext === "tsx") loader = "tsx";
        else if (ext === "css") loader = "css";
        else if (ext === "json") loader = "json";
        else loader = "text";

        return {
          contents: contents as string | Uint8Array,
          loader,
          resolveDir: dirname(args.path),
        };
      } catch (err: any) {
        return {
          errors: [
            {
              text: err instanceof Error ? err.message : String(err),
            },
          ],
        };
      }
    });
  },
};

function normalizePath(path: string) {
  const parts = [];

  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }

  return "/" + parts.join("/");
}

function dirname(path: string) {
  return path.slice(0, path.lastIndexOf("/")) || "/";
}
