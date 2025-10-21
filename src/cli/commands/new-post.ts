import { Command } from "commander";
import path from "path";
import { DEFAULT_CONTENT_DIR } from "../../config";

type WriteFileFn = (filePath: string, data: string) => Promise<number>;

interface NewDeps {
  writeFile: WriteFileFn;
  now: () => Date;
  logger: Pick<typeof console, "log" | "error">;
  exit: (code: number) => void;
}

const defaultDeps: NewDeps = {
  writeFile: (filePath, data) => Bun.write(filePath, data),
  now: () => new Date(),
  logger: console,
  exit: (code) => process.exit(code),
};

function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function handleNewCommand(
  title: string,
  options: { tags?: string },
  deps: NewDeps = defaultDeps,
): Promise<string> {
  try {
    const slug = createSlug(title);
    const date = deps.now().toISOString();

    const tags = options.tags
      ? options.tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean)
      : [];

    const frontmatter =
      `---\n` +
      `title: ${title}\n` +
      `date: ${date}\n` +
      `tags: [${tags.join(", ")}]\n` +
      `---\n\n` +
      `# ${title}\n\n`;

    const filePath = path.join(DEFAULT_CONTENT_DIR, `${slug}.md`);

    await deps.writeFile(filePath, frontmatter);
    deps.logger.log(`Created new post: ${filePath}`);
    return filePath;
  } catch (error) {
    deps.logger.error("Error creating new post:", error);
    deps.exit(1);
    return "";
  }
}

export function registerNewCommand(program: Command): Command {
  return program
    .command("new")
    .description("Create a new blog post")
    .argument("<title>", "Title of the post")
    .option("-t, --tags <tags>", "Comma-separated list of tags", "")
    .action(async (title: string, options) => {
      await handleNewCommand(title, options, defaultDeps);
    });
}
