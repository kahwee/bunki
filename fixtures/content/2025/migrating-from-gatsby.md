---
title: "Migrating from Gatsby to Bunki"
date: 2025-03-05T14:15:00-07:00
tags: [web-development, gatsby, migration, bun]
excerpt: A sample migration checklist for moving Markdown content and page layouts into Bunki.
---

# Migrating from Gatsby to Bunki

Treat a migration as a small trial first: move a few representative posts, recreate their layout, and compare the generated URLs and HTML. This sample is a checklist, not a promise of a particular speedup.

## Move the content

Copy plain Markdown into `content/`. MDX components need to be converted to Markdown or HTML; Bunki does not render React components.

```markdown
---
title: "Your Post Title"
date: 2025-03-05T14:15:00-07:00
tags: [web-development, migration]
excerpt: "A brief summary."
---

Your post content.
```

Use hyphenated tags and timezone-aware dates. The published URL year comes from the date in Pacific time. Check old URLs against the generated paths and plan redirects with your hosting provider.

## Rebuild the layout

Replace React page templates with Nunjucks. The rendered Markdown is available as `post.html`:

```nunjucks
{% extends "base.njk" %}
{% block content %}
  <h1>{{ post.title }}</h1>
  <div>{{ post.html | safe }}</div>
{% endblock %}
```

Move shared styles and browser JavaScript into your site's assets. Replace GraphQL-dependent page logic with the data Bunki supplies to templates.

## Configure and verify

Start in a new project with `bun init -y`, install Bunki with `bun add bunki`, and run `bunx bunki init` to create starter templates and `bunki.config.ts`. Update the generated configuration with your site's title, description, and public URL.

```bash
bunx bunki validate
bunx bunki generate
bunx bunki serve
```

Review post pages, tag listings, archives, images, feeds, and links before deploying `dist/` to your static host. Refer to the [Bunki reference](https://github.com/kahwee/bunki/blob/main/docs/reference.md) for template data, configuration paths, and validation limits.
