@echo off
set N=\\Mac\Home\repos\worktrees\nx\fs-trace-spike\packages\nx\src\native
rmdir /s /q C:\lt 2>nul
mkdir C:\lt\a C:\lt\b C:\lt\c C:\lt\d C:\lt\e
echo x> C:\lt\a\1
echo x> C:\lt\b\2
echo x> C:\lt\c\3
echo x> C:\lt\d\4
echo x> C:\lt\e\5
copy /y %N%\fstrace-*.* C:\lt\ >nul
type nul > C:\lt\log
C:\lt\fstrace-arm64.exe trace C:\lt\log "node \\Mac\Home\repos\worktrees\nx\fs-trace-spike\scratch\fs-trace-spike\windows\listing-test.js"
echo exit=%ERRORLEVEL%
findstr /b /c:"!" C:\lt\log | findstr /i "lt\\ untraced"
