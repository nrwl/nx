import { dump, load } from '@zkochan/js-yaml';
import { readFileSync, writeFileSync } from 'fs';

function updatePnpmCatalogDefinitions(
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  const pnpmWorkspaceYaml = readFileSync('pnpm-workspace.yaml', 'utf-8');
  const workspaceData = load(pnpmWorkspaceYaml)!;

  for (const [pkgName, version] of packageVersionMap.entries()) {
    const versionToUse = isPrerelease ? version : `~${version}`;
    if (workspaceData.catalogs.angular[pkgName]) {
      workspaceData.catalogs.angular[pkgName] = versionToUse;
    }
  }

  writeFileSync(
    'pnpm-workspace.yaml',
    dump(workspaceData, {
      indent: 2,
      quotingType: '"',
      forceQuotes: true,
    }),
    'utf-8'
  );
}

export async function updatePackageDependencies(
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  console.log('⏳ - Updating Pnpm Catalog definitions...');
  updatePnpmCatalogDefinitions(packageVersionMap, isPrerelease);
  console.log('✅ - Updated Pnpm Catalog definitions');
}
