// Taken from https://github.com/npm/cli/blob/c736b622b8504b07f5a19f631ade42dd40063269/lib/utils/format-bytes.js

// Convert bytes to printable output, for file reporting in tarballs
// Only supports up to GB because that's way larger than anything the registry
// supports anyways.

export const formatBytes = (bytes, space = true) => {
  let spacer = '';
  if (space) {
    spacer = ' ';
  }

  if (bytes < 1000) {
    // B
    return `${bytes}${spacer}B`;
  }

  if (bytes < 1000000) {
    // kB
    return `${(bytes / 1000).toFixed(1)}${spacer}kB`;
  }

  if (bytes < 1000000000) {
    // MB
    return `${(bytes / 1000000).toFixed(1)}${spacer}MB`;
  }

  // GB
  return `${(bytes / 1000000000).toFixed(1)}${spacer}GB`;
};
