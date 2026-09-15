//! Expands an `includeIgnored` fileset group, or a dependency's declared
//! outputs, into the files on disk: the glob text rules, the walk from each
//! glob's literal prefix, and the stamps the content cache validates by.

use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result, bail};
use dashmap::DashMap;
use rayon::prelude::*;
use walkdir::WalkDir;

use super::file_content_cache::{FileStamp, WalkRecord, WalkView, path_key, stamp_of};
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::walker::HARDCODED_IGNORE_PATTERNS;

/// Expansion per `files:{project}:[...]` instruction, scoped to one `hash_plans` call:
/// nothing watches gitignored directories, so a longer-lived memo goes stale.
pub(crate) type FilesExpansionCache = DashMap<String, Arc<FilesExpansion>>;

/// Where the files under a directory come from when not from a walk. Asked
/// with a workspace-relative directory (empty for the root); `Some` is its
/// files, sorted and workspace-relative, from an index the caller keeps
/// current; `None` walks the disk.
pub(crate) type Members<'a> = &'a (dyn Fn(&str) -> Option<Vec<String>> + Sync);

/// The walk, for a caller with no index.
pub(crate) const WALK: Members<'static> = &|_| None;

pub struct FilesExpansion {
    /// Existing files matched by the group, sorted, workspace-relative.
    pub files: Vec<String>,
    /// Aligned with `files`: the stamp read while expanding, so hashing does
    /// not stat again, or `None` when the workspace context vouched for the
    /// file and the disk was never consulted.
    pub stamps: Vec<Option<FileStamp>>,
    /// Declared exact paths that do not exist on disk.
    pub missing: Vec<String>,
    /// What each walk covered and saw, so the content cache can drop entries
    /// for files that are gone.
    pub(crate) walks: Vec<WalkRecord>,
}

/// Expands brace groups whose alternatives are all literal names into the
/// exact paths they stand for (`{nx,tsconfig.base}.json` → `nx.json`,
/// `tsconfig.base.json`; several groups multiply out). A group with a wildcard
/// or a nested brace is left as-is. A group of literals at the workspace root
/// names exact files, not a walk.
pub(crate) fn expand_literal_braces(glob: &str) -> Vec<String> {
    let negated = glob.starts_with('!');
    let body = glob.strip_prefix('!').unwrap_or(glob);
    let Some(open) = body.find('{') else {
        return vec![glob.to_string()];
    };
    let Some(close) = body[open..].find('}').map(|i| open + i) else {
        return vec![glob.to_string()];
    };
    let alternatives: Vec<&str> = body[open + 1..close].split(',').collect();
    let literal = alternatives.len() > 1
        && alternatives
            .iter()
            .all(|a| !a.is_empty() && !a.contains(['*', '?', '[', ']', '{', '}', '/', '\\']));
    if !literal {
        return vec![glob.to_string()];
    }
    let prefix = if negated { "!" } else { "" };
    alternatives
        .iter()
        .flat_map(|alternative| {
            let expanded = format!("{}{}{}", &body[..open], alternative, &body[close + 1..]);
            expand_literal_braces(&expanded)
        })
        .map(|expanded| {
            let expanded = expanded.strip_prefix('!').unwrap_or(&expanded).to_string();
            format!("{prefix}{expanded}")
        })
        .collect()
}

/// The literal directory a glob is walked from, and the pattern after it,
/// if any. The prefix ends at the first segment with glob syntax as the
/// engine reads it: `*`, `?`, `{`, `[`, or a `(` group. What follows reaches
/// the engine unchanged, so brackets, groups, and escapes mean exactly what
/// they mean in any other fileset. `@` and `+` are ordinary characters both
/// here and in the engine (`node_modules/@scope/pkg`, `g+en`), which is why
/// `partition_glob`, which strips them, is not used.
pub(crate) fn literal_prefix(glob: &str) -> Result<(String, Option<&str>)> {
    if Path::new(glob).is_absolute() || glob.starts_with('/') {
        bail!(
            "The includeIgnored fileset \"{glob}\" is an absolute path; globs are workspace-relative."
        );
    }
    let mut literal: Vec<&str> = Vec::new();
    let mut consumed = 0;
    let mut remainder = None;
    for segment in glob.split('/') {
        if segment == ".." {
            bail!("The includeIgnored fileset \"{glob}\" points outside the workspace.");
        }
        if segment == "." {
            bail!(
                "The includeIgnored fileset \"{glob}\" has a `.` segment; write it relative to the workspace root without `./`."
            );
        }
        if segment.contains(['*', '?', '{', '[', '(']) {
            remainder = Some(&glob[consumed..]);
            break;
        }
        literal.push(segment);
        consumed += segment.len() + 1;
    }
    let root = literal.join("/").trim_end_matches('/').to_string();
    Ok((root, remainder))
}

/// Collapses repeated and trailing slashes so `dist//gen/` and `dist/gen`
/// name the same directory, and so prefix arithmetic below lines up.
pub(crate) fn normalize_glob(glob: &str) -> String {
    let (prefix, body) = match glob.strip_prefix('!') {
        Some(body) => ("!", body),
        None => ("", glob),
    };
    let mut out = String::with_capacity(glob.len());
    out.push_str(prefix);
    let mut previous_slash = false;
    for c in body.chars() {
        if c == '/' {
            if previous_slash {
                continue;
            }
            previous_slash = true;
        } else {
            previous_slash = false;
        }
        out.push(c);
    }
    if out.len() > prefix.len() && out.ends_with('/') {
        out.pop();
    }
    out
}

/// Rejects a glob that would read outside the workspace or exclude nothing.
/// A glob with no leading directory (`**/*`, `*.gen`) is allowed: it walks
/// from the workspace root, which is slow but not wrong.
pub(crate) fn validate_files_glob(glob: &str) -> Result<()> {
    if let Some(body) = glob.strip_prefix('!') {
        let body = normalize_glob(body);
        if body.is_empty() {
            bail!("The includeIgnored fileset \"{glob}\" names nothing to exclude.");
        }
        for expanded in expand_literal_braces(&body) {
            literal_prefix(&expanded)?;
        }
        return Ok(());
    }
    for expanded in expand_literal_braces(&normalize_glob(glob)) {
        literal_prefix(&expanded)?;
    }
    Ok(())
}

/// `validate_files_glob` for every entry of a project's group, plus the one
/// rule that needs the whole group: it must not only exclude.
pub(crate) fn validate_files_globs(project: &str, globs: &[String]) -> Result<()> {
    if !globs.is_empty() && globs.iter().all(|glob| glob.starts_with('!')) {
        bail!(
            "The includeIgnored fileset \"{}\" applied to \"{project}\" is a negation with no positive includeIgnored fileset to filter. A negation only filters the positive includeIgnored filesets of the same project; a fileset with `dependencies: true` is hashed on its own for each dependency, so a negation there has nothing to filter.",
            globs[0]
        );
    }
    globs.iter().try_for_each(|glob| validate_files_glob(glob))
}

/// A positive entry: the directory it is read from and the pattern after it,
/// if any. Without a pattern it names an exact file, or a directory and
/// everything under it.
pub(crate) struct Positive {
    text: String,
    root: String,
    remainder: Option<String>,
}

impl Positive {
    /// Split at its literal prefix, see `literal_prefix`.
    pub(crate) fn parse(glob: &str) -> Result<Self> {
        let (root, remainder) = literal_prefix(glob)?;
        Ok(Self {
            text: glob.to_string(),
            root,
            remainder: remainder.map(str::to_string),
        })
    }

    /// `path` as written, whatever characters it has.
    pub(crate) fn exact(path: &str) -> Self {
        Self {
            text: path.to_string(),
            root: path.to_string(),
            remainder: None,
        }
    }
}

/// A `!` entry split at its literal prefix. The prefix is compared as text;
/// only the remainder is a glob. Without a remainder it names an exact file,
/// or a directory whose whole contents are excluded.
pub(crate) struct Negation {
    root: String,
    remainder: Option<Arc<NxGlobSet>>,
}

impl Negation {
    pub(crate) fn parse(glob: &str) -> Result<Self> {
        let normalized = normalize_glob(glob);
        let body = normalized.strip_prefix('!').unwrap_or(&normalized);
        let (root, remainder) = literal_prefix(body)?;
        if root.is_empty() && remainder.is_none() {
            bail!("The includeIgnored fileset \"{glob}\" names nothing to exclude.");
        }
        let remainder = remainder.map(|rest| build_glob_set(&[rest])).transpose()?;
        Ok(Self { root, remainder })
    }

    /// Excludes `path` as written: a file, or a directory and everything under it.
    pub(crate) fn exact(path: &str) -> Self {
        Self {
            root: path.to_string(),
            remainder: None,
        }
    }

    fn excludes(&self, path: &str) -> bool {
        let rest = if self.root.is_empty() {
            Some(path)
        } else {
            path.strip_prefix(self.root.as_str()).and_then(|rest| {
                if rest.is_empty() {
                    Some(rest)
                } else {
                    rest.strip_prefix('/')
                }
            })
        };
        match (&self.remainder, rest) {
            (_, None) => false,
            (None, Some(_)) => true,
            (Some(set), Some(rest)) => set.is_match(rest),
        }
    }
}

/// What a walk found, and what it saw or passed over on the way.
struct Walked {
    found: Vec<(String, Option<FileStamp>)>,
    view: WalkView,
}

enum Visit {
    /// A file the walk saw; `hit` is set when the pattern accepted it.
    File {
        key: u64,
        hit: Option<(String, Option<FileStamp>)>,
    },
    /// A directory the walk did not enter.
    SkippedDir(String),
}

/// Files under `start`, workspace-relative, with the stamp read on the way
/// for anything the context does not vouch for. Top-level subdirectories walk
/// in parallel. `start` itself is never skipped; its descendants are subject
/// to the hardcoded ignores, so `node_modules/foo/**` works. With
/// `canonical_root`, a linked file counts only when its target is inside it.
fn walk_files(
    start: &Path,
    workspace_root: &Path,
    canonical_root: Option<&Path>,
    skip: &NxGlobSet,
    accept: &(dyn Fn(&str) -> bool + Sync),
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Walked {
    let relative_of = |path: &Path| -> Option<String> {
        Some(
            path.strip_prefix(workspace_root)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/"),
        )
    };
    let Ok(entries) = std::fs::read_dir(start) else {
        return Walked {
            found: Vec::new(),
            view: WalkView::default(),
        };
    };
    let mut leaves = Vec::new();
    let mut dirs = Vec::new();
    for entry in entries.flatten() {
        match entry.file_type() {
            Ok(file_type) if file_type.is_dir() => dirs.push(entry.path()),
            Ok(file_type) => leaves.push((entry.path(), file_type)),
            Err(_) => {}
        }
    }
    let visit = |path: &Path, file_type: std::fs::FileType| -> Option<Visit> {
        let relative = relative_of(path)?;
        if file_type.is_symlink() {
            // Links are not followed: a linked directory is another walk's to
            // read.
            let target = std::fs::metadata(path).ok()?;
            if target.is_dir() {
                return Some(Visit::SkippedDir(relative));
            }
            let key = path_key(&relative);
            if !accept(&relative) {
                return Some(Visit::File { key, hit: None });
            }
            if let Some(root) = canonical_root
                && !dunce::canonicalize(path).is_ok_and(|t| t.starts_with(root))
            {
                return None;
            }
            let hit = if known(&relative) {
                (relative, None)
            } else {
                (relative, Some(stamp_of(&target)))
            };
            return Some(Visit::File {
                key,
                hit: Some(hit),
            });
        }
        if !file_type.is_file() {
            return None;
        }
        let key = path_key(&relative);
        if !accept(&relative) {
            return Some(Visit::File { key, hit: None });
        }
        if known(&relative) {
            return Some(Visit::File {
                key,
                hit: Some((relative, None)),
            });
        }
        let metadata = std::fs::metadata(path).ok()?;
        Some(Visit::File {
            key,
            hit: Some((relative, Some(stamp_of(&metadata)))),
        })
    };
    let mut visited: Vec<Visit> = leaves
        .iter()
        .filter_map(|(path, file_type)| visit(path, *file_type))
        .collect();
    let nested: Vec<Vec<Visit>> = dirs
        .par_iter()
        .map(|dir| {
            if skip.is_match(dir) {
                return relative_of(dir)
                    .map(Visit::SkippedDir)
                    .into_iter()
                    .collect();
            }
            let skipped_here = std::cell::RefCell::new(Vec::new());
            let mut visits: Vec<Visit> = WalkDir::new(dir)
                .follow_links(false)
                .into_iter()
                .filter_entry(|entry| {
                    if skip.is_match(entry.path()) {
                        skipped_here.borrow_mut().extend(relative_of(entry.path()));
                        false
                    } else {
                        true
                    }
                })
                .flatten()
                .filter_map(|entry| visit(entry.path(), entry.file_type()))
                .collect();
            visits.extend(skipped_here.into_inner().into_iter().map(Visit::SkippedDir));
            visits
        })
        .collect();
    for group in nested {
        visited.extend(group);
    }
    let mut walked = Walked {
        found: Vec::new(),
        view: WalkView::default(),
    };
    for visit in visited {
        match visit {
            Visit::File { key, hit } => {
                walked.view.seen.insert(key);
                if let Some(hit) = hit {
                    walked.found.push(hit);
                }
            }
            Visit::SkippedDir(dir) => {
                walked.view.skipped.insert(dir);
            }
        }
    }
    walked
}

/// Expands an `includeIgnored` fileset group. `known` says whether the
/// workspace context tracks a path: an exact path it knows is a member
/// without touching the disk, and a walked file it knows needs no stamp.
/// Every positive glob is resolved from its literal prefix, then the
/// negations filter the result. Walks skip the same directories the workspace
/// walker never enters, but an exact path or a prefix inside one of them is
/// read as-is. Nothing outside the workspace is read, symlinks included.
pub fn expand_files_with(
    workspace_root: &Path,
    globs: &[String],
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Result<FilesExpansion> {
    let (positives, negations) = parse_group(globs)?;
    expand_entries(workspace_root, &positives, &negations, known, true, WALK)
}

/// A group's entries split at their literal prefixes, positives then negations.
fn parse_group(globs: &[String]) -> Result<(Vec<Positive>, Vec<Negation>)> {
    let negations: Vec<Negation> = globs
        .iter()
        .filter(|g| g.starts_with('!'))
        .flat_map(|g| expand_literal_braces(g))
        .map(|g| Negation::parse(&g))
        .collect::<Result<_>>()?;
    let positives: Vec<Positive> = globs
        .iter()
        .filter(|g| !g.starts_with('!'))
        .flat_map(|g| expand_literal_braces(&normalize_glob(g)))
        .map(|g| Positive::parse(&g))
        .collect::<Result<_>>()?;
    Ok((positives, negations))
}

/// `expand_files_with` for entries the caller has already split. Without
/// `confine`, an entry is read wherever it points, as a declared output is.
/// A directory `members` lists is taken from the list; any other is walked.
pub(crate) fn expand_entries(
    workspace_root: &Path,
    positives: &[Positive],
    negations: &[Negation],
    known: &(dyn Fn(&str) -> bool + Sync),
    confine: bool,
    members: Members,
) -> Result<FilesExpansion> {
    let skip = build_glob_set(HARDCODED_IGNORE_PATTERNS)?;
    let canonical_root = if confine {
        Some(dunce::canonicalize(workspace_root).with_context(|| {
            format!(
                "Cannot resolve the workspace root {}",
                workspace_root.display()
            )
        })?)
    } else {
        None
    };

    let mut found: Vec<(String, Option<FileStamp>)> = Vec::new();
    let mut missing: Vec<String> = Vec::new();
    let mut walks: Vec<WalkRecord> = Vec::new();
    let record = |prefix: &str, view: WalkView| WalkRecord {
        workspace_root: workspace_root.to_path_buf(),
        prefix: prefix.to_string(),
        view: Arc::new(view),
    };
    for entry in positives {
        let root = &entry.root;
        let remainder = entry.remainder.as_deref();
        let has_pattern = remainder.is_some();
        if !has_pattern && known(root) {
            found.push((root.clone(), None));
            continue;
        }
        let start = workspace_root.join(root);
        let Ok(metadata) = std::fs::metadata(&start) else {
            // Nothing exists under it any more, so nothing was seen.
            walks.push(record(root, WalkView::default()));
            if !has_pattern {
                missing.push(root.clone());
            }
            continue;
        };
        if let Some(canonical_root) = &canonical_root {
            // After symlink resolution, not just lexically.
            let resolved = dunce::canonicalize(&start).with_context(|| {
                format!(
                    "Cannot resolve the includeIgnored fileset \"{}\"",
                    entry.text
                )
            })?;
            if !resolved.starts_with(canonical_root) {
                bail!(
                    "The includeIgnored fileset \"{}\" resolves outside the workspace.",
                    entry.text
                );
            }
        }
        if metadata.is_file() {
            if !has_pattern {
                found.push((root.clone(), Some(stamp_of(&metadata))));
            }
            continue;
        }
        // A directory declared by its exact path means everything under it;
        // with a pattern, only the remainder after the prefix is matched.
        // Excluded files are dropped before they are stat'ed.
        let excluded = |path: &str| negations.iter().any(|n| n.excludes(path));
        let accept: Box<dyn Fn(&str) -> bool + Sync> = if let Some(pattern) = remainder {
            // An empty root is the workspace root: the whole path is matched.
            let prefix_len = if root.is_empty() { 0 } else { root.len() + 1 };
            let set = build_glob_set(&[pattern])?;
            Box::new(move |path: &str| {
                path.len() > prefix_len && set.is_match(&path[prefix_len..]) && !excluded(path)
            })
        } else {
            Box::new(move |path: &str| !excluded(path))
        };
        if let Some(listed) = members(root) {
            // Listed files carry no stamp: the index that listed them is
            // asked for their content, or they are stat'ed when hashed.
            found.extend(
                listed
                    .into_iter()
                    .filter(|path| accept(path))
                    .map(|path| (path, None)),
            );
            continue;
        }
        let walked = walk_files(
            &start,
            workspace_root,
            canonical_root.as_deref(),
            &skip,
            &*accept,
            known,
        );
        found.extend(walked.found);
        walks.push(record(root, walked.view));
    }

    found.retain(|(path, _)| !negations.iter().any(|n| n.excludes(path)));
    missing.retain(|path| !negations.iter().any(|n| n.excludes(path)));
    found.sort_unstable_by(|a, b| a.0.cmp(&b.0));
    found.dedup_by(|a, b| a.0 == b.0);
    missing.sort_unstable();
    missing.dedup();
    let (files, stamps) = found.into_iter().unzip();
    Ok(FilesExpansion {
        files,
        stamps,
        missing,
        walks,
    })
}

/// `expand_files_with` without a workspace context: every path is checked on
/// disk.
pub fn expand_files(workspace_root: &Path, globs: &[String]) -> Result<FilesExpansion> {
    expand_files_with(workspace_root, globs, &|_| false)
}

pub(crate) fn expand_files_cached(
    workspace_root: &Path,
    key: &str,
    globs: &[String],
    cache: &FilesExpansionCache,
    known: &(dyn Fn(&str) -> bool + Sync),
    members: Members,
) -> Result<Arc<FilesExpansion>> {
    expand_cached(key, cache, || {
        let (positives, negations) = parse_group(globs)?;
        expand_entries(workspace_root, &positives, &negations, known, true, members)
    })
}

pub(crate) fn expand_cached(
    key: &str,
    cache: &FilesExpansionCache,
    expand: impl FnOnce() -> Result<FilesExpansion>,
) -> Result<Arc<FilesExpansion>> {
    if let Some(cached) = cache.get(key) {
        return Ok(Arc::clone(&cached));
    }
    let expansion = Arc::new(expand()?);
    cache.insert(key.to_string(), Arc::clone(&expansion));
    Ok(expansion)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    pub(crate) fn workspace() -> TempDir {
        let temp = TempDir::new().unwrap();
        temp.child("dist/gen/a.js").write_str("a").unwrap();
        temp.child("dist/gen/a.js.map").write_str("map").unwrap();
        temp.child("dist/gen/nested/b.js").write_str("b").unwrap();
        temp.child("dist/other/c.js").write_str("c").unwrap();
        temp.child("dist/gen/node_modules/dep/index.js")
            .write_str("dep")
            .unwrap();
        temp.child("node_modules/foo/package.json")
            .write_str("{}")
            .unwrap();
        temp
    }

    pub(crate) fn globs(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn a_directory_the_members_list_is_taken_from_the_list_not_the_disk() {
        let temp = workspace();
        let listed = |dir: &str| {
            (dir == "dist/gen").then(|| {
                globs(&[
                    "dist/gen/a.js",
                    "dist/gen/a.js.map",
                    "dist/gen/nested/b.js",
                    "dist/gen/phantom.js",
                ])
            })
        };
        let group = globs(&["dist/gen/**/*.js", "!dist/gen/nested/**"]);
        let (positives, negations) = parse_group(&group).unwrap();
        let expansion = expand_entries(
            temp.path(),
            &positives,
            &negations,
            &|_| false,
            true,
            &listed,
        )
        .unwrap();
        // The pattern and the negation apply to the list; nothing is stat'ed.
        assert_eq!(
            expansion.files,
            vec!["dist/gen/a.js", "dist/gen/phantom.js"]
        );
        assert!(expansion.stamps.iter().all(Option::is_none));
        assert!(expansion.walks.is_empty());
        // A directory the list does not hold is walked as before.
        let expansion = expand_entries(
            temp.path(),
            &parse_group(&globs(&["dist/other/**"])).unwrap().0,
            &[],
            &|_| false,
            true,
            &listed,
        )
        .unwrap();
        assert_eq!(expansion.files, vec!["dist/other/c.js"]);
        assert_eq!(expansion.walks.len(), 1);
    }

    #[test]
    fn expands_literal_brace_groups() {
        assert_eq!(
            expand_literal_braces("{nx,tsconfig.base}.json"),
            vec!["nx.json", "tsconfig.base.json"]
        );
        assert_eq!(
            expand_literal_braces("tools/{a,b}/{x,y}.ts"),
            vec![
                "tools/a/x.ts",
                "tools/a/y.ts",
                "tools/b/x.ts",
                "tools/b/y.ts"
            ]
        );
        assert_eq!(expand_literal_braces("!{a,b}.md"), vec!["!a.md", "!b.md"]);
        for unchanged in [
            "{a,*}.json",
            "{a,{b,c}}.json",
            "dist/**",
            "{a}.json",
            "{a,b/c}.ts",
        ] {
            assert_eq!(expand_literal_braces(unchanged), vec![unchanged]);
        }
    }

    #[test]
    fn a_root_brace_group_of_literals_names_exact_files_and_a_wildcard_one_walks() {
        let temp = workspace();
        temp.child("nx.json").write_str("{}").unwrap();
        temp.child("tsconfig.base.json").write_str("{}").unwrap();
        let group = globs(&["{nx,tsconfig.base,missing}.json"]);
        validate_files_globs("web", &group).unwrap();
        let expansion = expand_files(temp.path(), &group).unwrap();
        assert_eq!(expansion.files, vec!["nx.json", "tsconfig.base.json"]);
        assert_eq!(expansion.missing, vec!["missing.json"]);
        // A wildcard alternative stays a glob, walked from the workspace root.
        let walked = expand_files(temp.path(), &globs(&["{nx,*}.json"])).unwrap();
        assert_eq!(walked.files, vec!["nx.json", "tsconfig.base.json"]);
        // In-directory groups keep matching as before.
        let nested = expand_files(temp.path(), &globs(&["dist/gen/{a,nested/b}.js"])).unwrap();
        assert_eq!(nested.files, vec!["dist/gen/a.js", "dist/gen/nested/b.js"]);
    }

    #[test]
    fn refuses_a_prefix_that_leaves_the_workspace() {
        let temp = workspace();
        let outside = temp.path().parent().unwrap().join("outside-secret.txt");
        std::fs::write(&outside, "secret").unwrap();
        let err = match expand_files(temp.path(), &globs(&["../outside-secret.txt"])) {
            Err(err) => err,
            Ok(_) => panic!("a prefix outside the workspace must be refused"),
        };
        assert!(err.to_string().contains("outside the workspace"), "{err}");
        assert!(expand_files(temp.path(), &globs(&["../**"])).is_err());
        std::fs::remove_file(outside).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn skips_symlinks_whose_target_leaves_the_workspace() {
        let temp = workspace();
        let outside = temp.path().parent().unwrap().join("outside-linked.js");
        std::fs::write(&outside, "secret").unwrap();
        std::os::unix::fs::symlink(&outside, temp.path().join("dist/gen/escape.js")).unwrap();
        std::os::unix::fs::symlink(
            temp.path().join("dist/other/c.js"),
            temp.path().join("dist/gen/inside.js"),
        )
        .unwrap();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/*.js"])).unwrap();
        assert_eq!(expansion.files, vec!["dist/gen/a.js", "dist/gen/inside.js"]);
        // An exact path that is itself a link out of the workspace is refused.
        assert!(expand_files(temp.path(), &globs(&["dist/gen/escape.js"])).is_err());
        std::fs::remove_file(outside).unwrap();
    }

    #[test]
    fn expands_from_the_literal_prefix_and_applies_negations() {
        let temp = workspace();
        let expansion = expand_files(
            temp.path(),
            &globs(&["dist/gen/**/*.js", "!dist/gen/**/*.map"]),
        )
        .unwrap();
        assert_eq!(
            expansion.files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        assert!(expansion.missing.is_empty());
    }

    #[test]
    fn walks_skip_hardcoded_ignores_but_exact_paths_inside_them_are_read() {
        let temp = workspace();
        let walked = expand_files(temp.path(), &globs(&["dist/**"])).unwrap();
        assert!(
            !walked.files.iter().any(|f| f.contains("node_modules")),
            "{:?}",
            walked.files
        );

        let exact = expand_files(temp.path(), &globs(&["node_modules/foo/package.json"])).unwrap();
        assert_eq!(exact.files, vec!["node_modules/foo/package.json"]);

        let prefixed = expand_files(temp.path(), &globs(&["node_modules/foo/**"])).unwrap();
        assert_eq!(prefixed.files, vec!["node_modules/foo/package.json"]);
    }

    #[test]
    fn exact_directory_means_everything_under_it() {
        let temp = workspace();
        let expansion = expand_files(temp.path(), &globs(&["dist/other"])).unwrap();
        assert_eq!(expansion.files, vec!["dist/other/c.js"]);
    }

    #[test]
    fn reads_brackets_parentheses_and_escapes_as_any_fileset_does() {
        let temp = workspace();
        for file in [
            "apps/web/app/(marketing)/page.tsx",
            "apps/web/app/marketing/page.tsx",
            "apps/web/app/[id]/page.tsx",
            "apps/web/app/i/page.tsx",
            "apps/web/app/d/page.tsx",
            "apps/web/app/plain/page.tsx",
        ] {
            temp.child(file).write_str("x").unwrap();
        }
        let expand = |list: &[&str]| expand_files(temp.path(), &globs(list)).unwrap();

        // `[id]` is a character class and `(marketing)` a group, as in a
        // regular fileset; a backslash escapes brackets the same way too.
        assert_eq!(
            expand(&["apps/web/app/[id]/page.tsx"]).files,
            vec!["apps/web/app/d/page.tsx", "apps/web/app/i/page.tsx"]
        );
        assert_eq!(
            expand(&["apps/web/app/\\[id\\]/page.tsx"]).files,
            vec!["apps/web/app/[id]/page.tsx"]
        );
        assert_eq!(
            expand(&["apps/web/app/(marketing)/**"]).files,
            vec!["apps/web/app/marketing/page.tsx"]
        );
        // A negation reads the same way.
        assert_eq!(
            expand(&["apps/web/app/**/page.tsx", "!apps/web/app/[id]/**"]).files,
            vec![
                "apps/web/app/(marketing)/page.tsx",
                "apps/web/app/[id]/page.tsx",
                "apps/web/app/marketing/page.tsx",
                "apps/web/app/plain/page.tsx"
            ]
        );
        // The prefix stops before the group, so no exact path is involved.
        assert!(expand(&["apps/web/app/(absent)/x.json"]).missing.is_empty());
    }

    #[test]
    fn an_exact_path_the_context_knows_never_touches_the_disk() {
        let temp = workspace();
        // Neither path is on disk: membership comes from the context alone.
        let expansion = expand_files_with(
            temp.path(),
            &globs(&["libs/x/tracked.ts", "libs/x/absent.ts"]),
            &|path| path == "libs/x/tracked.ts",
        )
        .unwrap();
        assert_eq!(expansion.files, vec!["libs/x/tracked.ts"]);
        assert_eq!(expansion.stamps, vec![None]);
        assert_eq!(expansion.missing, vec!["libs/x/absent.ts"]);
    }

    #[test]
    fn repeated_slashes_are_normalized_and_a_bare_negation_is_rejected() {
        let temp = workspace();
        let expand = |list: &[&str]| expand_files(temp.path(), &globs(list)).unwrap();
        assert_eq!(
            expand(&["dist//gen/**", "!dist//gen//**/*.map"]).files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        assert_eq!(
            expand(&["dist/gen/"]).files,
            vec!["dist/gen/a.js", "dist/gen/a.js.map", "dist/gen/nested/b.js"]
        );
        // A negation that normalizes to nothing would exclude everything.
        for bare in ["!", "!/", "!//"] {
            let group = globs(&["dist/**", bare]);
            assert!(validate_files_globs("web", &group).is_err(), "{bare}");
            assert!(expand_files(temp.path(), &group).is_err(), "{bare}");
        }
        assert!(validate_files_globs("web", &globs(&["dist/**", "!../x"])).is_err());
        assert!(validate_files_globs("web", &globs(&["dist/./gen/**"])).is_err());
    }

    #[test]
    fn rejects_a_group_of_only_negations() {
        let err = validate_files_globs("web", &globs(&["!dist/**/*.map"])).unwrap_err();
        assert!(
            err.to_string()
                .contains("no positive includeIgnored fileset"),
            "{err}"
        );
        assert!(validate_files_globs("web", &globs(&["dist/**", "!dist/**/*.map"])).is_ok());
    }

    #[test]
    fn rejects_a_dot_slash_prefix() {
        assert!(validate_files_globs("web", &globs(&["./dist/**"])).is_err());
    }

    #[test]
    fn a_glob_with_no_leading_directory_walks_from_the_workspace_root() {
        let temp = workspace();
        temp.child("root.json").write_str("{}").unwrap();
        validate_files_globs(
            "web",
            &globs(&["**/*.js", "*.json", "dist/**/*.gen", "!**/*.map"]),
        )
        .unwrap();
        // The hardcoded skips still apply below the root, so node_modules is out.
        assert_eq!(
            expand_files(temp.path(), &globs(&["**/*.js"]))
                .unwrap()
                .files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js", "dist/other/c.js"]
        );
        assert_eq!(
            expand_files(temp.path(), &globs(&["*.json"]))
                .unwrap()
                .files,
            vec!["root.json"]
        );
        // A negation with no leading directory filters the walk the same way.
        assert_eq!(
            expand_files(temp.path(), &globs(&["**/*.js", "!**/nested/**"]))
                .unwrap()
                .files,
            vec!["dist/gen/a.js", "dist/other/c.js"]
        );
    }

    #[test]
    fn rejects_paths_that_leave_the_workspace_before_touching_the_disk() {
        for glob in ["../secret", "dist/../../secret", "/etc/passwd", "../**"] {
            let err = validate_files_globs("web", &globs(&[glob])).unwrap_err();
            assert!(
                err.to_string().contains("outside the workspace")
                    || err.to_string().contains("absolute path"),
                "{glob}: {err}"
            );
        }
    }

    #[test]
    fn keeps_at_and_plus_literal_in_the_walk_root() {
        let temp = workspace();
        temp.child("libs/app/@gen/schema.json")
            .write_str("{}")
            .unwrap();
        temp.child("libs/app/gen/schema.json")
            .write_str("{}")
            .unwrap();
        temp.child("libs/app/g+en/schema.json")
            .write_str("{}")
            .unwrap();
        temp.child("node_modules/@scope/pkg/package.json")
            .write_str("{}")
            .unwrap();
        let expand = |glob: &str| expand_files(temp.path(), &globs(&[glob])).unwrap();

        assert_eq!(
            expand("libs/app/@gen/schema.json").files,
            vec!["libs/app/@gen/schema.json"]
        );
        assert_eq!(
            expand("libs/app/@gen").files,
            vec!["libs/app/@gen/schema.json"]
        );
        assert_eq!(
            expand("libs/app/@gen/**").files,
            vec!["libs/app/@gen/schema.json"]
        );
        assert_eq!(
            expand("libs/app/g+en/schema.json").files,
            vec!["libs/app/g+en/schema.json"]
        );
        assert_eq!(
            expand("node_modules/@scope/pkg/package.json").files,
            vec!["node_modules/@scope/pkg/package.json"]
        );
        assert_eq!(
            expand("libs/app/@gen/absent.json").missing,
            vec!["libs/app/@gen/absent.json"]
        );
        assert!(validate_files_globs("web", &globs(&["@gen/**"])).is_ok());
    }
}
