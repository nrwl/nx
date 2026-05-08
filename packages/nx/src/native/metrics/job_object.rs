//! Windows Job Object resource limit detection (Windows only).
//!
//! Windows analog to the Linux `cgroup` module: detects CPU and memory limits
//! imposed on the calling process by the Job Object it belongs to — the
//! standard kernel-enforced mechanism used by process-isolated Windows
//! containers (Docker `--cpus`, `--memory`, etc.) and other sandboxed Windows
//! workloads.
//!
//! ## CPU
//! - `JOBOBJECT_CPU_RATE_CONTROL_INFORMATION` with `HARD_CAP` set:
//!   `ceil(host_cpu_count × CpuRate / 10000)`. Docker's `--cpus N` translates
//!   to HARD_CAP rate control on Windows.
//! - `JOBOBJECT_BASIC_LIMIT_INFORMATION.Affinity` (when `LIMIT_AFFINITY` set):
//!   the popcount of the Job-imposed CPU mask.
//! - `GetProcessAffinityMask`: the kernel's effective process mask, which
//!   reflects Job-imposed limits AND any manual `SetProcessAffinityMask` AND
//!   the system mask intersection.
//! - The function returns the minimum of those that are set.
//!
//! `WEIGHT_BASED` rate control (Docker `--cpu-shares`) is intentionally
//! ignored — it's a relative priority (1–9), not a hard ceiling. Mirrors how
//! the Linux path ignores `cpu.weight` / `cpu.shares`.
//!
//! Soft rate control (`ENABLE` set, no `HARD_CAP`, no `WEIGHT_BASED`) is also
//! ignored: per MSDN, without `HARD_CAP` the kernel permits transient bursts
//! above `CpuRate`, so it is not a defensible ceiling for "available cores".
//!
//! ## Memory
//! Mirrors HotSpot's and .NET's pattern: take the minimum of any that are set
//! among `ProcessMemoryLimit`, `JobMemoryLimit`, and `MaximumWorkingSetSize`,
//! gated on their respective `LIMIT_*` flags. Working set is a soft (paging)
//! limit but is included for parity with the reference implementations.
//!
//! ## Failure handling
//! Any API failure (`IsProcessInJob` or `QueryInformationJobObject`) is
//! treated as "no information" — the caller falls back to host values.
//! Matches what HotSpot's `os_windows.cpp` and .NET CoreCLR's
//! `gcenv.windows.cpp` do.
//!
//! Implementation cross-references: OpenJDK HotSpot `os_windows.cpp`
//! (uses Job affinity and memory limits, does NOT consult rate control), .NET
//! CoreCLR `gc/windows/gcenv.windows.cpp` (memory only). HARD_CAP rate
//! detection is our addition for parity with Docker `--cpus` semantics.
//!
//! ## Known limitation: nested Job hierarchies
//!
//! `QueryInformationJobObject(NULL, ...)` returns the **immediate** Job's
//! settings. Per MSDN: "If the job is nested, the immediate job of the
//! calling process is used." Win32 exposes no documented API to enumerate
//! or query parent Jobs in the chain.
//!
//! Per MSDN's `JOBOBJECT_CPU_RATE_CONTROL_INFORMATION` Remarks, "the rates
//! set for the job represent its portion of the CPU rate that is allocated
//! to its parent job" — i.e. nested rates compose multiplicatively. So a
//! parent HARD_CAP of 50% with a child HARD_CAP of 50% yields an effective
//! 25% of host, but our reader sees the child's 50% and reports
//! `ceil(host × 0.5)`. Per-process / per-job memory limits have the same
//! shape: the kernel enforces the tightest in the chain, but we see only
//! the immediate Job.
//!
//! Affinity is robust: `GetProcessAffinityMask` returns the kernel-effective
//! mask, already reflecting all parents.
//!
//! HotSpot and .NET CoreCLR exhibit the same memory limitation (single
//! immediate-job query, no parent walk). HARD_CAP CPU-rate detection goes
//! beyond them for Docker `--cpus` parity in the common single-silo case;
//! the nested-Job overreport is the documented cost of that addition.

use std::mem;

use winapi::shared::minwindef::{BOOL, DWORD, FALSE};
use winapi::um::jobapi::IsProcessInJob;
use winapi::um::jobapi2::QueryInformationJobObject;
use winapi::um::processthreadsapi::GetCurrentProcess;
use winapi::um::winbase::GetProcessAffinityMask;
use winapi::um::winnt::{
    JOB_OBJECT_CPU_RATE_CONTROL_ENABLE, JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP,
    JOB_OBJECT_CPU_RATE_CONTROL_WEIGHT_BASED, JOB_OBJECT_LIMIT_AFFINITY,
    JOB_OBJECT_LIMIT_JOB_MEMORY, JOB_OBJECT_LIMIT_PROCESS_MEMORY, JOB_OBJECT_LIMIT_WORKINGSET,
    JOBOBJECT_CPU_RATE_CONTROL_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JobObjectCpuRateControlInformation, JobObjectExtendedLimitInformation,
};

/// Read the effective CPU core count derived from the Job Object the calling
/// process belongs to. Returns `None` when the process is not in a Job, when
/// no Job-derived limits are set, or when the queries fail.
pub(super) fn read_job_cpu_quota_cores(host_cpu_count: u32) -> Option<u32> {
    if !is_in_job_object()? {
        return None;
    }

    let mut tightest: Option<u32> = None;

    if let Some(rate) = read_cpu_hard_cap_rate() {
        let cap = ((host_cpu_count as u64 * rate as u64).div_ceil(10000) as u32).max(1);
        tightest = take_min(tightest, cap.min(host_cpu_count));
    }

    if let Some(ext) = read_extended_limit_info() {
        let basic = &ext.BasicLimitInformation;
        if basic.LimitFlags & JOB_OBJECT_LIMIT_AFFINITY != 0 && basic.Affinity != 0 {
            // Affinity is `ULONG_PTR` (usize on x64). Bit count == # of CPUs the
            // job is allowed to schedule on.
            let count = basic.Affinity.count_ones();
            tightest = take_min(tightest, count.min(host_cpu_count));
        }
    }

    if let Some(count) = read_process_affinity_count() {
        tightest = take_min(tightest, count.min(host_cpu_count));
    }

    tightest
}

/// Read the effective memory limit in bytes derived from the Job Object the
/// calling process belongs to. Returns `None` when the process is not in a
/// Job, when no memory limit is set, or when the query fails. `host_total` is
/// used to filter values that are unset or exceed host RAM.
pub(super) fn read_job_memory_limit_bytes(host_total: u64) -> Option<u64> {
    if !is_in_job_object()? {
        return None;
    }

    let ext = read_extended_limit_info()?;
    let flags = ext.BasicLimitInformation.LimitFlags;
    let mut tightest: Option<u64> = None;
    let mut update = |value: u64| {
        if value > 0 && (host_total == 0 || value < host_total) {
            tightest = take_min(tightest, value);
        }
    };

    if flags & JOB_OBJECT_LIMIT_PROCESS_MEMORY != 0 {
        update(ext.ProcessMemoryLimit as u64);
    }
    if flags & JOB_OBJECT_LIMIT_JOB_MEMORY != 0 {
        update(ext.JobMemoryLimit as u64);
    }
    if flags & JOB_OBJECT_LIMIT_WORKINGSET != 0 {
        // Working set is paging-enforced (soft), but HotSpot and .NET both
        // include it in the min for parity.
        update(ext.BasicLimitInformation.MaximumWorkingSetSize as u64);
    }

    tightest
}

fn take_min<T: Ord>(current: Option<T>, value: T) -> Option<T> {
    Some(match current {
        Some(prev) => prev.min(value),
        None => value,
    })
}

fn is_in_job_object() -> Option<bool> {
    let mut in_job: BOOL = FALSE;
    // SAFETY: `GetCurrentProcess` returns a pseudo-handle (no resource); a
    // NULL `JobHandle` means "any job", per MSDN.
    let ok = unsafe { IsProcessInJob(GetCurrentProcess(), std::ptr::null_mut(), &mut in_job) };
    if ok == 0 { None } else { Some(in_job != 0) }
}

fn read_cpu_hard_cap_rate() -> Option<u32> {
    let mut info: JOBOBJECT_CPU_RATE_CONTROL_INFORMATION = unsafe { mem::zeroed() };
    let mut return_length: DWORD = 0;
    // SAFETY: NULL `hJob` resolves to the calling process's implicit Job per
    // MSDN. The buffer size we pass matches the struct.
    let ok = unsafe {
        QueryInformationJobObject(
            std::ptr::null_mut(),
            JobObjectCpuRateControlInformation,
            &mut info as *mut _ as *mut _,
            mem::size_of::<JOBOBJECT_CPU_RATE_CONTROL_INFORMATION>() as DWORD,
            &mut return_length,
        )
    };
    if ok == 0 {
        return None;
    }

    let flags = info.ControlFlags;
    if flags & JOB_OBJECT_CPU_RATE_CONTROL_ENABLE == 0 {
        return None;
    }
    if flags & JOB_OBJECT_CPU_RATE_CONTROL_WEIGHT_BASED != 0 {
        // Weight-based is a relative priority (1–9), not a CPU share. Skip.
        return None;
    }
    if flags & JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP == 0 {
        // Without HARD_CAP, the kernel allows transient bursts above the
        // configured rate, so it is not a defensible ceiling.
        return None;
    }

    // SAFETY: `HARD_CAP` discriminator is set without `WEIGHT_BASED`, so the
    // union member in use is `CpuRate` per MSDN.
    let rate = unsafe { *info.u.CpuRate() };
    if rate == 0 { None } else { Some(rate) }
}

fn read_extended_limit_info() -> Option<JOBOBJECT_EXTENDED_LIMIT_INFORMATION> {
    let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { mem::zeroed() };
    let mut return_length: DWORD = 0;
    // SAFETY: same as `read_cpu_hard_cap_rate` — NULL hJob = implicit Job.
    let ok = unsafe {
        QueryInformationJobObject(
            std::ptr::null_mut(),
            JobObjectExtendedLimitInformation,
            &mut info as *mut _ as *mut _,
            mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as DWORD,
            &mut return_length,
        )
    };
    if ok == 0 { None } else { Some(info) }
}

fn read_process_affinity_count() -> Option<u32> {
    let mut process_mask: usize = 0;
    let mut system_mask: usize = 0;
    // SAFETY: GetProcessAffinityMask writes two ULONG_PTR (usize) out values.
    let ok = unsafe {
        GetProcessAffinityMask(
            GetCurrentProcess(),
            &mut process_mask as *mut _ as *mut _,
            &mut system_mask as *mut _ as *mut _,
        )
    };
    // On systems with > 64 CPUs across multiple processor groups,
    // `GetProcessAffinityMask` may legitimately return 0 in `process_mask`.
    // Treat that as "unknown" rather than 0 cores.
    if ok == 0 || process_mask == 0 {
        return None;
    }
    Some(process_mask.count_ones())
}
