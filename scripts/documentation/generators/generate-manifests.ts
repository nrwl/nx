import * as chalk from 'chalk';
import { readJsonSync } from 'fs-extra';
import { resolve } from 'path';
import {
  convertToDocumentMetadata,
  createDocumentMetadata,
  DocumentMetadata,
  pkgToGeneratedApiDocs,
} from '@nx/nx-dev/models-document';
import { MenuItem } from '@nx/nx-dev/models-menu';
import {
  PackageMetadata,
  ProcessedPackageMetadata,
} from '@nx/nx-dev/models-package';
import { generateIndexMarkdownFile, generateJsonFile } from '../utils';
import { convertToDictionary } from './utils-generator/convert-to-dictionary';

interface DocumentSection {
  name: string;
  content: Partial<DocumentMetadata>[];
  prefix: string;
}

interface DocumentManifest {
  id: string;
  records: Record<string, DocumentMetadata>;
}

interface PackageManifest {
  id: string;
  records: Record<string, ProcessedPackageMetadata>;
}

type Manifest = DocumentManifest | PackageManifest;

const isDocument = (
  e: DocumentMetadata | ProcessedPackageMetadata
): e is DocumentMetadata => !('packageName' in e);
const isPackage = (
  e: DocumentMetadata | ProcessedPackageMetadata
): e is ProcessedPackageMetadata => 'packageName' in e;

export function generateManifests(workspace: string): Promise<void[]> {
  console.log(`${chalk.blue('i')} Generating Manifests`);
  const documentationPath = resolve(workspace, 'docs');
  const generatedDocumentationPath = resolve(documentationPath, 'generated');
  const generatedExternalDocumentationPath = resolve(
    documentationPath,
    'external-generated'
  );
  const targetFolder: string = resolve(generatedDocumentationPath, 'manifests');
  const documents: Partial<DocumentMetadata>[] = readJsonSync(
    `${documentationPath}/map.json`,
    {
      encoding: 'utf8',
    }
  ).content;
  const packages: PackageMetadata[] = [
    ...readJsonSync(`${generatedDocumentationPath}/packages-metadata.json`, {
      encoding: 'utf8',
    }),
    ...readJsonSync(
      `${generatedExternalDocumentationPath}/packages-metadata.json`,
      {
        encoding: 'utf8',
      }
    ),
  ];

  /**
   * We are starting by selecting what section of the map.json we want to work with.
   * @type {DocumentSection[]}
   */
  const documentSections = createDocumentSections(documents);

  /**
   * Once we have the DocumentSections we can start creating our DocumentManifests.
   * @type {Manifest[]}
   */
  const manifests = getDocumentManifests(documentSections);

  /**
   * Packages are not Documents and need to be handled in a custom way.
   * @type {{id: string, records: Record<string, ProcessedPackageMetadata>}}
   */
  const packagesManifest = createPackagesManifest(packages);
  const newPackagesManifest = createNewPackagesManifest(packages);

  /**
   * Add the packages manifest to the manifest collection for simplicity.
   */
  manifests.push(packagesManifest);
  manifests.push(newPackagesManifest);

  /**
   * We can easily infer all Documents menus but need a custom way to handle them
   * for the packages.
   * @type {{id: string, menu: MenuItem[]}[]}
   */
  const menus: {
    id: string;
    menu: MenuItem[];
  }[] = getDocumentMenus(
    manifests.filter((m): m is DocumentManifest =>
      isDocument(m.records[Object.keys(m.records)[0]])
    )
  );

  /*
   * Map API docs to /technologies section in the nx menu.
   */
  menus.forEach((menu) => {
    if (menu.id !== 'nx') return;
    insertApiDocs(menu.menu, newPackagesManifest);
  });

  /**
   * Creating packages menu with custom package logic.
   * @type {{id: string, menu: MenuItem[]}}
   */
  const packagesMenu: {
    id: string;
    menu: MenuItem[];
  } = createPackagesMenu(newPackagesManifest);

  /**
   * Add the packages menu to the main menu collection for simplicity.
   */
  menus.push(packagesMenu);

  /**
   * We can easily get all associated existing tags from each manifest.
   * @type {Record<string, {description: string, file: string, id: string, name: string, path: string}[]>}
   */
  const tags: Record<
    string,
    {
      description: string;
      file: string;
      id: string;
      name: string;
      path: string;
    }[]
  > = generateTags(manifests);

  /**
   * We can now create manifest files.
   */
  const fileGenerationPromises: Promise<any>[] = [];
  manifests.forEach((manifest) =>
    fileGenerationPromises.push(
      generateJsonFile(
        resolve(targetFolder + `/${manifest.id}.json`),
        manifest.records
      )
    )
  );
  fileGenerationPromises.push(
    generateJsonFile(resolve(targetFolder, `tags.json`), tags)
  );
  fileGenerationPromises.push(
    generateJsonFile(resolve(targetFolder, `menus.json`), menus)
  );
  fileGenerationPromises.push(
    generateIndexMarkdownFile(
      resolve(documentationPath, `shared`, `reference`, `sitemap.md`),
      menus
    )
  );

  return Promise.all(fileGenerationPromises);
}

function generateTags(manifests: Manifest[]) {
  const tags: Record<
    string,
    {
      description: string;
      file: string;
      id: string;
      name: string;
      path: string;
    }[]
  > = {};
  manifests.map((manifest) => {
    for (let key in manifest.records) {
      const item: DocumentMetadata | ProcessedPackageMetadata =
        manifest.records[key];

      if (isDocument(item))
        item.tags.forEach((t) => {
          const tagData = {
            description: item.description,
            file: item.file,
            id: item.id,
            name: item.name,
            path: item.path,
          };
          !tags[t] ? (tags[t] = [tagData]) : tags[t].push(tagData);
        });

      if (isPackage(item))
        Object.values(item.documents).forEach(
          (documentMetadata: DocumentMetadata) => {
            documentMetadata.tags.forEach((t: string) => {
              const filePath = documentMetadata.file.startsWith(
                'generated/packages'
              )
                ? documentMetadata.file
                : ['generated', 'packages', documentMetadata.file].join('/');

              const tagData = {
                description: documentMetadata.description,
                file: filePath,
                id: documentMetadata.id,
                name: documentMetadata.name,
                path: documentMetadata.path,
              };
              !tags[t] ? (tags[t] = [tagData]) : tags[t].push(tagData);
            });
          }
        );
    }
  });

  return tags;
}

// TODO(docs): Once we move API docs and set up redirect rules, we no longer need this menu
function createPackagesMenu(packages: PackageManifest): {
  id: string;
  menu: MenuItem[];
} {
  const packagesMenu: MenuItem[] = Object.values(packages.records).map((p) => {
    const item: MenuItem = {
      id: p.name,
      path: '/nx-api/' + p.name,
      name: p.name,
      children: [],
      isExternal: false,
      disableCollapsible: false,
    };

    if (!!Object.values(p.documents).length) {
      // Might need to remove the path set in the "additional api resources" items
      item.children.push({
        id: 'documents',
        path: '/' + ['nx-api', p.name, 'documents'].join('/'),
        name: 'documents',
        children: Object.values(p.documents).map((d) =>
          menuItemRecurseOperations(d)
        ),
        isExternal: false,
        disableCollapsible: false,
      });
    }

    if (!!Object.values(p.executors).length) {
      item.children.push({
        id: 'executors',
        path: '/' + ['nx-api', p.name, 'executors'].join('/'),
        name: 'executors',
        children: Object.values(p.executors).map((e) => ({
          id: e.name,
          path: '/' + ['nx-api', p.name, 'executors', e.name].join('/'),
          name: e.name,
          children: [],
          isExternal: false,
          disableCollapsible: false,
        })),
        isExternal: false,
        disableCollapsible: false,
      });
    }

    if (!!Object.values(p.generators).length) {
      item.children.push({
        id: 'generators',
        path: '/' + ['nx-api', p.name, 'generators'].join('/'),
        name: 'generators',
        children: Object.values(p.generators).map((g) => ({
          id: g.name,
          path: '/' + ['nx-api', p.name, 'generators', g.name].join('/'),
          name: g.name,
          children: [],
          isExternal: false,
          disableCollapsible: false,
        })),
        isExternal: false,
        disableCollapsible: false,
      });
    }

    if (!!Object.values(p.migrations).length) {
      item.children.push({
        id: 'migrations',
        path: '/' + ['nx-api', p.name, 'migrations'].join('/'),
        name: 'migrations',
        children: [],
        isExternal: false,
        disableCollapsible: false,
      });
    }
    return item;
  });
  return { id: 'nx-api', menu: packagesMenu };
}

function getDocumentMenus(manifests: DocumentManifest[]): {
  id: string;
  menu: MenuItem[];
}[] {
  return manifests.map((record) => {
    // IMPORTANT: Only use top-level items to avoid duplicate menu entries
    // The populateDictionary function adds all items (including nested children) to
    // a flat dictionary. Without filtering, each nested item would appear both in
    // its parent's children array AND as a separate top-level menu item. This was an issue
    // for the extending-nx page, where the menu was showing the same item twice.
    const topLevelItems = Object.values(record.records).filter((item) => {
      // Determine top-level items by analyzing path segments:
      // - For root items (no prefix): path will have 1 segment (just the id)
      // - For prefixed sections: path will have 2 segments (prefix + id)
      const pathSegments = item.path.split('/').filter(Boolean);
      return (
        pathSegments.length === 1 ||
        (pathSegments.length === 2 && pathSegments[0] === record.id)
      );
    });

    return {
      id: record.id,
      menu: topLevelItems
        .map((item: any) => convertToDocumentMetadata(item))
        .map((item: DocumentMetadata) => menuItemRecurseOperations(item)),
    };
  });
}

function createNewPackagesManifest(packages: PackageMetadata[]): {
  id: string;
  records: Record<string, ProcessedPackageMetadata>;
} {
  const packagesManifest: {
    id: string;
    records: Record<string, ProcessedPackageMetadata>;
  } = { id: 'new-nx-api', records: {} };

  packages.forEach((p) => {
    const data = pkgToGeneratedApiDocs[p.name];
    if (!data) {
      console.warn(
        `No mapping data found for package ${p.name}. Check "nx-dev/models-document/src/lib/mappings.ts".`
      );
      return;
    }

    const parentSegments = data.pagePath.split('/').filter(Boolean);
    let parentDoc: DocumentMetadata = createDocumentMetadata({
      id: parentSegments[0],
      path: `${parentSegments[0]}/`,
    });
    for (const ps of parentSegments.slice(1)) {
      parentDoc = documentRecurseOperations(
        createDocumentMetadata({
          id: ps,
          path: `${ps}/`,
        }),
        parentDoc
      );
    }
    packagesManifest.records[p.name] = {
      githubRoot: p.githubRoot,
      name: p.name,
      packageName: p.packageName,
      description: p.description,
      documents: data.includeDocuments
        ? convertToDictionary(
            p.documents.map((d) =>
              documentRecurseOperations(
                {
                  ...d,
                  path: d.path.replace(new RegExp(`^${p.name}/`, 'i'), ''),
                },
                parentDoc
              )
            ),
            'path'
          )
        : {},
      root: p.root,
      source: p.source,
      executors: convertToDictionary(
        p.executors.map((e) => ({
          ...e,
          path: generatePath(
            // package name is now in the prefix
            { id: e.name, path: e.path.split('/').slice(1).join('/') },
            data.pagePath
          ),
        })),
        'path'
      ),
      generators: convertToDictionary(
        p.generators.map((g) => ({
          ...g,
          path: generatePath(
            // package name is now in the prefix
            { id: g.name, path: g.path.split('/').slice(1).join('/') },
            data.pagePath
          ),
        })),
        'path'
      ),
      migrations: convertToDictionary(
        p.migrations.map((g) => ({
          ...g,
          path: generatePath(
            // package name is now in the prefix
            { id: g.name, path: g.path.split('/').slice(1).join('/') },
            data.pagePath
          ),
        })),
        'path'
      ),
      path: generatePath({ id: p.name, path: '' }, `technologies/${p.name}`),
    };
  });

  return packagesManifest;
}

function createPackagesManifest(packages: PackageMetadata[]): {
  id: string;
  records: Record<string, ProcessedPackageMetadata>;
} {
  const packagesManifest: {
    id: string;
    records: Record<string, ProcessedPackageMetadata>;
  } = { id: 'nx-api', records: {} };

  packages.forEach((p) => {
    packagesManifest.records[p.name] = {
      githubRoot: p.githubRoot,
      name: p.name,
      packageName: p.packageName,
      description: p.description,
      documents: convertToDictionary(
        p.documents.map((d) =>
          documentRecurseOperations(
            d,
            createDocumentMetadata({ id: p.name, path: 'nx-api/' })
          )
        ),
        'path'
      ),
      root: p.root,
      source: p.source,
      executors: convertToDictionary(
        p.executors.map((e) => ({
          ...e,
          path: generatePath({ id: e.name, path: e.path }, 'nx-api'),
          newPath: generatePath(
            // package name is now in the prefix
            { id: e.name, path: e.path.split('/').slice(1).join('/') },
            `technologies/${p.name}/api`
          ),
        })),
        'path'
      ),
      generators: convertToDictionary(
        p.generators.map((g) => ({
          ...g,
          path: generatePath({ id: g.name, path: g.path }, 'nx-api'),
          newPath: generatePath(
            // package name is now in the prefix
            { id: g.name, path: g.path.split('/').slice(1).join('/') },
            `technologies/${p.name}/api`
          ),
        })),
        'path'
      ),
      migrations: convertToDictionary(
        p.migrations.map((g) => ({
          ...g,
          path: generatePath({ id: g.name, path: g.path }, 'nx-api'),
          newPath: generatePath(
            // package name is now in the prefix
            { id: g.name, path: g.path.split('/').slice(1).join('/') },
            `technologies/${p.name}/api`
          ),
        })),
        'path'
      ),
      path: generatePath({ id: p.name, path: '' }, 'nx-api'),
      newPath: generatePath({ id: p.name, path: '' }, `technologies/${p.name}`),
    };
  });

  return packagesManifest;
}

function getDocumentManifests(sections: DocumentSection[]): Manifest[] {
  return sections.map((section) => {
    const records: Record<string, DocumentMetadata> = {};
    section.content
      .map((item: any) => convertToDocumentMetadata(item))
      .map((item: DocumentMetadata) =>
        documentRecurseOperations(
          item,
          createDocumentMetadata({ id: section.name, path: section.prefix })
        )
      )
      .forEach((item: DocumentMetadata) => {
        populateDictionary(item, records);
      });

    return {
      id: section.name,
      records,
    };
  });
}

function findMenuItemByPath(menus: MenuItem[], path: string): MenuItem | null {
  const parts = path.split('/').filter(Boolean);
  const id = parts.shift();

  let curr: MenuItem | null = null;

  for (const menu of menus) {
    if (menu.id !== id) continue;
    curr = menu;
    for (const part of parts) {
      if (!curr?.children) break;
      curr = curr.children.find((child) => child.id === part);
    }
    break;
  }

  return curr;
}

function insertApiDocs(menus: MenuItem[], packages: PackageManifest): void {
  Object.values(packages.records).forEach((p) => {
    const apiDocsData = pkgToGeneratedApiDocs[p.name];
    if (!apiDocsData) {
      console.warn(
        `No API path found for package ${p.name}. Skipping API docs insertion.`
      );
      return;
    }

    const apiItem = findMenuItemByPath(menus, apiDocsData.pagePath);
    if (!apiItem)
      throw new Error(
        `Cannot find where to put ${apiDocsData.pagePath}. Does it exist in map.json?`
      );

    if (apiDocsData.includeDocuments && !!Object.values(p.documents).length) {
      apiItem.children.push({
        id: 'documents',
        path: `${apiDocsData.pagePath}/documents`,
        name: 'documents',
        children: Object.values(p.documents).map((x) => ({
          id: x.name,
          path: `${apiDocsData.pagePath}/documents/${x.id}`,
          name: x.name,
          children: [],
          isExternal: false,
          disableCollapsible: false,
        })),
        isExternal: false,
        disableCollapsible: false,
      });
    }

    if (!!Object.values(p.executors).length) {
      apiItem.children.push({
        id: 'executors',
        path: `${apiDocsData.pagePath}/executors`,
        name: 'executors',
        children: Object.values(p.executors).map((x) => ({
          id: x.name,
          path: `${apiDocsData.pagePath}/executors/${x.name}`,
          name: x.name,
          children: [],
          isExternal: false,
          disableCollapsible: false,
        })),
        isExternal: false,
        disableCollapsible: false,
      });
    }

    if (!!Object.values(p.generators).length) {
      apiItem.children.push({
        id: 'generators',
        path: `${apiDocsData.pagePath}/generators`,
        name: 'generators',
        children: Object.values(p.generators).map((x) => ({
          id: x.name,
          path: `${apiDocsData.pagePath}/generators/${x.name}`,
          name: x.name,
          children: [],
          isExternal: false,
          disableCollapsible: false,
        })),
        isExternal: false,
        disableCollapsible: false,
      });
    }

    if (!!Object.values(p.migrations).length) {
      apiItem.children.push({
        id: 'migrations',
        path: `${apiDocsData.pagePath}/migrations`,
        name: 'migrations',
        children: [],
        isExternal: false,
        disableCollapsible: false,
      });
    }
    return apiItem;
  });
}

function createDocumentSections(
  documents: Partial<DocumentMetadata>[]
): DocumentSection[] {
  return [
    {
      name: 'nx',
      content: documents.find((x) => x.id === 'nx-documentation')!
        .itemList as Partial<DocumentMetadata>[],
      prefix: '',
    },
    {
      name: 'extending-nx',
      content: documents.find((x) => x.id === 'extending-nx')!
        .itemList as Partial<DocumentMetadata>[],
      prefix: 'extending-nx',
    },
    {
      name: 'ci',
      content: documents.find((x) => x.id === 'ci')!
        .itemList as Partial<DocumentMetadata>[],
      prefix: 'ci',
    },
  ];
}

function generatePath(
  item: { path: string; id: string },
  prefix: string = ''
): string {
  const isLinkExternal: (p: string) => boolean = (p: string) =>
    p.startsWith('http');
  const isLinkAbsolute: (p: string) => boolean = (p: string) =>
    p.startsWith('/');

  if (!item.path)
    return '/' + [...prefix.split('/'), item.id].filter(Boolean).join('/');
  if (isLinkAbsolute(item.path) || isLinkExternal(item.path)) return item.path;
  return (
    '/' +
    [...prefix.split('/'), ...item.path.split('/')].filter(Boolean).join('/')
  );
}

/**
 * Handle data interpolation for all items and their children.
 * @param target
 * @param parent
 */
function documentRecurseOperations(
  target: DocumentMetadata,
  parent: DocumentMetadata
): DocumentMetadata {
  const document: DocumentMetadata = structuredClone(target);

  /**
   * Calculate `path`
   */
  if (!!parent) document.path = generatePath(target, parent.path);
  else document.path = generatePath(document);

  /**
   * Calculate `isExternal`
   */
  if (document['isExternal'] === undefined) {
    document.isExternal = document.path.startsWith('http');
  }

  if (!!target.itemList.length) {
    document.itemList = target.itemList.map((i) =>
      documentRecurseOperations(i, document)
    );
  }

  return document;
}

function populateDictionary(
  document: DocumentMetadata,
  dictionary: Record<string, DocumentMetadata>
) {
  if (document.path.startsWith('http')) return;
  dictionary[document.path] = document;

  document.itemList.forEach((item: DocumentMetadata) =>
    populateDictionary(item, dictionary)
  );
}

// Creates menus dictionary mapping
function menuItemRecurseOperations(target: DocumentMetadata): MenuItem {
  const menuItem: MenuItem = {
    name: target.name,
    path: target.path,
    id: target.id,
    isExternal: target.isExternal,
    children: [],
    disableCollapsible: false,
  };
  /**
   * Calculate `isExternal`
   */
  if (menuItem['isExternal'] === undefined) {
    menuItem.isExternal = menuItem.path.startsWith('http');
  }

  if (!!target.itemList.length) {
    menuItem.children = target.itemList.map((i) =>
      menuItemRecurseOperations(i)
    );
  }

  return menuItem;
}
