import { ProjectFileMap, ProjectGraph, ProjectGraphDependency, ProjectGraphProjectNode } from '../../config/project-graph';
import { TaskGraph } from '../../config/task-graph';
export interface GraphError {
    message: string;
    stack: string;
    cause: unknown;
    name: string;
    pluginName: string;
    fileName?: string;
}
export interface ProjectGraphClientResponse {
    hash: string;
    projects: ProjectGraphProjectNode[];
    dependencies: Record<string, ProjectGraphDependency[]>;
    fileMap?: ProjectFileMap;
    layout: {
        appsDir: string;
        libsDir: string;
    };
    affected: string[];
    focus: string;
    groupByFolder: boolean;
    exclude: string[];
    isPartial: boolean;
    errors?: GraphError[];
    connectedToCloud?: boolean;
    disabledTaskSyncGenerators?: string[];
}
export interface TaskGraphClientResponse {
    taskGraph: TaskGraph;
    plans?: Record<string, string[]>;
    error?: string | null;
}
export interface ExpandedTaskInputsReponse {
    [taskId: string]: Record<string, string[]>;
}
export declare function generateGraph(args: {
    file?: string;
    print?: boolean;
    host?: string;
    port?: number;
    groupByFolder?: boolean;
    watch?: boolean;
    open?: boolean;
    view: 'projects' | 'tasks' | 'project-details';
    projects?: string[];
    all?: boolean;
    targets?: string[];
    focus?: string;
    exclude?: string[];
    affected?: boolean;
}, affectedProjects: string[]): Promise<void>;
/**
 * The data type that `nx graph --file graph.json` or `nx build --graph graph.json` contains
 */
export interface GraphJson {
    /**
     * A graph of tasks populated with `nx build --graph`
     */
    tasks?: TaskGraph;
    /**
     * The plans for hashing a task in the task graph
     */
    taskPlans?: Record<string, string[]>;
    /**
     * The project graph
     */
    graph: ProjectGraph;
}
