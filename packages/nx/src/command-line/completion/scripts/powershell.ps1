###-begin-nx-completions-###
#
# nx command completion script for PowerShell
#
# Installation: nx completion powershell | Out-File -Append $PROFILE
#
Register-ArgumentCompleter -Native -CommandName nx -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $tokens = @($commandAst.CommandElements | ForEach-Object { $_.Extent.Text })
    # Match POSIX wrappers' '[...tokens, currentPartial]' layout.
    if ($cursorPosition -gt $commandAst.Extent.EndOffset) {
        $tokens += ''
    }

    # Walk up for a workspace-local nx.cmd; fall back to PATH outside a workspace.
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
    # Windows PowerShell 5.1 turns native-command stderr into terminating
    # ErrorRecords when the caller's $ErrorActionPreference is 'Stop', so
    # `2>$null` raises before it can suppress. Force 'Continue' locally —
    # the param has function scope and resets on return.
    $ErrorActionPreference = 'Continue'
    try {
        # Hide stderr so stray warnings don't land in the buffer; NX_VERBOSE_LOGGING surfaces it.
        if ($env:NX_VERBOSE_LOGGING) {
            $lines = & $nxCmd @tokens
        } else {
            $lines = & $nxCmd @tokens 2>$null
        }
        # PowerShell appends a space after each completion — no per-result nospace API.
        # Skip blank lines: PS 5.1's CompletionResult ctor throws on empty completionText.
        foreach ($line in $lines) {
            if ([string]::IsNullOrEmpty($line)) { continue }
            [System.Management.Automation.CompletionResult]::new($line)
        }
    } finally {
        Remove-Item Env:NX_COMPLETE -ErrorAction SilentlyContinue
    }
}
###-end-nx-completions-###
