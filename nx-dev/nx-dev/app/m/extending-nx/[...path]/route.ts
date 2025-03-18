import { NextResponse } from 'next/server';
import { nxPluginsApi } from '../../../../lib/plugins.api';
import { rewriteMarkdownLinks } from '../../../../lib/markdown-utils';

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get the document using the document API
    const document = nxPluginsApi.getDocument(['extending-nx', ...params.path]);

    // Process the content to rewrite local links with the /m prefix
    const processedContent = rewriteMarkdownLinks(document.content);

    // Return the processed markdown content with proper headers
    return new NextResponse(processedContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'inline; filename="document.md"',
      },
    });
  } catch (error) {
    // Return a markdown 404 message
    return new NextResponse(
      `# Not Found\n\nThe requested document could not be found.`,
      {
        status: 404,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
        },
      }
    );
  }
}

// Define which paths should be statically generated at build time
export function generateStaticParams() {
  // Get all document paths for the extending-nx section
  const documentPaths = nxPluginsApi
    .getSlugsStaticDocumentPaths()
    .map((path) => path.replace(/^\/extending-nx\//, '')); // Remove the /extending-nx/ prefix

  // Convert paths to segment arrays for Next.js App Router
  return documentPaths.map((path) => ({
    path: path.split('/').filter(Boolean),
  }));
}

// Make this route static at build time for performance
export const dynamic = 'force-static';
