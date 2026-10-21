use rayon::prelude::*;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

/// How much of a script is kept: room for the shebang line and the comment
/// directives that follow it.
pub const HEADER_BYTES: usize = 512;

/// A workspace file that starts with `#!`, with its header (see
/// `read_shebang_header`).
#[napi(object)]
#[derive(Debug, Clone, PartialEq)]
pub struct ShebangFile {
    pub file: String,
    pub header: String,
}

/// The `files` (workspace-relative) that start with `#!`, each with its header
/// (see `read_shebang_header`), read in parallel and sorted by path. Files that
/// cannot be read are left out.
#[napi]
pub fn read_shebang_headers(workspace_root: String, files: Vec<String>) -> Vec<ShebangFile> {
    let root = PathBuf::from(workspace_root);
    let mut found: Vec<ShebangFile> = files
        .into_par_iter()
        .filter_map(|file| {
            read_shebang_header(&root.join(&file)).map(|header| ShebangFile { file, header })
        })
        .collect();
    found.sort_by(|a, b| a.file.cmp(&b.file));
    found
}

/// `shebang_header` of a file on disk, reading no more than the cap. `None`
/// when the file cannot be read, as a tracked broken symlink cannot.
pub fn read_shebang_header(path: &Path) -> Option<String> {
    let mut head = Vec::with_capacity(HEADER_BYTES);
    File::open(path)
        .ok()?
        .take(HEADER_BYTES as u64)
        .read_to_end(&mut head)
        .ok()?;
    shebang_header(&head)
}

/// The opening text of a file that starts with `#!`, or `None` for any other
/// file. Capped at `HEADER_BYTES`; when the cap falls inside a line that line
/// is dropped, so a directive is never read truncated.
pub fn shebang_header(content: &[u8]) -> Option<String> {
    let text = content.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(content);
    if !text.starts_with(b"#!") {
        return None;
    }
    if content.len() < HEADER_BYTES {
        return Some(String::from_utf8_lossy(text).into_owned());
    }
    // The cap counts raw bytes, so a byte order mark is part of it.
    let head = &text[..HEADER_BYTES - (content.len() - text.len())];
    let kept = match head.iter().rposition(|b| *b == b'\n') {
        Some(end) => &head[..end],
        None => head,
    };
    Some(String::from_utf8_lossy(kept).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    #[test]
    fn reads_the_headers_of_the_given_files() {
        let temp = TempDir::new().unwrap();
        temp.child("tools/run.ts")
            .write_str("#!/usr/bin/env node\n// @nx-target-name: run\n")
            .unwrap();
        temp.child("tools/lib.ts")
            .write_str("export {};\n")
            .unwrap();
        temp.child("scripts/seed.mjs")
            .write_str("#!/usr/bin/env tsx\n")
            .unwrap();

        let headers = read_shebang_headers(
            temp.path().to_string_lossy().into_owned(),
            vec![
                "tools/run.ts".into(),
                "tools/lib.ts".into(),
                "tools/missing.ts".into(),
                "scripts/seed.mjs".into(),
            ],
        );

        assert_eq!(
            headers,
            vec![
                ShebangFile {
                    file: "scripts/seed.mjs".into(),
                    header: "#!/usr/bin/env tsx\n".into(),
                },
                ShebangFile {
                    file: "tools/run.ts".into(),
                    header: "#!/usr/bin/env node\n// @nx-target-name: run\n".into(),
                },
            ]
        );
    }

    #[test]
    fn reads_a_header_from_disk_and_skips_what_it_cannot_read() {
        let temp = TempDir::new().unwrap();
        temp.child("run.ts")
            .write_str("#!/usr/bin/env node\nconsole.log(1);\n")
            .unwrap();
        temp.child("lib.ts").write_str("export {};\n").unwrap();
        temp.child("long.ts")
            .write_str(&format!(
                "#!/usr/bin/env node\n// {}\n",
                "x".repeat(2 * HEADER_BYTES)
            ))
            .unwrap();

        assert_eq!(
            read_shebang_header(&temp.path().join("run.ts")).as_deref(),
            Some("#!/usr/bin/env node\nconsole.log(1);\n")
        );
        assert_eq!(read_shebang_header(&temp.path().join("lib.ts")), None);
        assert_eq!(read_shebang_header(&temp.path().join("missing.ts")), None);
        assert_eq!(
            read_shebang_header(&temp.path().join("long.ts")).as_deref(),
            Some("#!/usr/bin/env node")
        );
    }

    #[test]
    fn keeps_a_short_script_whole() {
        assert_eq!(
            shebang_header(b"#!/usr/bin/env node\nconsole.log(1);\n").as_deref(),
            Some("#!/usr/bin/env node\nconsole.log(1);\n")
        );
    }

    #[test]
    fn ignores_files_without_a_shebang() {
        assert_eq!(shebang_header(b"const a = 1;\n"), None);
        assert_eq!(shebang_header(b""), None);
        assert_eq!(shebang_header(b"\n#!/usr/bin/env node\n"), None);
    }

    #[test]
    fn sees_through_a_byte_order_mark() {
        assert_eq!(
            shebang_header(b"\xEF\xBB\xBF#!/usr/bin/env node\n").as_deref(),
            Some("#!/usr/bin/env node\n")
        );
    }

    #[test]
    fn drops_the_line_the_cap_cuts() {
        let mut content = b"#!/usr/bin/env node\n// @nx-target-name: serve\n".to_vec();
        content.extend(std::iter::repeat_n(b'x', 2 * HEADER_BYTES));
        assert_eq!(
            shebang_header(&content).as_deref(),
            Some("#!/usr/bin/env node\n// @nx-target-name: serve")
        );
    }

    #[test]
    fn drops_the_line_the_cap_cuts_behind_a_byte_order_mark() {
        let mut content = b"\xEF\xBB\xBF#!/usr/bin/env node\n// ".to_vec();
        content.extend(std::iter::repeat_n(b'x', 500 - content.len() - 1));
        content.push(b'\n');
        content.extend(b"// @nx-target-name: serve-all\n");
        // What a capped read hands over: the directive straddles the cap.
        let header = shebang_header(&content[..HEADER_BYTES]).unwrap();
        assert!(header.ends_with('x'), "{header:?}");
        assert!(!header.contains("@nx-target-name"), "{header:?}");
    }

    #[test]
    fn keeps_a_capped_header_without_a_newline() {
        let content: Vec<u8> = b"#!"
            .iter()
            .copied()
            .chain(std::iter::repeat_n(b'a', 2 * HEADER_BYTES))
            .collect();
        assert_eq!(shebang_header(&content).unwrap().len(), HEADER_BYTES);
    }

    #[test]
    fn replaces_bytes_a_cut_leaves_invalid() {
        let mut content = b"#!/usr/bin/env node ".to_vec();
        content.extend(std::iter::repeat_n(b'a', HEADER_BYTES - content.len() - 1));
        // A two-byte character straddling the cap, with no newline to cut at.
        content.extend("é".as_bytes());
        let header = shebang_header(&content).unwrap();
        assert!(header.ends_with('\u{FFFD}'), "{header:?}");
    }
}
