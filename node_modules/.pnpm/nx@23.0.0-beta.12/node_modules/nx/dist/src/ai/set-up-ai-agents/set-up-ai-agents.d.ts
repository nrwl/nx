import { Tree } from '../../generators/tree';
import { CLIErrorMessageConfig, CLINoteMessageConfig } from '../../utils/output';
import { NormalizedSetupAiAgentsGeneratorSchema, SetupAiAgentsGeneratorSchema } from './schema';
export type ModificationResults = {
    messages: CLINoteMessageConfig[];
    errors: CLIErrorMessageConfig[];
};
export declare function setupAiAgentsGenerator(tree: Tree, options: SetupAiAgentsGeneratorSchema, inner?: boolean): Promise<(check?: boolean) => Promise<ModificationResults>>;
export declare function setupAiAgentsGeneratorImpl(tree: Tree, options: NormalizedSetupAiAgentsGeneratorSchema): Promise<() => Promise<ModificationResults>>;
export default setupAiAgentsGenerator;
