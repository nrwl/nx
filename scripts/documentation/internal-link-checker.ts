import * as chalk from 'chalk';
import { readFileSync } from 'fs';
import { readJsonSync } from 'fs-extra';
import * as parseLinks from 'parse-markdown-links';
import * as glob from 'glob';
import { join } from 'path';

console.log(`${chalk.blue('i')} Internal Link Check`);

const LOGGING_KEYS = [
  'LOG_DOC_TREE',
  'LOG_ANCHORED_LINKS',
  'LOG_INTERNAL_LINKS',
] as const;
type LoggingKey = typeof LOGGING_KEYS[number];

function replaceAll(
  target: string,
  toReplace: string,
  toReplaceWith: string
): string {
  let temp = target;
  while (temp.includes(toReplace)) {
    temp = temp.replace(toReplace, toReplaceWith);
  }
  return temp;
}

function log(environmentVariableName: LoggingKey, toLog: any) {
  if (process.env[environmentVariableName]) {
    console.log(toLog);
  }
}

const BASE_PATH = 'docs';
const DIRECT_INTERNAL_LINK_SYMBOL = 'https://nx.dev';

function readFileContents(path: string): string {
  return readFileSync(path, 'utf-8');
}

function isLinkInternal(linkPath: string): boolean {
  return linkPath.startsWith('/');
}

function isNotAsset(linkPath: string): boolean {
  return !linkPath.startsWith('/assets');
}

function isNotImage(linkPath: string): boolean {
  return !linkPath.endsWith('.png') && !linkPath.endsWith('.gif');
}

function isNotNxCommunityLink(linkPath: string): boolean {
  return linkPath !== '/community';
}

function removeAnchors(linkPath: string): string {
  return linkPath.split('#')[0];
}

function containsAnchor(linkPath: string): boolean {
  return linkPath.includes('#');
}

function extractAllInternalLinks(): Record<string, string[]> {
  return glob.sync(`${BASE_PATH}/**/*.md`).reduce((acc, path) => {
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
      .filter(isNotNxCommunityLink)
      .map(removeAnchors);
    if (links.length) {
      acc[path] = links;
    }
    return acc;
  }, {});
}

function extractAllInternalLinksWithAnchors(): Record<string, string[]> {
  return glob.sync(`${BASE_PATH}/**/*.md`).reduce((acc, path) => {
    const links = parseLinks(readFileContents(path))
      .filter(isLinkInternal)
      .filter(isNotAsset)
      .filter(isNotImage)
      .filter(containsAnchor);
    if (links.length) {
      acc[path] = links;
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
  return readJsonSync(join(BASE_PATH, 'map.json'));
}

interface DocumentPaths {
  relativeUrl: string;
  relativeFilePath: string;
  anchors: Record<string, boolean>;
}

function determineAnchors(filePath: string): string[] {
  const fullPath = join(BASE_PATH, filePath);
  const contents = readFileContents(fullPath).split('\n');
  const anchors = contents
    .filter((x) => x.startsWith('##'))
    .map((anchorLine) =>
      replaceAll(anchorLine, '#', '')
        .toLowerCase()
        .replace(/[^\w]+/g, '-')
        .replace('-', '')
    );
  return anchors;
}

function buildMapOfExisitingDocumentPaths(
  tree: DocumentTree[],
  map: Record<string, DocumentPaths> = {},
  ids: string[] = []
): Record<string, DocumentPaths> {
  return tree.reduce((acc, treeNode) => {
    if (isCategoryNode(treeNode)) {
      buildMapOfExisitingDocumentPaths(treeNode.itemList, acc, [
        ...ids,
        treeNode.id,
      ]);
    } else {
      const fullPath = join(join(...ids), treeNode.id);
      acc[/*treeNode.file ||*/ fullPath] = {
        relativeUrl: fullPath,
        relativeFilePath: treeNode.file || fullPath,
        anchors: determineAnchors(`${treeNode.file || fullPath}.md`).reduce(
          (acc, anchor) => {
            acc[anchor] = true;
            return acc;
          },
          {}
        ),
      };
    }
    return acc;
  }, map);
}

function determineErroneousInternalLinks(
  internalLinks: Record<string, string[]>,
  validInternalLinksMap: Record<string, DocumentPaths>
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
log('LOG_DOC_TREE', validInternalLinksMap);

const internalLinks = extractAllInternalLinks();
log('LOG_INTERNAL_LINKS', internalLinks);

const erroneousInternalLinks = determineErroneousInternalLinks(
  internalLinks,
  validInternalLinksMap
);

function checkInternalAnchoredLinks(
  internalLinksMap: Record<string, DocumentPaths>
): Record<string, string[]> | undefined {
  const links = extractAllInternalLinksWithAnchors();
  log('LOG_ANCHORED_LINKS', links);
  let erroneousInternalLinks: Record<string, string[]> | undefined;
  for (const [docPath, internalLinks] of Object.entries(links)) {
    for (const link of internalLinks) {
      const [fileKeyWithSlash, anchorKey] = link.split('#');
      const fileKey = fileKeyWithSlash.replace('/', '');
      if (!internalLinksMap[fileKey]) {
        throw Error(
          `Shouldn't be possible. The previous step would have failed.`
        );
      }
      if (!internalLinksMap[fileKey].anchors[anchorKey]) {
        if (!erroneousInternalLinks) {
          erroneousInternalLinks = {};
        }
        if (!erroneousInternalLinks[docPath]) {
          erroneousInternalLinks[docPath] = [];
        }
        erroneousInternalLinks[docPath].push(link);
      }
    }
  }
  return erroneousInternalLinks;
}

if (!erroneousInternalLinks) {
  console.log(`${chalk.green('✓')} All internal links appear to be valid!`);
  const erroneousAnchoredInternalLinks = checkInternalAnchoredLinks(
    validInternalLinksMap
  );
  if (!erroneousAnchoredInternalLinks) {
    console.log(
      `${chalk.green('✓')} All internal anchored links appear to be valid!`
    );
    process.exit(0);
  } else {
    console.log(`${chalk.red(
      'ERROR'
    )} The following files appear to contain the following invalid anchored internal links:
    ${JSON.stringify(erroneousAnchoredInternalLinks, null, 2)}`);
    process.exit(1);
  }
} else {
  console.log(`${chalk.red(
    'ERROR'
  )} The following files appear to contain the following invalid internal links:
  ${JSON.stringify(erroneousInternalLinks, null, 2)}`);

  process.exit(1);
}
