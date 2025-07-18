const { pathToFileURL } = require('node:url');
const { register } = require('node:module');
const path = require('node:path');

// Dynamic import helper to prevent TypeScript from transforming it
const dynamicImportEsm = new Function('specifier', 'return import(specifier)');

async function main() {
  try {
    // Register ESM loader for workspace path mappings
    register(
      path.join(__dirname, 'lib', 'esm-loader.js'),
      pathToFileURL(__filename)
    );

    // Import and run the file
    const fileToRun = process.env.NX_FILE_TO_RUN;
    if (!fileToRun) {
      throw new Error('NX_FILE_TO_RUN environment variable not set');
    }
    await dynamicImportEsm(pathToFileURL(fileToRun).href);
  } catch (error) {
    console.error('ESM loader error:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
