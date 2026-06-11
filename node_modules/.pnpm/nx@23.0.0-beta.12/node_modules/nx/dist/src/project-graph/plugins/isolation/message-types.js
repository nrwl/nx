"use strict";
/**
 * Generic message type system for socket-based IPC.
 *
 * Provides type-safe message definitions with automatic result type derivation.
 * Used by the plugin worker messaging layer but generic enough for any
 * request/response protocol over sockets.
 */
Object.defineProperty(exports, "__esModule", { value: true });
