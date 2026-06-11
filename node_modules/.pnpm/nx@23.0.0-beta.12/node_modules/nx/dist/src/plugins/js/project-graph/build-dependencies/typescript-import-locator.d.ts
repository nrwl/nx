import { DependencyType } from '../../../../config/project-graph';
/**
 * @deprecated This is deprecated and will be removed in Nx 20.
 * This was not intended to be exposed.
 * Please talk to us if you need this.
 */
export declare class TypeScriptImportLocator {
    private readonly scanner;
    constructor();
    fromFile(filePath: string, visitor: (importExpr: string, filePath: string, type: DependencyType) => void): void;
    fromNode(filePath: string, node: any, visitor: (importExpr: string, filePath: string, type: DependencyType) => void): void;
    private ignoreStatement;
    private ignoreLoadChildrenDependency;
    private getPropertyAssignmentName;
    private getStringLiteralValue;
}
