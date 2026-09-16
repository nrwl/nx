//! Reading glob text without matching anything: brace groups, the literal
//! directory prefix a walk can start from, and slash normalization.

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

/// A fileset entry that names a path with no glob syntax means that file, or
/// that directory and everything under it, so it becomes both. Which one it
/// is depends on the disk, and a glob set never looks; matching both costs
/// one extra pattern and reads the same in either case. An entry that already
/// carries a pattern, or ends in `/`, is left alone.
pub(crate) fn path_or_everything_under(glob: &str) -> Vec<String> {
    let body = glob.strip_prefix('!').unwrap_or(glob);
    // `literal_prefix` decides what counts as a pattern, so a directory named
    // `@types` or `+state` is a path here as it is everywhere else. Asking
    // the glob engine instead would call those characters syntax and leave
    // such a directory matching nothing.
    let has_pattern = literal_prefix(body).is_ok_and(|(_, rest)| rest.is_some());
    if body.is_empty() || body.ends_with('/') || has_pattern {
        return vec![glob.to_string()];
    }
    vec![glob.to_string(), format!("{glob}/**")]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_path_without_glob_syntax_also_means_everything_under_it() {
        assert_eq!(
            path_or_everything_under("libs/app/src"),
            vec!["libs/app/src", "libs/app/src/**"]
        );
        assert_eq!(
            path_or_everything_under("!libs/app/src"),
            vec!["!libs/app/src", "!libs/app/src/**"],
            "a negation excludes the directory's contents too"
        );
        for untouched in ["libs/app/**/*.ts", "libs/app/src/", "*.json", ""] {
            assert_eq!(path_or_everything_under(untouched), vec![untouched]);
        }
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
}
