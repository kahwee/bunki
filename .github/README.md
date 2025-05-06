# Bunki

[![MIT License](https://img.shields.io/github/license/kahwee/bunki)](https://github.com/kahwee/bunki/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/kahwee/bunki)](https://github.com/kahwee/bunki/issues)

Bunki is an opinionated static site generator built with Bun. It's designed for creating blogs and simple websites with sensible defaults and minimal configuration.

## Features

- Markdown content with frontmatter
- Syntax highlighting for code blocks
- Tag-based organization
- Year-based archives
- Pagination for post listings
- RSS feed generation
- Sitemap generation
- Local development server
- Simple CLI interface

## Installation

```bash
# Clone the repository
git clone git@github.com:kahwee/bunki.git
cd bunki

# Install dependencies
bun install

# Build the project
bun run build

# Link for local development
bun link
```

## Quick Start

```bash
# Initialize a new site
bunki init

# Create a new post
bunki new "My First Post" --tags "blogging, first-post"

# Generate site
bunki generate

# Start local server
bunki serve
```

## Documentation

For full documentation, see the [README.md](https://github.com/kahwee/bunki/blob/main/README.md) in the repository.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](https://github.com/kahwee/bunki/blob/main/LICENSE)