use crate::native::glob::escape_glob_literal;
use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::dep_outputs::get_dep_output;
use crate::native::tasks::hashers::{OnceCache, parse_group, scope_roots, validate_files_globs};
use crate::native::tasks::inputs::{SplitInputs, expand_single_project_inputs, get_named_inputs};
use crate::native::tasks::plan::{Plan, PlanBuilder};
use crate::native::tasks::types::{CwdMode, HashInstruction, JsonFileSetInput, Task, TaskGraph};
use crate::native::tasks::utils;
use crate::native::types::Input;
use crate::native::utils::{find_matching_projects, find_unmatched_patterns};
use itertools::Itertools;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use tracing::trace;

use super::HashPlanner;
use super::dependencies::VisitedTracker;
use super::ultracache::{AlwaysIds, UltracacheContext, retained_inputs};

impl HashPlanner {
    /// A disk-backed group whose globs stay out of nested projects. A group
    /// that does not parse is left unscoped: expanding it reports the error.
    fn ignored_file_set(&self, globs: Vec<String>) -> HashInstruction {
        self.disk_file_set(globs.into_iter().map(Arc::from).collect(), false)
    }

    fn disk_file_set(&self, globs: Vec<Arc<str>>, from_ultracache: bool) -> HashInstruction {
        let project_roots = parse_group(&globs).map_or_else(
            |_| Vec::new(),
            |(positives, _)| scope_roots(&positives, self.project_roots()),
        );
        HashInstruction::IgnoredFileSet {
            globs: globs.into(),
            project_roots,
            from_ultracache,
        }
    }

    pub(super) fn target_input<'a>(
        &'a self,
        project_name: &str,
        target_name: &str,
        self_inputs: &[Input],
        external_deps_map: &'a HashMap<String, Vec<String>>,
    ) -> anyhow::Result<Option<Vec<HashInstruction>>> {
        let project = &self.project_graph.nodes[project_name];
        let Some(target) = project.targets.get(target_name) else {
            return Ok(None);
        };

        let declared = self.declared_external_deps(
            project_name,
            Some(target_name),
            self_inputs,
            external_deps_map,
        )?;
        let declares_external_deps = declared.is_some();
        let mut external_deps = declared.unwrap_or_default();

        // Only @nx executors have a known package. Anything else could depend
        // on any external, unless the target declares which ones it uses.
        let Some(executor_package) = target
            .executor
            .as_deref()
            .filter(|e| e.starts_with("@nrwl/") || e.starts_with("@nx/"))
            .map(|e| {
                e.split(':')
                    .next()
                    .expect("Executors should always have a ':'")
            })
        else {
            return Ok(Some(if declares_external_deps {
                external_instructions(external_deps)
            } else {
                vec![HashInstruction::AllExternalDependencies]
            }));
        };

        let executor_nodes = find_external_dependency_node_names(
            executor_package,
            &self.project_graph,
            &self.external_node_names,
        );
        if !executor_nodes.is_empty() {
            for executor_node in executor_nodes {
                trace!(
                    "Add External Instructions for executor {executor_node} of {project_name}:{target_name}: {:?}",
                    &external_deps_map[executor_node]
                );
                external_deps.insert(executor_node);
                external_deps.extend(&external_deps_map[executor_node]);
            }
            return Ok(Some(external_instructions(external_deps)));
        }

        // An uninstalled @nx executor is planned like a third-party one. A
        // local plugin's project files are hashed on top, but they don't
        // cover its npm imports.
        let mut instructions = if declares_external_deps {
            external_instructions(external_deps)
        } else {
            vec![HashInstruction::AllExternalDependencies]
        };
        if let Some((executor_project, executor_config)) = target
            .executor_project
            .as_ref()
            .and_then(|name| self.project_graph.nodes.get_key_value(name))
        {
            trace!(
                "Add Project File Instruction for local executor {executor_project} of {project_name}:{target_name}"
            );
            instructions.push(HashInstruction::ProjectFileSet(
                executor_project.to_string(),
                vec![resolve_tokens(
                    "{projectRoot}/**/*",
                    &executor_config.root,
                    executor_project,
                )],
            ));
        }
        Ok(Some(instructions))
    }

    /// The external nodes `inputs` name through `externalDependencies`, each
    /// with its transitive externals, or `None` when no input declares any.
    /// `target_name` is `None` for a project reached through another task's inputs.
    fn declared_external_deps<'a>(
        &'a self,
        project_name: &str,
        target_name: Option<&str>,
        inputs: &[Input],
        external_deps_map: &'a HashMap<String, Vec<String>>,
    ) -> anyhow::Result<Option<hashbrown::HashSet<&'a String>>> {
        let mut external_deps = hashbrown::HashSet::new();
        let mut declares_external_deps = false;
        for input in inputs {
            let Input::ExternalDependency(deps) = input else {
                continue;
            };
            declares_external_deps = true;
            for dep in deps.iter() {
                let external_node_names = find_external_dependency_node_names(
                    dep,
                    &self.project_graph,
                    &self.external_node_names,
                );
                if external_node_names.is_empty() {
                    let owner = match target_name {
                        Some(target_name) => format!("{project_name}:{target_name}"),
                        None => project_name.to_string(),
                    };
                    if self.project_graph.nodes.contains_key(dep) {
                        let deps = self.project_graph.dependencies.get(project_name);
                        if deps.is_some_and(|deps| deps.contains(dep)) {
                            anyhow::bail!(
                                "The externalDependency '{dep}' for '{owner}' is not an external node and is already a dependency. Please remove it from the externalDependency inputs."
                            )
                        } else {
                            anyhow::bail!(
                                "The externalDependency '{dep}' for '{owner}' is not an external node. If you believe this is a dependency, add an implicitDependency to '{project_name}'"
                            )
                        }
                    } else {
                        anyhow::bail!(
                            "The externalDependency '{dep}' for '{owner}' could not be found"
                        )
                    }
                }
                for external_node_name in external_node_names {
                    trace!(
                        "Add External Instructions for External Input {external_node_name} of {project_name}: {:?}",
                        &external_deps_map[external_node_name]
                    );
                    external_deps.insert(external_node_name);
                    external_deps.extend(&external_deps_map[external_node_name]);
                }
            }
        }
        Ok(declares_external_deps.then_some(external_deps))
    }

    /// `target_input` covers the task's own project. Every other project
    /// whose inputs reach the plan gets its declared externals from here.
    pub(super) fn declared_external_instructions(
        &self,
        project_name: &str,
        inputs: &[Input],
        external_deps_map: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<Vec<HashInstruction>> {
        Ok(self
            .declared_external_deps(project_name, None, inputs, external_deps_map)?
            .map(external_instructions)
            .unwrap_or_default())
    }

    pub(super) fn self_and_deps_inputs<'a>(
        &'a self,
        project_name: &str,
        task: &Task,
        inputs: &SplitInputs,
        task_graph: &TaskGraph,
        external_deps_mapped: &'a HashMap<String, Vec<String>>,
        visited: &mut VisitedTracker<'a>,
        context: Option<&UltracacheContext>,
        always: &mut AlwaysIds,
    ) -> anyhow::Result<Plan> {
        let pool = &self.instruction_pool;
        let project_deps = &self.project_graph.dependencies[project_name];

        let mut builder = PlanBuilder::default();
        builder.ids(
            self.gather_self_inputs(project_name, &inputs.self_inputs, context)?
                .into_iter()
                .map(|instruction| pool.intern(instruction)),
        );
        // With a recording, the task's own TsConfiguration counts only if the
        // root tsconfig was read, `always` inputs or not.
        if always.is_collecting() {
            always.extend(
                self.gather_always_self_inputs(project_name, &inputs.self_inputs)?
                    .into_iter()
                    .filter(|id| {
                        context.is_none()
                            || !matches!(&*pool.get(*id), HashInstruction::TsConfiguration(_))
                    }),
            );
        }
        // Kept with a configuration too; unless `includeUnstableFiles` is `false`
        // the hasher drops recorded reads these hash.
        builder.ids(
            self.gather_dependency_outputs(task, task_graph, &inputs.deps_outputs)?
                .into_iter()
                .map(|instruction| pool.intern(instruction)),
        );
        // Always gathered: a selected input can carry env, runtime or externals
        // too. Its filesets are dropped with the rest of the replaced set unless
        // it is `always`.
        builder.include(self.gather_project_inputs(
            task,
            &inputs.project_inputs,
            task_graph,
            external_deps_mapped,
            always,
        )?);

        builder.include(self.gather_dependency_inputs(
            task,
            &inputs.deps_inputs,
            task_graph,
            project_deps,
            external_deps_mapped,
            visited,
            always,
        )?);

        Ok(builder.finish(pool))
    }

    /// The self inputs declared `always`, gathered as they hash natively: a
    /// configuration-hashed task's own path never gathers its filesets.
    pub(super) fn gather_always_self_inputs(
        &self,
        project_name: &str,
        self_inputs: &[Input],
    ) -> anyhow::Result<Vec<u32>> {
        let retained = retained_inputs(self_inputs);
        if retained.is_empty() {
            return Ok(vec![]);
        }
        Ok(self
            .gather_self_inputs(project_name, &retained, None)?
            .into_iter()
            .map(|instruction| self.instruction_pool.intern(instruction))
            .collect())
    }

    pub(super) fn compute_external_deps(&self) -> HashMap<String, Vec<String>> {
        self.project_graph
            .external_nodes
            .keys()
            .map(|external_node| {
                (
                    external_node.clone(),
                    utils::find_all_project_node_dependencies(
                        external_node,
                        &self.project_graph,
                        false,
                    )
                    .into_iter()
                    .cloned()
                    .collect(),
                )
            })
            .collect()
    }

    pub(super) fn gather_self_inputs(
        &self,
        project_name: &str,
        self_inputs: &[Input],
        context: Option<&UltracacheContext>,
    ) -> anyhow::Result<Vec<HashInstruction>> {
        if context.is_some() {
            return self.gather_self_inputs_from_configuration(project_name, self_inputs);
        }
        // `includeIgnored` filesets hash from disk as one aggregated group, so
        // a negation filters across entries; the rest read the file map.
        let mut file_sets = self_inputs
            .iter()
            .filter_map(|input| match input {
                Input::FileSet {
                    fileset,
                    include_ignored,
                    ..
                } => Some((FileSetStore::of(fileset, *include_ignored), *fileset)),
                _ => None,
            })
            .into_group_map();
        let ignored_file_sets = file_sets.remove(&FileSetStore::Disk).unwrap_or_default();
        let project_file_sets = file_sets.remove(&FileSetStore::Project).unwrap_or_default();
        let workspace_file_sets = file_sets
            .remove(&FileSetStore::Workspace)
            .unwrap_or_default();

        let project_root = &self.project_graph.nodes[project_name].root;

        let project_inputs = if project_file_sets.is_empty() {
            vec![
                HashInstruction::ProjectConfiguration(project_name.to_string()),
                HashInstruction::TsConfiguration(project_name.to_string()),
            ]
        } else {
            vec![
                HashInstruction::ProjectFileSet(
                    project_name.to_string(),
                    project_file_sets
                        .iter()
                        .map(|f| resolve_tokens(f, project_root, project_name))
                        .collect(),
                ),
                HashInstruction::ProjectConfiguration(project_name.to_string()),
                HashInstruction::TsConfiguration(project_name.to_string()),
            ]
        };

        let workspace_file_set_inputs = if workspace_file_sets.is_empty() {
            vec![]
        } else {
            vec![HashInstruction::WorkspaceFileSet(
                workspace_file_sets
                    .iter()
                    .map(|f| resolve_tokens(f, project_root, project_name))
                    .collect(),
            )]
        };
        let disk_backed_inputs = if ignored_file_sets.is_empty() {
            vec![]
        } else {
            let resolved: Vec<String> = ignored_file_sets
                .iter()
                .map(|f| resolve_files_glob(f, project_root, project_name))
                .collect();
            validate_files_globs(project_name, &resolved)?;
            vec![self.ignored_file_set(resolved)]
        };
        let runtime_and_env_inputs = self.runtime_env_cwd_json_inputs(project_name, self_inputs);

        Ok(project_inputs
            .into_iter()
            .chain(workspace_file_set_inputs)
            .chain(disk_backed_inputs)
            .chain(runtime_and_env_inputs)
            .collect())
    }

    /// The self inputs of a project hashed from its Ultracache configuration: the
    /// observed reads replace its declared filesets, `includeIgnored` ones
    /// included, so only the project configuration, tsconfig and non-file inputs
    /// remain. The `includeIgnored` group is emitted only so the caller's
    /// replacement pass can read its roots before dropping it; that pass also
    /// decides whether TsConfiguration and JSON inputs stay.
    fn gather_self_inputs_from_configuration(
        &self,
        project_name: &str,
        self_inputs: &[Input],
    ) -> anyhow::Result<Vec<HashInstruction>> {
        let project_root = &self.project_graph.nodes[project_name].root;
        let mut instructions = vec![
            HashInstruction::ProjectConfiguration(project_name.to_string()),
            HashInstruction::TsConfiguration(project_name.to_string()),
        ];
        let ignored: Vec<String> = self_inputs
            .iter()
            .filter_map(|input| match input {
                Input::FileSet {
                    fileset,
                    include_ignored: true,
                    ..
                } => Some(resolve_files_glob(fileset, project_root, project_name)),
                _ => None,
            })
            .collect();
        validate_files_globs(project_name, &ignored)?;
        if !ignored.is_empty() {
            instructions.push(self.ignored_file_set(ignored));
        }
        instructions.extend(self.runtime_env_cwd_json_inputs(project_name, self_inputs));
        Ok(instructions)
    }

    /// With a configuration, a declared `{json}` file counts only if the task
    /// read it or it is `always`: the observed reads are the file inputs now.
    fn runtime_env_cwd_json_inputs(
        &self,
        project_name: &str,
        self_inputs: &[Input],
    ) -> Vec<HashInstruction> {
        let project_root = &self.project_graph.nodes[project_name].root;
        self_inputs
            .iter()
            .filter_map(|i| match i {
                Input::Runtime(runtime) => Some(HashInstruction::Runtime(runtime.to_string())),
                Input::Environment(env) => Some(HashInstruction::Environment(env.to_string())),
                Input::WorkingDirectory(mode) => {
                    let cwd_mode = match mode.to_lowercase().as_str() {
                        "absolute" => CwdMode::Absolute,
                        _ => CwdMode::Relative,
                    };
                    Some(HashInstruction::Cwd(cwd_mode))
                }
                Input::Json {
                    json,
                    fields,
                    exclude_fields,
                    ..
                } => {
                    let json_path = resolve_tokens(json, project_root, project_name);
                    let proj_name = if json.starts_with("{projectRoot}") {
                        Some(project_name.to_string())
                    } else {
                        None
                    };
                    Some(HashInstruction::JsonFileSet(Box::new(JsonFileSetInput {
                        project_name: proj_name,
                        json_path,
                        fields: fields.map(|f| f.to_vec()),
                        exclude_fields: exclude_fields.map(|f| f.to_vec()),
                    })))
                }
                _ => None,
            })
            .collect()
    }

    fn gather_dependency_outputs(
        &self,
        task: &Task,
        task_graph: &TaskGraph,
        deps_outputs: &[Input],
    ) -> anyhow::Result<Vec<HashInstruction>> {
        if deps_outputs.is_empty() {
            return Ok(vec![]);
        }

        let mut result: Vec<HashInstruction> = vec![];

        for dep in deps_outputs {
            let Input::DepsOutputs {
                dependent_tasks_output_files,
                transitive,
            } = dep
            else {
                continue;
            };
            result.extend(get_dep_output(
                task,
                task_graph,
                dependent_tasks_output_files,
                *transitive,
            )?);
        }

        Ok(result)
    }

    fn gather_project_inputs<'a>(
        &'a self,
        task: &Task,
        project_inputs: &[Input],
        task_graph: &TaskGraph,
        external_deps_mapped: &'a HashMap<String, Vec<String>>,
        always: &mut AlwaysIds,
    ) -> anyhow::Result<Plan> {
        let pool = &self.instruction_pool;
        let mut result = PlanBuilder::default();
        for project in project_inputs {
            let Input::Projects {
                input,
                projects,
                dependencies,
                always: always_input,
            } = project
            else {
                continue;
            };
            if *always_input {
                self.ensure_every_pattern_matches(&task.id, input, projects)?;
            }
            let projects = find_matching_projects(projects, &self.project_graph)?;
            for project in projects {
                if *dependencies {
                    // Resolved as the project's own `^input`. The propagated input never
                    // carries `always`: memo entries are shared (see `SubtreeResult`).
                    let ids = self.gather_dependency_inputs(
                        task,
                        &[Input::Inputs {
                            input,
                            dependencies: true,
                            always: false,
                        }],
                        task_graph,
                        &self.project_graph.dependencies[project],
                        external_deps_mapped,
                        &mut VisitedTracker::new(project),
                        always,
                    )?;
                    if *always_input {
                        always.include(&ids);
                    }
                    result.include(ids);
                    continue;
                }
                let named_inputs =
                    get_named_inputs(&self.nx_json, &self.project_graph.nodes[project]);
                let expanded_input = expand_single_project_inputs(
                    [Input::Inputs {
                        input,
                        dependencies: false,
                        always: *always_input,
                    }],
                    &named_inputs,
                )?;
                if always.is_collecting() {
                    always.extend(self.gather_always_self_inputs(project, &expanded_input)?);
                }
                result.ids(
                    self.gather_self_inputs(project, &expanded_input, None)?
                        .into_iter()
                        .chain(self.declared_external_instructions(
                            project,
                            &expanded_input,
                            external_deps_mapped,
                        )?)
                        .map(|instruction| pool.intern(instruction)),
                );
            }
        }
        Ok(result.finish(pool))
    }

    /// An `always` input is kept on purpose, so a pattern that selects nothing
    /// is a mistake (a typo, a renamed project) rather than an empty selection.
    /// napi hands JavaScript only an `anyhow` error's outermost context, so the
    /// task id goes in the message itself.
    fn ensure_every_pattern_matches(
        &self,
        task_id: &str,
        input: &str,
        patterns: &[&str],
    ) -> anyhow::Result<()> {
        if let Some(pattern) = find_unmatched_patterns(patterns, &self.project_graph)?.first() {
            anyhow::bail!(
                "Task \"{task_id}\": the input {{ \"input\": \"{input}\", \"projects\" }} with \"always\": true selects \"{pattern}\", which matches no project."
            );
        }
        Ok(())
    }
}

/// Where a fileset's files come from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(super) enum FileSetStore {
    /// Read from disk (`includeIgnored`).
    Disk,
    /// Filtered from the project's tracked files.
    Project,
    /// Filtered from the workspace's tracked files.
    Workspace,
}

impl FileSetStore {
    pub(super) fn of(fileset: &str, include_ignored: bool) -> Self {
        if include_ignored {
            FileSetStore::Disk
        } else if fileset.starts_with("{projectRoot}/") || fileset.starts_with("!{projectRoot}/") {
            FileSetStore::Project
        } else {
            FileSetStore::Workspace
        }
    }
}

/// Resolves `{projectRoot}` and `{projectName}` in a fileset pattern, escaped so
/// a root like `app/(group)` matches only itself. One pass, so a substituted
/// value is never read for tokens. A root-level project strips `{projectRoot}/`
/// rather than producing `./**/*`.
fn resolve_tokens(fileset: &str, project_root: &str, project_name: &str) -> String {
    let root_token = match project_root {
        "." => "{projectRoot}/",
        _ => "{projectRoot}",
    };
    let mut resolved = String::with_capacity(fileset.len());
    let mut rest = fileset;
    while let Some(start) = rest.find('{') {
        resolved.push_str(&rest[..start]);
        rest = &rest[start..];
        if let Some(after) = rest.strip_prefix(root_token) {
            if project_root != "." {
                resolved.push_str(&escape_glob_literal(project_root));
            }
            rest = after;
        } else if let Some(after) = rest.strip_prefix("{projectName}") {
            resolved.push_str(&escape_glob_literal(project_name));
            rest = after;
        } else {
            resolved.push('{');
            rest = &rest[1..];
        }
    }
    resolved.push_str(rest);
    resolved
}

/// Disk-backed globs are workspace-relative once resolved: `{workspaceRoot}/`
/// is a no-op prefix here, unlike map-backed filesets where the hasher strips it.
fn resolve_files_glob(glob: &str, project_root: &str, project_name: &str) -> String {
    let resolved = resolve_tokens(glob, project_root, project_name);
    match resolved.strip_prefix("!{workspaceRoot}/") {
        Some(rest) => format!("!{rest}"),
        None => resolved
            .strip_prefix("{workspaceRoot}/")
            .map(str::to_string)
            .unwrap_or(resolved),
    }
}

fn external_instructions(external_deps: hashbrown::HashSet<&String>) -> Vec<HashInstruction> {
    external_deps
        .into_iter()
        .map(|dep| HashInstruction::External(dep.to_string()))
        .collect()
}

/// Without an exact `<pkg>` or non-link `npm:<pkg>` node, every installed version
/// matches: picking one by `HashMap` order would vary per process, and a bump to
/// any of them can change what the task does.
fn find_external_dependency_node_names<'a>(
    package_name: &str,
    project_graph: &'a ProjectGraph,
    cache: &OnceLock<OnceCache<Vec<String>>>,
) -> Vec<&'a String> {
    let npm_name = format!("npm:{}", &package_name);
    if let Some((key, _)) = project_graph.external_nodes.get_key_value(package_name) {
        return vec![key];
    }
    if let Some((key, node)) = project_graph.external_nodes.get_key_value(&npm_name) {
        // A link node cannot represent registry versions installed by other projects.
        if !node.version.starts_with("link:") {
            return vec![key];
        }
    }
    let matches = cache
        .get_or_init(OnceCache::new)
        .get_or_try_init(package_name.to_owned(), || {
            let mut matches: Vec<String> = project_graph
                .external_nodes
                .iter()
                .filter(|(_, node)| node.package_name.as_deref() == Some(package_name))
                .map(|(node_name, _)| node_name.clone())
                .collect();
            matches.sort_unstable();
            Ok::<_, std::convert::Infallible>(matches)
        })
        .unwrap();
    matches
        .iter()
        .map(|name| project_graph.external_nodes.get_key_value(name).unwrap().0)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::{ExternalNode, Project, Target};
    use crate::native::tasks::hashers::FileSet;
    use crate::native::types::NxJson;
    use napi::bindgen_prelude::External;

    #[test]
    fn token_resolution_escapes_the_substituted_root_and_name() {
        for (pattern, root, name, resolved) in [
            ("!{projectRoot}/**/*", ".", "app", "!**/*"),
            ("{projectRoot}", ".", "app", "{projectRoot}"),
            (
                "{workspaceRoot}/file",
                "libs/app",
                "app",
                "{workspaceRoot}/file",
            ),
            ("{projectRoot}/**/*", "libs/(g)", "app", r"libs/\(g\)/**/*"),
            (
                "{projectRoot}/{projectName}.ts",
                "libs/a",
                "[id]",
                r"libs/a/\[id\].ts",
            ),
            (
                "{projectRoot}/{projectName}",
                "libs/{projectName}",
                "{projectRoot}",
                r"libs/\{projectName\}/\{projectRoot\}",
            ),
        ] {
            assert_eq!(resolve_tokens(pattern, root, name), resolved, "{pattern}");
        }
    }

    #[test]
    fn a_project_root_with_glob_characters_matches_only_itself() {
        let fileset = FileSet::parse(&[resolve_tokens(
            "{projectRoot}/**/*",
            "packages/(group)/lib-a",
            "lib-a",
        )])
        .unwrap();
        assert!(fileset.matches("packages/(group)/lib-a/src/index.ts"));
        assert!(!fileset.matches("packages/group/lib-a/src/index.ts"));
    }

    fn graph_with_external_nodes(nodes: &[(&str, &str)]) -> ProjectGraph {
        ProjectGraph {
            nodes: HashMap::new(),
            dependencies: HashMap::new(),
            external_nodes: nodes
                .iter()
                .map(|(node_name, package_name)| {
                    (
                        node_name.to_string(),
                        ExternalNode {
                            r#type: Some("npm".into()),
                            package_name: Some(package_name.to_string()),
                            version: "0.0.0".into(),
                            hash: None,
                        },
                    )
                })
                .collect(),
        }
    }

    #[test]
    fn external_dependency_prefers_the_exact_node() {
        let graph = graph_with_external_nodes(&[
            ("npm:is-number@6.0.0", "is-number"),
            ("npm:is-number", "is-number"),
            ("npm:is-number@7.0.0", "is-number"),
            ("is-odd", "is-odd"),
            ("npm:is-odd@1.0.0", "is-odd"),
        ]);
        assert_eq!(
            find_external_dependency_node_names("is-number", &graph, &OnceLock::new()),
            vec!["npm:is-number"]
        );
        assert_eq!(
            find_external_dependency_node_names("is-odd", &graph, &OnceLock::new()),
            vec!["is-odd"]
        );
    }

    #[test]
    fn external_dependency_without_an_exact_node_matches_every_version_in_order() {
        let nodes = [
            ("npm:is-number@7.0.0", "is-number"),
            ("npm:is-number@6.0.0", "is-number"),
            ("npm:is-odd@1.0.0", "is-odd"),
        ];
        let reversed: Vec<_> = nodes.iter().rev().copied().collect();
        for graph in [
            graph_with_external_nodes(&nodes),
            graph_with_external_nodes(&reversed),
        ] {
            assert_eq!(
                find_external_dependency_node_names("is-number", &graph, &OnceLock::new()),
                vec!["npm:is-number@6.0.0", "npm:is-number@7.0.0"]
            );
        }
    }

    #[test]
    fn external_dependency_without_a_match_is_empty() {
        let graph = graph_with_external_nodes(&[("npm:is-number@7.0.0", "is-number")]);
        assert!(find_external_dependency_node_names("is-odd", &graph, &OnceLock::new()).is_empty());
    }

    #[test]
    fn external_dependencies_input_hashes_every_version_without_a_bare_registry_node() {
        use crate::native::test_utils::task_graph;
        use crate::native::types::ExternalDependenciesInput;
        use napi::bindgen_prelude::Either9;

        for with_link in [false, true] {
            let mut nodes = vec![
                ("npm:is-number@6.0.0", "is-number"),
                ("npm:is-number@7.0.0", "is-number"),
            ];
            if with_link {
                nodes.push(("npm:is-number", "is-number"));
            }
            let mut graph = graph_with_external_nodes(&nodes);
            if with_link {
                graph
                    .external_nodes
                    .get_mut("npm:is-number")
                    .unwrap()
                    .version = "link:../is-number".into();
            }
            graph.dependencies.insert("c".into(), vec![]);
            graph.nodes.insert(
                "c".into(),
                Project {
                    root: "packages/c".into(),
                    targets: HashMap::from([(
                        "check".into(),
                        Target {
                            executor: Some("nx:run-commands".into()),
                            inputs: Some(vec![Either9::F(ExternalDependenciesInput {
                                external_dependencies: vec!["is-number".into()],
                            })]),
                            ..Default::default()
                        },
                    )]),
                    ..Default::default()
                },
            );
            let planner = HashPlanner::new(
                NxJson { named_inputs: None },
                &External::new(Arc::new(graph)),
            );
            let plans = planner
                .get_plans_materialized(
                    vec!["c:check"],
                    task_graph(&[("c:check", &[])], &[]),
                    None,
                    &[],
                )
                .unwrap();
            let externals: Vec<_> = plans["c:check"]
                .iter()
                .filter_map(|instruction| match instruction {
                    HashInstruction::External(name) => Some(name.as_str()),
                    _ => None,
                })
                .collect();
            let mut expected = vec!["npm:is-number@6.0.0", "npm:is-number@7.0.0"];
            if with_link {
                expected.insert(0, "npm:is-number");
            }
            assert_eq!(externals, expected);
        }
    }

    #[test]
    fn another_projects_input_carries_its_externals_env_and_runtime() {
        use crate::native::test_utils::task_graph;
        use crate::native::types::{
            DepsOutputsInput, EnvironmentInput, ExternalDependenciesInput, InputsInput, JsInputs,
            RuntimeInput,
        };
        use napi::bindgen_prelude::{Either, Either9};

        let caret = || Either9::B("^probeext".to_string());
        let selected_project = || {
            Either9::A(InputsInput {
                input: "probeext".into(),
                dependencies: None,
                projects: Some(Either::B(vec!["lib".into()])),
                always: None,
            })
        };
        let deps_outputs = || {
            Either9::G(DepsOutputsInput {
                dependent_tasks_output_files: "**/*.js".into(),
                transitive: None,
            })
        };
        // No project has an edge to the package, so only the declaration names it.
        let cases: [(&str, JsInputs, &[&str], Option<JsInputs>); 4] = [
            ("memoized subtree", caret(), &[], None),
            ("project cycle", caret(), &["app"], None),
            ("task-dependent input", caret(), &[], Some(deps_outputs())),
            ("selected project", selected_project(), &[], None),
        ];
        for (case, app_input, lib_dependencies, lib_extra_input) in cases {
            let mut graph = graph_with_external_nodes(&[("npm:probe-pkg", "probe-pkg")]);
            let build = |inputs| {
                HashMap::from([(
                    "build".to_string(),
                    Target {
                        executor: Some("nx:run-commands".into()),
                        inputs: Some(inputs),
                        ..Default::default()
                    },
                )])
            };
            let no_externals = || {
                Either9::F(ExternalDependenciesInput {
                    external_dependencies: vec![],
                })
            };
            graph.nodes.insert(
                "app".into(),
                Project {
                    root: "packages/app".into(),
                    named_inputs: Some(HashMap::from([("probeext".into(), vec![])])),
                    targets: build(vec![no_externals(), app_input]),
                    ..Default::default()
                },
            );
            let mut probeext: Vec<JsInputs> = vec![
                Either9::F(ExternalDependenciesInput {
                    external_dependencies: vec!["probe-pkg".into()],
                }),
                Either9::E(EnvironmentInput {
                    env: "PROBE_ENV".into(),
                }),
                Either9::D(RuntimeInput {
                    runtime: "echo probe".into(),
                }),
            ];
            probeext.extend(lib_extra_input);
            graph.nodes.insert(
                "lib".into(),
                Project {
                    root: "packages/lib".into(),
                    named_inputs: Some(HashMap::from([("probeext".into(), probeext)])),
                    targets: build(vec![no_externals()]),
                    ..Default::default()
                },
            );
            graph.dependencies.insert("app".into(), vec!["lib".into()]);
            graph.dependencies.insert(
                "lib".into(),
                lib_dependencies.iter().map(|dep| dep.to_string()).collect(),
            );
            let planner = HashPlanner::new(
                NxJson { named_inputs: None },
                &External::new(Arc::new(graph)),
            );
            let plans = planner
                .get_plans_materialized(
                    vec!["app:build"],
                    task_graph(&[("app:build", &[])], &[]),
                    None,
                    &[],
                )
                .unwrap();
            let externals: Vec<_> = plans["app:build"]
                .iter()
                .filter_map(|instruction| match instruction {
                    HashInstruction::External(name) => Some(name.as_str()),
                    _ => None,
                })
                .collect();
            assert_eq!(externals, ["npm:probe-pkg"], "{case}");
            assert!(
                plans["app:build"].contains(&HashInstruction::Environment("PROBE_ENV".into())),
                "{case}"
            );
            assert!(
                plans["app:build"].contains(&HashInstruction::Runtime("echo probe".into())),
                "{case}"
            );
        }
    }
}

#[cfg(test)]
mod nested_project_tests {
    use super::*;
    use crate::native::project_graph::types::{Project, Target};
    use crate::native::test_utils::{
        excluding_unstable_files, including_unstable_files, task_graph,
    };
    use crate::native::types::{FileSetInput, NxJson};
    use napi::bindgen_prelude::{Either9, External};

    /// `gradle` holds `batch-runner`; only `gradle:build` declares inputs.
    fn planner() -> HashPlanner {
        let project = |root: &str, inputs: Option<Vec<_>>| Project {
            root: root.into(),
            targets: HashMap::from([(
                "build".into(),
                Target {
                    inputs,
                    ..Default::default()
                },
            )]),
            ..Default::default()
        };
        let ignored = |fileset: &str| {
            Either9::C(FileSetInput {
                fileset: fileset.into(),
                dependencies: None,
                include_ignored: Some(true),
                always: None,
            })
        };
        let graph = ProjectGraph {
            nodes: HashMap::from([
                (
                    "gradle".into(),
                    project(
                        "packages/gradle",
                        Some(vec![
                            ignored("{projectRoot}/**/*"),
                            ignored("{workspaceRoot}/dist/**"),
                        ]),
                    ),
                ),
                (
                    "batch-runner".into(),
                    project("packages/gradle/batch-runner", None),
                ),
                ("root".into(), project(".", None)),
            ]),
            dependencies: ["gradle", "batch-runner", "root"]
                .into_iter()
                .map(|name| (name.into(), vec![]))
                .collect(),
            external_nodes: HashMap::new(),
        };
        HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(graph)),
        )
    }

    fn roots_of(instruction: &HashInstruction) -> Option<Vec<&str>> {
        match instruction {
            HashInstruction::IgnoredFileSet { project_roots, .. } => {
                Some(project_roots.iter().map(String::as_str).collect())
            }
            _ => None,
        }
    }

    #[test]
    fn an_include_ignored_group_carries_the_roots_that_scope_it() {
        let plans = planner()
            .get_plans_materialized(
                vec!["gradle:build"],
                task_graph(&[("gradle:build", &[])], &[]),
                None,
                &[],
            )
            .unwrap();
        let roots: Vec<Vec<&str>> = plans["gradle:build"].iter().filter_map(roots_of).collect();
        // `dist` belongs to no project but the workspace root's, so it adds nothing.
        assert_eq!(
            roots,
            vec![vec!["packages/gradle", "packages/gradle/batch-runner"]]
        );
    }

    #[test]
    fn a_configuration_group_is_scoped_by_where_each_glob_reads_from() {
        let planner = planner();
        let group = |globs: &[&str]| {
            planner.ignored_file_set(globs.iter().map(|g| g.to_string()).collect())
        };
        assert_eq!(
            roots_of(&group(&[
                "packages/gradle/**/*",
                "!packages/gradle/**/*.spec.ts"
            ])),
            Some(vec!["packages/gradle", "packages/gradle/batch-runner"])
        );
        assert_eq!(
            roots_of(&group(&["packages/gradle/batch-runner/src/**/*.kt"])),
            Some(vec!["packages/gradle/batch-runner"])
        );
        assert_eq!(
            roots_of(&group(&["packages/**/*.json", "dist/**"])),
            Some(vec![])
        );
    }

    #[test]
    fn a_recorded_read_naming_a_project_root_belongs_to_that_project() {
        use crate::native::test_utils::ultracache_configurations;

        let (_dir, configurations) = ultracache_configurations(&[(
            "gradle:build",
            &[
                "packages/gradle/batch-runner",
                "packages/gradle/{batch-runner,src}",
                "packages/gradle//src/a.ts",
            ],
        )]);
        let plans = planner()
            .get_plans_materialized(
                vec!["gradle:build"],
                excluding_unstable_files(task_graph(&[("gradle:build", &[])], &[])),
                Some(&configurations),
                &[],
            )
            .unwrap();
        let mut filesets: Vec<(String, Vec<String>)> = plans["gradle:build"]
            .iter()
            .filter_map(|instruction| match instruction {
                HashInstruction::ProjectFileSet(project, globs) => {
                    let mut globs = globs.clone();
                    globs.sort();
                    Some((project.clone(), globs))
                }
                _ => None,
            })
            .collect();
        filesets.sort();
        // The outer project's file list holds none of the nested project's files.
        assert_eq!(
            filesets,
            vec![
                (
                    "batch-runner".to_string(),
                    vec!["packages/gradle/batch-runner".to_string()]
                ),
                (
                    "gradle".to_string(),
                    vec![
                        "packages/gradle/src".to_string(),
                        "packages/gradle/src/a.ts".to_string()
                    ]
                ),
            ]
        );
    }

    #[test]
    fn a_recording_hashes_a_nested_project_only_through_its_own_globs() {
        use crate::native::tasks::hashers::{Source, expand_globs};
        use crate::native::test_utils::ultracache_configurations;
        use assert_fs::TempDir;
        use assert_fs::prelude::*;

        let temp = TempDir::new().unwrap();
        for path in [
            "packages/gradle/src/a.ts",
            "packages/gradle/batch-runner/src/x.kt",
            "packages/gradle/batch-runner/src/y.kt",
            "packages/gradle/batch-runner/build/out.jar",
        ] {
            temp.child(path).write_str("x").unwrap();
        }
        let (_dir, configurations) = ultracache_configurations(&[(
            "gradle:build",
            &[
                "packages/gradle/**/*",
                "packages/gradle/batch-runner/src/**/*.kt",
                "!packages/gradle/batch-runner/src/y.kt",
            ],
        )]);
        let plans = planner()
            .get_plans_materialized(
                vec!["gradle:build"],
                including_unstable_files(task_graph(&[("gradle:build", &[])], &[])),
                Some(&configurations),
                &[],
            )
            .unwrap();
        let mut hashed: Vec<String> = plans["gradle:build"]
            .iter()
            .filter_map(|instruction| match instruction {
                HashInstruction::IgnoredFileSet {
                    globs,
                    project_roots,
                    ..
                } => Some(
                    expand_globs(
                        globs,
                        project_roots,
                        &Source::fileset_from_disk(temp.path()),
                    )
                    .unwrap()
                    .files,
                ),
                _ => None,
            })
            .flatten()
            .collect();
        hashed.sort();
        // The parent glob skips `batch-runner`; its own glob reads `x.kt`, and
        // the negation still removes `y.kt`.
        assert_eq!(
            hashed,
            vec![
                "packages/gradle/batch-runner/src/x.kt",
                "packages/gradle/src/a.ts"
            ]
        );
    }
}
