import { green, red } from 'chalk';
import * as shell from 'shelljs';
import * as fs from 'fs';
import * as parseLinks from 'parse-markdown-links';

const BASE_PATH = 'docs';
const FRAMEWORK_SYMBOL = '{{framework}}';
const DIRECT_INTERNAL_LINK_SYMBOL = 'https://nx.dev';

function readFileContents(path: string): string {
  const buffer = fs.readFileSync(path, { encoding: 'utf-8' });
  return buffer.toString();
}

function isLinkInternal(linkPath: string): boolean {
  return linkPath.startsWith('/');
}

function isNotAsset(linkPath: string): boolean {
  return !linkPath.startsWith('/assets');
}

function isNotImage(linkPath: string): boolean {
  return !linkPath.endsWith('.png');
}

function removeAnchors(linkPath: string): string {
  return linkPath.split('#')[0];
}

function expandFrameworks(linkPaths: string[]): string[] {
  return linkPaths.reduce((acc, link) => {
    if (link.includes(FRAMEWORK_SYMBOL)) {
      acc.push(link.replace(FRAMEWORK_SYMBOL, 'angular'));
      acc.push(link.replace(FRAMEWORK_SYMBOL, 'react'));
      acc.push(link.replace(FRAMEWORK_SYMBOL, 'node'));
    } else {
      acc.push(link);
    }
    return acc;
  }, []);
}

function extractAllInternalLinks(): Record<string, string[]> {
  return shell.ls(`${BASE_PATH}/**/*.md`).reduce((acc, path) => {
    const fileContents = readFileContents(path);
    const directLinks = fileContents
      .split(/[ ,]+/)
      .filter((word) => word.startsWith(DIRECT_INTERNAL_LINK_SYMBOL))
      .map((word) => word.replace(DIRECT_INTERNAL_LINK_SYMBOL, ''))
      .filter((x) => !!x);
    const links = parseLinks(fileContents)
      .concat(directLinks)
      .filter(isLinkInternal)
      .filter(isNotAsset)
      .filter(isNotImage)
      .map(removeAnchors);
    if (links.length) {
      acc[path] = expandFrameworks(links);
    }
    return acc;
  }, {});
}

interface DocumentTreeFileNode {
  name: string;
  id: string;
  file?: string;
}

interface DocumentTreeCategoryNode {
  name?: string;
  id: string;
  itemList: DocumentTree[];
}

type DocumentTree = DocumentTreeFileNode | DocumentTreeCategoryNode;

function isCategoryNode(
  documentTree: DocumentTree
): documentTree is DocumentTreeCategoryNode {
  return !!(documentTree as DocumentTreeCategoryNode).itemList;
}

function getDocumentMap(): DocumentTree[] {
  return JSON.parse(
    fs.readFileSync(`${BASE_PATH}/map.json`, { encoding: 'utf-8' })
  ) as DocumentTree[];
}

function buildMapOfExisitingDocumentPaths(
  tree: DocumentTree[],
  map: Record<string, boolean> = {},
  ids: string[] = []
): Record<string, boolean> {
  return tree.reduce((acc, treeNode) => {
    if (isCategoryNode(treeNode)) {
      buildMapOfExisitingDocumentPaths(treeNode.itemList, acc, [
        ...ids,
        treeNode.id,
      ]);
    } else {
      acc[/*treeNode.file ||*/ `${ids.join('/')}/${treeNode.id}`] = true;
    }
    return acc;
  }, map);
}

function determineErroneousInternalLinks(
  internalLinks: Record<string, string[]>,
  validInternalLinksMap: Record<string, boolean>
): Record<string, string[]> | undefined {
  let erroneousInternalLinks: Record<string, string[]> | undefined;
  for (const [docPath, links] of Object.entries(internalLinks)) {
    const erroneousLinks = links.filter(
      (link) => !validInternalLinksMap[`${link.slice(1)}`]
    );
    if (erroneousLinks.length) {
      if (!erroneousInternalLinks) {
        erroneousInternalLinks = {};
      }
      erroneousInternalLinks[docPath] = erroneousLinks;
    }
  }
  return erroneousInternalLinks;
}

const validInternalLinksMap = buildMapOfExisitingDocumentPaths(
  getDocumentMap()
);

const internalLinks = extractAllInternalLinks();

const erroneousInternalLinks = determineErroneousInternalLinks(
  internalLinks,
  validInternalLinksMap
);

if (!erroneousInternalLinks) {
  console.log(green('All internal links appear to be valid!!'));
  process.exit(0);
} else {
  console.log(
    red(
      'The following files appear to contain the following invalid internal links:'
    )
  );
  console.log(red(JSON.stringify(erroneousInternalLinks, null, 2)));
  process.exit(1);
}
