import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// CDN URLs for onnxruntime-web WASM binaries (uploaded via manus-upload-file --webdev)
const ORT_CDN = {
  jsep:     "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/ort-wasm-simd-threaded.jsep_545d5da0.wasm",
  plain:    "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/ort-wasm-simd-threaded_f686e602.wasm",
  asyncify: "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/ort-wasm-simd-threaded.asyncify_a7147f2a.wasm",
};

/**
 * Vite plugin that rewrites onnxruntime-web's hardcoded `new URL("ort-wasm-*.wasm", import.meta.url)`
 * calls in the built chunks to use CDN URLs instead. This is needed because:
 *  1. Vite dep-optimisation bundles onnxruntime-web into a chunk.
 *  2. The chunk uses `new URL(filename, import.meta.url)` to locate WASM files.
 *  3. In production the chunk is at /assets/chunk-XXXX.js so the WASM would be
 *     expected at /assets/ort-wasm-*.wasm — which doesn't exist.
 *  4. ort.env.wasm.wasmPaths is ignored by the bundled chunk.
 * Solution: replace the string literals in the built chunk with CDN URLs.
 */
const vitePluginOrtWasmCdn = (): Plugin => ({
  name: "ort-wasm-cdn",
  enforce: "post",
  renderChunk(code: string) {
    if (!code.includes("ort-wasm-simd-threaded")) return null;
    let out = code;
    out = out.replace(
      /new URL\("ort-wasm-simd-threaded\.jsep\.wasm",import\.meta\.url\)\.href/g,
      `"${ORT_CDN.jsep}"`
    );
    out = out.replace(
      /new URL\("ort-wasm-simd-threaded\.asyncify\.wasm",import\.meta\.url\)\.href/g,
      `"${ORT_CDN.asyncify}"`
    );
    // plain wasm — must come after jsep/asyncify to avoid partial matches
    out = out.replace(
      /new URL\("ort-wasm-simd-threaded\.wasm",import\.meta\.url\)\.href/g,
      `"${ORT_CDN.plain}"`
    );
    return out === code ? null : { code: out, map: null };
  },
});

// Plugin to serve .wasm files with the correct MIME type so WebAssembly.compile works.
// onnxruntime-web bundles a `new URL("ort-wasm-*.wasm", import.meta.url).href` path
// that resolves relative to the Vite dep-optimized chunk. We copy the WASM files into
// the Vite deps directory so they are co-located with the chunk and served correctly.
const ORT_WASM_FILES = [
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.asyncify.wasm",
];
const vitePluginWasmMime = (): Plugin => ({
  name: "wasm-mime",
  configureServer(server: ViteDevServer) {
    // Set MIME type for all .wasm requests
    server.middlewares.use((req, res, next) => {
      if (req.url?.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
      next();
    });
    // Copy WASM files into Vite deps cache after dep optimisation completes
    server.httpServer?.once("listening", () => {
      setTimeout(() => {
        const depsDir = path.join(PROJECT_ROOT, "node_modules", ".vite", "deps");
        const ortDist = path.join(PROJECT_ROOT, "node_modules", "onnxruntime-web", "dist");
        if (!fs.existsSync(depsDir)) return;
        for (const file of ORT_WASM_FILES) {
          const src = path.join(ortDist, file);
          const dest = path.join(depsDir, file);
          if (fs.existsSync(src) && !fs.existsSync(dest)) {
            try { fs.copyFileSync(src, dest); } catch { /* ignore */ }
          }
        }
      }, 3000); // wait 3 s for Vite dep optimisation to finish
    });
  },
});

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginWasmMime(), vitePluginOrtWasmCdn()];

export default defineConfig({
  plugins,
  optimizeDeps: {
    include: ["onnxruntime-web"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
