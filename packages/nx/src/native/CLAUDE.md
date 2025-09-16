# Nx Native (Rust Core) Development Guide

This directory contains the core Nx functionality written in Rust, providing high-performance operations for the Nx build system.

## Overview

The native module uses [napi-rs](https://napi.rs/) to create Node.js bindings for Rust code, enabling seamless integration between the TypeScript Nx codebase and performance-critical Rust implementations.

## Building the Native Module

After making changes to any Rust code in this directory, you must rebuild the nx package:

```bash
nx build nx
```

This command:

- Compiles the Rust code
- Generates TypeScript bindings
- Creates the native module for your current platform

## Development Workflow

1. **Make Rust Changes**: Edit `.rs` files in this directory
2. **Build Native Module**: Run `nx build-native nx --configuration local`
3. **Test Changes**: Run tests to verify functionality
4. **Format Code**: Ensure Rust code follows project conventions using `cargo fmt`

## Important Notes

- Always rebuild after Rust changes - TypeScript won't see updates until you rebuild
- The generated TypeScript bindings are in `packages/nx/src/native/index.js` and `.d.ts`
- Performance-critical operations should be implemented here rather than in TypeScript
- Use appropriate error handling - Rust panics will crash the Node.js process

## Testing

Run Rust tests with:

```bash
cargo test
```

Integration tests that verify the TypeScript/Rust boundary should be written in the TypeScript test files.

## Common Issues

- **Module not found errors**: Ensure you've run the build command after changes
- **Type mismatches**: Check that the napi-rs decorators match the TypeScript expectations
- **Performance regressions**: Profile before and after changes to ensure optimizations work as expected
