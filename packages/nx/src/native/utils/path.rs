use crate::native::{types::FileData, utils::normalize_trait::Normalize};
use std::path::{Component, Path, PathBuf};

impl Normalize for Path {
    fn to_normalized_string(&self) -> String {
        normalize_nx_path(self)
    }
}

impl Normalize for PathBuf {
    fn to_normalized_string(&self) -> String {
        normalize_nx_path(self)
    }
}

fn normalize_nx_path<P>(path: P) -> String
where
    P: AsRef<Path>,
{
    if path.as_ref() == Path::new("") {
        return ".".into();
    }

    // convert back-slashes in Windows paths, since the js expects only forward-slash path separators
    if cfg!(windows) {
        path.as_ref().display().to_string().replace('\\', "/")
    } else {
        path.as_ref().display().to_string()
    }
}

pub fn get_child_files<P: AsRef<Path>>(directory: P, files: Vec<FileData>) -> Vec<String> {
    files
        .into_iter()
        .filter(|file_data| Path::new(&file_data.file).starts_with(directory.as_ref()))
        .map(|file_data| file_data.file)
        .collect()
}

pub fn join_paths(base: &Path, relative: &str) -> PathBuf {
    let mut path = base.to_path_buf();

    let relative_path = Path::new(relative);

    if relative_path.is_absolute() {
        return relative_path.to_path_buf();
    }

    for component in relative_path.components() {
        match component {
            Component::ParentDir => {
                path.pop();
            }
            Component::CurDir => {}
            Component::Normal(c) => path.push(c),
            _ => {}
        }
    }

    path
}

/// Get the relative path from `from` to `to`.
///
/// # Example
/// ```
/// // From /a/b/c to /a/d/e returns "../../d/e"
/// // From /a/b to /a/b/c returns "c"
/// // From /a/b/c to /a/b/c returns "."
/// ```
pub fn get_relative_path<P: AsRef<Path>>(from: P, to: P) -> String {
    let from_path = from.as_ref();
    let to_path = to.as_ref();

    // Normalize both paths
    let from_components: Vec<&std::ffi::OsStr> = from_path
        .components()
        .filter_map(|c| match c {
            Component::Normal(n) => Some(n.as_ref()),
            _ => None,
        })
        .collect();

    let to_components: Vec<&std::ffi::OsStr> = to_path
        .components()
        .filter_map(|c| match c {
            Component::Normal(n) => Some(n.as_ref()),
            _ => None,
        })
        .collect();

    // Find the common prefix length
    let common_len = from_components
        .iter()
        .zip(to_components.iter())
        .take_while(|(a, b)| a == b)
        .count();

    // Calculate how many parent directories we need
    let ups = from_components.len() - common_len;

    // Build the relative path
    let mut result = vec!["..".to_string(); ups];
    result.extend(
        to_components[common_len..]
            .iter()
            .map(|c| c.to_string_lossy().to_string()),
    );

    if result.is_empty() {
        ".".to_string()
    } else {
        result.join("/")
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn should_get_child_files() {
        let directory = PathBuf::from("foo");
        let files = vec![
            FileData {
                file: "foo/bar".into(),
                hash: "123".into(),
            },
            FileData {
                file: "foo/baz".into(),
                hash: "123".into(),
            },
            FileData {
                file: "foo/child/bar".into(),
                hash: "123".into(),
            },
            FileData {
                file: "bar/baz".into(),
                hash: "123".into(),
            },
            FileData {
                file: "foo-other/not-child".into(),
                hash: "123".into(),
            },
        ];
        let child_files = get_child_files(&directory, files);
        assert_eq!(child_files, ["foo/bar", "foo/baz", "foo/child/bar",]);
    }

    #[test]
    fn should_get_relative_path_sibling() {
        assert_eq!(get_relative_path("a/b/c", "a/d/e"), "../../d/e");
    }

    #[test]
    fn should_get_relative_path_child() {
        assert_eq!(get_relative_path("a/b", "a/b/c"), "c");
    }

    #[test]
    fn should_get_relative_path_parent() {
        assert_eq!(get_relative_path("a/b/c/d", "a/b"), "../..");
    }

    #[test]
    fn should_get_relative_path_same() {
        assert_eq!(get_relative_path("a/b/c", "a/b/c"), ".");
    }

    #[test]
    fn should_get_relative_path_deeply_nested() {
        assert_eq!(
            get_relative_path("a/b/c/d/e", "a/x/y/z"),
            "../../../../x/y/z"
        );
    }
}
