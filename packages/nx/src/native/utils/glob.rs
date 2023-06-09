use globset::{Glob, GlobSet, GlobSetBuilder};

pub(crate) fn build_glob_set(globs: Vec<String>) -> anyhow::Result<GlobSet> {
    let mut glob_builder = GlobSetBuilder::new();
    for glob in globs {
        glob_builder.add(Glob::new(&glob).map_err(anyhow::Error::from)?);
    }

    glob_builder.build().map_err(anyhow::Error::from)
}
