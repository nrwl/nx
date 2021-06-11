import { uriTransformer } from 'react-markdown';

export function transformLinkPath(options: {
  flavor: string;
  version: string;
}): (href) => string {
  return (href) =>
    uriTransformer(
      href
        ? href
            .replace(
              '%7B%7Bframework%7D%7D',
              `${options.version}/${options.flavor}`
            )
            .replace('%7B%7Bversion%7D%7D', options.version)
        : href
    );
}
