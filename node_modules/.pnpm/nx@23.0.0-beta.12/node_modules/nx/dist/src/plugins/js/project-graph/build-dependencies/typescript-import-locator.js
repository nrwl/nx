"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptImportLocator = void 0;
const tslib_1 = require("tslib");
const path = tslib_1.__importStar(require("path"));
const project_graph_1 = require("../../../../config/project-graph");
const file_utils_1 = require("../../../../project-graph/file-utils");
const strip_source_code_1 = require("./strip-source-code");
let tsModule;
/**
 * @deprecated This is deprecated and will be removed in Nx 20.
 * This was not intended to be exposed.
 * Please talk to us if you need this.
 */
class TypeScriptImportLocator {
    constructor() {
        tsModule = require('typescript');
        this.scanner = tsModule.createScanner(tsModule.ScriptTarget.Latest, false);
    }
    fromFile(filePath, visitor) {
        const extension = path.extname(filePath);
        if (extension !== '.ts' &&
            extension !== '.mts' &&
            extension !== '.tsx' &&
            extension !== '.js' &&
            extension !== '.mjs' &&
            extension !== '.jsx') {
            return;
        }
        const content = (0, file_utils_1.defaultFileRead)(filePath);
        const strippedContent = (0, strip_source_code_1.stripSourceCode)(this.scanner, content);
        if (strippedContent !== '') {
            const tsFile = tsModule.createSourceFile(filePath, strippedContent, tsModule.ScriptTarget.Latest, true);
            this.fromNode(filePath, tsFile, visitor);
        }
    }
    fromNode(filePath, node, visitor) {
        if (tsModule.isImportDeclaration(node) ||
            (tsModule.isExportDeclaration(node) && node.moduleSpecifier)) {
            if (!this.ignoreStatement(node)) {
                const imp = this.getStringLiteralValue(node.moduleSpecifier);
                visitor(imp, filePath, project_graph_1.DependencyType.static);
            }
            return; // stop traversing downwards
        }
        if (tsModule.isCallExpression(node) &&
            node.expression.kind === tsModule.SyntaxKind.ImportKeyword &&
            node.arguments.length === 1 &&
            tsModule.isStringLiteral(node.arguments[0])) {
            if (!this.ignoreStatement(node)) {
                const imp = this.getStringLiteralValue(node.arguments[0]);
                visitor(imp, filePath, project_graph_1.DependencyType.dynamic);
            }
            return;
        }
        if (tsModule.isCallExpression(node) &&
            node.expression.getText() === 'require' &&
            node.arguments.length === 1 &&
            tsModule.isStringLiteral(node.arguments[0])) {
            if (!this.ignoreStatement(node)) {
                const imp = this.getStringLiteralValue(node.arguments[0]);
                visitor(imp, filePath, project_graph_1.DependencyType.static);
            }
            return;
        }
        if (node.kind === tsModule.SyntaxKind.PropertyAssignment) {
            const name = this.getPropertyAssignmentName(node.name);
            if (name === 'loadChildren') {
                const init = node.initializer;
                if (init.kind === tsModule.SyntaxKind.StringLiteral &&
                    !this.ignoreLoadChildrenDependency(node.getFullText())) {
                    const childrenExpr = this.getStringLiteralValue(init);
                    visitor(childrenExpr, filePath, project_graph_1.DependencyType.dynamic);
                    return; // stop traversing downwards
                }
            }
        }
        /**
         * Continue traversing down the AST from the current node
         */
        tsModule.forEachChild(node, (child) => this.fromNode(filePath, child, visitor));
    }
    ignoreStatement(node) {
        return (0, strip_source_code_1.stripSourceCode)(this.scanner, node.getFullText()) === '';
    }
    ignoreLoadChildrenDependency(contents) {
        this.scanner.setText(contents);
        let token = this.scanner.scan();
        while (token !== tsModule.SyntaxKind.EndOfFileToken) {
            if (token === tsModule.SyntaxKind.SingleLineCommentTrivia ||
                token === tsModule.SyntaxKind.MultiLineCommentTrivia) {
                const start = this.scanner.getStartPos() + 2;
                token = this.scanner.scan();
                const isMultiLineCommentTrivia = token === tsModule.SyntaxKind.MultiLineCommentTrivia;
                const end = this.scanner.getStartPos() - (isMultiLineCommentTrivia ? 2 : 0);
                const comment = contents.substring(start, end).trim();
                if (comment === 'nx-ignore-next-line') {
                    return true;
                }
            }
            else {
                token = this.scanner.scan();
            }
        }
        return false;
    }
    getPropertyAssignmentName(nameNode) {
        switch (nameNode.kind) {
            case tsModule.SyntaxKind.Identifier:
                return nameNode.getText();
            case tsModule.SyntaxKind.StringLiteral:
                return nameNode.text;
            default:
                return null;
        }
    }
    getStringLiteralValue(node) {
        return node.getText().slice(1, -1);
    }
}
exports.TypeScriptImportLocator = TypeScriptImportLocator;
