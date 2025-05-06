import path from 'path';
import fs from 'fs/promises';
import { DEFAULT_OUTPUT_DIR } from './config';

/**
 * Start a local development server for previewing generated site
 * @param outputDir Output directory containing generated files
 * @param port Port number to run the server on
 */
export function startServer(outputDir: string = DEFAULT_OUTPUT_DIR, port: number = 3000) {
  // Check if output directory exists
  fs.access(outputDir).then(() => {
    console.log(`Starting server for site in ${outputDir}...`);
    
    const server = Bun.serve({
      port,
      async fetch(req) {
        try {
          const url = new URL(req.url);
          let pathname = url.pathname;
          
          // Default to index.html for root path
          if (pathname === '/') {
            pathname = '/index.html';
          }
          
          // Convert paths like /foo/ to /foo/index.html
          if (pathname.endsWith('/')) {
            pathname = pathname + 'index.html';
          }
          
          // Handle pagination patterns
          const homePaginationMatch = pathname.match(/^\/page\/(\d+)\/?$/);
          const tagPaginationMatch = pathname.match(/^\/tags\/([^\/]+)\/page\/(\d+)\/?$/);
          const yearPaginationMatch = pathname.match(/^\/(\d{4})\/page\/(\d+)\/?$/);
          
          let filePath = '';
          
          if (homePaginationMatch) {
            // Home pagination: /page/2/
            const pageNumber = homePaginationMatch[1];
            filePath = path.join(outputDir, 'page', pageNumber, 'index.html');
          } else if (tagPaginationMatch) {
            // Tag pagination: /tags/ai/page/2/
            const tagSlug = tagPaginationMatch[1];
            const pageNumber = tagPaginationMatch[2];
            filePath = path.join(outputDir, 'tags', tagSlug, 'page', pageNumber, 'index.html');
          } else if (yearPaginationMatch) {
            // Year pagination: /2025/page/2/
            const year = yearPaginationMatch[1];
            const pageNumber = yearPaginationMatch[2];
            filePath = path.join(outputDir, year, 'page', pageNumber, 'index.html');
          } else {
            // Try multiple path variations if not direct match
            const directPath = path.join(outputDir, pathname);
            const withoutSlash = path.join(outputDir, pathname + '.html');
            const withHtml = pathname.endsWith('.html') ? directPath : withoutSlash;
            
            // First try exact match
            const bunFileDirect = Bun.file(directPath);
            const bunFileHtml = Bun.file(withHtml);
            
            if (await bunFileDirect.exists()) {
              filePath = directPath;
            } else if (await bunFileHtml.exists()) {
              filePath = withHtml;
            } else {
              // If no direct match, try as /path/index.html
              const indexPath = path.join(outputDir, pathname, 'index.html');
              const bunFileIndex = Bun.file(indexPath);
              
              if (await bunFileIndex.exists()) {
                filePath = indexPath;
              } else {
                console.log(`404 Not Found: ${pathname}`);
                return new Response(`<h1>404 Not Found</h1><p>Could not find ${pathname}</p>`, {
                  status: 404,
                  headers: { 'Content-Type': 'text/html' }
                });
              }
            }
          }
          
          console.log(`Serving file: ${filePath}`);
          
          // Determine content type
          const extname = path.extname(filePath);
          let contentType = 'text/html';
          
          switch (extname) {
            case '.js':
              contentType = 'text/javascript';
              break;
            case '.css':
              contentType = 'text/css';
              break;
            case '.json':
              contentType = 'application/json';
              break;
            case '.png':
              contentType = 'image/png';
              break;
            case '.jpg':
            case '.jpeg':
              contentType = 'image/jpeg';
              break;
            case '.svg':
              contentType = 'image/svg+xml';
              break;
            case '.xml':
              contentType = 'application/xml';
              break;
          }
          
          // Read and serve the file
          try {
            const bunFile = Bun.file(filePath);
            return new Response(bunFile, {
              headers: { 'Content-Type': contentType }
            });
          } catch (err) {
            console.error(`Error reading file ${filePath}:`, err);
            return new Response(`<h1>500 Server Error</h1><p>Error reading file: ${filePath}</p><pre>${err}</pre>`, {
              status: 500,
              headers: { 'Content-Type': 'text/html' }
            });
          }
        } catch (error) {
          console.error('Server error:', error);
          return new Response(`<h1>500 Server Error</h1><pre>${error}</pre>`, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
          });
        }
      },
    });
    
    console.log(`Bunki development server running at http://localhost:${port}/`);
    
  }).catch(error => {
    console.error(`Error: Output directory ${outputDir} does not exist or is not accessible.`);
    console.log('Try running "bunki generate" first to build your site.');
    process.exit(1);
  });
}