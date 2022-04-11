import { convertNxGenerator, logger } from '@nrwl/devkit';

export async function initGenerator() {
  logger.info(
    'This is a placeholder for @nrwl/js:init generator. If you want to create a library, use @nrwl/js:lib instead'
  );
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
