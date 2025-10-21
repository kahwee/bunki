import { describe, expect, test } from "bun:test";
import path from "path";
import { handleNewCommand } from "../../../src/cli/commands/new-post";

describe("CLI New Command (handler)", () => {
  test("creates a slugged markdown file with frontmatter and tags", async () => {
    const calls: { filePath?: string; data?: string } = {};
    const fixedDate = new Date("2025-01-01T00:00:00.000Z");

    const deps = {
      writeFile: async (filePath: string, data: string) => {
        calls.filePath = filePath;
        calls.data = data;
        return 0;
      },
      now: () => fixedDate,
      logger: { log: (_: string) => {}, error: (_: string) => {} },
      exit: (_: number) => {
        throw new Error("exit should not be called");
      },
    } as const;

    const title = "Hello, World!";
    const options = { tags: "bun, gatsby ,  " };
    const expectedSlug = "hello-world";

    const resultPath = await handleNewCommand(title, options, deps);

    // Path should resolve to <cwd>/content/<slug>.md
    const expectedPath = path.join(
      process.cwd(),
      "content",
      `${expectedSlug}.md`,
    );
    expect(resultPath).toBe(expectedPath);
    expect(calls.filePath).toBe(expectedPath);

    // Frontmatter content assertions
    expect(calls.data).toContain("---\n");
    expect(calls.data).toContain(`title: ${title}`);
    expect(calls.data).toContain(`date: ${fixedDate.toISOString()}`);
    expect(calls.data).toContain("tags: [bun, gatsby]");
    expect(calls.data).toContain(`# ${title}`);
  });

  test("creates post with no tags when not provided", async () => {
    const calls: { filePath?: string; data?: string } = {};
    const fixedDate = new Date("2025-01-01T00:00:00.000Z");

    const deps = {
      writeFile: async (filePath: string, data: string) => {
        calls.filePath = filePath;
        calls.data = data;
        return 0;
      },
      now: () => fixedDate,
      logger: { log: (_: string) => {}, error: (_: string) => {} },
      exit: (_: number) => {
        throw new Error("exit should not be called");
      },
    } as const;

    const title = "My Post";
    const options = { tags: "" };

    await handleNewCommand(title, options, deps);

    expect(calls.data).toContain("tags: []");
  });

  test("creates proper slug from title with special characters", async () => {
    const calls: { filePath?: string; data?: string } = {};

    const deps = {
      writeFile: async (filePath: string, data: string) => {
        calls.filePath = filePath;
        calls.data = data;
        return 0;
      },
      now: () => new Date(),
      logger: { log: (_: string) => {}, error: (_: string) => {} },
      exit: (_: number) => {
        throw new Error("exit should not be called");
      },
    } as const;

    const title = "Hello!!! World@@@ 2025";
    const options = { tags: "" };

    await handleNewCommand(title, options, deps);

    // Should slugify special characters
    expect(calls.filePath).toContain("hello-world-2025");
  });

  test("handles error when writeFile fails", async () => {
    const deps = {
      writeFile: async () => {
        throw new Error("Write failed");
      },
      now: () => new Date(),
      logger: {
        log: (_: string) => {},
        error: (_: string) => {},
      },
      exit: (_: number) => {
        // Should be called with code 1 on error
      },
    } as const;

    let exitCode: number | undefined;
    const testDeps = {
      ...deps,
      exit: (code: number) => {
        exitCode = code;
      },
    };

    const result = await handleNewCommand("Test", { tags: "" }, testDeps);

    expect(exitCode).toBe(1);
    expect(result).toBe("");
  });

  test("logs error when writeFile throws exception", async () => {
    let errorLogged = "";
    const deps = {
      writeFile: async () => {
        throw new Error("Disk full");
      },
      now: () => new Date(),
      logger: {
        log: (_: string) => {},
        error: (msg: string, err: any) => {
          errorLogged = msg;
        },
      },
      exit: (_: number) => {},
    } as const;

    await handleNewCommand("Test", { tags: "" }, deps);

    expect(errorLogged).toInclude("Error creating new post");
  });

  test("logs success message when post created", async () => {
    let loggedMessage = "";
    const deps = {
      writeFile: async (filePath: string) => {
        return 0;
      },
      now: () => new Date(),
      logger: {
        log: (msg: string) => {
          loggedMessage = msg;
        },
        error: (_: string) => {},
      },
      exit: (_: number) => {
        throw new Error("exit should not be called");
      },
    } as const;

    await handleNewCommand("Test", { tags: "" }, deps);

    expect(loggedMessage).toInclude("Created new post");
  });

  test("handles tags with whitespace correctly", async () => {
    const calls: { data?: string } = {};

    const deps = {
      writeFile: async (_: string, data: string) => {
        calls.data = data;
        return 0;
      },
      now: () => new Date(),
      logger: { log: (_: string) => {}, error: (_: string) => {} },
      exit: (_: number) => {
        throw new Error("exit should not be called");
      },
    } as const;

    const options = { tags: "  tag1  ,  tag2  ,  tag3  " };

    await handleNewCommand("Test", options, deps);

    expect(calls.data).toContain("tags: [tag1, tag2, tag3]");
  });
});
