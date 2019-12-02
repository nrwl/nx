#!/usr/bin/env node

// polyfill rxjs observable to avoid issues with multiple version fo Observable installed in node_modules
// https://twitter.com/BenLesh/status/1192478226385428483?s=20
(Symbol as any).observable = Symbol('observable polyfill');
import { findWorkspaceRoot } from '../lib/find-workspace-root';
import { initGlobal } from '../lib/init-global';
import { initLocal } from '../lib/init-local';

const workspace = findWorkspaceRoot(__dirname);

if (workspace) {
  initLocal(workspace);
} else {
  initGlobal();
}
