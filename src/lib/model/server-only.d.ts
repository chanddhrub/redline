/**
 * `server-only` is not a top-level package here. Next resolves the bare
 * specifier through a compiler alias (see
 * `node_modules/next/dist/build/create-compiler-aliases.js`): on the server it
 * becomes an empty module, and in a client bundle it becomes a module that
 * throws, which is what turns a client import of the transport into a build
 * failure. TypeScript does not follow that alias, so the module is declared
 * here.
 */
declare module "server-only";
