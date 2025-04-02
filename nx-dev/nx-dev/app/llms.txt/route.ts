import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface DocumentMetadata {
  id: string;
  name: string;
  description: string;
  path: string;
  file: string;
  isExternal: boolean;
  itemList: DocumentMetadata[];
  tags: string[];
}

interface MenuItem {
  id: string;
  name: string;
  path: string;
  isExternal: boolean;
  disableCollapsible: boolean;
  children: MenuItem[];
}

interface MenuSection {
  id: string;
  menu: MenuItem[];
}

// Markdown content for llms.txt - this is the static part
const llmsContent = `# Nx and LLMs

Nx provides excellent support for Large Language Models (LLMs) integration in your development workflow.

## Features

- AI-powered code generation
- Smart dependency analysis
- Automated refactoring suggestions
- Context-aware project scaffolding

## Getting Started

To get started with Nx LLM features, check out our documentation at [nx.dev/ai](https://nx.dev/ai).

## Supported Models

Nx works with various language models including:
- GPT-4
- Claude
- Llama
- And more

## Community

Join our community to learn more about how developers are using Nx with LLMs to supercharge their productivity.

`;

/**
 * Reads all manifest files to create a mapping of paths to descriptions
 */
function loadDocumentDescriptions(): Record<string, string> {
  try {
    const descriptions: Record<string, string> = {};
    const manifestsDir = path.join(
      process.cwd(),
      'public/documentation/generated/manifests'
    );

    // Load primary manifests (nx, extending-nx, ci)
    const manifestFiles = ['nx.json', 'extending-nx.json', 'ci.json'];

    manifestFiles.forEach((file) => {
      try {
        const manifestPath = path.join(manifestsDir, file);
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

          // Each manifest is a dictionary where keys are paths and values are document metadata
          Object.values(manifest).forEach((doc: DocumentMetadata) => {
            if (doc.path && doc.description) {
              descriptions[doc.path] = doc.description;
            }
          });
        }
      } catch (error) {
        console.error(`Error loading manifest file ${file}:`, error);
      }
    });

    return descriptions;
  } catch (error) {
    console.error('Error loading document descriptions:', error);
    return {};
  }
}

/**
 * Generates markdown for a menu item and its children
 */
function generateMenuItemMarkdown(
  item: MenuItem,
  descriptions: Record<string, string>,
  indent: number = 0
): string {
  if (item.isExternal) {
    return '';
  }

  const spacing = ' '.repeat(indent * 2);
  const description = descriptions[item.path] || '';
  const link = item.path.startsWith('http')
    ? `[${item.name}](${item.path})`
    : `[${item.name}](/m${item.path})`;

  // Place description after the link, not inside it
  let markdown = `${spacing}- ${link}${
    description ? ': ' + description : ''
  }\n`;

  if (item.children && item.children.length > 0) {
    item.children.forEach((child) => {
      markdown += generateMenuItemMarkdown(child, descriptions, indent + 1);
    });
  }

  return markdown;
}

/**
 * Generates a sitemap from menu structure with .md extensions and descriptions
 */
async function generateSitemapFromMenus(): Promise<string> {
  try {
    const menusPath = path.join(
      process.cwd(),
      'public/documentation/generated/manifests/menus.json'
    );

    if (!fs.existsSync(menusPath)) {
      throw new Error(`Menus file not found at: ${menusPath}`);
    }

    const menus: MenuSection[] = JSON.parse(fs.readFileSync(menusPath, 'utf8'));
    const descriptions = loadDocumentDescriptions();

    let sitemap = '## Documentation Structure\n\n';

    // Process main sections (nx, extending-nx, ci)
    ['nx', 'extending-nx', 'ci'].forEach((sectionId) => {
      const section = menus.find((m) => m.id === sectionId);
      if (!section) return;

      // Add section header
      sitemap += `- ${
        sectionId === 'nx'
          ? 'Nx'
          : sectionId === 'extending-nx'
          ? 'Extending-nx'
          : sectionId === 'ci'
          ? 'CI'
          : sectionId
      }\n\n`;

      // Process all menu items in the section
      section.menu.forEach((item) => {
        sitemap += generateMenuItemMarkdown(item, descriptions, 1);
      });

      sitemap += '\n';
    });

    return sitemap;
  } catch (error) {
    console.error('Error generating sitemap from menus:', error);
    // Fall back to modifying existing sitemap
    return await generateModifiedSitemap();
  }
}

/**
 * Reads the sitemap markdown file and modifies links adding .md extension
 * and document descriptions
 */
async function generateModifiedSitemap(): Promise<string> {
  try {
    const sitemapPath = path.join(
      process.cwd(),
      'public/documentation/shared/reference/sitemap.md'
    );

    if (!fs.existsSync(sitemapPath)) {
      throw new Error(`Sitemap file not found at: ${sitemapPath}`);
    }

    const originalContent = fs.readFileSync(sitemapPath, 'utf8');
    const descriptions = loadDocumentDescriptions();

    // Transform links from [Name](/path) to [Name](/path.md): Description
    const modifiedContent = originalContent.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (match, linkText, linkUrl) => {
        // Skip external links
        if (linkUrl.startsWith('http')) {
          return match;
        }

        // Add .md extension to the link and place description after the link
        const description = descriptions[linkUrl] || '';
        return `[${linkText}](${linkUrl}.md)${
          description ? ': ' + description : ''
        }`;
      }
    );

    return '## Documentation Structure\n\n' + modifiedContent;
  } catch (error) {
    console.error('Error generating modified sitemap:', error);
    return `## Documentation Structure\n\nError generating sitemap: ${error.message}`;
  }
}

// GET handler for the route
export async function GET(request: Request) {
  try {
    // Always start with the static content
    let fullContent = llmsContent;

    // Then append the sitemap
    let sitemapContent;
    try {
      sitemapContent = await generateSitemapFromMenus();
    } catch (error) {
      sitemapContent = await generateModifiedSitemap();
    }

    fullContent += sitemapContent;

    return new NextResponse(fullContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    return new NextResponse(`Error: ${error.message}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

// We can make this static since the content is generated at build time
export const dynamic = 'force-static';
