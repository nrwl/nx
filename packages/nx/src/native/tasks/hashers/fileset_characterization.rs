//! Pins the files each representative regular fileset matches, so a change to
//! how filesets are matched shows up as a snapshot diff. Lists are sorted:
//! the order a fileset folds its files in is the hasher's business, the
//! membership is the contract.

use std::collections::HashMap;
use std::sync::Arc;

use super::{
    FileSet, WorkspaceFileIndex, collect_project_file_paths, collect_workspace_file_paths,
    globs_from_workspace_globs,
};
use crate::native::types::FileData;

const WORKSPACE: &[&str] = &[
    ".gitignore",
    "nx.json",
    "package.json",
    "tsconfig.base.json",
    "tools/scripts/build.ts",
    "tools/scripts/build.spec.ts",
    "tools/scripts/nested/util.ts",
    "tools/README.md",
    "libs/x/README.md",
    "libs/x/package.json",
    "libs/x/project.json",
    "libs/x/jest.config.ts",
    "libs/x/tsconfig.spec.json",
    "libs/x/src/index.ts",
    "libs/x/src/app.tsx",
    "libs/x/src/app.spec.tsx",
    "libs/x/src/app.spec.tsx.snap",
    "libs/x/src/util.test.js",
    "libs/x/src/lib/a.ts",
    "libs/x/src/lib/a.module.ts",
    "libs/x/src/lib/fixtures/one.json",
    "libs/x/src/lib/deep/fixtures/two.json",
    "libs/x/src/fixtures/root.json",
    "libs/x/src/fixtures/skip.txt",
    "libs/x-other/src/index.ts",
    "libs/(group)/y/src/index.ts",
    "libs/(group)/y/project.json",
    "libs/group/y/src/index.ts",
    "libs/@scope/z/src/index.ts",
    "libs/+state/w/index.ts",
];

fn file_data(paths: &[&str]) -> Vec<FileData> {
    paths
        .iter()
        .map(|path| FileData {
            file: (*path).to_string(),
            hash: format!("hash:{path}"),
        })
        .collect()
}

fn project_file_map() -> HashMap<String, Vec<FileData>> {
    let mut map = HashMap::new();
    let under = |prefix: &str| -> Vec<&str> {
        WORKSPACE
            .iter()
            .copied()
            .filter(|path| path.starts_with(prefix))
            .collect()
    };
    map.insert("x".to_string(), file_data(&under("libs/x/")));
    map.insert("y".to_string(), file_data(&under("libs/(group)/y/")));
    // A project at the workspace root owns whatever no other project does.
    map.insert(
        "root".to_string(),
        file_data(
            &WORKSPACE
                .iter()
                .copied()
                .filter(|path| !path.starts_with("libs/"))
                .collect::<Vec<_>>(),
        ),
    );
    map
}

fn sorted(mut files: Vec<String>) -> Vec<String> {
    files.sort();
    files
}

const PROJECT_FILESETS: &[(&str, &[&str])] = &[
    // `{projectRoot}/**/*`
    ("x", &["libs/x/**/*"]),
    // The default `production` fileset, negations included.
    (
        "x",
        &[
            "libs/x/**/*",
            "!libs/x/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
            "!libs/x/tsconfig.spec.json",
            "!libs/x/jest.config.[jt]s",
        ],
    ),
    // Negations come first; order does not matter.
    ("x", &["!libs/x/src/**/*.spec.tsx", "libs/x/src/**/*"]),
    // Only negations: everything in the project but what they exclude.
    ("x", &["!libs/x/**/*.spec.tsx"]),
    // A mid-path `**`.
    ("x", &["libs/x/src/**/fixtures/*.json"]),
    // Brace groups, of patterns and of whole paths.
    ("x", &["libs/x/src/**/*.{ts,tsx}"]),
    ("x", &["{libs/x/README.md,libs/x/package.json}"]),
    ("x", &["libs/x/{README.md,project.json}"]),
    // A path with no pattern: that file, or that directory and all under it.
    ("x", &["libs/x/src/lib", "libs/x/package.json"]),
    ("x", &["libs/x/src", "!libs/x/src/lib"]),
    // An extglob that negates inside a positive.
    ("x", &["libs/x/src/lib/!(*.module).ts"]),
    // A file that is not there.
    ("x", &["libs/x/absent.ts"]),
    // An escaped literal: the project root has glob characters.
    ("y", &[r"libs/\(group\)/y/**/*"]),
    ("y", &[r"libs/\(group\)/y/src"]),
    // A project at `.`, whose filesets arrive with no root prefix.
    ("root", &["**/*", "!**/*.spec.ts"]),
    ("root", &["tools/**/*.ts"]),
    ("root", &["*.json"]),
];

const WORKSPACE_FILESETS: &[&[&str]] = &[
    &["{workspaceRoot}/package.json"],
    &[
        "{workspaceRoot}/tools/**/*.ts",
        "!{workspaceRoot}/tools/**/*.spec.ts",
    ],
    &["{workspaceRoot}/*.json", "{workspaceRoot}/.gitignore"],
    &["{workspaceRoot}/tools"],
    &["{workspaceRoot}/libs/**/fixtures/*.json"],
    &["{workspaceRoot}/libs/*/src/index.ts"],
    &["{workspaceRoot}/{nx.json,tsconfig.base.json}"],
    &[r"{workspaceRoot}/libs/\(group\)/**/*"],
    &[
        "{workspaceRoot}/libs/@scope/z",
        "{workspaceRoot}/libs/+state",
    ],
    &["{workspaceRoot}/libs/x", "!{workspaceRoot}/libs/x/src/**"],
    // Without `{workspaceRoot}/` an entry is dropped.
    &["package.json"],
];

#[test]
fn regular_filesets_match_the_recorded_files() {
    let project_file_map = project_file_map();
    let all_workspace_files = WorkspaceFileIndex::new(Arc::new(file_data(WORKSPACE)));
    let mut report = String::new();
    for (project, fileset) in PROJECT_FILESETS {
        let fileset: Vec<String> = fileset.iter().map(|g| g.to_string()).collect();
        let files = collect_project_file_paths(project, &fileset, &project_file_map).unwrap();
        report.push_str(&format!("{project} {fileset:?}\n"));
        for file in sorted(files) {
            report.push_str(&format!("  {file}\n"));
        }
    }
    for fileset in WORKSPACE_FILESETS {
        let fileset: Vec<String> = fileset.iter().map(|g| g.to_string()).collect();
        let files = collect_workspace_file_paths(&fileset, &all_workspace_files).unwrap();
        report.push_str(&format!("workspace {fileset:?}\n"));
        for file in sorted(files) {
            report.push_str(&format!("  {file}\n"));
        }
    }
    insta::assert_snapshot!(report);
}

// Affected detection tests one changed path against a fileset; hashing
// expands the fileset over the file map. Both must name the same files.
#[test]
fn matching_a_path_agrees_with_expanding_the_fileset() {
    let project_file_map = project_file_map();
    let all_workspace_files = WorkspaceFileIndex::new(Arc::new(file_data(WORKSPACE)));
    for (project, fileset) in PROJECT_FILESETS {
        let fileset: Vec<String> = fileset.iter().map(|g| g.to_string()).collect();
        let parsed = FileSet::parse(&fileset).unwrap();
        let matched: Vec<String> = project_file_map[*project]
            .iter()
            .filter(|file| parsed.matches(&file.file))
            .map(|file| file.file.clone())
            .collect();
        let expanded = collect_project_file_paths(project, &fileset, &project_file_map).unwrap();
        assert_eq!(sorted(matched), expanded, "{project} {fileset:?}");
    }
    for fileset in WORKSPACE_FILESETS {
        let fileset: Vec<String> = fileset.iter().map(|g| g.to_string()).collect();
        let globs = globs_from_workspace_globs(&fileset);
        if globs.is_empty() {
            continue;
        }
        let parsed = FileSet::parse(&globs).unwrap();
        let matched: Vec<String> = WORKSPACE
            .iter()
            .filter(|file| parsed.matches(file))
            .map(|file| file.to_string())
            .collect();
        let expanded = collect_workspace_file_paths(&fileset, &all_workspace_files).unwrap();
        assert_eq!(sorted(matched), expanded, "{fileset:?}");
    }
}
