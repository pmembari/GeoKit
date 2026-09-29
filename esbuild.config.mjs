import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outfile: "out/extension.js",
  external: ["vscode"],
  sourcemap: true,
  minify: false,
  logLevel: "info",
});

