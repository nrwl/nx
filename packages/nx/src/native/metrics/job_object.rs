//! Windows Job Object resource limit detection (Windows only).
//!
//! Windows analog to the Linux `cgroup` module: detects CPU and memory limits
//! imposed on the calling process by the Job Object it belongs to — the
//! standard kernel-enforced mechanism used by process-isolated Windows
//! containers (Docker `--cpus`, `--memory`, etc.) and other sandboxed Windows
//! workloads.
//!
//! ## CPU
//! Exposed as two `pub(super)` readers, mirroring the Linux arm's split
//! between cgroup-derived limits and `sched_getaffinity`:
//!
//! - [`read_job_cpu_quota_cores`] — Job-derived limits only. Returns `None`
//!   when the process is not in a Job. Inside a Job, reads
//!   `JOBOBJECT_CPU_RATE_CONTROL_INFORMATION` with `HARD_CAP` set
//!   (`ceil(host_cpu_count × CpuRate / 10000)` — Docker's `--cpus N`
//!   translates to HARD_CAP rate control). Job-imposed affinity is not read
//!   here because the kernel intersects it into the process mask, so
//!   `read_process_affinity_cores` already covers it.
//!
//! - [`read_process_affinity_cores`] — `GetProcessAffinityMask` unconditionally,
//!   honors manual `SetProcessAffinityMask` whether or not the process is in a
//!   Job. Inside a Job, the kernel intersects Job-imposed limits with manual
//!   affinity and the system mask. Matches Go's `runtime/os_windows.go`,
//!   .NET CoreCLR's `Environment.ProcessorCount`, libuv's
//!   `uv_available_parallelism`, and the no-Job branch of OpenJDK HotSpot's
//!   `active_processor_count`.
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

use tracing::debug;
use winapi::shared::minwindef::{BOOL, DWORD, FALSE};
use winapi::um::jobapi::IsProcessInJob;
use winapi::um::jobapi2::QueryInformationJobObject;
use winapi::um::processthreadsapi::GetCurrentProcess;
use winapi::um::winbase::GetProcessAffinityMask;
use winapi::um::winnt::{
    JOB_OBJECT_CPU_RATE_CONTROL_ENABLE, JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP,
    JOB_OBJECT_CPU_RATE_CONTROL_WEIGHT_BASED, JOB_OBJECT_LIMIT_JOB_MEMORY,
    JOB_OBJECT_LIMIT_PROCESS_MEMORY, JOB_OBJECT_LIMIT_WORKINGSET,
    JOBOBJECT_CPU_RATE_CONTROL_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JobObjectCpuRateControlInformation, JobObjectExtendedLimitInformation,
};

use super::metrics_math::{
    cores_from_affinity_mask, cores_from_cpu_rate, is_finite_memory_limit, take_min,
};

/// Read the effective CPU core count derived from the Job Object the calling
/// process belongs to. Returns `None` when the process is not in a Job or no
/// Job-derived limits apply.
pub(super) fn read_job_cpu_quota_cores(host_cpu_count: u32) -> Option<u32> {
    if !is_in_job_object()? {
        return None;
    }
    read_cpu_hard_cap_rate().map(|rate| cores_from_cpu_rate(host_cpu_count, rate))
}

/// Read the effective CPU core count derived from the calling process's
/// affinity mask. Honors manual `SetProcessAffinityMask` whether or not the
/// process is in a Job Object. Returns `None` when the query fails or the
/// mask is empty (Win32 reports zero when the process spans multiple
/// processor groups on > 64-CPU hosts).
pub(super) fn read_process_affinity_cores(host_cpu_count: u32) -> Option<u32> {
    let mask = read_process_affinity_mask()?;
    cores_from_affinity_mask(mask, host_cpu_count)
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
        if is_finite_memory_limit(value, host_total) {
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

fn is_in_job_object() -> Option<bool> {
    let mut in_job: BOOL = FALSE;
    // SAFETY: `GetCurrentProcess` returns a pseudo-handle (no resource); a
    // NULL `JobHandle` means "any job", per MSDN.
    let ok = unsafe { IsProcessInJob(GetCurrentProcess(), std::ptr::null_mut(), &mut in_job) };
    if ok == 0 {
        debug!("IsProcessInJob failed; assuming process is not in a Job Object");
        None
    } else {
        Some(in_job != 0)
    }
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
        debug!("QueryInformationJobObject(JobObjectCpuRateControlInformation) failed");
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
    if ok == 0 {
        debug!("QueryInformationJobObject(JobObjectExtendedLimitInformation) failed");
        None
    } else {
        Some(info)
    }
}

fn read_process_affinity_mask() -> Option<u64> {
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
    if ok == 0 {
        debug!("GetProcessAffinityMask failed");
        return None;
    }
    // On systems with > 64 CPUs across multiple processor groups,
    // `GetProcessAffinityMask` may legitimately return 0 in `process_mask`.
    // Treat that as "unknown" rather than 0 cores.
    if process_mask == 0 {
        debug!("GetProcessAffinityMask returned empty mask (likely > 64 CPUs across groups)");
        return None;
    }
    Some(process_mask as u64)
}
