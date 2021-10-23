import {
  FlavorMetadata,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

export function pathCleaner(
  versions: VersionMetadata[],
  flavors: FlavorMetadata[]
) {
  return (path: string): string => {
    const myPath = path
      .split('/')
      .filter(
        (segment: string) =>
          !versions.find((v) => [v.alias, v.id].includes(segment))
      )
      .filter(
        (segment: string) =>
          !flavors.find((f) => [f.alias, f.id].includes(segment))
      )
      .join('/');

    return myPath;
  };
}
