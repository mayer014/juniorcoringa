export type PostStatus = "draft" | "published";

export type PostCategory = "Notícia" | "Projeto" | "Agenda" | "Inclusão";

export type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: PostCategory;
  status: PostStatus;
  coverImage: string | null;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readingMinutes?: number;
};

export type PostInput = {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  category: PostCategory;
  status: PostStatus;
  coverImage?: string | null;
  featured?: boolean;
};

export type GalleryStatus = "published" | "hidden";

export type GalleryItem = {
  id: number;
  imageUrl: string;
  title: string;
  caption: string;
  postId: number | null;
  postTitle: string | null;
  postSlug: string | null;
  status: GalleryStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GalleryItemInput = {
  imageUrl: string;
  title?: string;
  caption?: string;
  postId?: number | null;
  status?: GalleryStatus;
};

export type PostOption = {
  id: number;
  title: string;
  slug: string;
};

export type LegislativeKind = "project" | "indication";
export type LegislativeStatusGroup = "processing" | "approved" | "archived" | "protocolled";
export type LegislativeEnrichmentStatus = "pending" | "complete" | "failed" | "manual_review" | "not_applicable";

export type LegislativeItem = {
  id: number;
  externalId: string;
  kind: LegislativeKind;
  type: string;
  number: string;
  year: number;
  title: string;
  summary: string;
  publicSummary: string;
  author: string;
  status: string;
  statusGroup: LegislativeStatusGroup;
  sourceUrl: string;
  location: string | null;
  neighborhood: string | null;
  service: string | null;
  reference: string | null;
  fullText: string | null;
  lawNumber: string | null;
  lawDate: string | null;
  lawUrl: string | null;
  authorRole: string | null;
  occurredAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
  published: boolean;
  featured: boolean;
  enrichmentStatus: LegislativeEnrichmentStatus;
  enrichmentError: string | null;
  enrichmentAttempts: number;
  lastEnrichmentAt: string | null;
  titleOverride: string | null;
  summaryOverride: string | null;
  serviceOverride: string | null;
  locationOverride: string | null;
  neighborhoodOverride: string | null;
  referenceOverride: string | null;
};

export type LegislativeItemInput = Omit<LegislativeItem,
  "id" | "firstSeenAt" | "lastSeenAt" | "updatedAt" | "published" | "featured" |
  "enrichmentAttempts" | "lastEnrichmentAt" | "titleOverride" | "summaryOverride" |
  "serviceOverride" | "locationOverride" | "neighborhoodOverride" | "referenceOverride"
> & {
  rawJson?: string;
  enrichmentAttempted?: boolean;
  initialPublished?: boolean;
};

export type LegislativeItemReviewInput = {
  title: string | null;
  publicSummary: string | null;
  service: string | null;
  location: string | null;
  neighborhood: string | null;
  reference: string | null;
  enrichmentStatus: "complete" | "manual_review";
};

export type CamaraSyncRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "error";
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  newsInserted: number;
  newsUpdated: number;
  newsFound: number;
  newsPending: number;
  newsFailed: number;
  mode: "daily" | "history" | "indications" | "news";
  triggerSource: "manual" | "scheduled";
  error: string | null;
};

export type OfficialNewsQueueStatus = "pending" | "complete" | "failed";

export type OfficialNewsCandidate = {
  sourceId: string;
  sourceUrl: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: string;
};

export type OfficialNewsQueueItem = OfficialNewsCandidate & {
  status: OfficialNewsQueueStatus;
  attempts: number;
  lastError: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastAttemptAt: string | null;
};

export type OfficialNewsQueueCounts = {
  total: number;
  complete: number;
  pending: number;
  failed: number;
};

export type CitizenRequestStatus =
  | "received"
  | "triage"
  | "waiting_information"
  | "assigned"
  | "protocolled"
  | "monitoring"
  | "fulfilled"
  | "partially_fulfilled"
  | "not_fulfilled"
  | "out_of_scope"
  | "duplicate"
  | "closed";

export type CitizenRequestCategory =
  | "pothole"
  | "lighting"
  | "cleaning"
  | "traffic"
  | "transport"
  | "health"
  | "education"
  | "security"
  | "leisure"
  | "accessibility"
  | "other";

export type CitizenRequestInput = {
  fullName: string;
  phone: string;
  birthDate: string;
  postalCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  category: CitizenRequestCategory;
  problemPostalCode: string | null;
  problemStreet: string;
  problemNumber: string | null;
  problemNeighborhood: string;
  problemCity: string;
  problemReference: string | null;
  description: string;
  urgent: boolean;
  privacyAccepted: true;
  relationshipConsent: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
};

export type CitizenRequest = {
  id: number;
  protocol: string;
  fullName: string;
  phone: string;
  birthDate: string;
  postalCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  relationshipConsent: boolean;
  category: CitizenRequestCategory;
  problemPostalCode: string | null;
  problemStreet: string;
  problemNumber: string | null;
  problemNeighborhood: string;
  problemCity: string;
  problemReference: string | null;
  description: string;
  urgent: boolean;
  status: CitizenRequestStatus;
  assignedTo: string | null;
  officialProtocol: string | null;
  officialDepartment: string | null;
  officialProtocolAt: string | null;
  followUpDueAt: string;
  createdAt: string;
  updatedAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  attachments: CitizenRequestAttachment[];
  history: CitizenRequestHistory[];
};

export type CitizenRequestSummary = Pick<CitizenRequest,
  "id" | "protocol" | "fullName" | "phone" | "neighborhood" | "category" |
  "problemNeighborhood" | "description" | "urgent" | "status" | "assignedTo" |
  "officialProtocol" | "followUpDueAt" | "createdAt" | "updatedAt"
>;

export type CitizenRequestAttachment = {
  id: number;
  requestId: number;
  filename: string;
  createdAt: string;
};

export type CitizenRequestHistory = {
  id: number;
  status: CitizenRequestStatus;
  note: string | null;
  actor: string;
  createdAt: string;
};

export type CitizenRequestUpdateInput = {
  status: CitizenRequestStatus;
  assignedTo: string | null;
  officialProtocol: string | null;
  officialDepartment: string | null;
  officialProtocolAt: string | null;
  note: string | null;
};
