import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** `@/` is the app root, the same alias tsconfig.json gives the Next build. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
