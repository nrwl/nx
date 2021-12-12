import {
  FlavorMetadata,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

export function pathCleaner(
  versions: VersionMetadata[],
  flavors: FlavorMetadata[]
) {
  return (path: string): string => {
    const [first, second, ...others] = path.split('/').filter(Boolean);
    const cleanPath = [];

    if (!versions.find((v) => [v.alias, v.id].includes(first))) {
      cleanPath.push(first);
    }

    if (!flavors.find((f) => [f.alias, f.id].includes(second))) {
      cleanPath.push(second);
    }

    return '/' + (others ? cleanPath.concat(...others) : cleanPath).join('/');
  };
}
