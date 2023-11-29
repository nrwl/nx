use crate::native::utils::normalize_trait::Normalize;
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

pub fn normalize_os_path(path: &Path) -> PathBuf {
    let mut components = path.components().peekable();
    let mut ret = if let Some(c @ Component::Prefix(..)) = components.peek().cloned() {
        components.next();
        PathBuf::from(c.as_os_str())
    } else {
        PathBuf::new()
    };

    for component in components {
        match component {
            Component::Prefix(..) => unreachable!(),
            Component::RootDir => {
                ret.push(component.as_os_str());
            }
            Component::CurDir => {}
            Component::ParentDir => {
                ret.pop();
            }
            Component::Normal(c) => {
                ret.push(c);
            }
        }
    }
    ret
}
