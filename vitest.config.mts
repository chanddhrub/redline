import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // `server-only` is a bare specifier Next resolves through a compiler
      // alias rather than a package in `node_modules`. Outside the Next build
      // it has to be pointed at the same empty module Next uses on the server,
      // or importing anything marked server-only fails to resolve.
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
});
