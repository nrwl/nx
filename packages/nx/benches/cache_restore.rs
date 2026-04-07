//! Benchmarks for cache restore (copy_files_from_cache)
//!
//! Simulates restoring 10 cache entries, each with the same directory structure
//! as the real benchmark workspace: packages/group-XX/sub-YY/leaf-ZZ/copy-out/output.md

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

/// Mirrors the current implementation: copies the entire hash dir to workspace root
fn restore_full_hash_dir(hash_dir: &Path, workspace: &Path, relative_output: &str) {
    // Remove existing output
    let _ = fs::remove_dir_all(workspace.join(relative_output));
    // Copy full hash dir -> workspace (current approach)
    copy_dir_all(hash_dir, workspace).unwrap();
}

/// Mirrors the proposed optimization: copy only the specific output path
fn restore_targeted(hash_dir: &Path, workspace: &Path, relative_output: &str) {
    let src = hash_dir.join(relative_output);
    let dst = workspace.join(relative_output);
    let _ = fs::remove_dir_all(&dst);
    fs::create_dir_all(dst.parent().unwrap()).unwrap();
    copy_dir_all(&src, &dst).unwrap();
}

/// Simplified copy_dir_all (same logic as file_ops.rs)
fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<u64> {
    fs::create_dir_all(dst)?;
    let mut total = 0u64;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            total += copy_dir_all(&entry.path(), &dst_path)?;
        } else {
            total += fs::copy(entry.path(), dst_path)?;
        }
    }
    Ok(total)
}

/// Create a realistic cache entry directory:
/// hash_dir/packages/group-XX/sub-YY/leaf-ZZ/copy-out/output.md
fn make_cache_entry(base: &Path, group: u32, sub: u32, leaf: u32) -> (PathBuf, String) {
    let relative = format!(
        "packages/group-{:02}/sub-{:02}/leaf-{:02}/copy-out",
        group, sub, leaf
    );
    let output_file = base.join(&relative).join("output.md");
    fs::create_dir_all(output_file.parent().unwrap()).unwrap();
    fs::write(&output_file, LOREM_MD).unwrap();
    (base.to_path_buf(), relative)
}

const LOREM_MD: &str = include_str!("../../../benchmarks/lorem.md");

fn bench_restore(c: &mut Criterion) {
    let mut group = c.benchmark_group("cache_restore");

    // Use 10 entries to represent typical batch size (full 1110 would be too slow for criterion)
    let n = 10usize;

    // Pre-build cache entries in temp dirs
    let cache_dirs: Vec<TempDir> = (0..n).map(|_| TempDir::new().unwrap()).collect();
    let entries: Vec<(PathBuf, String)> = (0..n)
        .map(|i| {
            let dir = &cache_dirs[i];
            make_cache_entry(
                dir.path(),
                (i / 10 + 1) as u32,
                (i % 10 + 1) as u32,
                1,
            )
        })
        .collect();

    group.bench_function("full_hash_dir_copy", |b| {
        let workspace = TempDir::new().unwrap();
        // Pre-create workspace structure
        for (_, rel) in &entries {
            fs::create_dir_all(workspace.path().join(rel).parent().unwrap()).unwrap();
        }
        b.iter(|| {
            for (hash_dir, rel) in &entries {
                restore_full_hash_dir(
                    black_box(hash_dir.as_path()),
                    black_box(workspace.path()),
                    black_box(rel.as_str()),
                );
            }
        });
    });

    group.bench_function("targeted_copy", |b| {
        let workspace = TempDir::new().unwrap();
        for (_, rel) in &entries {
            fs::create_dir_all(workspace.path().join(rel).parent().unwrap()).unwrap();
        }
        b.iter(|| {
            for (hash_dir, rel) in &entries {
                restore_targeted(
                    black_box(hash_dir.as_path()),
                    black_box(workspace.path()),
                    black_box(rel.as_str()),
                );
            }
        });
    });

    group.finish();
}

criterion_group!(benches, bench_restore);
criterion_main!(benches);
