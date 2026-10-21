import { defineConfig } from "vite-plus";
import { site } from "./build/plugin.ts";

export default defineConfig({
  plugins: [site()],
  test: {
    include: ["src/**/*.test.ts", "build/**/*.test.ts"],
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
