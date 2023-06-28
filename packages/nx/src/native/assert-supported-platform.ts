import { output } from '../utils/output';

/**
 * Checks to see if the current platform is supported by Nx.
 *
 * Will exit the process with an output message if the platform is not supported.
 */
export function assertSupportedPlatform() {
  try {
    require('../src/native');
  } catch (e) {
    let title = '';
    let bodyLines = [];
    if (
      process.platform == 'win32' ||
      process.platform == 'darwin' ||
      process.platform == 'linux' ||
      process.platform == 'freebsd'
    ) {
      title = 'Missing Platform Dependency';
      bodyLines = [
        `The Nx CLI could not find or load the native binary for your supported platform (${process.platform}-${process.arch}).`,
        'This likely means that optional dependencies were not installed correctly, or your system is missing some system dependencies.',
      ];
      if (process.env.NX_VERBOSE_LOGGING == 'true') {
        bodyLines.push('', 'Additional error information:', e.message);
      }
    } else {
      title = 'Platform not supported';
      bodyLines = [
        `This platform (${process.platform}-${process.arch}) is currently not supported by Nx.`,
      ];
    }

    output.error({
      title,
      bodyLines,
    });
    process.exit(1);
  }
}
