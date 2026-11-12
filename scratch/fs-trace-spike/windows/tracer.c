// fstrace.exe <none|trace> <log> <command line>
// Runs the command in a job object and waits for the whole process tree to exit.
#include "fstrace.h"
#include <stdio.h>

int wmain(int argc, wchar_t **argv) {
  if (argc != 4) {
    fwprintf(stderr, L"usage: fstrace.exe <none|trace> <log> <command line>\n");
    return 2;
  }
  BOOL trace = wcscmp(argv[1], L"trace") == 0;
  WCHAR dll[MAX_PATH];
  GetModuleFileNameW(NULL, dll, MAX_PATH);
  wcscpy_s(wcsrchr(dll, L'\\') + 1, MAX_PATH - (wcsrchr(dll, L'\\') + 1 - dll), L"fstrace.dll");
  if (trace) {
    CloseHandle(CreateFileW(argv[2], GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, CREATE_ALWAYS, 0, NULL));
    SetEnvironmentVariableW(L"FSTRACE_OUT", argv[2]);
  }

  HANDLE job = CreateJobObjectW(NULL, NULL);
  HANDLE port = CreateIoCompletionPort(INVALID_HANDLE_VALUE, NULL, 0, 1);
  JOBOBJECT_ASSOCIATE_COMPLETION_PORT acp = {job, port};
  SetInformationJobObject(job, JobObjectAssociateCompletionPortInformation, &acp, sizeof acp);
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = {0};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits, sizeof limits);

  STARTUPINFOW si = {sizeof si};
  PROCESS_INFORMATION pi;
  wchar_t *cmd = _wcsdup(argv[3]);
  if (!CreateProcessW(NULL, cmd, NULL, NULL, TRUE, CREATE_SUSPENDED, NULL, NULL, &si, &pi)) {
    fwprintf(stderr, L"spawn failed: %lu\n", GetLastError());
    return 127;
  }
  AssignProcessToJobObject(job, pi.hProcess);
  if (trace && !fstrace_inject(pi.hProcess, pi.hThread, dll)) fwprintf(stderr, L"fstrace: inject skipped\n");
  ResumeThread(pi.hThread);

  DWORD msg;
  ULONG_PTR key;
  LPOVERLAPPED ov;
  while (GetQueuedCompletionStatus(port, &msg, &key, &ov, INFINITE))
    if (msg == JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO && (HANDLE)key == job) break;
  DWORD code = 1;
  GetExitCodeProcess(pi.hProcess, &code);
  return (int)code;
}
