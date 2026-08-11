import path from "node:path";
import { DEFAULT_OUTPUT_DIR } from "./config";
import { isDirectory } from "./utils/file-utils";

function isWithinDirectory(rootDir: string, candidate: string): boolean {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

async function resolveStaticFile(outputDir: string, pathname: string): Promise<Bun.BunFile | null> {
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decodedPathname.includes("\0")) {
    return null;
  }

  const relativePath = decodedPathname.replace(/^\/+/, "");
  const directPath = path.resolve(outputDir, relativePath || "index.html");

  if (!isWithinDirectory(outputDir, directPath)) {
    return null;
  }

  const candidates = new Set<string>();
  if (relativePath === "" || decodedPathname.endsWith("/")) {
    candidates.add(path.join(directPath, relativePath === "" ? "" : "index.html"));
  } else {
    candidates.add(directPath);
    if (!path.extname(relativePath)) {
      candidates.add(`${directPath}.html`);
      candidates.add(path.join(directPath, "index.html"));
    }
  }

  // Root resolves to outputDir/index.html rather than outputDir itself.
  if (relativePath === "") {
    candidates.clear();
    candidates.add(path.join(outputDir, "index.html"));
  }

  for (const candidate of candidates) {
    if (!isWithinDirectory(outputDir, candidate)) {
      continue;
    }
    const file = Bun.file(candidate);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat?.isFile()) {
        return file;
      }
    }
  }

  return null;
}

export async function startServer(outputDir: string = DEFAULT_OUTPUT_DIR, port: number = 3000) {
  if (!(await isDirectory(outputDir))) {
    const msg = `Error: Output directory ${outputDir} does not exist or is not accessible.`;
    console.error(msg);
    console.log('Try running "bunki generate" first to build your site.');
    throw new Error(msg);
  }

  const resolvedOutputDir = path.resolve(outputDir);
  console.log(`Starting server for site in ${resolvedOutputDir}...`);

  const server = Bun.serve({
    port,
    async fetch(req) {
      try {
        const { pathname } = new URL(req.url);
        const file = await resolveStaticFile(resolvedOutputDir, pathname);

        if (!file) {
          console.log(`404 Not Found: ${pathname}`);
          return new Response(`<h1>404 Not Found</h1><p>Could not find ${pathname}</p>`, {
            status: 404,
            headers: { "Content-Type": "text/html" },
          });
        }

        console.log(`Serving file: ${file.name ?? pathname}`);
        // BunFile extends Blob, so Response automatically uses Bun's MIME type.
        return new Response(file);
      } catch (error) {
        console.error("Server error:", error);
        return new Response(`<h1>500 Server Error</h1><pre>${error}</pre>`, {
          status: 500,
          headers: { "Content-Type": "text/html" },
        });
      }
    },
  });

  console.log(`Bunki development server running at http://localhost:${port}/`);
  return server;
}
