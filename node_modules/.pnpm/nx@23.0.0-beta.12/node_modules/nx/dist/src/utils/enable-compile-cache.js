"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Side-effect-only module: import this as the *first* import in any nx
// process entry point so V8's compile cache is enabled before the rest of
// the import chain (which is what we actually want to cache) starts loading.
const compile_cache_1 = require("./compile-cache");
(0, compile_cache_1.enableCompileCache)();
