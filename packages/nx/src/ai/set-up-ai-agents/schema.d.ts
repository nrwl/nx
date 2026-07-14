import type { PackageManager } from '../../utils/package-manager';
import type { Agent } from '../utils';

export type SetupAiAgentsGeneratorSchema = {
  directory: string;
  writeNxCloudRules?: boolean;
  packageVersion?: string;
  agents?: Agent[];
  /**
   * Used to render the skill templates, so they can state which package manager the
   * workspace uses instead of telling the agent to go read the lockfile.
   *
   * Passed in rather than detected because during `create-nx-workspace` the lockfile does
   * not exist yet — sniffing the filesystem there falls through to whichever package
   * manager happened to invoke the CLI, which is not necessarily the one being set up.
   * When absent, templates render their "determine it yourself" fallback.
   */
  packageManager?: PackageManager;
};

// `packageManager` stays optional: it is genuinely unknown in some flows, and the skill
// templates are written to handle that rather than to be handed a guess.
export type NormalizedSetupAiAgentsGeneratorSchema = Required<
  Omit<SetupAiAgentsGeneratorSchema, 'packageManager'>
> &
  Pick<SetupAiAgentsGeneratorSchema, 'packageManager'>;
