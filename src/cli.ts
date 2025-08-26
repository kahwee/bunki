#!/usr/bin/env bun
import { Command } from "commander";
import path from "path";
import {
  createDefaultConfig,
  DEFAULT_CONTENT_DIR,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_TEMPLATES_DIR,
  loadConfig,
} from "./config";
import { startServer } from "./server";
import { SiteGenerator } from "./site-generator";
import {
  getDefaultCSSConfig,
  processCSS,
  watchCSS,
} from "./utils/css-processor";
import { ensureDir } from "./utils/file-utils";
import { DEFAULT_IMAGES_DIR, uploadImages } from "./utils/image-uploader";

const program = new Command();

program
  .name("bunki")
  .description("An opinionated static site generator built with Bun")
  .version("0.2.4");

// Init command - create a new site
program
  .command("init")
  .description("Initialize a new site with default structure")
  .option("-c, --config <file>", "Path to config file", "bunki.config.ts")
  .action(async (options) => {
    try {
      const configPath = path.resolve(options.config);

      // Create config file
      const configCreated = await createDefaultConfig(configPath);

      if (configCreated) {
        // Create directory structure
        console.log("Creating directory structure...");

        // Create content directory
        await ensureDir(DEFAULT_CONTENT_DIR);

        // Create templates directory
        await ensureDir(DEFAULT_TEMPLATES_DIR);
        await ensureDir(path.join(DEFAULT_TEMPLATES_DIR, "styles"));

        // Create public directory
        await ensureDir(path.join(process.cwd(), "public"));

        // Create basic templates
        const templates = {
          "base.njk": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}{{ site.title }}{% endblock %}</title>
  <meta name="description" content="{% block description %}{{ site.description }}{% endblock %}">
  <link rel="stylesheet" href="/css/style.css">
  {% block head %}{% endblock %}
</head>
<body>
  <header>
    <div class="container">
      <h1><a href="/">{{ site.title }}</a></h1>
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/tags/">Tags</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main class="container">
    {% block content %}{% endblock %}
  </main>

  <footer>
    <div class="container">
      <p>&copy; {{ "now" | date("YYYY") }} {{ site.title }}</p>
    </div>
  </footer>
</body>
</html>`,
          "index.njk": `{% extends "base.njk" %}

{% block content %}
  <h1>Latest Posts</h1>

  {% if posts.length > 0 %}
    <div class="posts">
      {% for post in posts %}
        <article class="post-card">
          <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
          <div class="post-meta">
            <time datetime="{{ post.date }}">{{ post.date | date("MMMM D, YYYY") }}</time>
            {% if post.tags.length > 0 %}
              <span class="tags">
                {% for tag in post.tags %}
                  <a href="/tags/{{ post.tagSlugs[tag] }}/">{{ tag }}</a>{% if not loop.last %}, {% endif %}
                {% endfor %}
              </span>
            {% endif %}
          </div>
          <div class="post-excerpt">{{ post.excerpt }}</div>
          <a href="{{ post.url }}" class="read-more">Read more →</a>
        </article>
      {% endfor %}
    </div>

    {% if pagination.totalPages > 1 %}
      <nav class="pagination">
        {% if pagination.hasPrevPage %}
          <a href="{{ pagination.pagePath }}{% if pagination.prevPage > 1 %}page/{{ pagination.prevPage }}/{% endif %}" class="prev">← Previous</a>
        {% endif %}

        {% if pagination.hasNextPage %}
          <a href="{{ pagination.pagePath }}page/{{ pagination.nextPage }}/" class="next">Next →</a>
        {% endif %}

        <span class="page-info">Page {{ pagination.currentPage }} of {{ pagination.totalPages }}</span>
      </nav>
    {% endif %}
  {% else %}
    <p>No posts yet!</p>
  {% endif %}
{% endblock %}`,
          "post.njk": `{% extends "base.njk" %}

{% block title %}{{ post.title }} | {{ site.title }}{% endblock %}
{% block description %}{{ post.excerpt }}{% endblock %}

{% block content %}
  <article class="post">
    <header class="post-header">
      <h1>{{ post.title }}</h1>
      <div class="post-meta">
        <time datetime="{{ post.date }}">{{ post.date | date("MMMM D, YYYY") }}</time>
        {% if post.tags.length > 0 %}
          <span class="tags">
            {% for tag in post.tags %}
              <a href="/tags/{{ post.tagSlugs[tag] }}/">{{ tag }}</a>{% if not loop.last %}, {% endif %}
            {% endfor %}
          </span>
        {% endif %}
      </div>
    </header>

    <div class="post-content">
      {{ post.html | safe }}
    </div>
  </article>
{% endblock %}`,
          "tag.njk": `{% extends "base.njk" %}

{% block title %}{{ tag.name }} | {{ site.title }}{% endblock %}
{% block description %}Posts tagged with {{ tag.name }} on {{ site.title }}{% endblock %}

{% block content %}
  <h1>Posts tagged "{{ tag.name }}"</h1>

  {% if tag.description %}
    <div class="tag-description">{{ tag.description }}</div>
  {% endif %}

  {% if tag.posts.length > 0 %}
    <div class="posts">
      {% for post in tag.posts %}
        <article class="post-card">
          <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
          <div class="post-meta">
            <time datetime="{{ post.date }}">{{ post.date | date("MMMM D, YYYY") }}</time>
          </div>
          <div class="post-excerpt">{{ post.excerpt }}</div>
          <a href="{{ post.url }}" class="read-more">Read more →</a>
        </article>
      {% endfor %}
    </div>

    {% if pagination.totalPages > 1 %}
      <nav class="pagination">
        {% if pagination.hasPrevPage %}
          <a href="{{ pagination.pagePath }}{% if pagination.prevPage > 1 %}page/{{ pagination.prevPage }}/{% endif %}" class="prev">← Previous</a>
        {% endif %}

        {% if pagination.hasNextPage %}
          <a href="{{ pagination.pagePath }}page/{{ pagination.nextPage }}/" class="next">Next →</a>
        {% endif %}

        <span class="page-info">Page {{ pagination.currentPage }} of {{ pagination.totalPages }}</span>
      </nav>
    {% endif %}
  {% else %}
    <p>No posts with this tag yet!</p>
  {% endif %}
{% endblock %}`,
          "tags.njk": `{% extends "base.njk" %}

{% block title %}Tags | {{ site.title }}{% endblock %}
{% block description %}Browse all tags on {{ site.title }}{% endblock %}

{% block content %}
  <h1>All Tags</h1>

  {% if tags.length > 0 %}
    <ul class="tags-list">
      {% for tag in tags %}
        <li>
          <a href="/tags/{{ tag.slug }}/">{{ tag.name }}</a>
          <span class="count">({{ tag.count }})</span>
          {% if tag.description %}
            <p class="description">{{ tag.description }}</p>
          {% endif %}
        </li>
      {% endfor %}
    </ul>
  {% else %}
    <p>No tags found!</p>
  {% endif %}
{% endblock %}`,
          "archive.njk": `{% extends "base.njk" %}

{% block title %}Archive {{ year }} | {{ site.title }}{% endblock %}
{% block description %}Posts from {{ year }} on {{ site.title }}{% endblock %}

{% block content %}
  <h1>Posts from {{ year }}</h1>

  {% if posts.length > 0 %}
    <div class="posts">
      {% for post in posts %}
        <article class="post-card">
          <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
          <div class="post-meta">
            <time datetime="{{ post.date }}">{{ post.date | date("MMMM D, YYYY") }}</time>
            {% if post.tags.length > 0 %}
              <span class="tags">
                {% for tag in post.tags %}
                  <a href="/tags/{{ post.tagSlugs[tag] }}/">{{ tag }}</a>{% if not loop.last %}, {% endif %}
                {% endfor %}
              </span>
            {% endif %}
          </div>
          <div class="post-excerpt">{{ post.excerpt }}</div>
          <a href="{{ post.url }}" class="read-more">Read more →</a>
        </article>
      {% endfor %}
    </div>

    {% if pagination.totalPages > 1 %}
      <nav class="pagination">
        {% if pagination.hasPrevPage %}
          <a href="/{{ year }}/{% if pagination.prevPage > 1 %}page/{{ pagination.prevPage }}/{% endif %}" class="prev">← Previous</a>
        {% endif %}

        {% if pagination.hasNextPage %}
          <a href="/{{ year }}/page/{{ pagination.nextPage }}/" class="next">Next →</a>
        {% endif %}

        <span class="page-info">Page {{ pagination.currentPage }} of {{ pagination.totalPages }}</span>
      </nav>
    {% endif %}
  {% else %}
    <p>No posts from {{ year }}!</p>
  {% endif %}
{% endblock %}`,
        };

        // Create each template file
        for (const [filename, content] of Object.entries(templates)) {
          await Bun.write(path.join(DEFAULT_TEMPLATES_DIR, filename), content);
        }

        // Create a default CSS file
        const defaultCss = `/* Reset & base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f8f9fa;
  padding-bottom: 2rem;
}

a {
  color: #0066cc;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Header */
header {
  background-color: #fff;
  padding: 1.5rem 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

header h1 {
  font-size: 1.8rem;
  margin: 0;
}

header h1 a {
  color: #333;
  text-decoration: none;
}

header nav {
  margin-top: 0.5rem;
}

header nav ul {
  display: flex;
  list-style: none;
  gap: 1.5rem;
}

/* Main content */
main {
  background-color: #fff;
  padding: 2rem;
  border-radius: 5px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Posts */
.posts {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.post-card {
  border-bottom: 1px solid #eee;
  padding-bottom: 1.5rem;
}

.post-card:last-child {
  border-bottom: none;
}

.post-card h2 {
  margin-bottom: 0.5rem;
}

.post-meta {
  font-size: 0.9rem;
  color: #6c757d;
  margin-bottom: 1rem;
}

.post-excerpt {
  margin-bottom: 1rem;
}

.read-more {
  font-weight: 500;
}

/* Single post */
.post-header {
  margin-bottom: 2rem;
}

.post-content {
  line-height: 1.8;
}

.post-content p,
.post-content ul,
.post-content ol,
.post-content blockquote {
  margin-bottom: 1.5rem;
}

.post-content h2,
.post-content h3,
.post-content h4 {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.post-content img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 2rem auto;
}

.post-content pre {
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

.post-content code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9em;
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

.post-content pre code {
  padding: 0;
  background-color: transparent;
}

/* Tags */
.tags a {
  display: inline-block;
  margin-left: 0.5rem;
}

.tags-list {
  list-style: none;
}

.tags-list li {
  margin-bottom: 1rem;
}

.tags-list .count {
  color: #6c757d;
  font-size: 0.9rem;
}

.tags-list .description {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: #6c757d;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.pagination .page-info {
  color: #6c757d;
  font-size: 0.9rem;
}

/* Footer */
footer {
  text-align: center;
  padding: 2rem 0;
  color: #6c757d;
  font-size: 0.9rem;
}`;

        await Bun.write(
          path.join(DEFAULT_TEMPLATES_DIR, "styles", "main.css"),
          defaultCss,
        );

        // Create a sample blog post
        const samplePost = `---
title: Welcome to Bunki
date: ${new Date().toISOString()}
tags: [getting-started, bunki]
---

# Welcome to Your New Bunki Site

This is a sample blog post to help you get started with Bunki. You can edit this file or create new markdown files in the \`content\` directory.

## Features

- Markdown support with frontmatter
- Syntax highlighting for code blocks
- Tag-based organization
- Pagination for post listings
- RSS feed generation
- Sitemap generation

## Adding Content

Create new markdown files in the \`content\` directory with frontmatter like this:

\`\`\`markdown
---
title: Your Post Title
date: 2025-01-01T12:00:00Z
tags: [tag1, tag2]
---

Your post content goes here...
\`\`\`

## Code Highlighting

Bunki supports syntax highlighting for code blocks:

\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\`

## Next Steps

1. Edit the site configuration in \`bunki.config.ts\`
2. Create your own templates in the \`templates\` directory
3. Add more blog posts in the \`content\` directory
4. Run \`bunki generate\` to build your site
5. Run \`bunki serve\` to preview your site locally
`;

        await Bun.write(
          path.join(DEFAULT_CONTENT_DIR, "welcome.md"),
          samplePost,
        );

        console.log("\nInitialization complete! Here are the next steps:");
        console.log("1. Edit bunki.config.ts to configure your site");
        console.log("2. Add markdown files to the content directory");
        console.log('3. Run "bunki generate" to build your site');
        console.log('4. Run "bunki serve" to preview your site locally');
      } else {
        console.log(
          "\nSkipped initialization because the config file already exists",
        );
      }
    } catch (error) {
      console.error("Error initializing site:", error);
      process.exit(1);
    }
  });

// New post command
program
  .command("new")
  .description("Create a new blog post")
  .argument("<title>", "Title of the post")
  .option("-t, --tags <tags>", "Comma-separated list of tags", "")
  .action(async (title, options) => {
    try {
      // Create slug from title
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Format date in ISO format
      const date = new Date().toISOString();

      // Parse tags
      const tags = options.tags
        ? options.tags.split(",").map((tag: string) => tag.trim())
        : [];

      // Create frontmatter
      const frontmatter = `---
title: ${title}
date: ${date}
tags: [${tags.join(", ")}]
---

# ${title}

`;

      // Create file path
      const filePath = path.join(DEFAULT_CONTENT_DIR, `${slug}.md`);

      // Write file
      await Bun.write(filePath, frontmatter);

      console.log(`Created new post: ${filePath}`);
    } catch (error) {
      console.error("Error creating new post:", error);
      process.exit(1);
    }
  });

// Generate command
program
  .command("generate")
  .description("Generate static site from markdown content")
  .option("-c, --config <file>", "Config file path", "bunki.config.ts")
  .option("-d, --content <dir>", "Content directory", DEFAULT_CONTENT_DIR)
  .option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT_DIR)
  .option("-t, --templates <dir>", "Templates directory", DEFAULT_TEMPLATES_DIR)
  .action(async (options) => {
    try {
      const configPath = path.resolve(options.config);
      const contentDir = path.resolve(options.content);
      const outputDir = path.resolve(options.output);
      const templatesDir = path.resolve(options.templates);

      console.log("Generating site with:");
      console.log(`- Config file: ${configPath}`);
      console.log(`- Content directory: ${contentDir}`);
      console.log(`- Output directory: ${outputDir}`);
      console.log(`- Templates directory: ${templatesDir}`);

      // Load configuration
      const config = await loadConfig(configPath);

      const generator = new SiteGenerator({
        contentDir,
        outputDir,
        templatesDir,
        config,
      });

      await generator.initialize();
      await generator.generate();

      console.log("Site generation completed successfully!");
    } catch (error) {
      console.error("Error generating site:", error);
      process.exit(1);
    }
  });

// Serve command
program
  .command("serve")
  .description("Start a local development server")
  .option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT_DIR)
  .option("-p, --port <number>", "Port number", "3000")
  .action(async (options) => {
    try {
      const outputDir = path.resolve(options.output);
      const port = parseInt(options.port, 10);

      await startServer(outputDir, port);
    } catch (error) {
      console.error("Error starting dev server:", error);
      process.exit(1);
    }
  });

// CSS command
program
  .command("css")
  .description("Process CSS using PostCSS")
  .option("-c, --config <file>", "Config file path", "bunki.config.ts")
  .option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT_DIR)
  .option("-w, --watch", "Watch for changes and rebuild")
  .action(async (options) => {
    try {
      const configPath = path.resolve(options.config);
      const outputDir = path.resolve(options.output);

      // Load configuration
      const config = await loadConfig(configPath);
      const cssConfig = config.css || getDefaultCSSConfig();

      if (!cssConfig.enabled) {
        console.log("CSS processing is disabled in configuration");
        return;
      }

      const processorOptions = {
        css: cssConfig,
        projectRoot: process.cwd(),
        outputDir,
        verbose: true,
      };

      if (options.watch) {
        console.log("Starting CSS watch mode...");
        cssConfig.watch = true;

        // Process once initially
        await processCSS(processorOptions);

        // Then watch for changes
        await watchCSS(processorOptions);
      } else {
        await processCSS(processorOptions);
      }
    } catch (error) {
      console.error("Error processing CSS:", error);
      process.exit(1);
    }
  });

// No init-images command needed - the images directory will be created automatically during upload

// Images push command
program
  .command("images:push")
  .description("Upload images to S3-compatible storage")
  .option(
    "-d, --domain <domain>",
    "Domain name for bucket identification (defaults to domain in bunki.config.ts)",
  )
  .option("-i, --images <dir>", "Images directory path", DEFAULT_IMAGES_DIR)
  .option("--output-json <file>", "Output URL mapping to JSON file")
  .action(async (options) => {
    try {
      await uploadImages({
        domain: options.domain,
        images: options.images,
        outputJson: options.outputJson,
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      process.exit(1);
    }
  });

// When called directly (not imported)
// This ensures it works both as ESM import and when executed directly
if (
  import.meta.url === Bun.main ||
  process.argv[1] === import.meta.url.substring(7)
) {
  program.parse(process.argv);
}
