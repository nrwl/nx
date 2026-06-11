"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldUseLegacyVersioning = shouldUseLegacyVersioning;
// TODO(v23): remove — kept only so `@nx/js@21`'s library generator can load via `ensurePackage`.
/** @deprecated Compat shim for `@nx/js@21`. */
function shouldUseLegacyVersioning(releaseConfig) {
    return releaseConfig?.version?.useLegacyVersioning ?? false;
}
