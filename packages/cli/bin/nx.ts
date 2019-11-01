#!/usr/bin/env node

import { findWorkspaceRoot } from '../lib/find-workspace-root';
import { initGlobal } from '../lib/init-global';
import { initLocal } from '../lib/init-local';

const workspace = findWorkspaceRoot(__dirname);

if (workspace) {
  initLocal(workspace);
} else {
  initGlobal();
}
