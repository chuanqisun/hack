import type { Plugin } from "esbuild-wasm";

// mock
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

    build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
      const contents = files[args.path as keyof typeof files];

      if (contents == null) {
        return {
          errors: [
            {
              text: `File not found: ${args.path}`,
            },
          ],
        };
      }

      return {
        contents,
        loader: "js",
        resolveDir: dirname(args.path),
      };
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
