---
title: "Migrating from Gatsby to Bunki"
date: 2025-03-05T14:15:00-07:00
tags: [web-development, gatsby, migration, bun]
excerpt: A comprehensive guide to migrating your blog or static site from Gatsby to Bunki. Learn about the key differences, migration strategies, and performance benefits you can expect when moving to this Bun-powered static site generator.
---

# Migrating from Gatsby to Bunki

If you're considering migrating from [Gatsby](https://www.gatsbyjs.com/) to [Bunki](/tags/web-development/), this guide will walk you through the process step by step. While Gatsby is a powerful React-based framework, its build times can become problematic as your site grows. Bunki offers a lightweight, high-performance alternative with a focus on blogs and simple websites.

## Why Migrate?

Before diving into the migration process, let's consider why you might want to switch:

- **Build Performance**: Bunki typically builds sites 5-10x faster than Gatsby
- **Simplicity**: Bunki has a more straightforward mental model without GraphQL
- **Lower Resource Usage**: Smaller memory footprint and dependencies
- **Bun-Powered**: Takes advantage of Bun's speed and modern JavaScript features

However, migration might not be for everyone. If you heavily rely on Gatsby's plugin ecosystem or need React for interactive components, you might want to stay with Gatsby.

## Content Migration

The first step is to migrate your content:

1. **Markdown Files**: If you're already using MDX or markdown in Gatsby, this is straightforward. Copy your markdown files to Bunki's `content` directory.

2. **Frontmatter Adjustment**: Update your frontmatter to match Bunki's expected format:

   ```markdown
   ---
   title: "Your Post Title"
   date: 2025-03-05T14:15:00-07:00
   tags: [tag1, tag2]
   excerpt: A brief summary of your post.
   ---
   ```

3. **Image Paths**: Update image paths in your markdown to use Bunki's asset structure.

## Template Migration

Next, you'll need to migrate your templates:

1. **From React to Nunjucks**: Bunki uses Nunjucks for templating. Here's a comparison:

   **Gatsby (React):**

   ```jsx
   const PostTemplate = ({ data }) => (
     <Layout>
       <h1>{data.markdownRemark.frontmatter.title}</h1>
       <div dangerouslySetInnerHTML={{ __html: data.markdownRemark.html }} />
     </Layout>
   );
   ```

   **Bunki (Nunjucks):**

   ```html
   {% extends "base.njk" %} {% block content %}
   <h1>{{ post.title }}</h1>
   <div>{{ post.html | safe }}</div>
   {% endblock %}
   ```

2. **Base Templates**: Create a base template (`base.njk`) with your site layout.

3. **Special Templates**: Create templates for index, post, tag, and archive pages.

## Configuration Setup

1. Create a `bunki.config.json` file:

   ```json
   {
     "title": "Your Site Title",
     "description": "Your site description",
     "baseUrl": "https://yourdomain.com",
     "domain": "yourdomain.com"
   }
   ```

2. Set up your directory structure:

   ```
   .
   ├── bunki.config.json
   ├── content/
   │   └── posts/
   ├── templates/
   │   ├── base.njk
   │   ├── index.njk
   │   ├── post.njk
   │   └── tag.njk
   └── public/
       └── favicon.ico
   ```

## Building and Deploying

Once your content and templates are migrated:

1. Install Bunki:

   ```bash
   bun install bunki
   ```

2. Build your site:

   ```bash
   bunki generate
   ```

3. Preview locally:

   ```bash
   bunki serve
   ```

4. Deploy to your hosting provider:
   ```bash
   # For Cloudflare Pages
   bunx wrangler pages deploy dist --project-name your-project
   ```

## Common Challenges

Some common challenges when migrating include:

1. **Dynamic Components**: Since Bunki generates static HTML without React, you'll need to add client-side JavaScript if needed.

2. **GraphQL Queries**: Replace these with Bunki's direct data model.

3. **Plugins**: Find alternatives for Gatsby plugins you're using.

## Conclusion

Migrating from Gatsby to Bunki might require some effort, but the performance improvements are often worth it, especially for content-focused sites. Start with a small test migration to see if Bunki meets your needs!
