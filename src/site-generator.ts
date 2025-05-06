import path from 'path';
import nunjucks from 'nunjucks';
import slugify from 'slugify';
import { Glob } from 'bun';
import { GeneratorOptions, PaginationData, Post, SiteConfig, TagData, Site } from './types';
import { parseMarkdownDirectory } from './parser';
import { ensureDir, copyFile } from './utils/file-utils';

export class SiteGenerator {
  private options: GeneratorOptions;
  private site: Site;
  
  /**
   * Helper function to format a date for RSS
   * @param date Date string
   * @returns Formatted date string for RSS feed
   */
  private formatRSSDate(date: string): string {
    const pacificDate = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return pacificDate.toUTCString();
  }
  
  /**
   * Helper function to get date in Pacific Time
   * @param date Date string or Date object
   * @returns Date object in Pacific Time
   */
  private getPacificDate(date: string | Date): Date {
    return new Date(new Date(date).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  }
  
  /**
   * Helper function to create pagination data
   * @param items Array of items to paginate
   * @param currentPage Current page number
   * @param pageSize Number of items per page
   * @param pagePath Base path for pagination URLs
   * @returns PaginationData object
   */
  private createPagination(items: any[], currentPage: number, pageSize: number, pagePath: string): PaginationData {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    return {
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      pageSize,
      totalItems,
      pagePath
    };
  }
  
  /**
   * Constructor for SiteGenerator
   * @param options Options for site generation
   */
  constructor(options: GeneratorOptions) {
    this.options = options;
    this.site = {
      name: options.config.domain,
      posts: [],
      tags: {}
    };
    
    // Configure nunjucks
    const env = nunjucks.configure(this.options.templatesDir, {
      autoescape: true,
      watch: false
    });
    
    // Add custom filters
    env.addFilter('date', function(date, format) {
      // Convert to Pacific Time
      const pstDate = new Date(date).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      const d = new Date(pstDate);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      
      if (format === 'YYYY') {
        return d.getFullYear();
      } else if (format === 'MMMM D, YYYY') {
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      } else if (format === 'MMMM D, YYYY h:mm A') {
        // Get hours in 12-hour format
        const hours = d.getHours() % 12 || 12;
        const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} @ ${hours} ${ampm}`;
      } else {
        return d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
      }
    });
  }
  
  /**
   * Initialize the site generator, load all content
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    console.log('Initializing site generator...');
    
    // Create the output directory
    await ensureDir(this.options.outputDir);
    
    // Load tag descriptions if available
    let tagDescriptions: Record<string, string> = {};
    const tagsTomlPath = path.join(process.cwd(), 'src', 'tags.toml');
    
    // Use Bun.file to check if the path exists
    const tagsTomlFile = Bun.file(tagsTomlPath);
    if (await tagsTomlFile.exists()) {
      try {
        // Import TOML file directly using Bun's built-in support
        tagDescriptions = require(tagsTomlPath);
        console.log('Loaded tag descriptions from tags.toml');
      } catch (error) {
        console.warn('Error loading tag descriptions:', error);
      }
    }
    
    // Parse all markdown files
    const posts = await parseMarkdownDirectory(this.options.contentDir);
    console.log(`Parsed ${posts.length} posts`);
    
    // Generate tag data
    const tags: Record<string, TagData> = {};
    
    // Process tags
    posts.forEach(post => {
      // Initialize tagSlugs map for each post
      post.tagSlugs = {};
      
      post.tags.forEach(tagName => {
        // Create the slug for this tag
        const tagSlug = slugify(tagName, { lower: true, strict: true });
        
        // Store the mapping in the post
        post.tagSlugs[tagName] = tagSlug;
        
        if (!tags[tagName]) {
          const tagData: TagData = {
            name: tagName,
            slug: tagSlug,
            count: 0,
            posts: []
          };
          
          // Add description if available
          if (tagDescriptions[tagName.toLowerCase()]) {
            tagData.description = tagDescriptions[tagName.toLowerCase()];
          }
          
          tags[tagName] = tagData;
        }
        
        tags[tagName].count += 1;
        tags[tagName].posts.push(post);
      });
    });
    
    // Store site data
    this.site = {
      name: this.options.config.domain,
      posts,
      tags
    };
  }
  
  /**
   * Generate all static files for the site
   * @returns Promise that resolves when generation is complete
   */
  async generate(): Promise<void> {
    console.log('Generating static site...');
    
    // Ensure output directory exists
    await ensureDir(this.options.outputDir);
    
    // Generate stylesheet
    await this.generateStylesheet();
    
    // Generate index page
    await this.generateIndexPage();
    
    // Generate individual post pages
    await this.generatePostPages();
    
    // Generate tag pages
    await this.generateTagPages();
    
    // Generate year-based archive pages
    await this.generateYearArchives();
    
    // Generate RSS feed
    await this.generateRSSFeed();
    
    // Generate sitemap
    await this.generateSitemap();
    
    // Copy static assets
    await this.copyStaticAssets();
    
    console.log('Site generation complete!');
  }
  
  /**
   * Generate year-based archive pages with pagination
   * @returns Promise that resolves when archive pages are generated
   */
  private async generateYearArchives(): Promise<void> {
    // Group posts by year
    const postsByYear: Record<string, Post[]> = {};
    
    for (const post of this.site.posts) {
      const postDate = new Date(post.date);
      const year = postDate.getFullYear().toString();
      
      if (!postsByYear[year]) {
        postsByYear[year] = [];
      }
      
      postsByYear[year].push(post);
    }
    
    // Generate archive pages for each year
    for (const [year, yearPosts] of Object.entries(postsByYear)) {
      const yearDir = path.join(this.options.outputDir, year);
      
      // Create year directory
      await ensureDir(yearDir);
      
      const pageSize = 10; // Number of posts per page
      const totalPages = Math.ceil(yearPosts.length / pageSize);
      
      // Generate each page for this year
      for (let page = 1; page <= totalPages; page++) {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedPosts = yearPosts.slice(startIndex, endIndex);
        
        // Create pagination data
        const pagination = this.createPagination(
          yearPosts,
          page,
          pageSize,
          `/${year}/` // Base path for year pagination
        );
        
        // Render the page
        const yearPageHtml = nunjucks.render('archive.njk', {
          site: this.options.config,
          posts: paginatedPosts,
          tags: Object.values(this.site.tags),
          year: year,
          pagination
        });
        
        if (page === 1) {
          // First page is the index
          await Bun.write(path.join(yearDir, 'index.html'), yearPageHtml);
        } else {
          // Create page directory
          const pageDir = path.join(yearDir, 'page', page.toString());
          
          // Ensure page directory exists
          await ensureDir(pageDir);
          
          await Bun.write(path.join(pageDir, 'index.html'), yearPageHtml);
        }
      }
    }
  }
  
  /**
   * Generate the index page with pagination
   * @returns Promise that resolves when index pages are generated
   */
  private async generateIndexPage(): Promise<void> {
    const pageSize = 10; // Number of posts per page
    const totalPages = Math.ceil(this.site.posts.length / pageSize);
    
    // Generate each page
    for (let page = 1; page <= totalPages; page++) {
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedPosts = this.site.posts.slice(startIndex, endIndex);
      
      // Create pagination data
      const pagination = this.createPagination(
        this.site.posts, 
        page,
        pageSize,
        '/' // Base path for homepage pagination
      );
      
      // Render the page
      const pageHtml = nunjucks.render('index.njk', {
        site: this.options.config,
        posts: paginatedPosts,
        tags: Object.values(this.site.tags),
        pagination
      });
      
      if (page === 1) {
        // First page is the index
        await Bun.write(path.join(this.options.outputDir, 'index.html'), pageHtml);
      } else {
        // Create page directory
        const pageDir = path.join(this.options.outputDir, 'page', page.toString());
        await ensureDir(pageDir);
        
        // Write the page
        await Bun.write(path.join(pageDir, 'index.html'), pageHtml);
      }
    }
  }
  
  /**
   * Generate pages for each individual post
   * @returns Promise that resolves when post pages are generated
   */
  private async generatePostPages(): Promise<void> {
    for (const post of this.site.posts) {
      // Extract post path from url, removing leading slash
      const postPath = post.url.substring(1);
      const postDir = path.join(this.options.outputDir, postPath);
      
      // Ensure directory exists
      await ensureDir(postDir);
      
      const postHtml = nunjucks.render('post.njk', {
        site: this.options.config,
        post,
        tags: Object.values(this.site.tags)
      });
      
      await Bun.write(path.join(postDir, 'index.html'), postHtml);
    }
  }
  
  /**
   * Generate pages for each tag with pagination
   * @returns Promise that resolves when tag pages are generated
   */
  private async generateTagPages(): Promise<void> {
    const tagsDir = path.join(this.options.outputDir, 'tags');
    
    // Create tags directory
    await ensureDir(tagsDir);
    
    // Generate tag index page
    const tagIndexHtml = nunjucks.render('tags.njk', {
      site: this.options.config,
      tags: Object.values(this.site.tags)
    });
    
    await Bun.write(path.join(tagsDir, 'index.html'), tagIndexHtml);
    
    // Generate individual tag pages with pagination
    for (const [tagName, tagData] of Object.entries(this.site.tags)) {
      const tagDir = path.join(tagsDir, tagData.slug);
      
      // Create tag directory
      await ensureDir(tagDir);
      
      const pageSize = 10; // Number of posts per page
      const totalPages = Math.ceil(tagData.posts.length / pageSize);
      
      // Generate each page for this tag
      for (let page = 1; page <= totalPages; page++) {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedPosts = tagData.posts.slice(startIndex, endIndex);
        
        // Create a copy of the tag data with paginated posts
        const paginatedTagData = {
          ...tagData,
          posts: paginatedPosts
        };
        
        // Create pagination data
        const pagination = this.createPagination(
          tagData.posts,
          page,
          pageSize,
          `/tags/${tagData.slug}/` // Base path for tag pagination
        );
        
        // Render the page
        const tagPageHtml = nunjucks.render('tag.njk', {
          site: this.options.config,
          tag: paginatedTagData,
          tags: Object.values(this.site.tags),
          pagination
        });
        
        if (page === 1) {
          // First page is the index
          await Bun.write(path.join(tagDir, 'index.html'), tagPageHtml);
        } else {
          // Create page directory
          const pageDir = path.join(tagDir, 'page', page.toString());
          
          // Ensure page directory exists
          await ensureDir(pageDir);
          
          await Bun.write(path.join(pageDir, 'index.html'), tagPageHtml);
        }
      }
    }
  }
  
  /**
   * Generate CSS using Bun's built-in CSS tools
   * @returns Promise that resolves when stylesheet is generated
   */
  private async generateStylesheet(): Promise<void> {
    const cssFilePath = path.join(this.options.templatesDir, 'styles', 'main.css');
    
    // Check if CSS file exists using Bun.file
    const cssFile = Bun.file(cssFilePath);
    if (!(await cssFile.exists())) {
      console.warn('CSS file not found, skipping stylesheet generation.');
      return;
    }
    
    try {
      // Read CSS content using Bun.file
      const cssContent = await cssFile.text();
      
      // Ensure CSS directory exists
      const cssDir = path.join(this.options.outputDir, 'css');
      await ensureDir(cssDir);
      
      // Write CSS file
      await Bun.write(path.join(cssDir, 'style.css'), cssContent);
    } catch (error) {
      console.error('Error generating stylesheet:', error);
    }
  }
  
  /**
   * Copy static assets to the output directory using Bun's Glob
   * @returns Promise that resolves when assets are copied
   */
  private async copyStaticAssets(): Promise<void> {
    const assetsDir = path.join(this.options.templatesDir, 'assets');
    const publicDir = path.join(process.cwd(), 'public');
    
    // Copy template assets if available
    const assetsDirFile = Bun.file(assetsDir);
    if (await assetsDirFile.exists()) {
      const assetGlob = new Glob("**/*.*");
      const assetsOutputDir = path.join(this.options.outputDir, 'assets');
      
      // Ensure assets directory exists
      await ensureDir(assetsOutputDir);
      
      for await (const file of assetGlob.scan({ cwd: assetsDir, absolute: true })) {
        const relativePath = path.relative(assetsDir, file);
        const targetPath = path.join(assetsOutputDir, relativePath);
        
        // Ensure target directory exists
        const targetDir = path.dirname(targetPath);
        await ensureDir(targetDir);
        
        // Copy the file using Bun.file
        await copyFile(file, targetPath);
      }
    }
    
    // Copy public directory files (favicons, etc.) if available
    const publicDirFile = Bun.file(publicDir);
    if (await publicDirFile.exists()) {
      const publicGlob = new Glob("**/*.*");
      
      for await (const file of publicGlob.scan({ cwd: publicDir, absolute: true })) {
        const relativePath = path.relative(publicDir, file);
        const targetPath = path.join(this.options.outputDir, relativePath);
        
        // Ensure target directory exists
        const targetDir = path.dirname(targetPath);
        await ensureDir(targetDir);
        
        // Only copy if the file doesn't exist
        const targetFile = Bun.file(targetPath);
        if (!(await targetFile.exists())) {
          await copyFile(file, targetPath);
        }
      }
      console.log('Copied public files to site');
    }
  }
  
  /**
   * Generate RSS feed
   * @returns Promise that resolves when RSS feed is generated
   */
  private async generateRSSFeed(): Promise<void> {
    const posts = this.site.posts.slice(0, 15); // Get the most recent 15 posts
    const config = this.options.config;
    
    const rssItems = posts.map(post => {
      const postUrl = `${config.baseUrl}${post.url}`;
      const pubDate = this.formatRSSDate(post.date);
      
      return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid>${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
    </item>`;
    }).join('\n');
    
    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${config.title}]]></title>
    <description><![CDATA[${config.description}]]></description>
    <link>${config.baseUrl}</link>
    <atom:link href="${config.baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${this.formatRSSDate(this.getPacificDate(new Date()).toISOString())}</lastBuildDate>
${rssItems}
  </channel>
</rss>`;
    
    // Write RSS feed using Bun.write
    await Bun.write(path.join(this.options.outputDir, 'feed.xml'), rssContent);
  }

  /**
   * Generate sitemap.xml
   * @returns Promise that resolves when sitemap is generated
   */
  private async generateSitemap(): Promise<void> {
    // Format current date for lastmod, using Pacific Time
    const currentDate = this.getPacificDate(new Date()).toISOString();
    const pageSize = 10; // Must match the pagination page size
    const config = this.options.config;
    
    // Start with the sitemap header
    let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Add the homepage (page 1)
    sitemapContent += `  <url>
    <loc>${config.baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
`;

    // Add pagination pages for homepage
    const totalHomePages = Math.ceil(this.site.posts.length / pageSize);
    if (totalHomePages > 1) {
      for (let page = 2; page <= totalHomePages; page++) {
        sitemapContent += `  <url>
    <loc>${config.baseUrl}/page/${page}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;
      }
    }

    // Add all posts
    for (const post of this.site.posts) {
      const postUrl = `${config.baseUrl}${post.url}`;
      const postDate = new Date(post.date).toISOString();
      
      sitemapContent += `  <url>
    <loc>${postUrl}</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    // Add the tags index page
    sitemapContent += `  <url>
    <loc>${config.baseUrl}/tags/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;

    // Add individual tag pages with pagination
    for (const [, tagData] of Object.entries(this.site.tags)) {
      // Add first page of tag
      const tagUrl = `${config.baseUrl}/tags/${tagData.slug}/`;
      
      sitemapContent += `  <url>
    <loc>${tagUrl}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
`;

      // Add pagination pages for this tag
      const totalTagPages = Math.ceil(tagData.posts.length / pageSize);
      if (totalTagPages > 1) {
        for (let page = 2; page <= totalTagPages; page++) {
          sitemapContent += `  <url>
    <loc>${config.baseUrl}/tags/${tagData.slug}/page/${page}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
`;
        }
      }
    }
    
    // Add year archives with pagination
    const postsByYear: Record<string, Post[]> = {};
    for (const post of this.site.posts) {
      const postDate = new Date(post.date);
      const year = postDate.getFullYear().toString();
      
      if (!postsByYear[year]) {
        postsByYear[year] = [];
      }
      
      postsByYear[year].push(post);
    }
    
    for (const [year, yearPosts] of Object.entries(postsByYear)) {
      // Add first page of year archive
      sitemapContent += `  <url>
    <loc>${config.baseUrl}/${year}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;

      // Add pagination pages for this year
      const totalYearPages = Math.ceil(yearPosts.length / pageSize);
      if (totalYearPages > 1) {
        for (let page = 2; page <= totalYearPages; page++) {
          sitemapContent += `  <url>
    <loc>${config.baseUrl}/${year}/page/${page}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
        }
      }
    }

    // Close the sitemap
    sitemapContent += `</urlset>`;
    
    // Write sitemap using Bun.write
    await Bun.write(path.join(this.options.outputDir, 'sitemap.xml'), sitemapContent);
    console.log('Generated sitemap.xml');
  }
}