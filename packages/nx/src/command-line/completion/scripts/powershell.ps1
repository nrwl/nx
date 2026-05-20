###-begin-nx-completions-###
#
# nx command completion script for PowerShell
#
# Installation: nx completion powershell | Out-File -Append $PROFILE
#
Register-ArgumentCompleter -Native -CommandName nx -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $tokens = @($commandAst.CommandElements | ForEach-Object { $_.Extent.Text })
    # If the cursor is past the last token, append an empty current word so
    # the binary sees the same '[...userTokens, currentPartial]' layout as
    # the POSIX wrappers emit.
    if ($cursorPosition -gt $commandAst.Extent.EndOffset) {
        $tokens += ''
    }

    # Prefer the workspace's local nx over PATH, like the POSIX wrappers.
    # Walks up from the cwd checking the standard and .nx-style layouts;
    # uses nx.cmd, the executable PowerShell can invoke on Windows.
    # Bare `nx` rather than an absolute path: that would tie completion to
    # whatever install was active when `nx completion powershell` ran,
    # breaking across worktrees or after a move.
    $nxCmd = 'nx'
    $dir = $PWD.Path
    while ($dir) {
        $standard = Join-Path $dir 'node_modules\.bin\nx.cmd'
        $nxStyle = Join-Path $dir '.nx\installation\node_modules\.bin\nx.cmd'
        if (Test-Path -LiteralPath $standard) { $nxCmd = $standard; break }
        if (Test-Path -LiteralPath $nxStyle) { $nxCmd = $nxStyle; break }
        $parent = Split-Path -Parent $dir
        if ($parent -eq $dir) { break }
        $dir = $parent
    }

    $env:NX_COMPLETE = 'powershell'
    try {
        # Stderr is hidden so a stray warning never lands in the completion
        # buffer. Honors NX_VERBOSE_LOGGING (Nx's standard debug switch) to
        # surface it.
        if ($env:NX_VERBOSE_LOGGING) {
            $lines = & $nxCmd @tokens
        } else {
            $lines = & $nxCmd @tokens 2>$null
        }
        # Note: PowerShell appends a space after each completion. Two-stage
        # 'project:' / 'plugin:' completion still works — the user deletes
        # the space or types ':' — but there is no per-result nospace API.
        $lines | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_)
        }
    } finally {
        Remove-Item Env:NX_COMPLETE -ErrorAction SilentlyContinue
    }
}
###-end-nx-completions-###
