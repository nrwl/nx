import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { isGlobPattern } from '../../../utils/globs';

type ProjectNameSubstitutor<T = unknown> = (name: string) => void;

/**
 * The idea here is:
 * - When we are recieving node results from createNodes,
 *   some node `A` may contain `dependsOn` or `inputs` blocks
 *   that reference a project (B) by name that was created by the
 *   same plugin.
 * - A later plugin may change the project name of `B` to `C`
 * - After the graph is built, this would leave `A` with a reference
 *   to project `B`, which no longer exists.
 *
 *
 */
export class ProjectNameInNodePropsManager {
  private projectNameSubstitutors = new Map<string, ProjectNameSubstitutor[]>();
  private dirtyRoots = new Set<string>();

  constructor() {}

  private registerProjectNameSubstitutor(
    root: string,
    substitutor: ProjectNameSubstitutor
  ) {
    let subs = this.projectNameSubstitutors.get(root);
    if (!subs) {
      subs = [];
      this.projectNameSubstitutors.set(root, subs);
    }
    subs.push(substitutor);
  }

  /**
   * Checks if results from a plugin may require substitutors given the known nodes.
   *
   * PERF IMPACT:
   *   - Loops through each result from the given plugin, and its targets
   *   - If no targets have dependencies or inputs on another project's config,
   *     that's it.
   *   - If a target has a dependency or input that references another project name
   *     - There's a minimal overhead to register + apply the substitutions
   *     - If that projects from another plugin result, theres a larger impact
   *       as we need to actually compute the name lookup table
   *
   * @param pluginResultProjects The results from a single plugin
   * @param mergedConfigurations The currently accumulated root map
   */
  registerSubstitutorsForNodeResults(
    pluginResultProjects?: Record<
      string,
      Omit<ProjectConfiguration, 'root'> & Partial<ProjectConfiguration>
    >,
    mergedConfigurations?: Record<string, ProjectConfiguration>
  ) {
    const nameMap = new AggregateMap(
      rootMapToNameMap(pluginResultProjects),
      new LazyMap(() => rootMapToNameMap(mergedConfigurations))
    );

    for (const root in pluginResultProjects) {
      const project = pluginResultProjects[root];

      if (project.targets) {
        for (const target in project.targets) {
          const config = project.targets[target];
          if (config.inputs) {
            for (const input of config.inputs) {
              if (typeof input === 'object' && 'projects' in input) {
                const projects = input['projects'];
                // This could be `self`, `dependencies`, or a project name
                if (typeof projects === 'string') {
                  if (projects === 'self' || projects === 'dependencies') {
                    // This is a legacy syntax, but it **doesnt** reference
                    // a project name, so we don't need to worry about it here
                  } else {
                    const project = nameMap.get(projects);
                    if (project) {
                      this.registerProjectNameSubstitutor(
                        project.root,
                        (name) => {
                          input.projects = name;
                        }
                      );
                    }
                  }
                } else {
                  // this is an array of project names
                  for (let i = 0; i < projects.length; i++) {
                    const projectName = projects[i];
                    const project = nameMap.get(projectName);
                    if (project) {
                      this.registerProjectNameSubstitutor(
                        project.root,
                        (name) => {
                          projects[i] = name;
                        }
                      );
                    }
                  }
                }
              }
            }
          }

          if (config.dependsOn) {
            for (const dep of config.dependsOn) {
              if (typeof dep === 'object' && dep.projects) {
                const projects = dep.projects;
                if (typeof projects === 'string') {
                  if (!['*', 'self', 'dependencies'].includes(projects)) {
                    const project = nameMap.get(projects);
                    if (project) {
                      this.registerProjectNameSubstitutor(
                        project.root,
                        (name) => {
                          dep.projects = name;
                        }
                      );
                    }
                  }
                } else {
                  // array of project names or glob patterns?
                  // ...to be totally correct here, we'd need to use
                  // find matching projects... But that seems overkill
                  // and likely to be perf sensitive. Lets assume these are full
                  // names.
                  for (let i = 0; i < dep.projects.length; i++) {
                    const projectName = dep.projects[i];
                    if (!isGlobPattern(projectName)) {
                      const project = nameMap.get(projectName);
                      if (project) {
                        this.registerProjectNameSubstitutor(
                          project.root,
                          (name) => {
                            projects[i] = name;
                          }
                        );
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  markDirty(root: string) {
    // It can't be dirty yet if there's no substitutors pointing at it
    if (this.projectNameSubstitutors.has(root)) {
      this.dirtyRoots.add(root);
    }
  }

  applySubstitutions(rootMap: Record<string, ProjectConfiguration>) {
    for (const root of this.dirtyRoots) {
      const substitutions = this.projectNameSubstitutors.get(root);
      if (substitutions) {
        for (const substitution of substitutions) {
          const currentName = rootMap[root].name;
          substitution(currentName);
        }
      }
    }
  }
}

function rootMapToNameMap(
  rm: Record<
    string,
    Omit<ProjectConfiguration, 'root'> & Partial<ProjectConfiguration>
  >
) {
  const map = new Map<string, ProjectConfiguration>();
  for (const root in rm) {
    const project = rm[root];
    if (project.name) {
      project.root ??= root;
      map.set(project.name, project as ProjectConfiguration);
    }
  }
  return map;
}

class LazyMap<K, V> {
  private data?: Map<K, V>;

  constructor(private builder: () => Map<K, V>) {}

  get(key: K): V | null {
    if (!this.data) {
      this.data = this.builder();
    }
    return this.data.get(key);
  }
}

class AggregateMap<K, V> {
  private readonly maps: Array<Map<K, V> | LazyMap<K, V>>;
  constructor(...maps: Array<Map<K, V> | LazyMap<K, V>>) {
    this.maps = maps;
  }

  get(key: K) {
    for (const map of this.maps) {
      const v = map.get(key);
      if (v !== undefined) {
        return v;
      }
    }
  }
}
