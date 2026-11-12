// Opens argv[1] argv[2] times through CreateFileA.
#include <windows.h>
#include <stdlib.h>
int main(int argc, char **argv) {
  int n = atoi(argv[2]);
  for (int i = 0; i < n; i++) {
    HANDLE h = CreateFileA(argv[1], GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (h == INVALID_HANDLE_VALUE) return 1;
    CloseHandle(h);
  }
  return 0;
}
