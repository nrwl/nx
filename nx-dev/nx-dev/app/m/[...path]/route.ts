import { NextResponse } from 'next/server';
import { nxDocumentationApi } from '../../../lib/nx.api';

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get the document using the document API
    const document = nxDocumentationApi.getDocument(params.path);

    // Return the raw markdown content with proper headers
    return new NextResponse(document.content, {
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
  const reservedPaths = ['/ci', '/nx-api', '/changelog'];

  // Get all document paths and filter out reserved ones
  const documentPaths = nxDocumentationApi
    .getSlugsStaticDocumentPaths()
    .filter(
      (path) => !reservedPaths.some((reserved) => path.startsWith(reserved))
    );

  // Convert paths to segment arrays for Next.js App Router
  return documentPaths.map((path) => ({
    path: path.split('/').filter(Boolean),
  }));
}

// Make this route static at build time for performance
export const dynamic = 'force-static';
