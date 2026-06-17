//! Pure-math helpers shared by the Linux cgroup reader and the Windows Job
//! Object reader. Kept cfg-free so the unit tests run on every OS.

/// Convert a Job Object `CpuRate` (units of 1/10000) into whole cores.
/// `ceil(host × rate / 10000)` matches Docker `--cpus` semantics. Clamps to
/// `[1, host_cpu_count]`.
pub(super) fn cores_from_cpu_rate(host_cpu_count: u32, rate: u32) -> u32 {
    let raw = (host_cpu_count as u64 * rate as u64).div_ceil(10000);
    (raw.min(host_cpu_count as u64) as u32).max(1)
}

/// Convert a CPU affinity mask into the number of allowed cores, clamped to
/// the host CPU count. Returns `None` for an empty mask — Win32 can
/// legitimately report this on hosts spanning multiple processor groups, and
/// a Job-imposed mask of zero means no constraint was set.
pub(super) fn cores_from_affinity_mask(mask: u64, host_cpu_count: u32) -> Option<u32> {
    if mask == 0 {
        return None;
    }
    Some(mask.count_ones().min(host_cpu_count))
}

/// Accept a memory limit value when it is strictly positive and (when
/// `host_total > 0`) strictly less than host RAM. Filters both cgroup v1's
/// `PAGE_COUNTER_MAX`-style "no limit" sentinel and Job Object fields that
/// are unset or default to the host total.
pub(super) fn is_finite_memory_limit(value: u64, host_total: u64) -> bool {
    value > 0 && (host_total == 0 || value < host_total)
}

/// Seed-or-tighten: returns `Some(min(current, value))`, treating `None` as
/// "no value yet" rather than as a participating minimum.
pub(super) fn take_min<T: Ord>(current: Option<T>, value: T) -> Option<T> {
    Some(match current {
        Some(prev) => prev.min(value),
        None => value,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cores_from_cpu_rate_ceils_and_clamps() {
        // Docker `--cpus 2` on a 16-core host: rate = 1250 (12.5%).
        assert_eq!(cores_from_cpu_rate(16, 1250), 2);
        // Fractional rate rounds up.
        assert_eq!(cores_from_cpu_rate(16, 1251), 3);
        // Sub-core ratio clamps to 1.
        assert_eq!(cores_from_cpu_rate(16, 1), 1);
        // Full rate equals host count.
        assert_eq!(cores_from_cpu_rate(16, 10000), 16);
        // Over-spec rates (some kernels accept > 10000) clamp to host.
        assert_eq!(cores_from_cpu_rate(8, 20000), 8);
    }

    #[test]
    fn cores_from_affinity_mask_clamps_and_filters_empty() {
        assert_eq!(cores_from_affinity_mask(0, 8), None);
        assert_eq!(cores_from_affinity_mask(0b1, 8), Some(1));
        assert_eq!(cores_from_affinity_mask(0b11, 8), Some(2));
        // Mask wider than host: clamped to host.
        assert_eq!(cores_from_affinity_mask(0b1111, 2), Some(2));
        // Lower-clamp boundary at host = 1.
        assert_eq!(cores_from_affinity_mask(0b1111, 1), Some(1));
        // Fully populated 64-bit mask: clamped to host.
        assert_eq!(cores_from_affinity_mask(u64::MAX, 8), Some(8));
    }

    #[test]
    fn is_finite_memory_limit_filters_zero_and_host_relative_values() {
        assert!(is_finite_memory_limit(
            4 * 1024 * 1024 * 1024,
            8 * 1024 * 1024 * 1024
        ));
        // Equal to host: reject (Job Object MaximumWorkingSetSize defaults).
        assert!(!is_finite_memory_limit(
            8 * 1024 * 1024 * 1024,
            8 * 1024 * 1024 * 1024
        ));
        // Above host (PAGE_COUNTER_MAX-style sentinel): reject.
        assert!(!is_finite_memory_limit(
            0x7FFFFFFFFFFFF000,
            8 * 1024 * 1024 * 1024
        ));
        assert!(!is_finite_memory_limit(0, 8 * 1024 * 1024 * 1024));
        assert!(!is_finite_memory_limit(0, 0));
        // host_total == 0 (sysinfo failure): accept any positive value.
        assert!(is_finite_memory_limit(1, 0));
    }

    #[test]
    fn take_min_starts_then_tightens() {
        assert_eq!(take_min::<u32>(None, 5), Some(5));
        assert_eq!(take_min(Some(8), 5), Some(5));
        assert_eq!(take_min(Some(3), 5), Some(3));
    }
}
