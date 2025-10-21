import { describe, expect, it } from "bun:test";
import path from "path";
import { handleNewCommand } from "../src/cli/commands/new-post";

describe("CLI New Command (handler)", () => {
  it("creates a slugged markdown file with frontmatter and tags", async () => {
    const calls: { filePath?: string; data?: string } = {};
    const fixedDate = new Date("2025-01-01T00:00:00.000Z");

    const deps = {
      writeFile: async (filePath: string, data: string) => {
        calls.filePath = filePath;
        calls.data = data;
        return 0;
      },
      now: () => fixedDate,
      logger: { log: (_: string) => { }, error: (_: string) => { } },
      exit: (_: number) => {
        throw new Error("exit should not be called");
      },
    } as const;

    const title = "Hello, World!";
    const options = { tags: "bun, gatsby ,  " };
    const expectedSlug = "hello-world";

    const resultPath = await handleNewCommand(title, options, deps);

    // Path should resolve to <cwd>/content/<slug>.md
    const expectedPath = path.join(process.cwd(), "content", `${expectedSlug}.md`);
    expect(resultPath).toBe(expectedPath);
    expect(calls.filePath).toBe(expectedPath);

    // Frontmatter content assertions
    expect(calls.data).toContain("---\n");
    expect(calls.data).toContain(`title: ${title}`);
    expect(calls.data).toContain(`date: ${fixedDate.toISOString()}`);
    expect(calls.data).toContain("tags: [bun, gatsby]");
    expect(calls.data).toContain(`# ${title}`);
  });
});
