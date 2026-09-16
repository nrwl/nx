//! The glob text rules: brace groups, the literal prefix a walk starts
//! from, slash normalization, and what a fileset may not say.

use std::path::Path;

use anyhow::{Result, bail};

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
