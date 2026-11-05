// Environment variables are strings: parseInt("8_000") returns 8, not 8000.
export function newsRequestTimeout(value?: string) {
  const parsed = Number((value ?? "8000").replaceAll("_", ""));
  return Number.isSafeInteger(parsed) && parsed >= 1000
    ? Math.min(parsed, 15000)
    : 8000;
}

export async function fetchCamaraWithRetry(
  url: string | URL,
  init: RequestInit,
  context: string,
  timeoutMs = 90_000,
  maxAttempts = 3,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    init.signal?.throwIfAborted();
    try {
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      const response = await fetch(url, { ...init, signal });
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }
    if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  const cause = lastError instanceof Error ? lastError : null;
  const reason = cause && /Timeout|Abort/.test(cause.name)
    ? `tempo de consulta excedido (${timeoutMs / 1000}s)`
    : cause?.message || "falha de conexão";
  throw new Error(`${context}: ${reason}.`, { cause: lastError });
}
