#!/usr/bin/env node

import { logger } from 'nx/src/shared/logger';
import { getPackageManagerCommand } from 'nx/src/shared/package-manager';

logger.warn('Please update your global install of Nx');
logger.warn(`- ${getPackageManagerCommand().addGlobal} nx`);

require('nx/bin/nx');
