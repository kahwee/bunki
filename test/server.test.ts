import {
  expect,
  test,
  describe,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { startServer } from "../src/server";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Resolve directory path in a way that satisfies TypeScript
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_OUTPUT_DIR = path.join(__dirname, "server-test-output");
const TEST_PORT = 3333;

// Helper to check if directory exists
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

// Helper to create test files
async function createTestFile(
  filePath: string,
  content: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, content);
}

// Helper to make HTTP request
async function makeRequest(url: string): Promise<Response> {
  return fetch(url);
}

// Helper to check if server is running on port
async function isPortInUse(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}`);
    return true;
  } catch {
    return false;
  }
}

describe("Server Directory Existence Tests", () => {
  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  test("should reject non-existent directory", async () => {
    const nonExistentDir = path.join(TEST_OUTPUT_DIR, "does-not-exist");
    await expect(startServer(nonExistentDir, TEST_PORT)).rejects.toThrow();
  });

  test("should reject file instead of directory", async () => {
    // Create a file where we expect a directory
    const filePath = path.join(TEST_OUTPUT_DIR, "not-a-directory");
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, "I'm a file, not a directory");

    await expect(startServer(filePath, TEST_PORT)).rejects.toThrow();
  });

  test("should accept valid directory", async () => {
    // Create test directory with basic files
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "index.html"),
      "<html><body>Test</body></html>",
    );

    // Start server but don't wait for it to keep running
    const server = await startServer(TEST_OUTPUT_DIR, TEST_PORT);

    // Wait a bit for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if server is running
    const isRunning = await isPortInUse(TEST_PORT);
    expect(isRunning).toBe(true);

    // Kill the server process (it will be running in background)
    server.stop?.();
  });

  test("should handle permission denied directory", async () => {
    // This test might not work on all systems due to permissions
    const restrictedDir = "/root/restricted";

    await expect(startServer(restrictedDir, TEST_PORT)).rejects.toThrow();
  });
});

describe("Server Path Traversal Security Tests", () => {
  beforeAll(async () => {
    // Create test directory with files
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "index.html"),
      "<html><body>Safe content</body></html>",
    );
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "safe.html"),
      "<html><body>Safe file</body></html>",
    );

    // Create a sensitive file outside the output directory
    const sensitiveDir = path.join(__dirname, "sensitive");
    await fs.promises.mkdir(sensitiveDir, { recursive: true });
    await createTestFile(
      path.join(sensitiveDir, "secret.txt"),
      "This should not be accessible",
    );
  });

  afterAll(async () => {
    // Clean up
    try {
      await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true });
      await fs.promises.rm(path.join(__dirname, "sensitive"), {
        recursive: true,
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  test("should prevent directory traversal attacks", async () => {
    // Ensure base directory and files still exist (in case removed by prior tests)
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    const indexPath = path.join(TEST_OUTPUT_DIR, "index.html");
    try {
      await fs.promises.access(indexPath);
    } catch {
      await fs.promises.writeFile(
        indexPath,
        "<html><body>Safe content</body></html>",
      );
    }
    const server1 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 1);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Try various directory traversal attempts
    const traversalAttempts = [
      "/../sensitive/secret.txt",
      "/../../sensitive/secret.txt",
      "/../../../etc/passwd",
      "/..%2Fsensitive%2Fsecret.txt",
      "/....//sensitive/secret.txt",
    ];

    for (const attempt of traversalAttempts) {
      const response = await makeRequest(
        `http://localhost:${TEST_PORT + 1}${attempt}`,
      );
      expect(response.status).toBe(404); // Should return 404, not the sensitive file
    }

    server1.stop?.();
  });

  test("should serve legitimate files correctly", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    const safeFile = path.join(TEST_OUTPUT_DIR, "safe.html");
    try {
      await fs.promises.access(safeFile);
    } catch {
      await fs.promises.writeFile(
        safeFile,
        "<html><body>Safe file</body></html>",
      );
    }
    const server2 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 2);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Test legitimate requests
    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 2}/safe.html`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("Safe file");

    server2.stop?.();
  });
});

describe("Server Content-Type and Security Headers Tests", () => {
  beforeAll(async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.html"),
      "<html><body>HTML</body></html>",
    );
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.css"),
      "body { color: red; }",
    );
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.js"),
      "console.log('test');",
    );
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.json"),
      '{"test": true}',
    );
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true });
    } catch {}
  });

  test("should set correct Content-Type headers", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.html"),
      "<html><body>HTML</body></html>",
    );
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.css"),
      "body { color: red; }",
    );
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.js"),
      "console.log('test');",
    );
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.json"),
      '{"test": true}',
    );
    const server3 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 3);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const testCases = [
      { file: "/test.html", expectedType: "text/html" },
      { file: "/test.css", expectedType: "text/css" },
      { file: "/test.js", expectedType: "text/javascript" },
      { file: "/test.json", expectedType: "application/json" },
    ];

    for (const { file, expectedType } of testCases) {
      const response = await makeRequest(
        `http://localhost:${TEST_PORT + 3}${file}`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(expectedType);
    }

    server3.stop?.();
  });

  test("should handle missing files with 404", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    const server4 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 4);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 4}/nonexistent.html`,
    );
    expect(response.status).toBe(404);

    const content = await response.text();
    expect(content).toInclude("404 Not Found");

    server4.stop?.();
  });
});

describe("Server Edge Cases Tests", () => {
  beforeAll(async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "index.html"),
      "<html><body>Root</body></html>",
    );

    // Create subdirectory structure
    const subDir = path.join(TEST_OUTPUT_DIR, "subdir");
    await fs.promises.mkdir(subDir, { recursive: true });
    await createTestFile(
      path.join(subDir, "index.html"),
      "<html><body>Sub</body></html>",
    );
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true });
    } catch {}
  });

  test("should handle root path correctly", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "index.html"),
      "<html><body>Root</body></html>",
    );
    const server5 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 5);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(`http://localhost:${TEST_PORT + 5}/`);
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("Root");

    server5.stop?.();
  });

  test("should handle trailing slashes", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    const subDir = path.join(TEST_OUTPUT_DIR, "subdir");
    await fs.promises.mkdir(subDir, { recursive: true });
    await createTestFile(
      path.join(subDir, "index.html"),
      "<html><body>Sub</body></html>",
    );
    const server6 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 6);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 6}/subdir/`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("Sub");

    server6.stop?.();
  });

  test("should handle empty directory", async () => {
    const emptyDir = path.join(TEST_OUTPUT_DIR, "empty");
    await fs.promises.mkdir(emptyDir, { recursive: true });
    const server7 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 7);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 7}/empty/`,
    );
    expect(response.status).toBe(404);

    server7.stop?.();
  });
});

describe("Server Error Handling Tests", () => {
  test("should handle port already in use", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    const server8 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 8);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(startServer(TEST_OUTPUT_DIR, TEST_PORT + 8)).rejects.toThrow();
    server8.stop?.();
  });
});

describe("Server Image and Media Types Tests", () => {
  beforeAll(async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    // Create image files
    await createTestFile(path.join(TEST_OUTPUT_DIR, "test.png"), "PNG data");
    await createTestFile(path.join(TEST_OUTPUT_DIR, "test.jpg"), "JPEG data");
    await createTestFile(path.join(TEST_OUTPUT_DIR, "test.jpeg"), "JPEG data");
    await createTestFile(path.join(TEST_OUTPUT_DIR, "test.svg"), "<svg></svg>");
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.xml"),
      "<?xml version='1.0'?><root/>",
    );
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true });
    } catch {}
  });

  test("should serve PNG images with correct content type", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(path.join(TEST_OUTPUT_DIR, "test.png"), "PNG data");

    const server9 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 9);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 9}/test.png`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");

    server9.stop?.();
  });

  test("should serve JPEG images with correct content type", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(path.join(TEST_OUTPUT_DIR, "test.jpg"), "JPEG data");

    const server10 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 10);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 10}/test.jpg`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");

    server10.stop?.();
  });

  test("should serve SVG with correct content type", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(path.join(TEST_OUTPUT_DIR, "test.svg"), "<svg></svg>");

    const server11 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 11);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 11}/test.svg`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");

    server11.stop?.();
  });

  test("should serve XML with correct content type", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "test.xml"),
      "<?xml version='1.0'?><root/>",
    );

    const server12 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 12);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 12}/test.xml`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml");

    server12.stop?.();
  });
});

describe("Server Pagination Routes Tests", () => {
  beforeAll(async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    // Create pagination structure
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "page", "2", "index.html"),
      "<html><body>Page 2</body></html>",
    );
    await createTestFile(
      path.join(
        TEST_OUTPUT_DIR,
        "tags",
        "javascript",
        "page",
        "1",
        "index.html",
      ),
      "<html><body>JavaScript Tag Page 1</body></html>",
    );
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "2025", "page", "1", "index.html"),
      "<html><body>Year 2025 Page 1</body></html>",
    );
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true });
    } catch {}
  });

  test("should serve home pagination routes", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "page", "2", "index.html"),
      "<html><body>Page 2</body></html>",
    );

    const server13 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 13);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 13}/page/2`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("Page 2");

    server13.stop?.();
  });

  test("should serve tag pagination routes", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(
        TEST_OUTPUT_DIR,
        "tags",
        "javascript",
        "page",
        "1",
        "index.html",
      ),
      "<html><body>JavaScript Tag Page 1</body></html>",
    );

    const server14 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 14);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 14}/tags/javascript/page/1`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("JavaScript Tag Page 1");

    server14.stop?.();
  });

  test("should serve year archive pagination routes", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "2025", "page", "1", "index.html"),
      "<html><body>Year 2025 Page 1</body></html>",
    );

    const server15 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 15);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 15}/2025/page/1`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("Year 2025 Page 1");

    server15.stop?.();
  });
});

describe("Server File Resolution Tests", () => {
  test("should resolve paths with and without .html extension", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "about.html"),
      "<html><body>About Page</body></html>",
    );

    const server16 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 16);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Request without .html extension
    const response1 = await makeRequest(
      `http://localhost:${TEST_PORT + 16}/about`,
    );
    expect(response1.status).toBe(200);

    const content1 = await response1.text();
    expect(content1).toInclude("About Page");

    // Request with .html extension
    const response2 = await makeRequest(
      `http://localhost:${TEST_PORT + 16}/about.html`,
    );
    expect(response2.status).toBe(200);

    const content2 = await response2.text();
    expect(content2).toInclude("About Page");

    server16.stop?.();
  });

  test("should serve directory index files", async () => {
    const dir = path.join(TEST_OUTPUT_DIR, "docs");
    await fs.promises.mkdir(dir, { recursive: true });
    await createTestFile(
      path.join(dir, "index.html"),
      "<html><body>Documentation</body></html>",
    );

    const server17 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 17);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Request directory path
    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 17}/docs`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("Documentation");

    server17.stop?.();
  });
});

describe("Server Bun.file() Integration Tests", () => {
  test("should use Bun.file() for efficient file serving", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    const largeContent = "x".repeat(10000);
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "large.html"),
      `<html><body>${largeContent}</body></html>`,
    );

    const server18 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 18);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 18}/large.html`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude(largeContent);

    server18.stop?.();
  });

  test("should handle files with special characters in names", async () => {
    await fs.promises.mkdir(TEST_OUTPUT_DIR, { recursive: true });
    await createTestFile(
      path.join(TEST_OUTPUT_DIR, "file-with-dashes.html"),
      "<html><body>File with dashes</body></html>",
    );

    const server19 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 19);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 19}/file-with-dashes.html`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("File with dashes");

    server19.stop?.();
  });

  test("should handle deeply nested paths", async () => {
    const deepPath = path.join(TEST_OUTPUT_DIR, "a", "b", "c", "d", "e", "f");
    await fs.promises.mkdir(deepPath, { recursive: true });
    await createTestFile(
      path.join(deepPath, "index.html"),
      "<html><body>Deep</body></html>",
    );

    const server20 = await startServer(TEST_OUTPUT_DIR, TEST_PORT + 20);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await makeRequest(
      `http://localhost:${TEST_PORT + 20}/a/b/c/d/e/f/`,
    );
    expect(response.status).toBe(200);

    const content = await response.text();
    expect(content).toInclude("Deep");

    server20.stop?.();
  });
});
