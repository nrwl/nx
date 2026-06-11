"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCatalogError = formatCatalogError;
function formatCatalogError(error, suggestions) {
    let message = error;
    if (suggestions.length > 0) {
        message += '\n\nSuggestions:';
        suggestions.forEach((suggestion) => {
            message += `\n  • ${suggestion}`;
        });
    }
    return message;
}
