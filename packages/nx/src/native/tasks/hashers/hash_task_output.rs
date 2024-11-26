use std::path::Path;
use crate::native::cache::expand_outputs::get_files_for_outputs;
use crate::native::glob::build_glob_set;
use crate::native::hasher::{hash_array, hash_file};
use anyhow::*;
use rayon::prelude::*;
use tracing::trace;

pub fn hash_task_output(workspace_root: &str, glob: &str, outputs: &[String]) -> Result<String> {
    let now = std::time::Instant::now();
    let output_files = get_files_for_outputs(workspace_root.to_string(), outputs.to_vec())?;
    trace!("get_files_for_outputs: {:?}", now.elapsed());
    let glob = build_glob_set(&[glob])?;
    let hashes = output_files
        .into_par_iter()
        .filter(|file| glob.is_match(file))
        .filter_map(|file| hash_file(Path::new(workspace_root).join(file).to_str().expect("path contains invalid utf-8").to_owned()))
        .collect::<Vec<_>>();
    Ok(hash_array(hashes))
}
