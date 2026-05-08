// Side-effect-only module: import this as the *first* import in any nx
// process entry point so V8's compile cache is enabled before the rest of
// the import chain (which is what we actually want to cache) starts loading.
import { enableCompileCache } from './compile-cache';

enableCompileCache();
