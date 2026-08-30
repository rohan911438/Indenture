import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/envelope.ts", "src/mirror.ts", "src/hcs.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // @hashgraph/sdk is Node-only (gRPC/HTTP-2); never bundle it for edge.
  external: ["@hashgraph/sdk"],
});
