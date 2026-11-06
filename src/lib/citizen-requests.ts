import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { decryptCitizenValue, encryptCitizenValue, hashCitizenValue, normalizePhone, trackingTokenHash } from "@/lib/citizen-privacy";
import type { CitizenRequest, CitizenRequestAttachment, CitizenRequestCategory, CitizenRequestHistory, CitizenRequestInput, CitizenRequestStatus, CitizenRequestSummary, CitizenRequestUpdateInput } from "@/lib/types";

export const PRIVACY_NOTICE_VERSION = "2026-11-06-v1";
export const RELATIONSHIP_CONSENT_VERSION = "2026-11-06-v1";

type RequestRow = {
  id: number;
  protocol: string;
  citizen_id: number;
  full_name_enc: string;
  phone_enc: string;
  birth_date_enc: string;
  postal_code_enc: string;
  street_enc: string;
  address_number_enc: string;
  address_complement_enc: string | null;
  neighborhood: string;
  city: string;
  state: string;
  relationship_opt_in: number;
  category: CitizenRequestCategory;
  problem_postal_code: string | null;
  problem_street: string;
  problem_number: string | null;
  problem_neighborhood: string;
  problem_city: string;
  problem_reference: string | null;
  description: string;
  urgent: number;
  status: CitizenRequestStatus;
  assigned_to: string | null;
  official_protocol: string | null;
  official_department: string | null;
  official_protocol_at: string | null;
  follow_up_due_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  created_at: string;
  updated_at: string;
};

const requestSelect = `
  SELECT r.*, c.full_name_enc, c.phone_enc, c.birth_date_enc, c.postal_code_enc,
    c.street_enc, c.address_number_enc, c.address_complement_enc, c.neighborhood,
    c.city, c.state, c.relationship_opt_in
  FROM citizen_requests r
  JOIN citizens c ON c.id = r.citizen_id
`;

function mapAttachment(row: { id: number; request_id: number; filename: string; created_at: string }): CitizenRequestAttachment {
  return { id: row.id, requestId: row.request_id, filename: row.filename, createdAt: row.created_at };
}

function mapHistory(row: { id: number; status: CitizenRequestStatus; note: string | null; actor: string; created_at: string }): CitizenRequestHistory {
  return { id: row.id, status: row.status, note: row.note, actor: row.actor, createdAt: row.created_at };
}

function mapRequest(row: RequestRow, withDetails = true): CitizenRequest {
  const attachments = withDetails
    ? (db.prepare("SELECT * FROM citizen_request_attachments WHERE request_id = ? ORDER BY id").all(row.id) as Array<{ id: number; request_id: number; filename: string; created_at: string }>).map(mapAttachment)
    : [];
  const history = withDetails
    ? (db.prepare("SELECT id, status, note, actor, created_at FROM citizen_request_history WHERE request_id = ? ORDER BY id DESC").all(row.id) as Array<{ id: number; status: CitizenRequestStatus; note: string | null; actor: string; created_at: string }>).map(mapHistory)
    : [];
  return {
    id: row.id, protocol: row.protocol,
    fullName: decryptCitizenValue(row.full_name_enc), phone: decryptCitizenValue(row.phone_enc),
    birthDate: decryptCitizenValue(row.birth_date_enc), postalCode: decryptCitizenValue(row.postal_code_enc),
    street: decryptCitizenValue(row.street_enc), addressNumber: decryptCitizenValue(row.address_number_enc),
    addressComplement: decryptCitizenValue(row.address_complement_enc) || null,
    neighborhood: row.neighborhood, city: row.city, state: row.state,
    relationshipConsent: Boolean(row.relationship_opt_in), category: row.category,
    problemPostalCode: row.problem_postal_code, problemStreet: row.problem_street,
    problemNumber: row.problem_number, problemNeighborhood: row.problem_neighborhood,
    problemCity: row.problem_city, problemReference: row.problem_reference,
    description: row.description, urgent: Boolean(row.urgent), status: row.status,
    assignedTo: row.assigned_to, officialProtocol: row.official_protocol,
    officialDepartment: row.official_department, officialProtocolAt: row.official_protocol_at,
    followUpDueAt: row.follow_up_due_at, createdAt: row.created_at, updatedAt: row.updated_at,
    utmSource: row.utm_source, utmMedium: row.utm_medium, utmCampaign: row.utm_campaign, utmContent: row.utm_content,
    attachments, history,
  };
}

export function countRecentCitizenRequestsByIp(ipHash: string, since: string) {
  return (db.prepare("SELECT COUNT(*) AS total FROM citizen_requests WHERE ip_hash = ? AND created_at >= ?")
    .get(ipHash, since) as { total: number }).total;
}

export function createCitizenRequest(input: CitizenRequestInput, ipHash: string) {
  const now = new Date().toISOString();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Telefone inv\u00e1lido.");
  const phoneHash = hashCitizenValue(phone);
  const trackingToken = randomBytes(24).toString("base64url");
  const followUpDueAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO citizens (full_name_enc, phone_enc, phone_hash, birth_date_enc, postal_code_enc,
        street_enc, address_number_enc, address_complement_enc, neighborhood, city, state,
        relationship_opt_in, relationship_opt_in_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone_hash) DO UPDATE SET
        full_name_enc = excluded.full_name_enc, phone_enc = excluded.phone_enc,
        birth_date_enc = excluded.birth_date_enc, postal_code_enc = excluded.postal_code_enc,
        street_enc = excluded.street_enc, address_number_enc = excluded.address_number_enc,
        address_complement_enc = excluded.address_complement_enc, neighborhood = excluded.neighborhood,
        city = excluded.city, state = excluded.state,
        relationship_opt_in = CASE WHEN excluded.relationship_opt_in = 1 THEN 1 ELSE citizens.relationship_opt_in END,
        relationship_opt_in_at = CASE WHEN excluded.relationship_opt_in = 1 THEN excluded.relationship_opt_in_at ELSE citizens.relationship_opt_in_at END,
        updated_at = excluded.updated_at
    `).run(
      encryptCitizenValue(input.fullName), encryptCitizenValue(phone), phoneHash,
      encryptCitizenValue(input.birthDate), encryptCitizenValue(input.postalCode),
      encryptCitizenValue(input.street), encryptCitizenValue(input.addressNumber), encryptCitizenValue(input.addressComplement),
      input.neighborhood, input.city, input.state, input.relationshipConsent ? 1 : 0,
      input.relationshipConsent ? now : null, now, now,
    );
    const citizen = db.prepare("SELECT id FROM citizens WHERE phone_hash = ?").get(phoneHash) as { id: number };
    const temporaryProtocol = `pending-${trackingToken}`;
    const inserted = db.prepare(`
      INSERT INTO citizen_requests (protocol, tracking_token_hash, citizen_id, category, problem_postal_code,
        problem_street, problem_number, problem_neighborhood, problem_city, problem_reference, description,
        urgent, status, follow_up_due_at, utm_source, utm_medium, utm_campaign, utm_content, referrer,
        ip_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      temporaryProtocol, trackingTokenHash(trackingToken), citizen.id, input.category, input.problemPostalCode,
      input.problemStreet, input.problemNumber, input.problemNeighborhood, input.problemCity, input.problemReference,
      input.description, input.urgent ? 1 : 0, followUpDueAt, input.utmSource, input.utmMedium,
      input.utmCampaign, input.utmContent, input.referrer, ipHash, now, now,
    );
    const id = Number(inserted.lastInsertRowid);
    const protocol = `JC-${new Date().getFullYear()}-${String(id).padStart(6, "0")}`;
    db.prepare("UPDATE citizen_requests SET protocol = ? WHERE id = ?").run(protocol, id);
    db.prepare("INSERT INTO citizen_request_history (request_id, status, note, actor, created_at) VALUES (?, 'received', ?, 'site', ?)")
      .run(id, "Solicita\u00e7\u00e3o recebida pelo site.", now);
    db.prepare(`INSERT INTO citizen_consents (citizen_id, request_id, privacy_version, privacy_accepted_at,
      relationship_opt_in, relationship_text_version, source_ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(citizen.id, id, PRIVACY_NOTICE_VERSION, now, input.relationshipConsent ? 1 : 0,
        input.relationshipConsent ? RELATIONSHIP_CONSENT_VERSION : null, ipHash, now);
    if (input.relationshipConsent) {
      db.prepare(`INSERT OR IGNORE INTO citizen_communication_outbox
        (citizen_id, request_id, kind, scheduled_at, idempotency_key, created_at)
        VALUES (?, ?, 'follow_up_30d', ?, ?, ?)`)
        .run(citizen.id, id, followUpDueAt, `follow-up:${id}:30d`, now);
    }
    return { id, protocol, trackingToken };
  });
  return create.immediate();
}

export function addCitizenRequestAttachment(requestId: number, filename: string) {
  const now = new Date().toISOString();
  const result = db.prepare("INSERT INTO citizen_request_attachments (request_id, filename, created_at) VALUES (?, ?, ?)")
    .run(requestId, filename, now);
  return { id: Number(result.lastInsertRowid), requestId, filename, createdAt: now } satisfies CitizenRequestAttachment;
}

export function getCitizenRequest(id: number) {
  const row = db.prepare(`${requestSelect} WHERE r.id = ?`).get(id) as RequestRow | undefined;
  return row ? mapRequest(row) : null;
}

export function getCitizenRequestByTrackingToken(token: string) {
  const row = db.prepare(`SELECT id, protocol, category, problem_neighborhood, status, official_protocol, created_at, updated_at
    FROM citizen_requests WHERE tracking_token_hash = ?`).get(trackingTokenHash(token)) as {
      id: number; protocol: string; category: CitizenRequestCategory; problem_neighborhood: string;
      status: CitizenRequestStatus; official_protocol: string | null; created_at: string; updated_at: string;
    } | undefined;
  if (!row) return null;
  return {
    protocol: row.protocol,
    category: row.category,
    problemNeighborhood: row.problem_neighborhood,
    status: row.status,
    officialProtocol: row.official_protocol,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    history: (db.prepare("SELECT status, created_at FROM citizen_request_history WHERE request_id = ? ORDER BY id DESC")
      .all(row.id) as Array<{ status: CitizenRequestStatus; created_at: string }>)
      .map((entry) => ({ status: entry.status, createdAt: entry.created_at })),
  };
}

export function listCitizenRequests(options: {
  status?: CitizenRequestStatus;
  category?: CitizenRequestCategory;
  query?: string;
  limit?: number;
} = {}): CitizenRequestSummary[] {
  const rows = db.prepare(`${requestSelect}
    WHERE (? IS NULL OR r.status = ?) AND (? IS NULL OR r.category = ?)
    ORDER BY r.urgent DESC, datetime(r.created_at) DESC LIMIT 1000
  `).all(options.status ?? null, options.status ?? null, options.category ?? null, options.category ?? null) as RequestRow[];
  const query = options.query?.trim().toLocaleLowerCase("pt-BR");
  const mapped = rows.map((row) => mapRequest(row, false)).filter((item) => !query ||
    [item.protocol, item.fullName, item.phone, item.problemNeighborhood, item.description, item.officialProtocol || ""]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(query)));
  return mapped.slice(0, options.limit ?? 250).map((item) => ({
    id: item.id, protocol: item.protocol, fullName: item.fullName, phone: item.phone,
    neighborhood: item.neighborhood, category: item.category, problemNeighborhood: item.problemNeighborhood,
    description: item.description, urgent: item.urgent, status: item.status, assignedTo: item.assignedTo,
    officialProtocol: item.officialProtocol, followUpDueAt: item.followUpDueAt,
    createdAt: item.createdAt, updatedAt: item.updatedAt,
  }));
}

export function getCitizenRequestCounts() {
  const row = db.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN status IN ('received','triage','waiting_information','assigned') THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status = 'protocolled' OR status = 'monitoring' THEN 1 ELSE 0 END) AS monitoring,
    SUM(CASE WHEN status IN ('fulfilled','partially_fulfilled','not_fulfilled','out_of_scope','duplicate','closed') THEN 1 ELSE 0 END) AS closed,
    SUM(CASE WHEN urgent = 1 AND status NOT IN ('fulfilled','partially_fulfilled','not_fulfilled','out_of_scope','duplicate','closed') THEN 1 ELSE 0 END) AS urgent,
    SUM(CASE WHEN follow_up_due_at <= ? AND status NOT IN ('fulfilled','closed','duplicate') THEN 1 ELSE 0 END) AS followUpDue
    FROM citizen_requests`).get(new Date().toISOString()) as Record<string, number | null>;
  return { total: row.total ?? 0, pending: row.pending ?? 0, monitoring: row.monitoring ?? 0,
    closed: row.closed ?? 0, urgent: row.urgent ?? 0, followUpDue: row.followUpDue ?? 0 };
}

export function updateCitizenRequest(id: number, input: CitizenRequestUpdateInput, actor: string) {
  const update = db.transaction(() => {
    const current = db.prepare("SELECT status FROM citizen_requests WHERE id = ?").get(id) as { status: CitizenRequestStatus } | undefined;
    if (!current) return null;
    const now = new Date().toISOString();
    db.prepare(`UPDATE citizen_requests SET status = ?, assigned_to = ?, official_protocol = ?,
      official_department = ?, official_protocol_at = ?, updated_at = ? WHERE id = ?`)
      .run(input.status, input.assignedTo, input.officialProtocol, input.officialDepartment, input.officialProtocolAt, now, id);
    if (current.status !== input.status || input.note) {
      db.prepare("INSERT INTO citizen_request_history (request_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, input.status, input.note, actor, now);
    }
    return getCitizenRequest(id);
  });
  return update.immediate();
}

export function getCitizenRequestAttachment(requestId: number, attachmentId: number) {
  return db.prepare("SELECT id, request_id, filename, created_at FROM citizen_request_attachments WHERE id = ? AND request_id = ?")
    .get(attachmentId, requestId) as { id: number; request_id: number; filename: string; created_at: string } | undefined;
}
