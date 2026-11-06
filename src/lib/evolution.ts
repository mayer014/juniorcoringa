type EvolutionConnectionState = "open" | "close" | "connecting" | "unknown";

export type EvolutionConfiguration = {
  ready: boolean;
  sendingEnabled: boolean;
  missing: string[];
  baseUrl: string | null;
  instance: string | null;
  webhookReady: boolean;
};

function cleanUrl(value: string | undefined) {
  const url = value?.trim().replace(/\/+$/, "");
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString().replace(/\/$/, "") : null;
  } catch { return null; }
}

export function getEvolutionConfiguration(): EvolutionConfiguration {
  const baseUrl = cleanUrl(process.env.EVOLUTION_API_URL);
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE?.trim();
  const missing: string[] = [];
  if (!baseUrl) missing.push("EVOLUTION_API_URL");
  if (!apiKey) missing.push("EVOLUTION_API_KEY");
  if (!instance) missing.push("EVOLUTION_INSTANCE");
  return {
    ready: missing.length === 0,
    sendingEnabled: process.env.EVOLUTION_SEND_ENABLED === "true",
    missing,
    baseUrl,
    instance: instance || null,
    webhookReady: Boolean(process.env.EVOLUTION_WEBHOOK_SECRET?.trim() && process.env.NEXT_PUBLIC_SITE_URL?.trim()),
  };
}

function credentials() {
  const configuration = getEvolutionConfiguration();
  if (!configuration.ready || !configuration.baseUrl || !configuration.instance) {
    throw new Error(`Evolution API incompleta: ${configuration.missing.join(", ")}.`);
  }
  return { ...configuration, apiKey: process.env.EVOLUTION_API_KEY!.trim() };
}

async function evolutionRequest(pathname: string, init?: RequestInit) {
  const config = credentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${config.baseUrl}${pathname}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: config.apiKey, ...init?.headers },
    });
    const text = await response.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) {
      const message = typeof payload === "object" && payload && "response" in payload
        ? JSON.stringify((payload as { response: unknown }).response).slice(0, 400)
        : String(text || `HTTP ${response.status}`).slice(0, 400);
      throw new Error(`Evolution API respondeu ${response.status}: ${message}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("A Evolution API demorou mais de 6 segundos para responder.");
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function getEvolutionConnectionState(): Promise<{ state: EvolutionConnectionState; error: string | null }> {
  const configuration = getEvolutionConfiguration();
  if (!configuration.ready || !configuration.instance) return { state: "unknown", error: `Faltam: ${configuration.missing.join(", ")}.` };
  try {
    const result = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(configuration.instance)}`) as { instance?: { state?: string } };
    const state = result.instance?.state;
    return { state: state === "open" || state === "close" || state === "connecting" ? state : "unknown", error: null };
  } catch (error) { return { state: "unknown", error: error instanceof Error ? error.message : "Falha ao consultar a Evolution API." }; }
}

export async function sendEvolutionText(number: string, text: string) {
  const configuration = getEvolutionConfiguration();
  if (!configuration.sendingEnabled) throw new Error("Os disparos da Evolution API est\u00e3o desativados.");
  const result = await evolutionRequest(`/message/sendText/${encodeURIComponent(configuration.instance!)}`, {
    method: "POST", body: JSON.stringify({ number: number.replace(/\D/g, ""), text, delay: 1200 }),
  }) as { key?: { id?: string }; status?: string };
  return { messageId: result.key?.id || null, status: result.status || null };
}

export async function configureEvolutionWebhook() {
  const configuration = getEvolutionConfiguration();
  const siteUrl = cleanUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  if (!siteUrl || !secret) throw new Error("Configure NEXT_PUBLIC_SITE_URL e EVOLUTION_WEBHOOK_SECRET.");
  if (process.env.NODE_ENV === "production" && !siteUrl.startsWith("https://")) throw new Error("O webhook exige NEXT_PUBLIC_SITE_URL com HTTPS em produção.");
  return evolutionRequest(`/webhook/set/${encodeURIComponent(configuration.instance!)}`, {
    method: "POST",
    body: JSON.stringify({
      enabled: true,
      url: `${siteUrl}/api/webhooks/evolution?secret=${encodeURIComponent(secret)}`,
      webhookByEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"],
    }),
  });
}
