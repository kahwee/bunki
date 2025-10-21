import {
  expect,
  test,
  describe,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { loadConfig } from "../../src/config";
import { convertMarkdownToHtml } from "../../src/utils/markdown-utils";
import path from "path";
import fs from "fs";

const TEST_DIR = path.join(import.meta.dir, "security-test");

describe("Config Loading Security Tests", () => {
  beforeAll(async () => {
    await fs.promises.mkdir(TEST_DIR, { recursive: true });

    // Create a legitimate config file
    const legitimateConfig = {
      site: {
        title: "Test Site",
        description: "Test Description",
        url: "https://example.com",
        author: "Test Author",
      },
    };

    await fs.promises.writeFile(
      path.join(TEST_DIR, "legitimate.config.ts"),
      `export default ${JSON.stringify(legitimateConfig, null, 2)};`,
    );

    // Create a malicious config file
    const maliciousConfig = `
      import { exec } from 'child_process';
      exec('echo "MALICIOUS_CODE_EXECUTED" > /tmp/bunki_security_test');
      export default { site: { title: "Hacked" } };
    `;

    await fs.promises.writeFile(
      path.join(TEST_DIR, "malicious.config.ts"),
      maliciousConfig,
    );
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(TEST_DIR, { recursive: true });
      // Clean up any potential malicious files
      try {
        await fs.promises.unlink("/tmp/bunki_security_test");
      } catch {}
    } catch {}
  });

  test("should reject path traversal in config path", async () => {
    const traversalAttempts = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
      "/etc/passwd",
      "C:\\Windows\\System32\\drivers\\etc\\hosts",
      "../../../proc/version",
      "..%2f..%2f..%2fetc%2fpasswd",
      "....//....//....//etc/passwd",
    ];

    for (const attempt of traversalAttempts) {
      await expect(loadConfig(attempt)).rejects.toThrow();
    }
  });

  test("should load legitimate config safely", async () => {
    const configPath = path.join(TEST_DIR, "legitimate.config.ts");
    const config = await loadConfig(configPath);

    expect(config).toBeDefined();
    expect(config.site.title).toBe("Test Site");
  });

  test("should validate config file extensions", async () => {
    // Test with non-config file extensions
    const invalidExtensions = [
      "config.exe",
      "config.sh",
      "config.bat",
      "config.php",
    ];

    for (const ext of invalidExtensions) {
      const invalidPath = path.join(TEST_DIR, `test.${ext}`);
      await expect(loadConfig(invalidPath)).rejects.toThrow();
    }
  });

  test("should handle missing config file gracefully", async () => {
    const nonExistentPath = path.join(TEST_DIR, "nonexistent.config.ts");
    const config = await loadConfig(nonExistentPath);

    // Should return default config, not throw
    expect(config).toBeDefined();
    expect(config.site).toBeDefined();
  });

  test("should prevent config from accessing parent directories", async () => {
    // Test that config loading is restricted to safe directories
    const outsideProjectPath = path.join("/tmp", "outside.config.ts");

    // Create file outside project
    await fs.promises.writeFile(
      outsideProjectPath,
      'export default { site: { title: "Outside" } };',
    );

    try {
      await expect(loadConfig(outsideProjectPath)).rejects.toThrow(
        /within project directory/,
      );
    } finally {
      try {
        await fs.promises.unlink(outsideProjectPath);
      } catch {}
    }
  });
});

describe("Markdown XSS Protection Tests", () => {
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(\'XSS\')">',
    "<iframe src=\"javascript:alert('XSS')\"></iframe>",
    "<object data=\"javascript:alert('XSS')\"></object>",
    "<embed src=\"javascript:alert('XSS')\">",
    '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
    "<style>body{background:url(\"javascript:alert('XSS')\")}</style>",
    "<div onload=\"alert('XSS')\">",
    "<body onload=\"alert('XSS')\">",
    "<svg onload=\"alert('XSS')\">",
    "<details open ontoggle=\"alert('XSS')\">",
    "\"><script>alert('XSS')</script>",
    "javascript:alert('XSS')",
    'vbscript:msgbox("XSS")',
    "<a href=\"javascript:alert('XSS')\">Click me</a>",
    "<form><button formaction=\"javascript:alert('XSS')\">Submit</button></form>",
  ];

  test("should sanitize XSS attempts in markdown", () => {
    for (const payload of xssPayloads) {
      const html = convertMarkdownToHtml(payload);

      // Should not contain dangerous tags or attributes
      expect(html.toLowerCase()).not.toInclude("<script");
      expect(html.toLowerCase()).not.toInclude("javascript:");
      expect(html.toLowerCase()).not.toInclude("vbscript:");
      expect(html.toLowerCase()).not.toInclude("onload=");
      expect(html.toLowerCase()).not.toInclude("onerror=");
      expect(html.toLowerCase()).not.toInclude("ontoggle=");
      expect(html.toLowerCase()).not.toInclude("<object");
      expect(html.toLowerCase()).not.toInclude("<embed");
    }
  });

  test("should preserve safe HTML elements", () => {
    const safeMarkdown = `
# Header
**Bold text**
*Italic text*
[Link](https://example.com)
![Image](https://example.com/image.jpg)
\`code\`
\`\`\`javascript
console.log('safe code');
\`\`\`
    `;

    const html = convertMarkdownToHtml(safeMarkdown);

    expect(html).toInclude("<h1");
    expect(html).toInclude("<strong>");
    expect(html).toInclude("<em>");
    expect(html).toInclude('<a href="https://example.com"');
    expect(html).toInclude("<img");
    expect(html).toInclude("<code>");
    expect(html).toInclude("<pre>");
  });

  test("should handle malicious attributes in allowed tags", () => {
    const maliciousMarkdown = `
<p onclick="alert('XSS')" style="background: url('javascript:alert(1)')">
Malicious paragraph
</p>
<a href="javascript:alert('XSS')" target="_blank">Malicious link</a>
<img src="x" onerror="alert('XSS')" alt="test">
    `;

    const html = convertMarkdownToHtml(maliciousMarkdown);

    expect(html.toLowerCase()).not.toInclude("onclick=");
    expect(html.toLowerCase()).not.toInclude("javascript:");
    expect(html.toLowerCase()).not.toInclude("onerror=");
    expect(html.toLowerCase()).not.toInclude('style="background: url');
  });
});

describe("File Path Validation Tests", () => {
  test("should validate safe file paths", () => {
    const safePaths = [
      "content/post.md",
      "templates/base.njk",
      "images/photo.jpg",
      "public/favicon.ico",
    ];

    // Helper function to validate paths (would be implemented in actual codebase)
    const isPathSafe = (filePath: string, baseDir: string): boolean => {
      const resolvedPath = path.resolve(baseDir, filePath);
      const resolvedBase = path.resolve(baseDir);
      return resolvedPath.startsWith(resolvedBase);
    };

    for (const safePath of safePaths) {
      expect(isPathSafe(safePath, process.cwd())).toBe(true);
    }
  });

  test("should reject dangerous file paths", () => {
    const dangerousPaths = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\hosts",
      "/etc/passwd",
      "C:\\Windows\\System32\\drivers\\etc\\hosts",
      "../.ssh/id_rsa",
      "../../../../proc/version",
      "..%2f..%2f..%2fetc%2fpasswd",
    ];

    const isPathSafe = (filePath: string, baseDir: string): boolean => {
      // Decode percent-encodings to catch encoded traversal
      let decoded = filePath;
      try {
        decoded = decodeURIComponent(filePath);
      } catch {}
      // Reject absolute paths
      if (path.isAbsolute(decoded)) return false;
      // Reject traversal attempts (../, ..\\, ....// style, encoded %2f patterns)
      if (/(^|[\\/])\.\.([\\/]|$)/.test(decoded)) return false;
      if (/\.%2f|%2f\.|%2f%2f/i.test(filePath)) return false;
      if (/\.\.\.\//.test(decoded)) return false; // patterns like ....//
      if (/\.\.%2f/i.test(filePath)) return false; // encoded ..%2f sequences
      // Reject Windows drive letter absolute paths (e.g., C:\Windows) on POSIX
      if (/^[a-zA-Z]:\\/.test(filePath)) return false;
      const resolvedPath = path.resolve(baseDir, decoded);
      const resolvedBase = path.resolve(baseDir);
      if (!resolvedPath.startsWith(resolvedBase)) return false;
      return true;
    };

    for (const dangerousPath of dangerousPaths) {
      expect(isPathSafe(dangerousPath, process.cwd())).toBe(false);
    }
  });
});

describe("Input Validation Tests", () => {
  test("should validate markdown frontmatter", () => {
    const validFrontmatters = [
      { title: "Valid Post", date: "2025-01-01", tags: ["test"] },
      { title: "Another Post", date: "2025-01-01T10:00:00Z", tags: [] },
      { title: "No Tags Post", date: "2025-01-01" },
    ];

    const invalidFrontmatters = [
      { date: "2025-01-01", tags: ["test"] }, // Missing title
      { title: "No Date", tags: ["test"] }, // Missing date
      { title: "Bad Date", date: "invalid-date", tags: ["test"] },
      { title: "Bad Tags", date: "2025-01-01", tags: "not-an-array" },
      { title: "", date: "2025-01-01", tags: ["test"] }, // Empty title
      { title: "   ", date: "2025-01-01", tags: ["test"] }, // Whitespace only title
    ];

    const validateFrontmatter = (data: any): boolean => {
      if (
        !data.title ||
        typeof data.title !== "string" ||
        data.title.trim() === ""
      ) {
        return false;
      }
      if (!data.date || isNaN(Date.parse(data.date))) {
        return false;
      }
      if (data.tags && !Array.isArray(data.tags)) {
        return false;
      }
      return true;
    };

    for (const valid of validFrontmatters) {
      expect(validateFrontmatter(valid)).toBe(true);
    }

    for (const invalid of invalidFrontmatters) {
      expect(validateFrontmatter(invalid)).toBe(false);
    }
  });

  test("should validate file extensions", () => {
    const allowedExtensions = [
      ".md",
      ".markdown",
      ".html",
      ".njk",
      ".css",
      ".js",
      ".json",
    ];
    const dangerousExtensions = [
      ".exe",
      ".bat",
      ".sh",
      ".php",
      ".py",
      ".rb",
      ".pl",
    ];

    const isExtensionSafe = (
      filename: string,
      allowedExts: string[],
    ): boolean => {
      const ext = path.extname(filename).toLowerCase();
      return allowedExts.includes(ext);
    };

    for (const ext of allowedExtensions) {
      expect(isExtensionSafe(`test${ext}`, allowedExtensions)).toBe(true);
    }

    for (const ext of dangerousExtensions) {
      expect(isExtensionSafe(`malicious${ext}`, allowedExtensions)).toBe(false);
    }
  });

  test("should validate URL schemes", () => {
    const safeUrls = [
      "https://example.com",
      "http://example.com",
      "mailto:user@example.com",
      "/relative/path",
      "../relative/path",
      "#anchor",
    ];

    const dangerousUrls = [
      'javascript:alert("XSS")',
      'vbscript:msgbox("XSS")',
      'data:text/html,<script>alert("XSS")</script>',
      "ftp://malicious.com/file.exe",
      "file:///etc/passwd",
    ];

    const isUrlSafe = (url: string): boolean => {
      const safeSchemes = ["http:", "https:", "mailto:", ""];
      try {
        if (
          url.startsWith("/") ||
          url.startsWith("#") ||
          url.startsWith("../")
        ) {
          return true; // Relative URLs are safe
        }
        const parsed = new URL(url);
        return safeSchemes.includes(parsed.protocol);
      } catch {
        return false;
      }
    };

    for (const safe of safeUrls) {
      expect(isUrlSafe(safe)).toBe(true);
    }

    for (const dangerous of dangerousUrls) {
      expect(isUrlSafe(dangerous)).toBe(false);
    }
  });
});

describe("Resource Limits Tests", () => {
  test("should handle large file sizes", () => {
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const largeContent = "x".repeat(maxFileSize + 1);

    const isFileSizeValid = (content: string, maxSize: number): boolean => {
      return Buffer.byteLength(content, "utf8") <= maxSize;
    };

    expect(isFileSizeValid("small content", maxFileSize)).toBe(true);
    expect(isFileSizeValid(largeContent, maxFileSize)).toBe(false);
  });

  test("should handle excessive number of files", () => {
    const maxFiles = 1000;
    const tooManyFiles = Array(maxFiles + 1).fill("file.md");
    const normalFiles = Array(10).fill("file.md");

    const isFileCountValid = (files: string[], maxCount: number): boolean => {
      return files.length <= maxCount;
    };

    expect(isFileCountValid(normalFiles, maxFiles)).toBe(true);
    expect(isFileCountValid(tooManyFiles, maxFiles)).toBe(false);
  });

  test("should validate filename length", () => {
    const maxFilenameLength = 255;
    const longFilename = "x".repeat(maxFilenameLength + 1) + ".md";
    const normalFilename = "normal-post.md";

    const isFilenameLengthValid = (
      filename: string,
      maxLength: number,
    ): boolean => {
      return path.basename(filename).length <= maxLength;
    };

    expect(isFilenameLengthValid(normalFilename, maxFilenameLength)).toBe(true);
    expect(isFilenameLengthValid(longFilename, maxFilenameLength)).toBe(false);
  });
});

describe("Concurrent Access Tests", () => {
  test("should handle concurrent config loading", async () => {
    const configPath = path.join(TEST_DIR, "legitimate.config.ts");

    // Simulate multiple concurrent config loads
    const loadPromises = Array(10)
      .fill(null)
      .map(() => loadConfig(configPath));

    const results = await Promise.allSettled(loadPromises);

    // All should succeed or fail consistently
    const successful = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    // Either all succeed or all fail, no partial state
    expect(successful.length === 10 || failed.length === 10).toBe(true);
  });
});
