/**
 * Lets a plain `node` run import the product's TypeScript directly.
 *
 * Node 24 strips the types itself; what it will not do is guess a file
 * extension or know about the aliases the Next build supplies. Two gaps, two
 * hooks, no dependency:
 *
 * - `server-only` is a bare specifier Next resolves through a compiler alias
 *   rather than a package. `src/lib/model/openrouter.ts` imports it, so
 *   without this the smoke run cannot load the real transport at all. It is
 *   pointed at the same empty module Next uses on the server — the identical
 *   alias `vitest.config.ts` already sets, for the identical reason.
 * - `./verify`, `@/lib/...` and friends carry no extension, because a bundler
 *   supplies one. Node's resolver does not, so an extensionless specifier is
 *   retried as `.ts`, `.tsx` and then as a directory index.
 *
 * This file is a run harness. Nothing in `src/` imports it and nothing about
 * the pipeline changes because it exists.
 */

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolvePath(here, "..", "src");
const serverOnly = pathToFileURL(
  resolvePath(here, "..", "node_modules", "next", "dist", "compiled", "server-only", "empty.js"),
).href;

const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];
const INDEXES = EXTENSIONS.map((extension) => `/index${extension}`);

/** The first candidate that exists on disk, or `null`. */
function firstExisting(base) {
  for (const suffix of [...EXTENSIONS, ...INDEXES]) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: serverOnly, shortCircuit: true };
    }

    if (specifier.startsWith("@/")) {
      const found = firstExisting(resolvePath(srcDir, specifier.slice(2)));
      if (found) return { url: found, shortCircuit: true };
    }

    if (specifier.startsWith(".") && context.parentURL) {
      const base = resolvePath(
        dirname(fileURLToPath(context.parentURL)),
        specifier,
      );
      if (!existsSync(base)) {
        const found = firstExisting(base);
        if (found) return { url: found, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});
