import { libraryGenerator } from '@nrwl/js';

// backwards compat
// TODO(jack): Remove in Nx 16
export { libraryGenerator };

export { applicationGenerator } from './src/generators/application/application';
export { initGenerator } from './src/generators/init/init';
