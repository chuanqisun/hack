import type { Plugin } from "esbuild-wasm";

export const httpPlugin: Plugin = {
  name: "http",
  setup(build) {
    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: "http",
    }));

    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.importer.startsWith("http")) {
        return {
          path: new URL(args.path, args.importer).href,
          namespace: "http",
        };
      }
    });

    build.onLoad({ filter: /.*/, namespace: "http" }, async (args) => {
      const res = await fetch(args.path);
      if (!res.ok) {
        return {
          errors: [{ text: `Failed to fetch ${args.path}` }],
        };
      }

      return {
        contents: await res.text(),
        loader: "js",
      };
    });
  },
};
