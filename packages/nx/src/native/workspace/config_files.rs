use rayon::prelude::*;
use nx_glob::NxGlobSet;
use crate::native::types::FileData;

/// Get workspace config files based on provided globs
pub(super) fn glob_files(
    files: &[FileData],
    globs: Vec<String>,
    exclude: Option<Vec<String>>,
) -> napi::Result<impl ParallelIterator<Item = &FileData>> {
    let globs = NxGlobSet::new(&globs)?;

    let exclude_glob_set = match exclude {
        Some(exclude) => {
            if exclude.is_empty() {
                None
            } else {
                Some(NxGlobSet::new(&exclude)?)
            }
        }
        None => None,
    };

    Ok(files.par_iter().filter(move |file_data| {
        let path = &file_data.file;
        let is_match = globs.is_match(path);

        if !is_match {
            return is_match;
        }

        exclude_glob_set
            .as_ref()
            .map(|exclude_glob_set| !exclude_glob_set.is_match(path))
            .unwrap_or(is_match)
    }))
}
