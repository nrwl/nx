import { uriTransformer } from 'react-markdown';
import {
  FlavorMetadata,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

export function transformLinkPath(options: {
  framework: FlavorMetadata;
  frameworkList: FlavorMetadata[];
  version: VersionMetadata;
  versionList: VersionMetadata[];
}): (href: string) => string {
  return (href) =>
    uriTransformer(
      href
        ? interpolation(href, {
            framework: {
              marker: '%7B%7Bframework%7D%7D',
              value: options.framework.alias,
            },
            frameworkList: options.frameworkList.map((f) => f.alias),
            version: {
              marker: '%7B%7Bversion%7D%7D',
              value: options.version.alias,
            },
            versionList: options.versionList.map((v) => v.alias),
          })
        : href
    );
}

function interpolation(
  path: string,
  config: {
    framework: { marker: string; value: string };
    frameworkList: string[];
    version: { marker: string; value: string };
    versionList: string[];
  }
): string {
  // Skip external and anchor links
  if (path.startsWith('#') || path.startsWith('http')) return path;

  // -> /{{version}}/{{framework}}/path/to/document
  if (path.includes([config.version.marker, config.framework.marker].join('/')))
    path = path.replace(
      [config.version.marker, config.framework.marker].join('/'),
      `${config.version.value}/${config.framework.value}`
    );
  // -> /version/{{framework}}/path/to/document
  if (path.includes(config.framework.marker))
    path = path.replace(
      [config.framework.marker].join('/'),
      config.framework.value
    );
  // -> /{{version}}/framework/path/to/document
  if (path.includes(config.version.marker))
    path = path.replace(
      [config.version.marker].join('/'),
      config.version.value
    );

  const isPrependedWithVersion = (
    value: string,
    versionList: string[]
  ): boolean => versionList.includes(value.split('/').filter(Boolean)[0]);
  const isSupportedFramework = (
    value: string,
    frameworkList: string[]
  ): boolean => frameworkList.includes(value.split('/').filter(Boolean)[0]);

  /**
   * Always prepend the link with a version if not already present only
   * if the path contains a known framework
   */
  if (
    !isPrependedWithVersion(path, config.versionList) &&
    isSupportedFramework(path, config.frameworkList)
  ) {
    path =
      '/' + config.version.value + (path.startsWith('/') ? path : '/' + path);
  }

  /**
   * Version aliasing if not done already on supported versions only
   * /latest/react/gatsby/overview => /l/react/gatsby/overview
   */
  const aliasVersion = (path: string): string => {
    const explodedPath = path.split('/').filter(Boolean);
    if (
      !!explodedPath[0] &&
      explodedPath[0].length > 1 &&
      config.versionList.includes(explodedPath[0].charAt(0))
    )
      return (path =
        '/' +
        [explodedPath[0].charAt(0), explodedPath.slice(1).join('/')].join('/'));
    return path;
  };

  /**
   * Framework aliasing if not done already on supported framework only
   * /l/react/gatsby/overview => /l/r/gatsby/overview
   */
  const aliasFramework = (path: string): string => {
    const explodedPath = path.split('/').filter(Boolean);
    if (
      !!explodedPath[1] &&
      explodedPath[1].length > 1 &&
      config.frameworkList.includes(explodedPath[1].charAt(0))
    )
      return (path =
        '/' +
        [
          explodedPath[0],
          explodedPath[1].charAt(0),
          explodedPath.slice(2).join('/'),
        ].join('/'));
    return path;
  };

  return aliasFramework(aliasVersion(path));
}
