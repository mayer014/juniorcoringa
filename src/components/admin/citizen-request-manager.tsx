"use client";

import { FormEvent, useState } from "react";
import { Check, Loader2, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { citizenRequestStatusLabels } from "@/lib/citizen-request-labels";
import type { CitizenRequest, CitizenRequestStatus } from "@/lib/types";

export function CitizenRequestManager({ request }: { request: CitizenRequest }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/admin/requests/${request.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setMessage("Atualização salva.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally { setSaving(false); }
  }

  return <form className="request-admin-manager" onSubmit={save}>
    <div className="request-admin-manager__heading"><div><span>Fluxo de atendimento</span><h2>Atualizar indicação</h2></div><button type="button" className="admin-button admin-button--secondary print-hide" onClick={() => window.print()}><Printer size={17} /> Imprimir ficha</button></div>
    <div className="request-admin-manager__grid">
      <label className="admin-field"><span>Situação</span><select name="status" defaultValue={request.status}>{Object.entries(citizenRequestStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="admin-field"><span>Responsável interno</span><input name="assignedTo" defaultValue={request.assignedTo || ""} placeholder="Nome do assessor" /></label>
      <label className="admin-field"><span>Protocolo oficial</span><input name="officialProtocol" defaultValue={request.officialProtocol || ""} placeholder="Número no órgão" /></label>
      <label className="admin-field"><span>Órgão / secretaria</span><input name="officialDepartment" defaultValue={request.officialDepartment || ""} placeholder="Ex.: Sisep" /></label>
      <label className="admin-field"><span>Data do protocolo oficial</span><input name="officialProtocolAt" type="datetime-local" defaultValue={request.officialProtocolAt?.slice(0, 16) || ""} /></label>
      <label className="admin-field request-admin-manager__note"><span>Nota interna / retorno</span><textarea name="note" rows={4} placeholder="Registre o encaminhamento ou a resposta recebida." /></label>
    </div>
    <div className="request-admin-manager__actions">{message && <span className={message.includes("salva") ? "is-success" : "is-error"}>{message.includes("salva") && <Check size={16} />}{message}</span>}<button className="admin-button admin-button--primary" disabled={saving}>{saving ? <><Loader2 className="spin" size={17} /> Salvando...</> : "Salvar atualização"}</button></div>
  </form>;
}
