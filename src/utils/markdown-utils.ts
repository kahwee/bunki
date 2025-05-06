import matter from 'gray-matter';
import { Marked, MarkedOptions } from 'marked';
import { markedHighlight } from 'marked-highlight';
import sanitizeHtml from 'sanitize-html';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import { Post } from '../types';
import { readFileAsText, getBaseFilename } from './file-utils';

// Register the languages you need
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);

// Initialize the markdown parser with syntax highlighting
const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang, info) {
      const language = hljs.getLanguage(lang) ? lang : 'json';
      return hljs.highlight(code, { language }).value;
    }
  })
);

// Configure markdown parser options
const markedOptions: MarkedOptions = {
  gfm: true,
  breaks: true,
};

// Set up the options
marked.setOptions(markedOptions);

// Configure markdown parser extensions for links and embedded content
marked.use({
  walkTokens(token) {
    if (token.type === 'link') {
      token.href = token.href || '';
      // Check if the link is external
      const isExternal = token.href && (
        token.href.startsWith('http://') ||
        token.href.startsWith('https://') ||
        token.href.startsWith('//'));

      if (isExternal) {
        // Store this for later processing
        (token as any).isExternalLink = true;
        
        // Handle YouTube links for oEmbed
        if (token.href.includes('youtube.com/watch') || token.href.includes('youtu.be/')) {
          (token as any).isYouTubeLink = true;
        }
      }
    }
  },
  hooks: {
    preprocess(markdown) {
      return markdown;
    },
    postprocess(html) {
      // Transform YouTube links to responsive oembed iframes
      html = html.replace(
        /<a href="(https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)[^"]*)"[^>]*>(.*?)<\/a>/g,
        '<div class="video-container"><iframe src="https://www.youtube.com/embed/$4" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>'
      );
      
      // Replace remaining external links with a target="_blank" rel="noopener noreferrer"
      return html.replace(/<a href="(https?:\/\/|\/\/)([^"]+)"/g,
        '<a href="$1$2" target="_blank" rel="noopener noreferrer"');
    }
  }
});

/**
 * Extracts a short excerpt from the markdown content
 * @param content Markdown content to extract excerpt from
 * @param maxLength Maximum length of the excerpt (default: 200)
 * @returns Plain text excerpt with formatting removed
 */
export function extractExcerpt(content: string, maxLength = 200): string {
  // Remove markdown formatting, headers, and code blocks
  const plainText = content
    .replace(/^#.*$/gm, '') // Remove headers
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with just the text
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // Remove bold/italic formatting
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  // Get the first few characters as the excerpt
  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Find a good breaking point
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return truncated.substring(0, lastSpace) + '...';
}

/**
 * Converts markdown content to HTML with syntax highlighting and sanitization
 * @param markdownContent Raw markdown content
 * @returns Sanitized HTML ready for rendering
 */
export function convertMarkdownToHtml(markdownContent: string): string {
  // Convert markdown to HTML
  const html = marked.parse(markdownContent);

  // Sanitize the HTML to prevent XSS but preserve code syntax highlighting
  return sanitizeHtml(html.toString(), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span', 'iframe', 'div']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title'],
      code: ['class'],
      pre: ['class'],
      span: ['class', 'style'],
      iframe: ['src', 'frameborder', 'allow', 'allowfullscreen', 'loading'],
      div: ['class']
    },
    allowedClasses: {
      code: ['*'],
      pre: ['*'],
      span: ['*'],
      div: ['video-container']
    },
    // Allow highlight.js span elements for code highlighting
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
  });
}

/**
 * Parse a single markdown file into a Post object
 * @param filePath Path to the markdown file
 * @returns Promise that resolves to a Post object, or null if parsing fails
 */
export async function parseMarkdownFile(
  filePath: string
): Promise<Post | null> {
  try {
    // Read the file content as text
    const fileContent = await readFileAsText(filePath);
    
    if (fileContent === null) {
      console.warn(`File not found or couldn't be read: ${filePath}`);
      return null;
    }
    
    const { data, content } = matter(fileContent);

    if (!data.title || !data.date) {
      console.warn(`Skipping ${filePath}: missing required frontmatter (title or date)`);
      return null;
    }

    // Generate the slug from frontmatter or fallback to filename
    let slug = data.slug || getBaseFilename(filePath);

    // Convert markdown to HTML
    const sanitizedHtml = convertMarkdownToHtml(content);

    // Create the post object with date in Pacific Time
    // Ensure we're using PST/PDT timezone for all date operations
    const pacificDate = new Date(new Date(data.date).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    // Get the year based on Pacific time
    const postYear = pacificDate.getFullYear();

    const post: Post = {
      title: data.title,
      date: pacificDate.toISOString(),
      tags: data.tags || [],
      tagSlugs: {}, // Will be populated by the generator
      content,
      slug,
      url: `/${postYear}/${slug}/`,
      excerpt: data.excerpt || extractExcerpt(content),
      html: sanitizedHtml,
    };

    return post;
  } catch (error) {
    console.error(`Error parsing markdown file ${filePath}:`, error);
    return null;
  }
}