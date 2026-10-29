import * as he from "he";

export type IndicationEnrichmentStatus = "pending" | "complete" | "failed" | "manual_review" | "not_applicable";

export type IndicationDetails = {
  location: string | null;
  neighborhood: string | null;
  reference: string | null;
  service: string;
  publicSummary: string;
  fullText: string | null;
  title: string;
  territorial: boolean;
  enrichmentStatus: IndicationEnrichmentStatus;
};

export function normalizeLegislativeText(value: unknown) {
  return he.decode(String(value ?? ""))
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[_\s]+/g, " ")
    .trim();
}

export function normalizeForComparison(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function sentenceCase(value: string) {
  const clean = normalizeLegislativeText(value).replace(/\s+([,.;:])/g, "$1");
  if (!clean) return clean;
  const letters = clean.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const uppercase = letters.replace(/[^A-ZÀ-Þ]/g, "");
  if (letters.length && uppercase.length / letters.length > 0.75) {
    return clean.toLocaleLowerCase("pt-BR").replace(/(^|[.!?]\s+)(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("pt-BR")}`);
  }
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1);
}

export function concise(value: string, maximum = 150) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum + 1).replace(/\s+\S*$/, "").trim();
  return `${shortened}…`;
}

export function cleanPdfText(value: string) {
  return value
    .replace(/Página \d+\/\d+\s*/gi, "")
    .replace(/-- \d+ of \d+ --/gi, "")
    .replace(/Câmara Municipal de Campo Grande\s+ESTADO DE MATO GROSSO DO SUL\s+Avenida Ricardo Brandão, 1600\.\s+CNPJ:[^\n]+\s*/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanField(value: string | undefined | null) {
  const cleaned = normalizeLegislativeText(value)
    .replace(/^(?:endereço|completo|local|referência):?\s*/i, "")
    .replace(/,?\s*Complemento:\s*$/i, "")
    .replace(/\s*CEP(?:\s+Busca|:)?\s*$/i, "")
    .replace(/,\s*n[º°o.]?\s*(?=,|Bairro:|CEP:|$)/gi, "")
    .replace(/,?\s*(?:Bairro|CEP):\s*(?=,|$)/gi, "")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/^\s*[,;:-]+|[,;:-]+\s*$/g, "")
    .replace(/[.]$/, "")
    .trim();
  if (/^(?:n[aã]o\s+)?informad[oa]\b/i.test(cleaned) || /\bJUSTIFICATIVA:/i.test(cleaned)) return null;
  return /\p{L}{3}/u.test(cleaned) ? cleaned : null;
}

function placeCase(value: string) {
  const clean = normalizeLegislativeText(value)
    .replace(/^R\.\s*/i, "Rua ")
    .replace(/^Av\.\s*/i, "Avenida ")
    .replace(/^Tv\.\s*/i, "Travessa ")
    .replace(/^Rod\.\s*/i, "Rodovia ")
    .replace(/^rua\b/i, "Rua")
    .replace(/^avenida\b/i, "Avenida")
    .replace(/^travessa\b/i, "Travessa")
    .replace(/^estrada\b/i, "Estrada")
    .replace(/^praça\b/i, "Praça")
    .replace(/^rodovia\b/i, "Rodovia");
  const letters = clean.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const uppercase = letters.replace(/[^A-ZÀ-Þ]/g, "");
  if (!letters.length || (uppercase.length / letters.length < 0.75 && uppercase.length > 1)) return clean;
  const lowercaseWords = new Set(["a", "as", "ao", "aos", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos"]);
  return clean.toLocaleLowerCase("pt-BR").split(/(\s+)/).map((word, index) => {
    if (!word.trim() || (index > 0 && lowercaseWords.has(word))) return word;
    if (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(word)) return word.toUpperCase();
    return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
  }).join("");
}

export function extractNeighborhood(text: string) {
  const patterns = [
    /Bairro:\s*([^,;]+?)(?:,\s*Campo|,\s*CEP|;|$)/i,
    /(?:NO|DO|PARA O)\s+BAIRRO\s+([A-ZÀ-Ý0-9 .'-]+?)(?:,\s*CEP|\s+CEP|,\s*EM CAMPO|,\s*CAMPO|\s*[–—-]|[.;\n]|$)/i,
    /BAIRRO\s+([A-ZÀ-Ý0-9 .'-]+?)(?:,\s*CEP|\s+CEP|,\s*EM CAMPO|,\s*CAMPO|\s*[–—-]|[.;\n]|$)/i,
    /(?:NA\s+)?REGIÃO\s+(?:DO|DA|DE)\s+([A-ZÀ-Ý0-9 .'-]+?)(?:,\s*EM CAMPO|,\s*CAMPO|[.;\n]|$)/i,
    /\b((?:JARDIM|VILA|PARQUE|RESIDENCIAL|CONJUNTO|LOTEAMENTO)\s+[A-ZÀ-Ý0-9 .'-]+?)(?:[.;\n]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = cleanField(text.match(pattern)?.[1]);
    if (match && !/^(?:col[eé]gio|escola|ubs|unidade)\b/i.test(match)) return placeCase(match).replace(/^Bairro\s+/i, "");
  }
  return null;
}

export function extractLocation(text: string) {
  const section = text.match(/^\s*(?:4\D{0,4})?ENDEREÇO:?\s+(?:ENDEREÇO:?\s+)*([\s\S]*?)(?:Endereço completo:|Ponto de refer|Junior Coringa|$)/im)?.[1];
  const addressOnly = section?.split(/\n\s*(?:Bairro|CEP|Complemento):/i)[0]
    .replace(/\s+(?:Bairro|CEP):[\s\S]*$/i, "");
  const fromSection = cleanField(addressOnly);
  if (fromSection) return placeCase(fromSection);

  const streets = text.match(/\bNAS?\s+RUAS?\s+([\s\S]+?)(?=,\s*(?:NA\s+REGIÃO|NO\s+BAIRRO|EM\s+CAMPO)|\n\s*(?:NA\s+REGIÃO|NO\s+BAIRRO|EM\s+CAMPO)|[.;]\s)/i)?.[1];
  if (streets) return cleanField(placeCase(`Ruas ${streets}`));

  const request = text.match(/((?:RUA|R\.|AVENIDA|AV\.|ALAMEDA|TRAVESSA|TV\.|ESTRADA|PRAÇA|RODOVIA|ROD\.)\s*[A-ZÀ-Ý0-9 .,'º°-]+?)(?:,\s*(?:ESPECIALMENTE|BAIRRO|CEP|EM CAMPO)|\s+BAIRRO|\s+-\s+CAMPO|[;\n]|$)/i)?.[1]
    ?? text.match(/\b(?:na|no)\s+((?:rua|r\.|avenida|av\.|alameda|travessa|tv\.|estrada|praça|rodovia|rod\.)\s*[^,.;\n]+)/i)?.[1];
  const cleaned = cleanField(request ? placeCase(request) : null);
  return cleaned ? placeCase(cleaned) : null;
}

export function extractReference(text: string) {
  const match = text.match(/(?:PONTO\s+DE\s+REFER[ÊE]NCIA|REFER[ÊE]NCIA):?\s*([^\n;]+?)(?:\n|;|$)/i)?.[1];
  return cleanField(match);
}

export function extractRequestedService(text: string) {
  const request = text.match(
    /SOLICITANDO\s+QUE\s+PROVIDENCIE[;:]?\s*((?:A|O)\s+[\s\S]+?)(?=\s+NAS?\s+(?:RUAS?|AVENIDAS?)|\s+(?:NO\s+BAIRRO|NA\s+REGIÃO)|[.]\s)/i,
  )?.[1];
  return request ? sentenceCase(normalizeLegislativeText(request).replace(/[;,]+$/, "")) : null;
}

export function indicationServiceTitle(service: string) {
  const normalized = normalizeForComparison(service);
  const rules: Array<[RegExp, string]> = [
    [/tapa.?buraco/, "Operação tapa-buracos"],
    [/patrolamento.*(?:en)?cascalhamento|(?:en)?cascalhamento.*patrolamento/, "Patrolamento e cascalhamento"],
    [/(?:en)?cascalhamento.*regularizacao|regularizacao.*(?:en)?cascalhamento/, "Cascalhamento e regularização"],
    [/pavimentacao|asfaltamento/, "Pavimentação da via"],
    [/limpeza.*rocada|rocada.*limpeza|capinagem/, "Limpeza e roçada"],
    [/iluminacao|refletor|fiacao eletrica|lampada|luminaria/, "Manutenção da iluminação"],
    [/lombada|quebra.?mola/, "Instalação de lombada"],
    [/drenagem|aguas pluviais/, "Drenagem e melhoria da via"],
    [/sinalizacao/, "Sinalização viária"],
    [/poda|arvore/, "Poda e manejo de árvores"],
    [/semaforo/, "Instalação e manutenção semafórica"],
    [/faixa.*pedestre/, "Implantação de faixa de pedestres"],
    [/praca publica|pracas publicas/, "Revitalização de praça pública"],
    [/rede de esgoto|instalacao de esgoto/, "Instalação e reparo da rede de esgoto"],
    [/limpeza.*(?:area|terreno) public|limpeza de terreno/, "Limpeza de área pública"],
    [/limpeza.*praca.*campo/, "Limpeza de praça e campo de futebol"],
    [/ronda policial/, "Ampliação da ronda policial"],
    [/boca de lobo/, "Implantação e manutenção de boca de lobo"],
    [/rede.*baixa tensao|rede baixa/, "Ampliação da rede elétrica"],
    [/hidrante/, "Instalação de hidrante"],
    [/abrigo.*(?:onibus|ponto)/, "Instalação de abrigo em ponto de ônibus"],
    [/passarela/, "Reforma de passarela"],
  ];
  const matched = rules.find(([pattern]) => pattern.test(normalized));
  if (matched) return matched[1];
  const firstIdea = service
    .replace(/^\d+\s*[-–—]\s*/, "")
    .split(/\s+[—–-]\s+|[;:]|,\s+(?:na|no|em|para|bairro)\s+|\s+(?:na|no|em|para)\s+(?=(?:rua|avenida|bairro|região|praça|estrada|travessa|rodovia)\b)/i)[0]
    .replace(/[.]$/, "")
    .trim();
  return concise(firstIdea || service, 78);
}

export function isTerritorialService(service: string) {
  return /(?:rua|avenida|via|bairro|regiao|patrol|cascalh|buraco|paviment|asfalt|drenag|ilumin|limpeza|rocada|capin|lombada|quebra.?mola|redutor|sinaliz|semaforo|faixa|praca|esgoto|arvore|poda)/.test(normalizeForComparison(service));
}

function locationPreposition(location: string) {
  const normalized = normalizeForComparison(location);
  if (/^(ruas|avenidas|pracas|estradas|travessas|alamedas)\b/.test(normalized)) return "nas";
  if (/^(rua|avenida|praca|estrada|travessa|alameda|rodovia)\b/.test(normalized)) return "na";
  return "em";
}

export function formatIndicationTitle(service: string, location: string | null, neighborhood: string | null) {
  const shortService = indicationServiceTitle(service);
  let cleanLocation = cleanField(location);
  let cleanNeighborhood = cleanField(neighborhood);
  if (cleanLocation && normalizeForComparison(shortService).includes(normalizeForComparison(cleanLocation))) cleanLocation = null;
  if (cleanNeighborhood && normalizeForComparison(shortService).includes(normalizeForComparison(cleanNeighborhood))) cleanNeighborhood = null;
  const neighborhoodSuffix = cleanNeighborhood ? `, bairro ${cleanNeighborhood}` : "";
  if (cleanLocation) {
    const available = Math.max(40, 160 - shortService.length - neighborhoodSuffix.length - 5);
    cleanLocation = concise(cleanLocation, available);
  }
  let suffix = cleanLocation
    ? `${locationPreposition(cleanLocation)} ${cleanLocation}${cleanNeighborhood ? `, bairro ${cleanNeighborhood}` : ""}`
    : cleanNeighborhood ? `no bairro ${cleanNeighborhood}` : "";
  if (!suffix) return concise(shortService, 150);
  const serviceLimit = Math.max(24, 160 - suffix.length - 1);
  let title = `${concise(shortService, serviceLimit).replace(/…$/, "")} ${suffix}`.trim();
  if (title.length > 160 && cleanLocation) {
    const excess = title.length - 160;
    cleanLocation = concise(cleanLocation, Math.max(25, cleanLocation.length - excess - 1));
    suffix = `${locationPreposition(cleanLocation)} ${cleanLocation}${neighborhoodSuffix}`;
    title = `${concise(shortService, Math.max(20, 160 - suffix.length - 1)).replace(/…$/, "")} ${suffix}`.trim();
  }
  return title;
}

export function formatIndicationSummary(service: string, location: string | null, neighborhood: string | null) {
  const serviceText = sentenceCase(service).replace(/[.]$/, "");
  const cleanLocation = cleanField(location);
  const cleanNeighborhood = cleanField(neighborhood);
  const place = cleanLocation
    ? `${locationPreposition(cleanLocation)} ${cleanLocation}${cleanNeighborhood ? `, no bairro ${cleanNeighborhood}` : ""}`
    : cleanNeighborhood ? `no bairro ${cleanNeighborhood}` : "em Campo Grande";
  return concise(`Solicitação à Prefeitura de Campo Grande para realizar ${serviceText.charAt(0).toLocaleLowerCase("pt-BR")}${serviceText.slice(1)} ${place}.`, 320);
}

export function buildIndicationDetails(summaryValue: string, pdfText: string | null): IndicationDetails {
  const summary = sentenceCase(summaryValue).replace(/[.]$/, "");
  const fullText = pdfText ? cleanPdfText(pdfText) : null;
  const searchable = fullText || summary;
  const extractedLocation = extractLocation(searchable);
  const neighborhood = extractNeighborhood(searchable);
  const escapedNeighborhood = neighborhood?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const location = extractedLocation
    ?.replace(escapedNeighborhood ? new RegExp(`(?:,|;|–|—|-)?\\s*Bairro\\s+${escapedNeighborhood}[\\s\\S]*$`, "i") : /$^/, "")
    .replace(escapedNeighborhood ? new RegExp(`(?:,|;|–|—|-|\\s)\\s*${escapedNeighborhood}[\\s\\S]*$`, "i") : /$^/, "")
    .replace(neighborhood ? /,?\s*Bairro\s+[^,;]+(?=,|$)/i : /$^/, "")
    .replace(/,?\s*Bairro\s*$/i, "")
    .replace(/,?\s*CEP\s*\d{5}-?\d{3}[\s\S]*$/i, "")
    .replace(/,?\s*Campo Grande(?:\s*[-/]\s*MS)?[\s\S]*$/i, "")
    .replace(/[,;\s]+$/, "") || null;
  const reference = extractReference(searchable);
  const requestedService = fullText ? extractRequestedService(fullText) : null;
  const filenameLikeSummary = /^indicacao\s+/i.test(normalizeForComparison(summary));
  const service = (filenameLikeSummary ? requestedService : null) || summary || requestedService || "Solicitação de melhoria urbana";
  const territorial = isTerritorialService(service);
  const ambiguousService = /^indicacao\b/.test(normalizeForComparison(service));
  const enrichmentStatus: IndicationEnrichmentStatus = ambiguousService
    ? "manual_review"
    : territorial && !location && !neighborhood ? "pending" : "complete";
  return {
    location,
    neighborhood,
    reference,
    service,
    publicSummary: formatIndicationSummary(service, location, neighborhood),
    fullText,
    title: formatIndicationTitle(service, location, neighborhood),
    territorial,
    enrichmentStatus,
  };
}
