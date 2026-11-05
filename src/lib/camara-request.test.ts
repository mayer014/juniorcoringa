import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { fetchCamaraWithRetry, newsRequestTimeout } from "./camara-request";

test("interpreta o prazo em segundos reais e rejeita configuração inválida", () => {
  for (const value of [undefined, "8000", "8_000", "", "0", "8", "inválido"]) {
    assert.equal(newsRequestTimeout(value), 8000);
  }
  assert.equal(newsRequestTimeout("12000"), 12000);
  assert.equal(newsRequestTimeout("90000"), 15000);
});

test("consulta que demora mais de 8ms conclui e respeita cancelamento total", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/slow") return;
    setTimeout(() => response.end("arquivo oficial"), 100);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetchCamaraWithRetry(baseUrl, {}, "Arquivo", newsRequestTimeout(), 1);
    assert.equal(await response.text(), "arquivo oficial");
    await assert.rejects(
      fetchCamaraWithRetry(`${baseUrl}/slow`, { signal: AbortSignal.timeout(100) }, "Arquivo", 8000, 1),
      /tempo de consulta excedido/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
