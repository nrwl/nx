using System.Diagnostics;

namespace MsbuildAnalyzer.Utilities;

/// <summary>
/// Performance logging utility that writes timing information to stderr when NX_PERF_LOGGING=true.
/// Follows Nx performance logging conventions.
/// </summary>
public class PerfLogger : IDisposable
{
    private readonly string _operationName;
    private readonly Stopwatch _stopwatch;
    private static readonly bool _isEnabled = Environment.GetEnvironmentVariable("NX_PERF_LOGGING") == "true";

    private PerfLogger(string operationName)
    {
        _operationName = operationName;
        _stopwatch = Stopwatch.StartNew();
    }

    /// <summary>
    /// Start timing an operation. Use with 'using' statement for automatic disposal.
    /// </summary>
    /// <param name="operationName">Name of the operation being timed.</param>
    /// <returns>PerfLogger instance that will log timing on disposal.</returns>
    public static PerfLogger? Start(string operationName)
    {
        return _isEnabled ? new PerfLogger(operationName) : null;
    }

    /// <summary>
    /// Logs the elapsed time for the operation to stderr.
    /// </summary>
    public void Dispose()
    {
        if (_isEnabled)
        {
            _stopwatch.Stop();
            Console.Error.WriteLine($"Time for '[@nx/dotnet]: {_operationName}' {_stopwatch.Elapsed.TotalMilliseconds:F1}ms");
        }
    }
}
