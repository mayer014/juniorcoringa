import { db } from "@/lib/db";
import { decryptCitizenValue, encryptCitizenValue, hashCitizenValue, normalizePhone } from "@/lib/citizen-privacy";
import { getEvolutionConfiguration, getEvolutionConnectionState, sendEvolutionText } from "@/lib/evolution";

type OutboxKind = "follow_up_30d" | "birthday";
type OutboxRow = { id: number; citizen_id: number; request_id: number | null; kind: OutboxKind; attempts: number; full_name_enc: string; phone_enc: string; protocol: string | null };

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "";
}

function messageFor(row: OutboxRow) {
  const name = firstName(decryptCitizenValue(row.full_name_enc));
  if (row.kind === "birthday") {
    return `Ol\u00e1, ${name}! Passando para desejar um feliz anivers\u00e1rio, com muita sa\u00fade, alegria e realiza\u00e7\u00f5es. Um abra\u00e7o do vereador Junior Coringa e de toda a equipe!`;
  }
  return `Ol\u00e1, ${name}! H\u00e1 cerca de 30 dias voc\u00ea enviou a indica\u00e7\u00e3o ${row.protocol || "ao nosso mandato"}. Gostar\u00edamos de saber: a situa\u00e7\u00e3o foi resolvida ou houve alguma mudan\u00e7a? Sua resposta nos ajuda a continuar acompanhando. Para n\u00e3o receber mais mensagens, responda SAIR.`;
}

export function getCommunicationCounts() {
  const row = db.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM citizen_communication_outbox`).get() as Record<string, number | null>;
  return { total: row.total ?? 0, pending: row.pending ?? 0, sent: row.sent ?? 0, failed: row.failed ?? 0 };
}

export function listRecentCommunicationEvents(limit = 20) {
  const rows = db.prepare(`SELECT e.*, c.full_name_enc, r.protocol FROM citizen_communication_events e
    LEFT JOIN citizens c ON c.id = e.citizen_id LEFT JOIN citizen_requests r ON r.id = e.request_id
    ORDER BY e.id DESC LIMIT ?`).all(limit) as Array<{ id: number; direction: string; event_kind: string; message_enc: string | null; external_message_id: string | null; created_at: string; full_name_enc: string | null; protocol: string | null }>;
  return rows.map((row) => ({
    id: row.id, direction: row.direction, eventKind: row.event_kind,
    message: decryptCitizenValue(row.message_enc) || null, externalMessageId: row.external_message_id,
    createdAt: row.created_at, fullName: decryptCitizenValue(row.full_name_enc) || "Contato n\u00e3o identificado", protocol: row.protocol,
  }));
}

export function scheduleBirthdayMessages(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Campo_Grande" })
    .formatToParts(now).reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const citizens = db.prepare("SELECT id, birth_date_enc FROM citizens WHERE relationship_opt_in = 1").all() as Array<{ id: number; birth_date_enc: string }>;
  const insert = db.prepare(`INSERT OR IGNORE INTO citizen_communication_outbox
    (citizen_id, request_id, kind, scheduled_at, idempotency_key, created_at, updated_at)
    VALUES (?, NULL, 'birthday', ?, ?, ?, ?)`);
  const timestamp = now.toISOString();
  let scheduled = 0;
  db.transaction(() => {
    for (const citizen of citizens) {
      const birthDate = decryptCitizenValue(citizen.birth_date_enc);
      if (birthDate.slice(5, 7) !== today.month || birthDate.slice(8, 10) !== today.day) continue;
      scheduled += insert.run(citizen.id, timestamp, `birthday:${citizen.id}:${today.year}`, timestamp, timestamp).changes;
    }
  })();
  return scheduled;
}

export async function dispatchDueCommunications(limit = 10) {
  const localHour = Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Campo_Grande" }).format(new Date()));
  if (localHour < 9 || localHour >= 19) return { status: "outside_sending_window" as const, processed: 0, sent: 0, failed: 0, error: null };
  const config = getEvolutionConfiguration();
  if (!config.ready) return { status: "not_configured" as const, processed: 0, sent: 0, failed: 0, error: `Faltam: ${config.missing.join(", ")}.` };
  if (!config.sendingEnabled) return { status: "disabled" as const, processed: 0, sent: 0, failed: 0, error: null };
  const connection = await getEvolutionConnectionState();
  if (connection.state !== "open") return { status: "disconnected" as const, processed: 0, sent: 0, failed: 0, error: connection.error };
  const rows = db.prepare(`SELECT o.id, o.citizen_id, o.request_id, o.kind, o.attempts,
    c.full_name_enc, c.phone_enc, r.protocol FROM citizen_communication_outbox o
    JOIN citizens c ON c.id = o.citizen_id LEFT JOIN citizen_requests r ON r.id = o.request_id
    WHERE o.status = 'pending' AND o.scheduled_at <= ? AND c.relationship_opt_in = 1
    ORDER BY o.scheduled_at, o.id LIMIT ?`).all(new Date().toISOString(), limit) as OutboxRow[];
  let sent = 0; let failed = 0;
  for (const row of rows) {
    const now = new Date().toISOString();
    db.prepare("UPDATE citizen_communication_outbox SET status = 'sending', updated_at = ? WHERE id = ? AND status = 'pending'").run(now, row.id);
    try {
      const message = messageFor(row);
      const result = await sendEvolutionText(decryptCitizenValue(row.phone_enc), message);
      db.transaction(() => {
        db.prepare("UPDATE citizen_communication_outbox SET status = 'sent', attempts = attempts + 1, last_error = NULL, external_message_id = ?, sent_at = ?, updated_at = ? WHERE id = ?")
          .run(result.messageId, now, now, row.id);
        db.prepare("INSERT INTO citizen_communication_events (citizen_id, request_id, direction, event_kind, message_enc, external_message_id, created_at) VALUES (?, ?, 'outbound', ?, ?, ?, ?)")
          .run(row.citizen_id, row.request_id, row.kind, encryptCitizenValue(message), result.messageId, now);
      })();
      sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      db.prepare("UPDATE citizen_communication_outbox SET status = ?, attempts = ?, last_error = ?, updated_at = ? WHERE id = ?")
        .run(attempts >= 5 ? "failed" : "pending", attempts, (error instanceof Error ? error.message : "Falha no envio").slice(0, 600), now, row.id);
      failed += 1;
    }
  }
  return { status: "complete" as const, processed: rows.length, sent, failed, error: null };
}

function extractIncomingText(data: Record<string, unknown>) {
  const message = data.message as Record<string, unknown> | undefined;
  if (!message) return "";
  if (typeof message.conversation === "string") return message.conversation;
  const extended = message.extendedTextMessage as Record<string, unknown> | undefined;
  return typeof extended?.text === "string" ? extended.text : "";
}

export function handleEvolutionWebhook(body: unknown) {
  if (!body || typeof body !== "object") return { ignored: true };
  const payload = body as Record<string, unknown>;
  const event = String(payload.event || "").toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return { ignored: true };
  const data = payload.data as Record<string, unknown> | undefined;
  const key = data?.key as Record<string, unknown> | undefined;
  if (!data || !key || key.fromMe === true) return { ignored: true };
  const remoteJid = String(key.remoteJid || "");
  const rawPhone = remoteJid.split("@")[0].split(":")[0];
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ignored: true };
  const citizen = db.prepare("SELECT id FROM citizens WHERE phone_hash = ?").get(hashCitizenValue(phone)) as { id: number } | undefined;
  if (!citizen) return { ignored: true };
  const text = extractIncomingText(data).trim().slice(0, 3000);
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  const request = db.prepare("SELECT id FROM citizen_requests WHERE citizen_id = ? ORDER BY id DESC LIMIT 1").get(citizen.id) as { id: number } | undefined;
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare("INSERT INTO citizen_communication_events (citizen_id, request_id, direction, event_kind, message_enc, external_message_id, created_at) VALUES (?, ?, 'inbound', 'reply', ?, ?, ?)")
      .run(citizen.id, request?.id ?? null, encryptCitizenValue(text), String(key.id || "") || null, now);
    if (["SAIR", "CANCELAR", "PARAR"].includes(normalized)) {
      db.prepare("UPDATE citizens SET relationship_opt_in = 0, relationship_opt_out_at = ?, updated_at = ? WHERE id = ?").run(now, now, citizen.id);
      db.prepare("UPDATE citizen_communication_outbox SET status = 'cancelled', updated_at = ? WHERE citizen_id = ? AND status = 'pending'").run(now, citizen.id);
    }
  })();
  return { ignored: false, optedOut: ["SAIR", "CANCELAR", "PARAR"].includes(normalized) };
}
