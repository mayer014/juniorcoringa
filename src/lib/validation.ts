import type { CitizenRequestCategory, CitizenRequestInput, CitizenRequestStatus, CitizenRequestUpdateInput, GalleryItemInput, GalleryStatus, LegislativeItemReviewInput, PostCategory, PostInput, PostStatus } from "@/lib/types";

const categories: PostCategory[] = ["Notícia", "Projeto", "Agenda", "Inclusão"];
const statuses: PostStatus[] = ["draft", "published"];
export const citizenRequestCategories: CitizenRequestCategory[] = ["pothole", "lighting", "cleaning", "traffic", "transport", "health", "education", "security", "leisure", "accessibility", "other"];
export const citizenRequestStatuses: CitizenRequestStatus[] = ["received", "triage", "waiting_information", "assigned", "protocolled", "monitoring", "fulfilled", "partially_fulfilled", "not_fulfilled", "out_of_scope", "duplicate", "closed"];

function optionalFormText(body: Record<string, unknown>, key: string, maximum: number) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  return value ? value.slice(0, maximum) : null;
}

function requiredFormText(body: Record<string, unknown>, key: string, minimum: number, maximum: number, label: string) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  if (value.length < minimum || value.length > maximum) return { error: `${label} deve ter entre ${minimum} e ${maximum} caracteres.` };
  return { value };
}

export function validateCitizenRequestInput(value: unknown): { data?: CitizenRequestInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inv\u00e1lidos." };
  const body = value as Record<string, unknown>;
  const fullName = requiredFormText(body, "fullName", 5, 140, "O nome completo");
  const street = requiredFormText(body, "street", 2, 180, "O endere\u00e7o residencial");
  const addressNumber = requiredFormText(body, "addressNumber", 1, 20, "O n\u00famero residencial");
  const neighborhood = requiredFormText(body, "neighborhood", 2, 120, "O bairro residencial");
  const city = requiredFormText(body, "city", 2, 120, "A cidade");
  const problemStreet = requiredFormText(body, "problemStreet", 2, 180, "O endere\u00e7o do problema");
  const problemNeighborhood = requiredFormText(body, "problemNeighborhood", 2, 120, "O bairro do problema");
  const problemCity = requiredFormText(body, "problemCity", 2, 120, "A cidade do problema");
  const description = requiredFormText(body, "description", 20, 3000, "A descri\u00e7\u00e3o");
  const invalid = [fullName, street, addressNumber, neighborhood, city, problemStreet, problemNeighborhood, problemCity, description]
    .find((field): field is { error: string } => "error" in field);
  if (invalid) return { error: invalid.error };
  const phoneDigits = String(body.phone ?? "").replace(/\D/g, "");
  const localPhone = phoneDigits.startsWith("55") && phoneDigits.length > 11 ? phoneDigits.slice(2) : phoneDigits;
  if (localPhone.length < 10 || localPhone.length > 11) return { error: "Informe um telefone com DDD v\u00e1lido." };
  const postalCode = String(body.postalCode ?? "").replace(/\D/g, "");
  if (postalCode.length !== 8) return { error: "Informe um CEP residencial v\u00e1lido." };
  const problemPostalCodeRaw = String(body.problemPostalCode ?? "").replace(/\D/g, "");
  if (problemPostalCodeRaw && problemPostalCodeRaw.length !== 8) return { error: "Informe um CEP v\u00e1lido para o problema." };
  const birthDate = typeof body.birthDate === "string" ? body.birthDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return { error: "Informe uma data de nascimento v\u00e1lida." };
  const born = new Date(`${birthDate}T12:00:00-04:00`);
  const now = new Date();
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  if (!Number.isFinite(born.getTime()) || born > now || born.getFullYear() !== birthYear || born.getMonth() + 1 !== birthMonth ||
    born.getDate() !== birthDay || born.getFullYear() < now.getFullYear() - 120) return { error: "Informe uma data de nascimento v\u00e1lida." };
  const state = String(body.state ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return { error: "Informe a UF residencial." };
  const category = body.category as CitizenRequestCategory;
  if (!citizenRequestCategories.includes(category)) return { error: "Selecione uma categoria v\u00e1lida." };
  if (body.privacyAccepted !== true) return { error: "Confirme a leitura do aviso de privacidade." };
  return {
    data: {
      fullName: fullName.value!, phone: String(body.phone), birthDate, postalCode,
      street: street.value!, addressNumber: addressNumber.value!, addressComplement: optionalFormText(body, "addressComplement", 120),
      neighborhood: neighborhood.value!, city: city.value!, state, category,
      problemPostalCode: problemPostalCodeRaw || null, problemStreet: problemStreet.value!,
      problemNumber: optionalFormText(body, "problemNumber", 20), problemNeighborhood: problemNeighborhood.value!, problemCity: problemCity.value!,
      problemReference: optionalFormText(body, "problemReference", 240), description: description.value!, urgent: body.urgent === true,
      privacyAccepted: true, relationshipConsent: body.relationshipConsent === true,
      utmSource: optionalFormText(body, "utmSource", 150), utmMedium: optionalFormText(body, "utmMedium", 150),
      utmCampaign: optionalFormText(body, "utmCampaign", 150), utmContent: optionalFormText(body, "utmContent", 150),
      referrer: optionalFormText(body, "referrer", 500),
    },
  };
}

export function validateCitizenRequestUpdate(value: unknown): { data?: CitizenRequestUpdateInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inv\u00e1lidos." };
  const body = value as Record<string, unknown>;
  const status = body.status as CitizenRequestStatus;
  if (!citizenRequestStatuses.includes(status)) return { error: "Situa\u00e7\u00e3o inv\u00e1lida." };
  return {
    data: {
      status,
      assignedTo: optionalFormText(body, "assignedTo", 160),
      officialProtocol: optionalFormText(body, "officialProtocol", 100),
      officialDepartment: optionalFormText(body, "officialDepartment", 180),
      officialProtocolAt: optionalFormText(body, "officialProtocolAt", 30),
      note: optionalFormText(body, "note", 1500),
    },
  };
}

export function validatePostInput(value: unknown): { data?: PostInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inválidos." };
  const body = value as Record<string, unknown>;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : undefined;
  const coverImage = typeof body.coverImage === "string" ? body.coverImage.trim() : null;
  const category = body.category as PostCategory;
  const status = body.status as PostStatus;

  if (title.length < 5 || title.length > 160) return { error: "O título deve ter entre 5 e 160 caracteres." };
  if (excerpt.length < 10 || excerpt.length > 320) return { error: "O resumo deve ter entre 10 e 320 caracteres." };
  if (content.length < 20 || content.length > 100_000) return { error: "O conteúdo precisa ter pelo menos 20 caracteres." };
  if (!categories.includes(category)) return { error: "Categoria inválida." };
  if (!statuses.includes(status)) return { error: "Status inválido." };
  if (coverImage && !coverImage.startsWith("/media/")) return { error: "Imagem de capa inválida." };

  return {
    data: {
      title,
      excerpt,
      content,
      slug,
      coverImage,
      category,
      status,
      featured: Boolean(body.featured),
    },
  };
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expectedHost =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      new URL(request.url).host;
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

export function validateGalleryItemInput(value: unknown): { data?: GalleryItemInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inválidos." };
  const body = value as Record<string, unknown>;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const status = body.status === "hidden" ? "hidden" : "published" as GalleryStatus;
  const postId = body.postId === null || body.postId === "" || body.postId === undefined
    ? null
    : Number(body.postId);

  if (!imageUrl.startsWith("/media/")) return { error: "Imagem inválida." };
  if (title.length > 180) return { error: "O título deve ter no máximo 180 caracteres." };
  if (caption.length > 600) return { error: "A legenda deve ter no máximo 600 caracteres." };
  if (postId !== null && (!Number.isInteger(postId) || postId < 1)) return { error: "Matéria vinculada inválida." };

  return { data: { imageUrl, title, caption, postId, status } };
}

export function validateGalleryItems(value: unknown): { data?: GalleryItemInput[]; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inválidos." };
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    return { error: "Envie entre 1 e 30 imagens por vez." };
  }

  const parsed: GalleryItemInput[] = [];
  for (const item of items) {
    const result = validateGalleryItemInput(item);
    if (!result.data) return { error: result.error };
    parsed.push(result.data);
  }
  return { data: parsed };
}

export function validateLegislativeReviewInput(value: unknown): { data?: LegislativeItemReviewInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inválidos." };
  const body = value as Record<string, unknown>;
  const optionalText = (key: string, maximum: number) => {
    const raw = body[key];
    if (raw === null || raw === undefined || raw === "") return { value: null as string | null };
    if (typeof raw !== "string") return { error: `O campo ${key} é inválido.` };
    const text = raw.trim();
    if (text.length > maximum) return { error: `O campo ${key} deve ter no máximo ${maximum} caracteres.` };
    return { value: text || null };
  };
  const title = optionalText("title", 180);
  const publicSummary = optionalText("publicSummary", 500);
  const service = optionalText("service", 500);
  const location = optionalText("location", 500);
  const neighborhood = optionalText("neighborhood", 180);
  const reference = optionalText("reference", 300);
  const invalid = [title, publicSummary, service, location, neighborhood, reference].find((field) => field.error);
  if (invalid?.error) return { error: invalid.error };
  if (title.value && title.value.length < 5) return { error: "O título deve ter pelo menos 5 caracteres." };
  const enrichmentStatus = body.enrichmentStatus === "complete" ? "complete" : "manual_review";
  return {
    data: {
      title: title.value ?? null,
      publicSummary: publicSummary.value ?? null,
      service: service.value ?? null,
      location: location.value ?? null,
      neighborhood: neighborhood.value ?? null,
      reference: reference.value ?? null,
      enrichmentStatus,
    },
  };
}
