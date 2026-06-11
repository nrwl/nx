export declare const REGISTER_PROJECT_GRAPH_LISTENER = "REGISTER_PROJECT_GRAPH_LISTENER";
export type RegisterProjectGraphListenerMessage = {
    type: typeof REGISTER_PROJECT_GRAPH_LISTENER;
};
export declare function isRegisterProjectGraphListenerMessage(message: unknown): message is RegisterProjectGraphListenerMessage;
