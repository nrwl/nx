export interface FenceProps {
    children: string;
    command: string;
    title: string;
    path: string;
    fileName: string;
    highlightLines: number[];
    lineGroups: Record<string, number[]>;
    language: string;
    enableCopy: boolean;
    skipRescope?: boolean;
    selectedLineGroup?: string;
    onLineGroupSelectionChange?: (selection: string) => void;
    isWithinTab?: boolean;
    lineWrap?: number;
}
export declare function Fence({ children, command, title, path, fileName, lineGroups, highlightLines, language, enableCopy, selectedLineGroup, skipRescope, onLineGroupSelectionChange, isWithinTab, lineWrap, }: FenceProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=fence.d.ts.map