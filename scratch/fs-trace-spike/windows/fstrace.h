#pragma once
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

// Loads `dll` into a process created suspended. The APC runs on the main thread once the
// loader has mapped static imports, before the entry point. Only same-architecture
// children are injected; an x64 child of an ARM64 tracer is reported as skipped.
static BOOL fstrace_inject(HANDLE process, HANDLE thread, const WCHAR *dll) {
  PROCESS_MACHINE_INFORMATION mine = {0}, theirs = {0};
  if (GetProcessInformation(GetCurrentProcess(), ProcessMachineTypeInfo, &mine, sizeof mine) &&
      GetProcessInformation(process, ProcessMachineTypeInfo, &theirs, sizeof theirs) &&
      mine.ProcessMachine != theirs.ProcessMachine)
    return FALSE;
  SIZE_T bytes = (wcslen(dll) + 1) * sizeof(WCHAR);
  void *remote = VirtualAllocEx(process, NULL, bytes, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (!remote || !WriteProcessMemory(process, remote, dll, bytes, NULL)) return FALSE;
  PAPCFUNC load = (PAPCFUNC)GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "LoadLibraryW");
  return QueueUserAPC(load, thread, (ULONG_PTR)remote) != 0;
}
