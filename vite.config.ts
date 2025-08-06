import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import glsl from "vite-plugin-glsl";

export default defineConfig({
  plugins: [
    glsl({
      include: [
        // Glob pattern, or array of glob patterns to import
        "**/*.glsl",
        "**/*.wgsl",
        "**/*.vert",
        "**/*.frag",
        "**/*.vs",
        "**/*.fs",
      ],
      exclude: undefined, // Glob pattern, or array of glob patterns to ignore
      warnDuplicatedImports: true, // Warn if the same chunk was imported multiple times
      defaultExtension: "glsl", // Shader suffix when no extension specified
      watch: true, // Recompile shader on change
    }),
    tsconfigPaths(),
  ],
  resolve: {
    alias: [{ find: "@", replacement: "/src" }],
  },
});
