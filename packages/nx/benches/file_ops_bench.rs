//! Benchmarks the hot path in _copy: copying a small file to a target where
//! the parent directory already exists (the common case during cache restore).

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::fs;
use std::path::Path;
use tempfile::TempDir;

// ── helpers ──────────────────────────────────────────────────────────────────

/// Current implementation: guard with exists() before create_dir_all
fn copy_with_exists_guard(src: &Path, dest: &Path) -> u64 {
    let dest_parent = dest.parent().unwrap_or(dest);
    if !dest_parent.exists() {
        fs::create_dir_all(dest_parent).unwrap();
    }
    fs::copy(src, dest).unwrap()
}

/// Proposed: just call create_dir_all (it's a no-op when dir exists)
fn copy_no_exists_guard(src: &Path, dest: &Path) -> u64 {
    let dest_parent = dest.parent().unwrap_or(dest);
    fs::create_dir_all(dest_parent).unwrap();
    fs::copy(src, dest).unwrap()
}

const LOREM_MD: &str = include_str!("../../../benchmarks/lorem.md");

// ── benchmarks ───────────────────────────────────────────────────────────────

fn bench_copy_parent_exists(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_copy_parent_exists");

    // Scenario: parent directory already exists (hot path — cache restore)
    let src_dir = TempDir::new().unwrap();
    let src_file = src_dir.path().join("output.md");
    fs::write(&src_file, LOREM_MD).unwrap();

    let dest_dir = TempDir::new().unwrap();
    // Pre-create the parent — this is the common case
    let dest_parent = dest_dir.path().join("packages/group-01/sub-01/leaf-01/copy-out");
    fs::create_dir_all(&dest_parent).unwrap();

    group.bench_function("with_exists_guard", |b| {
        b.iter(|| {
            let dest = dest_parent.join("output.md");
            let _ = fs::remove_file(&dest); // clean up from last iter
            copy_with_exists_guard(black_box(&src_file), black_box(&dest))
        });
    });

    group.bench_function("no_exists_guard", |b| {
        b.iter(|| {
            let dest = dest_parent.join("output.md");
            let _ = fs::remove_file(&dest);
            copy_no_exists_guard(black_box(&src_file), black_box(&dest))
        });
    });

    group.finish();
}

fn bench_copy_parent_missing(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_copy_parent_missing");

    // Scenario: parent does NOT exist (cold start, first copy)
    let src_dir = TempDir::new().unwrap();
    let src_file = src_dir.path().join("output.md");
    fs::write(&src_file, LOREM_MD).unwrap();

    group.bench_function("with_exists_guard", |b| {
        b.iter(|| {
            let dest_dir = TempDir::new().unwrap();
            let dest = dest_dir.path().join("packages/group-01/sub-01/leaf-01/copy-out/output.md");
            copy_with_exists_guard(black_box(&src_file), black_box(&dest))
        });
    });

    group.bench_function("no_exists_guard", |b| {
        b.iter(|| {
            let dest_dir = TempDir::new().unwrap();
            let dest = dest_dir.path().join("packages/group-01/sub-01/leaf-01/copy-out/output.md");
            copy_no_exists_guard(black_box(&src_file), black_box(&dest))
        });
    });

    group.finish();
}

criterion_group!(benches, bench_copy_parent_exists, bench_copy_parent_missing);
criterion_main!(benches);
