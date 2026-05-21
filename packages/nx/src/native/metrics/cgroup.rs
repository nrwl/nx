//! Container/cgroup-aware resource limit detection (Linux only).
//!
//! Discovers the calling process's cgroup CPU quota and memory limit by:
//! 1. Parsing `/proc/self/cgroup` to find the process's cgroup path for the
//!    requested controller.
//! 2. Parsing `/proc/self/mountinfo` to locate where that controller is mounted
//!    in the local filesystem, with bind-mount and cgroup-namespace handling
//!    (the kernel virtualizes both files to be relative to the namespace root,
//!    so the same algorithm covers namespaced and `cgroupns=host` setups).
//! 3. Composing `mount_point + (cgroup_path − mount_root)` to get the directory
//!    holding `cpu.max` / `memory.max` (cgroup v2) or `cpu.cfs_quota_us` etc.
//!    (cgroup v1, including the systemd `cpu,cpuacct` co-mount).
//! 4. Walking from the leaf up to the mount point and taking the **minimum**
//!    finite limit found at any level. The cgroup kernel subsystem enforces
//!    the tightest ancestor's limit (with hierarchical enforcement, which is
//!    always-on in v2 and the modern systemd default in v1), so reading only
//!    the leaf can overreport when a parent slice is tighter — common in
//!    Kubernetes (pod-level cgroup tighter than container, VPA in-place
//!    resize, Burstable QoS).
//!
//! Composition with `sched_getaffinity` happens in the caller — this module is
//! only concerned with cgroup-derived limits.
//!
//! mountinfo paths containing spaces, tabs, newlines, or backslashes are
//! kernel-encoded as `\040`, `\011`, `\012`, `\134` per `man 5
//! proc_pid_mountinfo`; we unescape before joining with the cgroup path so
//! pathological mount points don't break resolution.
//!
//! Implementation cross-references: Go 1.25 `internal/runtime/cgroup`,
//! uber-go/automaxprocs v1, OpenJDK `cgroupSubsystem_linux.cpp`, .NET CoreCLR
//! `gc/unix/cgroup.cpp`, libuv `src/unix/linux.c`, and Rust stdlib
//! `library/std/src/sys/thread/unix.rs::cgroups`. OpenJDK's cgroupns-host
//! suffix walk (for very old runtime + no-namespace combinations) is the only
//! published edge case we deliberately don't replicate, as it doesn't show up
//! in modern container/k8s deployments.

use std::borrow::Cow;
use std::path::{Path, PathBuf};

use tracing::debug;

use super::metrics_math::{is_finite_memory_limit, take_min};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Version {
    V1,
    V2,
}

#[derive(Debug, Clone)]
pub(super) struct CgroupLocation {
    pub version: Version,
    /// Absolute path on the local filesystem to the leaf cgroup directory.
    pub dir: PathBuf,
    /// Mount point of the cgroup hierarchy. Used as the upper bound when
    /// walking ancestors looking for tighter limits.
    pub mount_point: PathBuf,
}

/// Discover the cgroup directory for the given controller (e.g. `"cpu"`,
/// `"memory"`). Returns `None` when not running under cgroups, when /proc
/// is masked, or when the controller isn't found.
pub(super) fn discover(controller: &str) -> Option<CgroupLocation> {
    let cgroup_content = std::fs::read_to_string("/proc/self/cgroup")
        .inspect_err(|e| debug!("failed to read /proc/self/cgroup: {e}"))
        .ok()?;
    let mountinfo_content = std::fs::read_to_string("/proc/self/mountinfo")
        .inspect_err(|e| debug!("failed to read /proc/self/mountinfo: {e}"))
        .ok()?;
    let location = resolve_cgroup_dir(&cgroup_content, &mountinfo_content, controller);
    if location.is_none() {
        debug!("no cgroup mount matched controller {controller:?}");
    }
    location
}

/// Read the effective CPU quota in whole cores (rounded up) for the calling
/// process, or `None` when no quota is set anywhere up to the cgroup mountpoint.
pub(super) fn read_cpu_quota_cores() -> Option<u32> {
    let cg = discover("cpu")?;
    walk_for_limit(&cg, |dir| match cg.version {
        Version::V2 => read_v2_cpu_max(dir),
        Version::V1 => read_v1_cpu_quota(dir),
    })
}

/// Read the effective memory limit in bytes for the calling process, or `None`
/// when unlimited. `host_total` is used to filter cgroup-v1's "no limit"
/// sentinel (a value at or above host RAM is treated as unset).
pub(super) fn read_memory_limit_bytes(host_total: u64) -> Option<u64> {
    let cg = discover("memory")?;
    walk_for_limit(&cg, |dir| match cg.version {
        Version::V2 => read_v2_memory_max(dir),
        Version::V1 => read_v1_memory_limit(dir, host_total),
    })
}

/// Walk from the leaf cgroup directory up to the mount point, accumulating the
/// **minimum** finite limit across all levels. The kernel enforces the
/// tightest ancestor's limit, so a leaf with a relaxed limit under a tighter
/// parent slice would otherwise be overreported. Matches libuv's
/// `uv__get_constrained_cpu`, Rust stdlib `cgroups::quota_v{1,2}`, and .NET
/// CoreCLR's memory walker.
fn walk_for_limit<T: Ord>(cg: &CgroupLocation, read_at: impl Fn(&Path) -> Option<T>) -> Option<T> {
    let mut current = cg.dir.clone();
    let mut tightest: Option<T> = None;
    loop {
        if let Some(value) = read_at(&current) {
            tightest = take_min(tightest, value);
        }
        if current == cg.mount_point {
            return tightest;
        }
        if !current.pop() {
            return tightest;
        }
        if !current.starts_with(&cg.mount_point) {
            return tightest;
        }
    }
}

// ---------------------------------------------------------------------------
// Pure parsers (covered by unit tests; do no I/O)
// ---------------------------------------------------------------------------

/// Compose the cgroup directory path from `/proc/self/cgroup` and
/// `/proc/self/mountinfo` contents.
fn resolve_cgroup_dir(
    cgroup_content: &str,
    mountinfo_content: &str,
    controller: &str,
) -> Option<CgroupLocation> {
    let (version, cgroup_path) = parse_proc_self_cgroup(cgroup_content, controller)?;

    for line in mountinfo_content.lines() {
        let Some(entry) = parse_mountinfo_line(line) else {
            continue;
        };

        match version {
            Version::V2 if entry.fs_type != "cgroup2" => continue,
            Version::V1 => {
                if entry.fs_type != "cgroup" {
                    continue;
                }
                if !entry.super_options.split(',').any(|o| o == controller) {
                    continue;
                }
            }
            _ => {}
        }

        let mount_root = unescape_mountinfo(entry.mount_root);
        let Some(rel) = strip_path_prefix(cgroup_path, mount_root.as_ref()) else {
            // This mountpoint exposes a different subtree of the hierarchy than
            // the one our process lives in; keep searching.
            continue;
        };

        let mount_point = PathBuf::from(unescape_mountinfo(entry.mount_point).as_ref());
        let rel_clean = rel.trim_start_matches('/');
        let dir = if rel_clean.is_empty() {
            mount_point.clone()
        } else {
            mount_point.join(rel_clean)
        };

        return Some(CgroupLocation {
            version,
            dir,
            mount_point,
        });
    }

    None
}

/// Unescape the four octal sequences the kernel emits in mountinfo path fields:
/// `\040` (space), `\011` (tab), `\012` (newline), `\134` (backslash).
/// Returns the original borrowed string when no escape is present (the common
/// case) to avoid the allocation.
fn unescape_mountinfo(s: &str) -> Cow<'_, str> {
    if !s.contains('\\') {
        return Cow::Borrowed(s);
    }
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\\' && i + 3 < bytes.len() {
            let (a, b, c) = (bytes[i + 1], bytes[i + 2], bytes[i + 3]);
            if let (Some(da), Some(db), Some(dc)) = (octal_digit(a), octal_digit(b), octal_digit(c))
            {
                let value = (da << 6) | (db << 3) | dc;
                // Only the four sequences the kernel actually emits — be strict
                // to avoid corrupting unrelated backslash sequences.
                if matches!(value, b' ' | b'\t' | b'\n' | b'\\') {
                    out.push(value as char);
                    i += 4;
                    continue;
                }
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    Cow::Owned(out)
}

fn octal_digit(b: u8) -> Option<u8> {
    if (b'0'..=b'7').contains(&b) {
        Some(b - b'0')
    } else {
        None
    }
}

/// Parse `/proc/self/cgroup` and return the version + path for the controller.
/// v1 lines (e.g. `12:cpu,cpuacct:/some/path`) take precedence over the v2
/// unified line (`0::/some/path`) when both are present (hybrid hosts).
fn parse_proc_self_cgroup<'a>(content: &'a str, controller: &str) -> Option<(Version, &'a str)> {
    let mut v2_path: Option<&'a str> = None;
    for line in content.lines() {
        let mut parts = line.splitn(3, ':');
        let _id = parts.next()?;
        let controllers = parts.next()?;
        let path = parts.next()?;

        if controllers.is_empty() {
            // Unified v2 line. Tentatively record; v1 controllers below win.
            v2_path = Some(path);
        } else if controllers.split(',').any(|c| c == controller) {
            return Some((Version::V1, path));
        }
    }
    v2_path.map(|p| (Version::V2, p))
}

#[derive(Debug)]
struct MountEntry<'a> {
    mount_root: &'a str,
    mount_point: &'a str,
    fs_type: &'a str,
    super_options: &'a str,
}

/// Parse a single line of `/proc/self/mountinfo`. Format:
///   `<mount-id> <parent-id> <major:minor> <root> <mount-point> <opts> [<optional-fields>] - <fs-type> <source> <super-options>`
fn parse_mountinfo_line(line: &str) -> Option<MountEntry<'_>> {
    // The " - " separator divides the variable-length pre-fields from the
    // fixed three post-fields. Splitting on it makes parsing trivial.
    let (pre, post) = line.split_once(" - ")?;

    let mut pre_parts = pre.split_ascii_whitespace();
    let _mount_id = pre_parts.next()?;
    let _parent_id = pre_parts.next()?;
    let _major_minor = pre_parts.next()?;
    let mount_root = pre_parts.next()?;
    let mount_point = pre_parts.next()?;
    // Remaining pre-fields: <mount-options> [<optional-fields...>] — ignored.

    let mut post_parts = post.split_ascii_whitespace();
    let fs_type = post_parts.next()?;
    let _source = post_parts.next()?;
    let super_options = post_parts.next()?;

    Some(MountEntry {
        mount_root,
        mount_point,
        fs_type,
        super_options,
    })
}

/// Strip `prefix` from `path` (both as POSIX paths). Returns the remainder when
/// `path` is at or under `prefix`. Treats `/` and the empty string as no-op
/// prefixes.
fn strip_path_prefix<'a>(path: &'a str, prefix: &str) -> Option<&'a str> {
    if prefix.is_empty() || prefix == "/" {
        return Some(path);
    }
    if path == prefix {
        return Some("");
    }
    if let Some(rest) = path.strip_prefix(prefix)
        && rest.starts_with('/')
    {
        return Some(rest);
    }
    None
}

// ---------------------------------------------------------------------------
// Limit file readers
// ---------------------------------------------------------------------------

fn read_v2_cpu_max(dir: &Path) -> Option<u32> {
    let content = std::fs::read_to_string(dir.join("cpu.max")).ok()?;
    parse_v2_cpu_max(&content)
}

fn parse_v2_cpu_max(content: &str) -> Option<u32> {
    let mut parts = content.split_whitespace();
    let quota = parts.next()?;
    let period = parts.next()?;
    if quota == "max" {
        return None;
    }
    let q: u64 = quota.parse().ok()?;
    let p: u64 = period.parse().ok()?;
    cores_from_quota(q, p)
}

fn read_v1_cpu_quota(dir: &Path) -> Option<u32> {
    let q_raw = std::fs::read_to_string(dir.join("cpu.cfs_quota_us")).ok()?;
    let q: i64 = q_raw.trim().parse().ok()?;
    if q <= 0 {
        return None;
    }
    let p_raw = std::fs::read_to_string(dir.join("cpu.cfs_period_us")).ok()?;
    let p: u64 = p_raw.trim().parse().ok()?;
    cores_from_quota(q as u64, p)
}

fn cores_from_quota(quota: u64, period: u64) -> Option<u32> {
    if period == 0 {
        return None;
    }
    let cores = quota.div_ceil(period).min(u32::MAX as u64) as u32;
    Some(cores.max(1))
}

fn read_v2_memory_max(dir: &Path) -> Option<u64> {
    let content = std::fs::read_to_string(dir.join("memory.max")).ok()?;
    let trimmed = content.trim();
    if trimmed == "max" {
        return None;
    }
    trimmed.parse().ok()
}

fn read_v1_memory_limit(dir: &Path, host_total: u64) -> Option<u64> {
    let content = std::fs::read_to_string(dir.join("memory.limit_in_bytes")).ok()?;
    let bytes: u64 = content.trim().parse().ok()?;
    // v1 has no "max" sentinel; the kernel reports something around
    // `0x7FFFFFFFFFFFF000` (PAGE_COUNTER_MAX) when no limit is set, and
    // anything at or above host RAM is meaningless as a "container limit".
    is_finite_memory_limit(bytes, host_total).then_some(bytes)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ----- pure parsers -----

    #[test]
    fn cores_from_quota_rounds_up() {
        assert_eq!(cores_from_quota(600_000, 100_000), Some(6));
        assert_eq!(cores_from_quota(550_000, 100_000), Some(6)); // 5.5 → 6
        assert_eq!(cores_from_quota(150_000, 100_000), Some(2)); // 1.5 → 2
        assert_eq!(cores_from_quota(10_000, 100_000), Some(1)); // sub-core clamped to 1
        assert_eq!(cores_from_quota(100_000, 0), None);
    }

    #[test]
    fn parse_v2_cpu_max_handles_max() {
        assert_eq!(parse_v2_cpu_max("max 100000\n"), None);
        assert_eq!(parse_v2_cpu_max("600000 100000\n"), Some(6));
        assert_eq!(parse_v2_cpu_max("garbage"), None);
    }

    #[test]
    fn strip_path_prefix_handles_root_and_subpath() {
        assert_eq!(strip_path_prefix("/foo/bar", "/"), Some("/foo/bar"));
        assert_eq!(strip_path_prefix("/foo/bar", ""), Some("/foo/bar"));
        assert_eq!(strip_path_prefix("/foo/bar", "/foo"), Some("/bar"));
        assert_eq!(strip_path_prefix("/foo", "/foo"), Some(""));
        // Must not match a partial directory name.
        assert_eq!(strip_path_prefix("/foobar", "/foo"), None);
        // Path under different subtree.
        assert_eq!(strip_path_prefix("/foo", "/bar"), None);
    }

    #[test]
    fn parse_proc_self_cgroup_v2_unified() {
        let content = "0::/kubepods.slice/pod-uid/container-id\n";
        let parsed = parse_proc_self_cgroup(content, "cpu");
        assert_eq!(
            parsed,
            Some((Version::V2, "/kubepods.slice/pod-uid/container-id"))
        );
    }

    #[test]
    fn parse_proc_self_cgroup_v1_co_mount() {
        // systemd-managed cgroup v1: cpu and cpuacct are co-mounted.
        let content = "12:cpu,cpuacct:/kubepods/pod-uid/container-id\n\
                       11:memory:/kubepods/pod-uid/container-id\n";
        assert_eq!(
            parse_proc_self_cgroup(content, "cpu"),
            Some((Version::V1, "/kubepods/pod-uid/container-id"))
        );
        assert_eq!(
            parse_proc_self_cgroup(content, "cpuacct"),
            Some((Version::V1, "/kubepods/pod-uid/container-id"))
        );
        assert_eq!(
            parse_proc_self_cgroup(content, "memory"),
            Some((Version::V1, "/kubepods/pod-uid/container-id"))
        );
    }

    #[test]
    fn parse_proc_self_cgroup_hybrid_prefers_v1() {
        // Hybrid host: v1 controllers and v2 unified hierarchy both present.
        let content = "12:cpu,cpuacct:/host-cpu-path\n\
                       0::/unified-path\n";
        assert_eq!(
            parse_proc_self_cgroup(content, "cpu"),
            Some((Version::V1, "/host-cpu-path"))
        );
    }

    #[test]
    fn parse_mountinfo_line_basic() {
        let line =
            "31 27 0:27 / /sys/fs/cgroup ro,nosuid,nodev,noexec shared:9 - cgroup2 cgroup2 rw";
        let entry = parse_mountinfo_line(line).expect("parsed");
        assert_eq!(entry.fs_type, "cgroup2");
        assert_eq!(entry.mount_point, "/sys/fs/cgroup");
        assert_eq!(entry.mount_root, "/");
        assert_eq!(entry.super_options, "rw");
    }

    #[test]
    fn parse_mountinfo_line_v1_co_mount_with_optional_fields() {
        let line = "35 31 0:30 / /sys/fs/cgroup/cpu,cpuacct rw,nosuid,nodev,noexec,relatime \
                    shared:14 master:7 - cgroup cgroup rw,cpu,cpuacct";
        let entry = parse_mountinfo_line(line).expect("parsed");
        assert_eq!(entry.fs_type, "cgroup");
        assert_eq!(entry.mount_point, "/sys/fs/cgroup/cpu,cpuacct");
        assert!(entry.super_options.split(',').any(|o| o == "cpu"));
        assert!(entry.super_options.split(',').any(|o| o == "cpuacct"));
    }

    // ----- resolve_cgroup_dir orchestration -----

    #[test]
    fn resolve_v2_namespaced_container() {
        // Modern container with cgroup namespaces: kernel virtualizes
        // /proc/self/cgroup and mountinfo to be relative to the namespace root.
        let cgroup = "0::/\n";
        let mountinfo =
            "31 27 0:27 / /sys/fs/cgroup ro,nosuid,nodev,noexec shared:9 - cgroup2 cgroup2 rw\n";
        let cg = resolve_cgroup_dir(cgroup, mountinfo, "cpu").expect("resolved");
        assert_eq!(cg.version, Version::V2);
        assert_eq!(cg.dir, PathBuf::from("/sys/fs/cgroup"));
        assert_eq!(cg.mount_point, PathBuf::from("/sys/fs/cgroup"));
    }

    #[test]
    fn resolve_v2_cgroupns_host() {
        // cgroupns=host: process sees the host's cgroup tree and a host-rooted
        // cgroup path. The mount root stays "/".
        let cgroup = "0::/kubepods.slice/pod-uid/container-id\n";
        let mountinfo =
            "31 27 0:27 / /sys/fs/cgroup ro,nosuid,nodev,noexec shared:9 - cgroup2 cgroup2 rw\n";
        let cg = resolve_cgroup_dir(cgroup, mountinfo, "cpu").expect("resolved");
        assert_eq!(cg.version, Version::V2);
        assert_eq!(
            cg.dir,
            PathBuf::from("/sys/fs/cgroup/kubepods.slice/pod-uid/container-id")
        );
    }

    #[test]
    fn resolve_v2_with_bind_mount_root() {
        // Bind-mount: /sys/fs/cgroup inside the container is bind-mounted from
        // a sub-path of the host tree. The mount_root field reflects the host
        // sub-path; mountinfo is virtualized in modern kernels but we still
        // need to handle the historical mount_root != "/" case.
        let cgroup = "0::/kubepods.slice/pod-uid/container-id\n";
        let mountinfo = "31 27 0:27 /kubepods.slice/pod-uid /sys/fs/cgroup ro shared:9 \
                         - cgroup2 cgroup2 rw\n";
        let cg = resolve_cgroup_dir(cgroup, mountinfo, "cpu").expect("resolved");
        assert_eq!(cg.dir, PathBuf::from("/sys/fs/cgroup/container-id"));
    }

    #[test]
    fn resolve_v1_co_mount() {
        // systemd v1: cpu and cpuacct co-mounted at /sys/fs/cgroup/cpu,cpuacct.
        // The bug Codex flagged in the previous patch.
        let cgroup = "12:cpu,cpuacct:/kubepods/pod-uid/container-id\n";
        let mountinfo = "35 31 0:30 / /sys/fs/cgroup/cpu,cpuacct rw,nosuid shared:14 \
                         - cgroup cgroup rw,cpu,cpuacct\n";
        let cg = resolve_cgroup_dir(cgroup, mountinfo, "cpu").expect("resolved");
        assert_eq!(cg.version, Version::V1);
        assert_eq!(
            cg.dir,
            PathBuf::from("/sys/fs/cgroup/cpu,cpuacct/kubepods/pod-uid/container-id")
        );
    }

    #[test]
    fn resolve_v1_memory() {
        let cgroup = "11:memory:/kubepods/pod-uid/container-id\n";
        let mountinfo = "36 31 0:31 / /sys/fs/cgroup/memory rw,nosuid shared:15 \
                         - cgroup cgroup rw,memory\n";
        let cg = resolve_cgroup_dir(cgroup, mountinfo, "memory").expect("resolved");
        assert_eq!(cg.version, Version::V1);
        assert_eq!(
            cg.dir,
            PathBuf::from("/sys/fs/cgroup/memory/kubepods/pod-uid/container-id")
        );
    }

    #[test]
    fn resolve_returns_none_when_controller_missing() {
        let cgroup = "12:other:/path\n";
        let mountinfo = "35 31 0:30 / /sys/fs/cgroup/other rw shared:14 - cgroup cgroup rw,other\n";
        assert!(resolve_cgroup_dir(cgroup, mountinfo, "cpu").is_none());
    }

    #[test]
    fn resolve_skips_mount_unable_to_reach_cgroup() {
        // Mount root points at a subtree that doesn't contain our cgroup path.
        let cgroup = "0::/foo/bar\n";
        let mountinfo = "31 27 0:27 /unrelated /sys/fs/cgroup ro shared:9 - cgroup2 cgroup2 rw\n";
        assert!(resolve_cgroup_dir(cgroup, mountinfo, "cpu").is_none());
    }

    // ----- walk_for_limit + limit readers (touch the filesystem via tempdir) -----

    #[test]
    fn walk_for_limit_reads_leaf() {
        let tmp = TempDir::new().unwrap();
        let mount = tmp.path();
        let leaf = mount.join("a/b/c");
        fs::create_dir_all(&leaf).unwrap();
        fs::write(leaf.join("cpu.max"), "300000 100000\n").unwrap();
        let cg = CgroupLocation {
            version: Version::V2,
            dir: leaf,
            mount_point: mount.to_path_buf(),
        };
        let cores = walk_for_limit(&cg, |dir| read_v2_cpu_max(dir));
        assert_eq!(cores, Some(3));
    }

    #[test]
    fn walk_for_limit_climbs_when_leaf_unlimited() {
        // Leaf has cpu.max="max"; ancestor has a real limit.
        let tmp = TempDir::new().unwrap();
        let mount = tmp.path();
        let pod = mount.join("pod-uid");
        let container = pod.join("container-id");
        fs::create_dir_all(&container).unwrap();
        fs::write(container.join("cpu.max"), "max 100000\n").unwrap();
        fs::write(pod.join("cpu.max"), "200000 100000\n").unwrap();
        let cg = CgroupLocation {
            version: Version::V2,
            dir: container,
            mount_point: mount.to_path_buf(),
        };
        let cores = walk_for_limit(&cg, |dir| read_v2_cpu_max(dir));
        assert_eq!(cores, Some(2));
    }

    #[test]
    fn walk_for_limit_takes_min_when_parent_tighter() {
        // Codex P2: leaf has a finite limit (4 cores) but a parent slice is
        // tighter (2 cores). The kernel enforces the minimum, so we must too.
        let tmp = TempDir::new().unwrap();
        let mount = tmp.path();
        let pod = mount.join("pod-uid");
        let container = pod.join("container-id");
        fs::create_dir_all(&container).unwrap();
        fs::write(container.join("cpu.max"), "400000 100000\n").unwrap();
        fs::write(pod.join("cpu.max"), "200000 100000\n").unwrap();
        let cg = CgroupLocation {
            version: Version::V2,
            dir: container,
            mount_point: mount.to_path_buf(),
        };
        let cores = walk_for_limit(&cg, |dir| read_v2_cpu_max(dir));
        assert_eq!(cores, Some(2));
    }

    #[test]
    fn walk_for_limit_takes_min_when_leaf_tighter() {
        // Symmetric case: leaf is tighter than parent. Leaf should still win.
        let tmp = TempDir::new().unwrap();
        let mount = tmp.path();
        let pod = mount.join("pod-uid");
        let container = pod.join("container-id");
        fs::create_dir_all(&container).unwrap();
        fs::write(container.join("cpu.max"), "100000 100000\n").unwrap();
        fs::write(pod.join("cpu.max"), "400000 100000\n").unwrap();
        let cg = CgroupLocation {
            version: Version::V2,
            dir: container,
            mount_point: mount.to_path_buf(),
        };
        let cores = walk_for_limit(&cg, |dir| read_v2_cpu_max(dir));
        assert_eq!(cores, Some(1));
    }

    #[test]
    fn walk_for_limit_takes_min_for_memory() {
        // Same hierarchical-min semantic for memory.
        let tmp = TempDir::new().unwrap();
        let mount = tmp.path();
        let pod = mount.join("pod-uid");
        let container = pod.join("container-id");
        fs::create_dir_all(&container).unwrap();
        let leaf_limit = 16u64 * 1024 * 1024 * 1024;
        let pod_limit = 12u64 * 1024 * 1024 * 1024;
        fs::write(container.join("memory.max"), format!("{leaf_limit}\n")).unwrap();
        fs::write(pod.join("memory.max"), format!("{pod_limit}\n")).unwrap();
        let cg = CgroupLocation {
            version: Version::V2,
            dir: container,
            mount_point: mount.to_path_buf(),
        };
        let bytes = walk_for_limit(&cg, |dir| read_v2_memory_max(dir));
        assert_eq!(bytes, Some(pod_limit));
    }

    #[test]
    fn walk_for_limit_returns_none_when_unlimited_to_root() {
        let tmp = TempDir::new().unwrap();
        let mount = tmp.path();
        let leaf = mount.join("a");
        fs::create_dir_all(&leaf).unwrap();
        fs::write(leaf.join("cpu.max"), "max 100000\n").unwrap();
        fs::write(mount.join("cpu.max"), "max 100000\n").unwrap();
        let cg = CgroupLocation {
            version: Version::V2,
            dir: leaf,
            mount_point: mount.to_path_buf(),
        };
        assert!(walk_for_limit(&cg, |dir| read_v2_cpu_max(dir)).is_none());
    }

    #[test]
    fn read_v1_cpu_quota_handles_unlimited_sentinel() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("cpu.cfs_quota_us"), "-1\n").unwrap();
        fs::write(tmp.path().join("cpu.cfs_period_us"), "100000\n").unwrap();
        assert!(read_v1_cpu_quota(tmp.path()).is_none());
    }

    #[test]
    fn read_v1_cpu_quota_reads_value() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("cpu.cfs_quota_us"), "150000\n").unwrap();
        fs::write(tmp.path().join("cpu.cfs_period_us"), "100000\n").unwrap();
        assert_eq!(read_v1_cpu_quota(tmp.path()), Some(2)); // 1.5 → 2
    }

    #[test]
    fn read_v1_memory_limit_filters_unlimited_sentinel() {
        let tmp = TempDir::new().unwrap();
        let host_total = 64u64 * 1024 * 1024 * 1024;
        // Kernel reports something near 2^63 when unlimited; anything >= host
        // should be treated as unset.
        fs::write(
            tmp.path().join("memory.limit_in_bytes"),
            "9223372036854771712\n",
        )
        .unwrap();
        assert!(read_v1_memory_limit(tmp.path(), host_total).is_none());
    }

    #[test]
    fn read_v1_memory_limit_filters_zero() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("memory.limit_in_bytes"), "0\n").unwrap();
        assert!(read_v1_memory_limit(tmp.path(), 64 * 1024 * 1024 * 1024).is_none());
    }

    #[test]
    fn read_v1_memory_limit_reads_value() {
        let tmp = TempDir::new().unwrap();
        let host_total = 64u64 * 1024 * 1024 * 1024;
        let limit = 12u64 * 1024 * 1024 * 1024;
        fs::write(
            tmp.path().join("memory.limit_in_bytes"),
            format!("{limit}\n"),
        )
        .unwrap();
        assert_eq!(read_v1_memory_limit(tmp.path(), host_total), Some(limit));
    }

    #[test]
    fn read_v2_memory_max_handles_max() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("memory.max"), "max\n").unwrap();
        assert!(read_v2_memory_max(tmp.path()).is_none());
        fs::write(tmp.path().join("memory.max"), "12884901888\n").unwrap();
        assert_eq!(read_v2_memory_max(tmp.path()), Some(12884901888));
    }

    // ----- mountinfo octal-escape unescape -----

    #[test]
    fn unescape_mountinfo_passes_through_when_no_backslash() {
        let s = "/sys/fs/cgroup/cpu,cpuacct";
        match unescape_mountinfo(s) {
            Cow::Borrowed(b) => assert_eq!(b, s),
            Cow::Owned(_) => panic!("expected borrowed for path without backslash"),
        }
    }

    #[test]
    fn unescape_mountinfo_decodes_kernel_escapes() {
        assert_eq!(
            unescape_mountinfo("/path\\040with\\040spaces"),
            "/path with spaces"
        );
        assert_eq!(unescape_mountinfo("/tab\\011here"), "/tab\there");
        assert_eq!(unescape_mountinfo("/newline\\012here"), "/newline\nhere");
        assert_eq!(unescape_mountinfo("/back\\134slash"), "/back\\slash");
    }

    #[test]
    fn unescape_mountinfo_leaves_unrelated_backslashes_alone() {
        // Only the four kernel-emitted sequences are unescaped; unrelated
        // backslash sequences (from arbitrary content) pass through unchanged.
        assert_eq!(
            unescape_mountinfo("/path\\with\\backslash"),
            "/path\\with\\backslash"
        );
    }

    #[test]
    fn resolve_mountinfo_with_escaped_mount_point() {
        // Synthetic but valid: a mount point containing a space, encoded as \040.
        let cgroup = "0::/\n";
        let mountinfo = "31 27 0:27 / /weird\\040mount ro shared:9 - cgroup2 cgroup2 rw\n";
        let cg = resolve_cgroup_dir(cgroup, mountinfo, "cpu").expect("resolved");
        assert_eq!(cg.dir, PathBuf::from("/weird mount"));
        assert_eq!(cg.mount_point, PathBuf::from("/weird mount"));
    }
}
