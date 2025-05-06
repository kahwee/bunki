import { Post } from "./types";
import { findFilesByPattern } from "./utils/file-utils";
import { parseMarkdownFile } from "./utils/markdown-utils";

export async function parseMarkdownDirectory(
  contentDir: string,
): Promise<Post[]> {
  try {
    const markdownFiles = await findFilesByPattern("**/*.md", contentDir, true);
    console.log(`Found ${markdownFiles.length} markdown files`);

    const postsPromises = markdownFiles.map((filePath) =>
      parseMarkdownFile(filePath),
    );
    const posts = await Promise.all(postsPromises);

    return posts
      .filter((post): post is Post => post !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error(`Error parsing markdown directory:`, error);
    return [];
  }
}
