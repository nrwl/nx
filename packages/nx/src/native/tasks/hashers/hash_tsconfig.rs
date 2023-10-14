use std::collections::HashMap;

use anyhow::*;
use tracing::trace;
use tsconfig::{CompilerOptions, TsConfig};

use crate::native::hasher::hash;
use crate::native::project_graph::utils::find_project_for_path;
use crate::native::utils::Normalize;

impl Normalize for CompilerOptions {
    fn to_normalized_string(&self) -> String {
        format!("allow_js: {:?},check_js:{:?},composite:{:?},declaration:{:?},declaration_map:{:?},downlevel_iteration:{:?},import_helpers:{:?},incremental:{:?},isolated_modules:{:?},
jsx:{:?},lib:{:?},module:{:?},no_emit:{:?},out_dir:{:?},out_file:{:?},
remove_comments:{:?},root_dir:{:?},source_map:{:?},target:{:?},ts_build_info_file:{:?},
always_strict:{:?},no_implicit_any:{:?},no_implicit_this:{:?},strict:{:?},
strict_bind_call_apply:{:?},strict_function_types:{:?},strict_null_checks:{:?},
strict_property_initialization:{:?},allow_synthetic_default_imports:{:?},
allow_umd_global_access:{:?},base_url:{:?},es_module_interop:{:?},
module_resolution:{:?},preserve_symlinks:{:?},root_dirs:{:?},
type_roots:{:?},types:{:?},inline_source_map:{:?},inline_sources:{:?},
map_root:{:?},source_root:{:?},no_fallthrough_cases_in_switch:{:?},
no_implicit_returns:{:?},no_property_access_from_index_signature:{:?},
no_unchecked_indexed_access:{:?},no_unused_locals:{:?},emit_decorator_metadata:{:?},
experimental_decorators:{:?},allow_unreachable_code:{:?},allow_unused_labels:{:?},
assume_changes_only_affect_direct_dependencies:{:?},declaration_dir:{:?},
disable_referenced_project_load:{:?},disable_size_limit:{:?},
disable_solution_searching:{:?},disable_source_of_project_reference_redirect:{:?},
emit_bom:{:?},emit_declaration_only:{:?},explain_files:{:?},extended_diagnostics:{:?},
force_consistent_casing_in_file_names:{:?},generate_cpu_profile:{:?},
imports_not_used_as_values:{:?},jsx_factory:{:?},jsx_fragment_factory:{:?},
jsx_import_source:{:?},keyof_strings_only:{:?},list_emitted_files:{:?},
list_files:{:?},max_node_module_js_depth:{:?},no_emit_helpers:{:?},
no_emit_on_error:{:?},no_error_truncation:{:?},no_implicit_use_strict:{:?},
no_lib:{:?},no_resolve:{:?},no_strict_generic_checks:{:?},preserve_const_enums:{:?},react_namespace:{:?},resolve_json_module:{:?},
skip_default_lib_check:{:?},skip_lib_check:{:?},strip_internal:{:?},
suppress_excess_property_errors:{:?},suppress_implicit_any_index_errors:{:?},
trace_resolution:{:?},use_define_for_class_fields:{:?},preserve_watch_output:{:?},
pretty:{:?},fallback_polling:{:?},watch_directory:{:?},watch_file:{:?}",
                            self.allow_js, self.check_js, self.composite, self.declaration, self.declaration_map,
                            self.downlevel_iteration, self.import_helpers, self.incremental, self.isolated_modules,
                            self.jsx, self.lib, self.module, self.no_emit, self.out_dir, self.out_file,
                            self.remove_comments, self.root_dir, self.source_map, self.target, self.ts_build_info_file,
                            self.always_strict, self.no_implicit_any, self.no_implicit_this, self.strict,
                            self.strict_bind_call_apply, self.strict_function_types, self.strict_null_checks,
                            self.strict_property_initialization, self.allow_synthetic_default_imports,
                            self.allow_umd_global_access, self.base_url, self.es_module_interop,
                            self.module_resolution, self.preserve_symlinks, self.root_dirs,
                            self.type_roots, self.types, self.inline_source_map, self.inline_sources,
                            self.map_root, self.source_root, self.no_fallthrough_cases_in_switch,
                            self.no_implicit_returns, self.no_property_access_from_index_signature,
                            self.no_unchecked_indexed_access, self.no_unused_locals, self.emit_decorator_metadata,
                            self.experimental_decorators, self.allow_unreachable_code, self.allow_unused_labels,
                            self.assume_changes_only_affect_direct_dependencies, self.declaration_dir,
                            self.disable_referenced_project_load, self.disable_size_limit,
                            self.disable_solution_searching, self.disable_source_of_project_reference_redirect,
                            self.emit_bom, self.emit_declaration_only, self.explain_files, self.extended_diagnostics,
                            self.force_consistent_casing_in_file_names, self.generate_cpu_profile,
                            self.imports_not_used_as_values, self.jsx_factory, self.jsx_fragment_factory,
                            self.jsx_import_source, self.keyof_strings_only, self.list_emitted_files,
                            self.list_files, self.max_node_module_js_depth, self.no_emit_helpers,
                            self.no_emit_on_error, self.no_error_truncation, self.no_implicit_use_strict,
                            self.no_lib, self.no_resolve, self.no_strict_generic_checks,
                            self.preserve_const_enums, self.react_namespace, self.resolve_json_module,
                            self.skip_default_lib_check, self.skip_lib_check, self.strip_internal,
                            self.suppress_excess_property_errors, self.suppress_implicit_any_index_errors,
                            self.trace_resolution, self.use_define_for_class_fields, self.preserve_watch_output,
                            self.pretty, self.fallback_polling, self.watch_directory, self.watch_file
        )
    }
}

pub fn hash_tsconfig_selectively(
    project_name: &str,
    ts_config: &TsConfig,
    project_root_mappings: &HashMap<String, String>,
) -> Result<String> {
    let Some(compiler_options) = &ts_config.compiler_options else {
        return Ok(hash("".as_bytes()));
    };

    let Some(paths) = compiler_options.paths.as_ref() else {
        return Ok(hash("".as_bytes()));
    };

    let project_path = remove_other_project_paths(project_name, project_root_mappings, paths);
    let compiler_options_string = compiler_options.to_normalized_string();
    trace!(?project_path, ?compiler_options_string, "hashing tsconfig");
    Ok(hash(
        &[project_path.as_bytes(), compiler_options_string.as_bytes()].concat(),
    ))
}

fn remove_other_project_paths(
    project_name: &str,
    project_root_mappings: &HashMap<String, String>,
    paths: &HashMap<String, Vec<String>>,
) -> String {
    let mut filtered_paths = paths
        .iter()
        .filter_map(|(key, files)| {
            let project_files = files
                .iter()
                .filter(|&file| {
                    find_project_for_path(file, project_root_mappings)
                        .map_or_else(|| false, |p| project_name == p)
                })
                .map(|file| file.as_str())
                .collect::<Vec<_>>();

            (!project_files.is_empty()).then(|| format!("{}:{}", key, project_files.join(";")))
        })
        .collect::<Vec<_>>();
    filtered_paths.sort();
    filtered_paths.join(";")
}

#[cfg(test)]
mod test {
    #![allow(deprecated)]
    // You may need to import more types from your crate or from the standard library
    use super::*;
    use crate::native::project_graph::types::Project;
    use crate::native::project_graph::utils::create_project_root_mappings;
    use std::collections::HashMap;
    use tsconfig::{CompilerOptions, Lib, Module, ModuleResolutionMode, Target, TsConfig};

    #[test]
    fn test_remove_other_project_paths() {
        let project_name = "project1";
        let project_root_mappings = create_project_root_mappings(&HashMap::from([
            (
                "project1".into(),
                Project {
                    root: "path1".into(),
                    ..Default::default()
                },
            ),
            (
                "project2".into(),
                Project {
                    root: "packages/path2".into(),
                    ..Default::default()
                },
            ),
        ]));

        let paths = &HashMap::from([
            (
                "@test/project1".into(),
                vec!["path1/index.ts".into(), "path1/index2.ts".into()],
            ),
            (
                "@test/project2".into(),
                vec!["packages/path2/index.ts".into()],
            ),
        ]);
        let result = remove_other_project_paths(project_name, &project_root_mappings, paths);
        assert_eq!(result, "@test/project1:path1/index.ts;path1/index2.ts");
    }

    #[test]
    fn test_hash_tsconfig() {
        let project_root_mappings = create_project_root_mappings(&HashMap::from([
            (
                "project1".into(),
                Project {
                    root: "path1".into(),
                    ..Default::default()
                },
            ),
            (
                "project2".into(),
                Project {
                    root: "packages/path2".into(),
                    ..Default::default()
                },
            ),
        ]));
        let tsconfig = TsConfig {
            compiler_options: Some(CompilerOptions {
                allow_js: Some(true),
                allow_synthetic_default_imports: None,
                allow_umd_global_access: None,
                allow_unreachable_code: None,
                allow_unused_labels: None,
                always_strict: None,
                assume_changes_only_affect_direct_dependencies: None,
                base_url: Some(".".into()),
                charset: None,
                check_js: None,
                composite: None,
                declaration: Some(true),
                declaration_dir: None,
                declaration_map: None,
                diagnostics: None,
                disable_referenced_project_load: None,
                disable_size_limit: None,
                disable_solution_searching: None,
                disable_source_of_project_reference_redirect: None,
                downlevel_iteration: None,
                emit_bom: None,
                emit_declaration_only: Some(true),
                emit_decorator_metadata: None,
                es_module_interop: None,
                experimental_decorators: Some(true),
                explain_files: None,
                extended_diagnostics: None,
                fallback_polling: None,
                force_consistent_casing_in_file_names: None,
                generate_cpu_profile: None,
                import_helpers: Some(true),
                imports_not_used_as_values: None,
                incremental: None,
                inline_source_map: None,
                inline_sources: None,
                isolated_modules: None,
                jsx: None,
                jsx_factory: None,
                jsx_fragment_factory: None,
                jsx_import_source: None,
                keyof_strings_only: None,
                lib: Some(vec![Lib::Es2020]),
                list_emitted_files: None,
                list_files: None,
                map_root: None,
                max_node_module_js_depth: None,
                module: Some(Module::CommonJs),
                module_resolution: Some(ModuleResolutionMode::Node),
                no_emit: None,
                no_emit_helpers: None,
                no_emit_on_error: None,
                no_error_truncation: None,
                no_fallthrough_cases_in_switch: None,
                no_implicit_any: None,
                no_implicit_returns: None,
                no_implicit_this: None,
                no_implicit_use_strict: None,
                no_lib: None,
                no_property_access_from_index_signature: None,
                no_resolve: None,
                no_strict_generic_checks: None,
                no_unchecked_indexed_access: None,
                no_unused_locals: None,
                out: None,
                out_dir: Some("build".into()),
                out_file: None,
                paths: Some(HashMap::from([
                    (
                        "@test/project1".into(),
                        vec!["path1/index.ts".into(), "path1/index2.ts".into()],
                    ),
                    (
                        "@test/project2".into(),
                        vec!["packages/path2/index.ts".into()],
                    ),
                ])),
                preserve_const_enums: None,
                preserve_symlinks: None,
                preserve_watch_output: None,
                pretty: None,
                react_namespace: None,
                remove_comments: None,
                resolve_json_module: Some(true),
                root_dir: Some(".".into()),
                root_dirs: None,
                skip_default_lib_check: None,
                skip_lib_check: Some(true),
                source_map: None,
                source_root: None,
                strict: None,
                strict_bind_call_apply: None,
                strict_function_types: None,
                strict_null_checks: None,
                strict_property_initialization: None,
                strip_internal: None,
                suppress_excess_property_errors: None,
                suppress_implicit_any_index_errors: None,
                target: Some(Target::Other("ES2021".into())),
                trace_resolution: None,
                ts_build_info_file: None,
                type_roots: None,
                types: Some(vec!["node".into(), "jest".into()]),
                use_define_for_class_fields: None,
                watch_directory: None,
                watch_file: None,
            }),
            files: None,
            exclude: None,
            extends: None,
            include: None,
            references: None,
            type_acquisition: None,
        };

        let result =
            hash_tsconfig_selectively("project1", &tsconfig, &project_root_mappings).unwrap();
        assert_eq!(result, "6459663646861242321");
        let result =
            hash_tsconfig_selectively("project2", &tsconfig, &project_root_mappings).unwrap();
        assert_eq!(result, "725061289497832604");
    }
}
