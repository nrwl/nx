import { NextResponse } from 'next/server';
import { nxPackagesApi } from '../../../../../../lib/packages.api';
import { tagsApi } from '../../../../../../lib/tags.api';
import { rewriteMarkdownLinks } from '../../../../../../lib/markdown-utils';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(
  request: Request,
  { params }: { params: { name: string; path: string[] } }
) {
  try {
    // Get the package documents and file path
    const packageDocuments = nxPackagesApi.getPackageDocuments(params.name);
    const segments = ['nx-api', params.name, 'documents', ...params.path];
    const docPath = '/' + segments.join('/');

    // Find the document in the package documents
    const documentMeta = packageDocuments[docPath];

    if (!documentMeta) {
      throw new Error(`Document not found: ${docPath}`);
    }

    // Read the file content
    const filePath = join('public/documentation', `${documentMeta.file}.md`);
    const content = readFileSync(filePath, 'utf8');

    // Process the content to rewrite local links with the /m prefix
    const processedContent = rewriteMarkdownLinks(content);

    // Return the processed markdown content with proper headers
    return new NextResponse(processedContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'inline; filename="document.md"',
      },
    });
  } catch (error) {
    console.error('Error serving nx-api document:', error);
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
  // For simplicity, we don't pre-generate these - they'll be generated on-demand
  return [];
}

// Make this route dynamic for on-demand generation
export const dynamic = 'force-dynamic';
