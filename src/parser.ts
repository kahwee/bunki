import { Post } from "./types";
import { findFilesByPattern } from "./utils/file-utils";
import { parseMarkdownFile, type ParseError } from "./utils/markdown-utils";

export interface ParseResult {
  posts: Post[];
  errors: ParseError[];
}

export async function parseMarkdownDirectory(
  contentDir: string,
  strictMode: boolean = false,
): Promise<Post[]> {
  try {
    const markdownFiles = await findFilesByPattern("**/*.md", contentDir, true);
    console.log(`Found ${markdownFiles.length} markdown files`);

    const resultsPromises = markdownFiles.map((filePath) =>
      parseMarkdownFile(filePath),
    );
    const results = await Promise.all(resultsPromises);

    // Separate successful posts from errors
    const posts: Post[] = [];
    const errors: ParseError[] = [];

    for (const result of results) {
      if (result.post) {
        posts.push(result.post);
      } else if (result.error) {
        errors.push(result.error);
      }
    }

    // Display error summary if there are errors
    if (errors.length > 0) {
      console.error(`\n⚠️  Found ${errors.length} parsing error(s):\n`);

      // Group errors by type for better readability
      const yamlErrors = errors.filter((e) => e.type === "yaml");
      const missingFieldErrors = errors.filter(
        (e) => e.type === "missing_field",
      );
      const validationErrors = errors.filter((e) => e.type === "validation");
      const otherErrors = errors.filter(
        (e) =>
          e.type !== "yaml" &&
          e.type !== "missing_field" &&
          e.type !== "validation",
      );

      if (yamlErrors.length > 0) {
        console.error(`  YAML Parsing Errors (${yamlErrors.length}):`);
        yamlErrors.slice(0, 5).forEach((e) => {
          console.error(`    ❌ ${e.file}`);
          if (e.suggestion) {
            console.error(`       💡 ${e.suggestion}`);
          }
        });
        if (yamlErrors.length > 5) {
          console.error(`    ... and ${yamlErrors.length - 5} more`);
        }
        console.error("");
      }

      if (missingFieldErrors.length > 0) {
        console.error(
          `  Missing Required Fields (${missingFieldErrors.length}):`,
        );
        missingFieldErrors.slice(0, 5).forEach((e) => {
          console.error(`    ⚠️  ${e.file}: ${e.message}`);
        });
        if (missingFieldErrors.length > 5) {
          console.error(`    ... and ${missingFieldErrors.length - 5} more`);
        }
        console.error("");
      }

      if (validationErrors.length > 0) {
        console.error(`  Validation Errors (${validationErrors.length}):`);
        validationErrors.slice(0, 5).forEach((e) => {
          console.error(`    ⚠️  ${e.file}: ${e.message}`);
          if (e.suggestion) {
            console.error(`       💡 ${e.suggestion}`);
          }
        });
        if (validationErrors.length > 5) {
          console.error(`    ... and ${validationErrors.length - 5} more`);
        }
        console.error("");
      }

      if (otherErrors.length > 0) {
        console.error(`  Other Errors (${otherErrors.length}):`);
        otherErrors.slice(0, 3).forEach((e) => {
          console.error(`    ❌ ${e.file}: ${e.message}`);
        });
        if (otherErrors.length > 3) {
          console.error(`    ... and ${otherErrors.length - 3} more`);
        }
        console.error("");
      }

      console.error(
        `📝 Tip: Fix YAML errors by quoting titles/descriptions with colons`,
      );
      console.error(
        `   Example: title: "My Post: A Guide"  (quotes required for colons)\n`,
      );

      // Always fail on validation errors (business location format)
      if (validationErrors.length > 0) {
        throw new Error(
          `❌ Build failed: ${validationErrors.length} validation error(s) found\n` +
            `   Business locations must have: type, name, address, lat, lng\n` +
            `   Run 'bunki validate' to see all errors`,
        );
      }

      if (strictMode) {
        throw new Error(
          `Build failed: ${errors.length} parsing error(s) found (strictMode enabled)`,
        );
      }
    }

    const sortedPosts = posts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    console.log(`Parsed ${sortedPosts.length} posts`);

    return sortedPosts;
  } catch (error) {
    console.error(`Error parsing markdown directory:`, error);
    throw error;
  }
}
