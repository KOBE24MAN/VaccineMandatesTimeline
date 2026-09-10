import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const dataPath = fileURLToPath(
  new URL("../vaccine_mandates.csv", import.meta.url),
);
/** Serve only the root dataset; never expose the rest of the repository. */
function mandateData(): Plugin {
  return {
    name: "root-mandate-data",
    configureServer(server) {
      server.watcher.add(dataPath);
      server.watcher.on("change", (path) => {
        if (path === dataPath) server.ws.send({ type: "full-reload" });
      });
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/vaccine_mandates.csv")
          return next();
        try {
          response.setHeader(
            "Content-Type",
            "text/tab-separated-values; charset=utf-8",
          );
          response.setHeader("Cache-Control", "no-cache");
          response.end(readFileSync(dataPath));
        } catch {
          response.statusCode = 404;
          response.end("Mandate data file not found");
        }
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "vaccine_mandates.csv",
        source: readFileSync(dataPath),
      });
    },
  };
}
export default defineConfig({ base: "./", plugins: [react(), mandateData()] });
