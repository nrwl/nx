import { Socket } from 'net';
import { ProjectGraph } from '../../config/project-graph';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration/source-maps';
export declare let registeredProjectGraphListenerSockets: Socket[];
export declare function removeRegisteredProjectGraphListenerSocket(socket: Socket): void;
export declare function hasRegisteredProjectGraphListenerSockets(): boolean;
export declare function notifyProjectGraphListenerSockets(projectGraph: ProjectGraph, sourceMaps: ConfigurationSourceMaps, error: Error | null): Promise<void>;
