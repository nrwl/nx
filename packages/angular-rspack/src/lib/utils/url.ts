/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Removes the leading slash from a URL if it exists.
 *
 * @param url - The URL string from which to remove the leading slash.
 * @returns The URL string without a leading slash.
 *
 * @example
 * ```js
 * stripLeadingSlash('/path'); // 'path'
 * stripLeadingSlash('/path/');  // 'path/'
 * stripLeadingSlash('/'); // '/'
 * stripLeadingSlash(''); // ''
 * ```
 */
export function stripLeadingSlash(url: string): string {
  // Check if the first character of the URL is a slash
  return url.length > 1 && url[0] === '/' ? url.slice(1) : url;
}

/**
 * Adds a leading slash to a URL if it does not already have one.
 *
 * @param url - The URL string to which the leading slash will be added.
 * @returns The URL string with a leading slash.
 *
 * @example
 * ```js
 * addLeadingSlash('path'); // '/path'
 * addLeadingSlash('/path'); // '/path'
 * ```
 */
export function addLeadingSlash(url: string): string {
  // Check if the URL already starts with a slash
  return url[0] === '/' ? url : `/${url}`;
}

/**
 * Adds a trailing slash to a URL if it does not already have one.
 *
 * @param url - The URL string to which the trailing slash will be added.
 * @returns The URL string with a trailing slash.
 *
 * @example
 * ```js
 * addTrailingSlash('path'); // 'path/'
 * addTrailingSlash('path/'); // 'path/'
 * ```
 */
export function addTrailingSlash(url: string): string {
  // Check if the URL already end with a slash
  return url.at(-1) === '/' ? url : `${url}/`;
}

/**
 * Joins URL parts into a single URL string.
 *
 * This function takes multiple URL segments, normalizes them by removing leading
 * and trailing slashes where appropriate, and then joins them into a single URL.
 *
 * @param parts - The parts of the URL to join. Each part can be a string with or without slashes.
 * @returns The joined URL string, with normalized slashes.
 *
 * @example
 * ```js
 * joinUrlParts('path/', '/to/resource'); // '/path/to/resource'
 * joinUrlParts('/path/', 'to/resource'); // '/path/to/resource'
 * joinUrlParts('http://localhost/path/', 'to/resource'); // 'http://localhost/path/to/resource'
 * joinUrlParts('', ''); // '/'
 * ```
 */
export function joinUrlParts(...parts: string[]): string {
  const normalizeParts: string[] = [];
  for (const part of parts) {
    if (part === '') {
      // Skip any empty parts
      continue;
    }

    let normalizedPart = part;
    if (part[0] === '/') {
      normalizedPart = normalizedPart.slice(1);
    }
    if (part.at(-1) === '/') {
      normalizedPart = normalizedPart.slice(0, -1);
    }
    if (normalizedPart !== '') {
      normalizeParts.push(normalizedPart);
    }
  }

  const protocolMatch =
    normalizeParts.length && /^https?:\/\//.test(normalizeParts[0]);
  const joinedParts = normalizeParts.join('/');

  return protocolMatch ? joinedParts : addLeadingSlash(joinedParts);
}
