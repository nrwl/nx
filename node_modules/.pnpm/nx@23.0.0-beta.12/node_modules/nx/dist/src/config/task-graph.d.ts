/**
 * `Task` and `TaskGraph` are defined as Rust structs in
 * `packages/nx/src/native/tasks/types.rs` and exposed to TypeScript via NAPI.
 * This file re-exports them so existing imports keep working.
 */
export type { Task, TaskGraph, TaskTarget, TaskHashDetails } from '../native';
