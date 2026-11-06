import type { CitizenRequestCategory, CitizenRequestStatus } from "@/lib/types";

export const citizenCategoryLabels: Record<CitizenRequestCategory, string> = {
  pothole: "Buracos e pavimentação",
  lighting: "Iluminação pública",
  cleaning: "Limpeza urbana",
  traffic: "Trânsito e sinalização",
  transport: "Transporte",
  health: "Saúde",
  education: "Educação",
  security: "Segurança",
  leisure: "Praças, esporte e lazer",
  accessibility: "Acessibilidade",
  other: "Outros",
};

export const citizenStatusLabels: Record<CitizenRequestStatus, string> = {
  received: "Recebida",
  triage: "Em triagem",
  waiting_information: "Aguardando informações",
  assigned: "Encaminhada ao assessor",
  protocolled: "Protocolada",
  monitoring: "Em acompanhamento",
  fulfilled: "Atendida",
  partially_fulfilled: "Parcialmente atendida",
  not_fulfilled: "Não atendida",
  out_of_scope: "Fora da competência",
  duplicate: "Duplicada",
  closed: "Encerrada",
};

export const publicCitizenStatusLabels: Record<CitizenRequestStatus, string> = {
  received: "Recebida",
  triage: "Em análise",
  waiting_information: "Aguardando informações",
  assigned: "Em análise",
  protocolled: "Protocolada",
  monitoring: "Em acompanhamento",
  fulfilled: "Concluída",
  partially_fulfilled: "Concluída parcialmente",
  not_fulfilled: "Concluída",
  out_of_scope: "Concluída",
  duplicate: "Concluída",
  closed: "Concluída",
};

export const citizenRequestCategoryLabels = citizenCategoryLabels;
export const citizenRequestStatusLabels = citizenStatusLabels;
export const citizenRequestPublicStatusLabels = publicCitizenStatusLabels;
