//! Compares std::collections::HashMap vs hashbrown::HashMap for string-key
//! insertions — simulating the collect() at the end of get_plans_internal.

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use hashbrown::HashMap as HashbrownMap;
use std::collections::HashMap as StdMap;

fn bench_string_insert_std(c: &mut Criterion) {
    let mut group = c.benchmark_group("hashmap_string_insert");

    for n in [10usize, 100, 1110] {
        // Generate keys that look like real task IDs
        let keys: Vec<String> = (0..n)
            .map(|i| {
                format!(
                    "group-{:02}-sub-{:02}-leaf-{:02}:copy",
                    i / 100,
                    (i / 10) % 10,
                    i % 10
                )
            })
            .collect();
        let value: Vec<u8> = (0..32).collect(); // simulate a small Vec<HashInstruction>

        group.bench_with_input(BenchmarkId::new("std_hashmap", n), &n, |b, _| {
            b.iter(|| {
                let mut map: StdMap<String, Vec<u8>> = StdMap::new();
                for k in &keys {
                    map.insert(black_box(k.clone()), black_box(value.clone()));
                }
                black_box(map)
            });
        });

        group.bench_with_input(BenchmarkId::new("hashbrown_hashmap", n), &n, |b, _| {
            b.iter(|| {
                let mut map: HashbrownMap<String, Vec<u8>> = HashbrownMap::new();
                for k in &keys {
                    map.insert(black_box(k.clone()), black_box(value.clone()));
                }
                black_box(map)
            });
        });

        group.bench_with_input(
            BenchmarkId::new("hashbrown_with_capacity", n),
            &n,
            |b, _| {
                b.iter(|| {
                    let mut map: HashbrownMap<String, Vec<u8>> = HashbrownMap::with_capacity(n);
                    for k in &keys {
                        map.insert(black_box(k.clone()), black_box(value.clone()));
                    }
                    black_box(map)
                });
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_string_insert_std);
criterion_main!(benches);
