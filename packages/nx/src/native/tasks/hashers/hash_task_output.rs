use std::path::{Path, PathBuf};

use anyhow::Result;

use super::disk_expansion::{
    FilesExpansion, FilesExpansionCache, Negation, Positive, Source, expand_cached, expand_entries,
};
use super::hash_ignored_files::hash_files;
use crate::native::glob::{build_glob_set, literal_prefix};
use crate::native::walker::files_under;
use crate::native::workspace::ignored_index::IgnoredIndex;

/// Result of hashing task output files, including the matched file paths
pub struct TaskOutputHashResult {
    pub hash: String,
    pub files: Vec<String>,
}

/// The files under a dependency's declared `outputs` that `glob` selects,
/// read from disk the way an `includeIgnored` fileset is, see
/// `output_entries`. The outputs' expansion is shared by every task that
/// reads them in one hashing call; `glob` then filters per task.
pub fn expand_task_outputs(
    workspace_root: &Path,
    glob: &str,
    outputs: &[String],
    cache: &FilesExpansionCache,
) -> Result<FilesExpansion> {
    let key = format!("outputs:[{}]", outputs.join("\n"));
    let expansion = expand_cached(&key, cache, || {
        let (positives, negations) = output_entries(workspace_root, outputs)?;
        expand_entries(
            workspace_root,
            &positives,
            &negations,
            &Source::declared_outputs(&|dir, accept| {
                files_under(workspace_root, dir, false, accept)
            }),
        )
    })?;
    let selected = build_glob_set(&[glob])?;
    let files: Vec<String> = expansion
        .files
        .iter()
        .filter(|file| selected.is_match(file))
        .cloned()
        .collect();
    // An output that does not exist is not an input.
    Ok(FilesExpansion { files })
}

pub fn hash_task_output(
    workspace_root: &Path,
    glob: &str,
    outputs: &[String],
    cache: &FilesExpansionCache,
    index: &IgnoredIndex,
) -> Result<TaskOutputHashResult> {
    let expansion = expand_task_outputs(workspace_root, glob, outputs, cache)?;
    // Written by a task that has run, so never taken on trust.
    let hash = hash_files(workspace_root, &expansion, |_| None, index, false);
    Ok(TaskOutputHashResult {
        hash,
        files: expansion.files,
    })
}

/// The file-resolution half of `hash_task_output`, for the inspector.
pub fn resolve_task_output_files(
    workspace_root: &Path,
    glob: &str,
    outputs: &[String],
) -> Result<Vec<String>> {
    let expansion =
        expand_task_outputs(workspace_root, glob, outputs, &FilesExpansionCache::new())?;
    Ok(expansion.files)
}

/// The directories a task's declared outputs are read from, for an index to
/// keep: a glob's literal prefix, an exact path as itself.
pub(crate) fn output_prefixes(outputs: &[String]) -> Vec<String> {
    outputs
        .iter()
        .filter(|entry| !entry.starts_with('!'))
        .filter_map(|entry| normalize_output_entry(entry))
        .filter_map(|entry| literal_prefix(&entry).ok().map(|(root, _)| root))
        .collect()
}

/// Declared outputs are paths first: an entry that exists is read as written,
/// whatever characters it has (`.next/server/app/[id]`), and only one that
/// names nothing on disk is a glob walked from its literal prefix. A `!`
/// entry filters the rest.
fn output_entries(
    workspace_root: &Path,
    outputs: &[String],
) -> Result<(Vec<Positive>, Vec<Negation>)> {
    let mut positives = Vec::new();
    let mut negations = Vec::new();
    for entry in outputs {
        let Some(entry) = relative_output_entry(workspace_root, entry) else {
            continue;
        };
        let (negated, body) = match entry.strip_prefix('!') {
            Some(rest) => (true, rest),
            None => (false, entry.as_str()),
        };
        let exists = workspace_root.join(body).exists();
        match (negated, exists) {
            (true, true) => negations.push(Negation::exact(body)),
            (true, false) if !body.is_empty() => negations.push(Negation::parse(body)?),
            (true, false) => {}
            (false, true) => positives.push(Positive::exact(body)),
            (false, false) => positives.push(Positive::parse(body)?),
        }
    }
    Ok((positives, negations))
}

/// An absolute entry inside the workspace (`{options.outputPath}` with an
/// absolute value) is read relative to it, so the files it hashes are named
/// like any other; one outside the workspace names nothing here, like an
/// entry that climbs out with `..`.
fn relative_output_entry(workspace_root: &Path, entry: &str) -> Option<String> {
    let (bang, body) = match entry.strip_prefix('!') {
        Some(rest) => ("!", rest),
        None => ("", entry),
    };
    if !Path::new(body).is_absolute() {
        return normalize_output_entry(entry);
    }
    let inside = match Path::new(body).strip_prefix(workspace_root) {
        Ok(inside) => inside.to_path_buf(),
        Err(_) => resolved_inside(workspace_root, Path::new(body))?,
    };
    let inside = inside.to_string_lossy().replace('\\', "/");
    normalize_output_entry(&format!("{bang}{inside}"))
}

/// `path` relative to the workspace when the two are spelled differently,
/// through a symlink (`/tmp` and `/private/tmp`) or a drive letter's case:
/// both are resolved, the path through its longest existing ancestor, since
/// the rest may be a glob or not written yet.
fn resolved_inside(workspace_root: &Path, path: &Path) -> Option<PathBuf> {
    let root = dunce::canonicalize(workspace_root).ok()?;
    let mut existing = path;
    let mut rest = Vec::new();
    let resolved = loop {
        if let Ok(resolved) = dunce::canonicalize(existing) {
            break resolved;
        }
        rest.push(existing.file_name()?);
        existing = existing.parent()?;
    };
    let full: PathBuf = rest
        .iter()
        .rev()
        .fold(resolved, |full, part| full.join(part));
    full.strip_prefix(&root).ok().map(Path::to_path_buf)
}

/// Resolves `.` and `..` lexically: outputs are declared relative to the
/// workspace and may climb (`{projectRoot}/../shared`). An entry that leaves
/// the workspace, or is absolute, names nothing here.
fn normalize_output_entry(entry: &str) -> Option<String> {
    let (bang, body) = match entry.strip_prefix('!') {
        Some(rest) => ("!", rest),
        None => ("", entry),
    };
    if body.starts_with('/') {
        return None;
    }
    let mut segments: Vec<&str> = Vec::new();
    for segment in body.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop()?;
            }
            other => segments.push(other),
        }
    }
    Some(format!("{bang}{}", segments.join("/")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    fn strings(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    fn workspace() -> TempDir {
        let temp = TempDir::new().unwrap();
        for file in [
            "dist/apps/web/index.js",
            "dist/apps/web/index.js.map",
            "dist/apps/web/assets/a.css",
            "dist/@scope/pkg/index.js",
            "dist/libs/lib/index.js",
        ] {
            temp.child(file).write_str(file).unwrap();
        }
        temp
    }

    fn files(temp: &TempDir, glob: &str, outputs: &[&str]) -> Vec<String> {
        resolve_task_output_files(temp.path(), glob, &strings(outputs)).unwrap()
    }

    fn hash(temp: &TempDir, glob: &str, outputs: &[&str], cache: &FilesExpansionCache) -> String {
        hash_with(temp, glob, outputs, cache, &IgnoredIndex::new(None))
    }

    fn hash_with(
        temp: &TempDir,
        glob: &str,
        outputs: &[&str],
        cache: &FilesExpansionCache,
        index: &IgnoredIndex,
    ) -> String {
        hash_task_output(temp.path(), glob, &strings(outputs), cache, index)
            .unwrap()
            .hash
    }

    #[test]
    fn selects_the_files_the_glob_names_under_the_declared_outputs() {
        let temp = workspace();
        assert_eq!(
            files(&temp, "**/*.js", &["dist/apps/web"]),
            vec!["dist/apps/web/index.js"]
        );
        assert_eq!(
            files(&temp, "**/*", &["dist/apps/web/**/*.css"]),
            vec!["dist/apps/web/assets/a.css"]
        );
        assert_eq!(
            files(&temp, "**/*", &["dist/apps/web", "!dist/apps/web/**/*.map"]),
            vec!["dist/apps/web/assets/a.css", "dist/apps/web/index.js"]
        );
        assert_eq!(
            files(&temp, "**/*.js", &["dist/apps/web", "dist/libs/lib"]),
            vec!["dist/apps/web/index.js", "dist/libs/lib/index.js"]
        );
    }

    #[test]
    fn a_file_under_two_overlapping_outputs_counts_once() {
        let temp = workspace();
        assert_eq!(
            files(&temp, "**/*.js", &["dist", "dist/apps/web"]),
            vec![
                "dist/@scope/pkg/index.js",
                "dist/apps/web/index.js",
                "dist/libs/lib/index.js"
            ]
        );
        let cache = FilesExpansionCache::new();
        assert_eq!(
            hash(&temp, "**/*.js", &["dist", "dist/apps/web"], &cache),
            hash(&temp, "**/*.js", &["dist"], &cache)
        );
    }

    #[test]
    fn keeps_at_in_an_output_prefix() {
        let temp = workspace();
        assert_eq!(
            files(&temp, "**/*.js", &["dist/@scope/pkg/**"]),
            vec!["dist/@scope/pkg/index.js"]
        );
    }

    #[test]
    fn an_output_that_exists_is_read_as_written() {
        let temp = workspace();
        temp.child("dist/app/[id]/page.js").write_str("id").unwrap();
        temp.child("dist/app/(group)/page.js")
            .write_str("group")
            .unwrap();
        assert_eq!(
            files(&temp, "**/*", &["dist/app/[id]", "dist/app/(group)"]),
            vec!["dist/app/(group)/page.js", "dist/app/[id]/page.js"]
        );
        assert_eq!(
            files(&temp, "**/*", &["dist/app", "!dist/app/[id]"]),
            vec!["dist/app/(group)/page.js"]
        );
        // Only an entry that names nothing on disk is a glob.
        assert_eq!(
            files(&temp, "**/*", &["dist/apps/[wx]eb/index.js"]),
            vec!["dist/apps/web/index.js"]
        );
    }

    #[cfg(unix)]
    #[test]
    fn an_output_is_read_wherever_it_points() {
        let temp = workspace();
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("out/index.js").write_str("linked").unwrap();
        elsewhere.child("file.js").write_str("linked file").unwrap();
        std::os::unix::fs::symlink(
            elsewhere.path().join("out"),
            temp.path().join("dist/linked"),
        )
        .unwrap();
        std::os::unix::fs::symlink(
            elsewhere.path().join("file.js"),
            temp.path().join("dist/apps/web/linked.js"),
        )
        .unwrap();
        assert_eq!(
            files(&temp, "**/*.js", &["dist/linked"]),
            vec!["dist/linked/index.js"]
        );
        assert_eq!(
            files(&temp, "**/*.js", &["dist/apps/web/**"]),
            vec!["dist/apps/web/index.js", "dist/apps/web/linked.js"]
        );
    }

    #[test]
    fn resolves_dot_segments_and_drops_entries_that_leave_the_workspace() {
        assert_eq!(
            normalize_output_entry("apps/web/../shared").as_deref(),
            Some("apps/shared")
        );
        assert_eq!(normalize_output_entry("./dist/").as_deref(), Some("dist"));
        assert_eq!(
            normalize_output_entry("!apps/web/../shared/**").as_deref(),
            Some("!apps/shared/**")
        );
        assert_eq!(normalize_output_entry("../outside"), None);
        assert_eq!(normalize_output_entry("/abs/dist"), None);
        let temp = workspace();
        assert_eq!(
            files(&temp, "**/*.js", &["dist/apps/web/../../libs/lib"]),
            vec!["dist/libs/lib/index.js"]
        );
    }

    #[test]
    fn an_absolute_output_inside_the_workspace_is_read_relative_to_it() {
        let temp = workspace();
        let absolute = temp.path().join("dist/libs/lib");
        assert_eq!(
            files(&temp, "**/*.js", &[&absolute.to_string_lossy()]),
            vec!["dist/libs/lib/index.js"]
        );
        let excluded = format!("!{}", temp.path().join("dist/libs/**").to_string_lossy());
        assert_eq!(
            files(&temp, "**/*.js", &["dist", &excluded]),
            vec!["dist/@scope/pkg/index.js", "dist/apps/web/index.js"]
        );
        // Outside the workspace it names nothing, like `../outside`.
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("out/index.js").write_str("x").unwrap();
        let outside = elsewhere.path().join("out");
        assert!(files(&temp, "**/*.js", &[&outside.to_string_lossy()]).is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn an_absolute_output_spelled_through_a_symlink_is_still_inside() {
        let temp = workspace();
        let aliases = TempDir::new().unwrap();
        let alias = aliases.path().join("ws");
        std::os::unix::fs::symlink(temp.path(), &alias).unwrap();
        // The root spelled one way and the entries the other, both ways round.
        for (root, spelling) in [
            (temp.path(), alias.as_path()),
            (alias.as_path(), temp.path()),
        ] {
            let entry = |rest: &str| spelling.join(rest).to_string_lossy().to_string();
            assert_eq!(
                resolve_task_output_files(root, "**/*.js", &[entry("dist/libs/lib")]).unwrap(),
                vec!["dist/libs/lib/index.js"]
            );
            // A glob's tail does not exist; it resolves through its prefix.
            assert_eq!(
                resolve_task_output_files(root, "**/*.js", &[entry("dist/libs/**/*.js")]).unwrap(),
                vec!["dist/libs/lib/index.js"]
            );
        }
    }

    #[test]
    fn a_missing_output_is_not_an_input() {
        let temp = workspace();
        let cache = FilesExpansionCache::new();
        let with_absent = hash_task_output(
            temp.path(),
            "**/*.js",
            &strings(&["dist/absent", "dist/apps/web"]),
            &cache,
            &IgnoredIndex::new(None),
        )
        .unwrap();
        assert_eq!(with_absent.files, vec!["dist/apps/web/index.js"]);
        assert_eq!(
            with_absent.hash,
            hash(&temp, "**/*.js", &["dist/apps/web"], &cache)
        );
    }

    #[test]
    fn the_hash_follows_the_content() {
        let temp = workspace();
        // One index across the hashes, so a remembered hash could answer.
        let index = IgnoredIndex::new(None);
        let hash = || {
            hash_with(
                &temp,
                "**/*.js",
                &["dist/apps/web"],
                &FilesExpansionCache::new(),
                &index,
            )
        };
        let first = hash();
        assert_eq!(first, hash());
        let file = temp.path().join("dist/apps/web/index.js");
        temp.child("dist/apps/web/index.js")
            .write_str("changed")
            .unwrap();
        let second = hash();
        assert_ne!(first, second);
        // A same-size rewrite with the same mtime still counts: the pinned
        // mtime is not before the entry's second, so the entry is racy.
        let instant = std::time::SystemTime::now() + std::time::Duration::from_secs(2);
        let pin = || {
            std::fs::File::open(&file)
                .unwrap()
                .set_modified(instant)
                .unwrap();
        };
        pin();
        let pinned = hash();
        temp.child("dist/apps/web/index.js")
            .write_str("CHANGED")
            .unwrap();
        pin();
        assert_ne!(pinned, hash());
    }
}
