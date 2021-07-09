import { uriTransformer } from 'react-markdown';

export function transformLinkPath(options: {
  framework: string;
  frameworkList: string[];
  version: string;
  versionList: string[];
}): (href) => string {
  return (href) =>
    uriTransformer(
      href
        ? interpolation(href, {
            framework: {
              marker: '%7B%7Bframework%7D%7D',
              value: options.framework,
            },
            frameworkList: options.frameworkList,
            version: { marker: '%7B%7Bversion%7D%7D', value: options.version },
            versionList: options.versionList,
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

  return path;
}
