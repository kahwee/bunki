import { Post } from './types';
import { findFilesByPattern } from './utils/file-utils';
import { parseMarkdownFile } from './utils/markdown-utils';

/**
 * Parse all markdown files in the content directory
 * @param contentDir Base content directory path
 * @returns Promise that resolves to an array of Post objects sorted by date (newest first)
 */
export async function parseMarkdownDirectory(
  contentDir: string
): Promise<Post[]> {
  try {
    // Find all markdown files in the content directory
    const markdownFiles = await findFilesByPattern('**/*.md', contentDir, true);
    console.log(`Found ${markdownFiles.length} markdown files`);

    // Parse each markdown file
    const postsPromises = markdownFiles.map(filePath =>
      parseMarkdownFile(filePath)
    );

    const posts = await Promise.all(postsPromises);

    // Filter out any null values (failed parses) and sort by date (newest first)
    return posts
      .filter((post): post is Post => post !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error(`Error parsing markdown directory:`, error);
    return [];
  }
}