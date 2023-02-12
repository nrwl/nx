/**
 * The Nx Devkit is the underlying technology used to customize Nx to support
 * different technologies and custom use-cases. It contains many utility
 * functions for reading and writing files, updating configuration,
 * working with Abstract Syntax Trees(ASTs), and more.
 *
 * As with most things in Nx, the core of Nx Devkit is very simple.
 * It only uses language primitives and immutable objects
 * (the tree being the only exception).
 *
 * @module @nrwl/devkit
 */

// TODO(v17): remove this file, we can use the normally generated index.d.ts from index.ts

/* eslint-disable @typescript-eslint/no-restricted-imports */
export * from 'nx/src/devkit-exports';

export * from './public-api';
