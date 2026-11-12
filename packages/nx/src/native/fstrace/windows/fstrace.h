#pragma once
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wchar.h>

typedef BOOL(WINAPI *PFN_CreateProcessW)(LPCWSTR, LPWSTR, LPSECURITY_ATTRIBUTES, LPSECURITY_ATTRIBUTES, BOOL,
                                         DWORD, LPVOID, LPCWSTR, LPSTARTUPINFOW, LPPROCESS_INFORMATION);

static const WCHAR *fstrace_arch_name(USHORT machine) {
  switch (machine) {
  case IMAGE_FILE_MACHINE_ARM64:
    return L"arm64";
  case IMAGE_FILE_MACHINE_AMD64:
    return L"x64";
  case IMAGE_FILE_MACHINE_I386:
    return L"x86";
  default:
    return NULL;
  }
}

static USHORT fstrace_machine(HANDLE process) {
  PROCESS_MACHINE_INFORMATION info = {0};
  return GetProcessInformation(process, ProcessMachineTypeInfo, &info, sizeof info) ? info.ProcessMachine : 0;
}

// `dir\fstrace-<arch>.<ext>`, the build of this tracer for a given architecture.
static BOOL fstrace_sibling(const WCHAR *self, USHORT machine, const WCHAR *ext, WCHAR *out, size_t n) {
  const WCHAR *arch = fstrace_arch_name(machine);
  const WCHAR *slash = wcsrchr(self, L'\\');
  if (!arch || !slash) return FALSE;
  return swprintf(out, n, L"%.*sfstrace-%s.%s", (int)(slash - self + 1), self, arch, ext) > 0;
}

// Loads `dll` into a same-architecture process created suspended. The APC runs on the main
// thread once the loader has mapped static imports, before the entry point.
static BOOL fstrace_inject_same_arch(HANDLE process, HANDLE thread, const WCHAR *dll) {
  SIZE_T bytes = (wcslen(dll) + 1) * sizeof(WCHAR);
  void *remote = VirtualAllocEx(process, NULL, bytes, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (!remote || !WriteProcessMemory(process, remote, dll, bytes, NULL)) return FALSE;
  PAPCFUNC load = (PAPCFUNC)GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "LoadLibraryW");
  return QueueUserAPC(load, thread, (ULONG_PTR)remote) != 0;
}

// Loads the tracer DLL matching the child's architecture. `self` is any tracer file in the
// install directory. A child of another architecture is handed to that architecture's
// helper, `fstrace-<arch>.exe inject <pid> <tid>`, because only a process of the child's
// architecture knows where its LoadLibraryW is.
static BOOL fstrace_inject(HANDLE process, HANDLE thread, const WCHAR *self, PFN_CreateProcessW create) {
  USHORT mine = fstrace_machine(GetCurrentProcess()), theirs = fstrace_machine(process);
  WCHAR dll[MAX_PATH];
  if (!fstrace_sibling(self, theirs, L"dll", dll, MAX_PATH)) return FALSE;
  if (mine == theirs) return fstrace_inject_same_arch(process, thread, dll);

  WCHAR helper[MAX_PATH], cmd[MAX_PATH + 64];
  if (!fstrace_sibling(self, theirs, L"exe", helper, MAX_PATH)) return FALSE;
  swprintf(cmd, MAX_PATH + 64, L"\"%s\" inject %lu %lu", helper, GetProcessId(process), GetThreadId(thread));
  STARTUPINFOW si = {sizeof si};
  PROCESS_INFORMATION pi;
  if (!create(helper, cmd, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) return FALSE;
  WaitForSingleObject(pi.hProcess, INFINITE);
  DWORD code = 1;
  GetExitCodeProcess(pi.hProcess, &code);
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  return code == 0;
}
