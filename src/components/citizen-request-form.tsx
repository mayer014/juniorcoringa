"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, ImagePlus, Loader2, ShieldCheck } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { citizenRequestCategoryLabels } from "@/lib/citizen-request-labels";

type Campaign = { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string };
type Success = { protocol: string; trackingUrl: string; warning?: string | null };

export function CitizenRequestForm({ campaign }: { campaign: Campaign }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [sameAddress, setSameAddress] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Success | null>(null);

  function advance() {
    const panel = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const fields = Array.from(panel?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea") || []);
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    setError("");
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: formRef.current?.offsetTop ? formRef.current.offsetTop - 120 : 0, behavior: "smooth" });
  }

  function copyAddress(checked: boolean) {
    setSameAddress(checked);
    const form = formRef.current;
    if (!checked || !form) return;
    const data = new FormData(form);
    const pairs = [
      ["postalCode", "problemPostalCode"], ["street", "problemStreet"],
      ["addressNumber", "problemNumber"], ["neighborhood", "problemNeighborhood"], ["city", "problemCity"],
    ];
    for (const [from, to] of pairs) {
      const target = form.elements.namedItem(to) as HTMLInputElement | null;
      if (target) target.value = String(data.get(from) || "");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const data = new FormData(event.currentTarget);
      data.set("privacyAccepted", data.has("privacyAccepted") ? "true" : "false");
      data.set("relationshipConsent", data.has("relationshipConsent") ? "true" : "false");
      data.set("urgent", data.has("urgent") ? "true" : "false");
      data.set("referrer", document.referrer || "");
      const response = await fetch("/api/requests", { method: "POST", body: data });
      const payload = await response.json() as Success & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar.");
      setSuccess(payload);
      window.scrollTo({ top: formRef.current?.offsetTop ? formRef.current.offsetTop - 120 : 0, behavior: "smooth" });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  if (success) {
    return (
      <div className="request-success" role="status">
        <span className="request-success__icon"><Check size={34} /></span>
        <p className="eyebrow eyebrow--dark">Solicitação recebida</p>
        <h2>Obrigado por ajudar a cuidar da cidade.</h2>
        <p>Seu protocolo é <strong>{success.protocol}</strong>. Guarde o link abaixo para acompanhar o andamento.</p>
        {success.warning && <p className="form-message form-message--warning">{success.warning}</p>}
        <Link className="button" href={success.trackingUrl}>Acompanhar solicitação</Link>
        <small>O envio registra a demanda para análise do mandato, mas não garante a execução pelo órgão responsável.</small>
      </div>
    );
  }

  return (
    <form className="request-form" ref={formRef} onSubmit={submit}>
      <div className="request-steps" aria-label="Etapas do formulário">
        {["Seus dados", "A indicação", "Revisão"].map((label, index) => (
          <div className={`${step === index + 1 ? "is-active" : ""}${step > index + 1 ? " is-complete" : ""}`} key={label}>
            <span>{step > index + 1 ? <Check size={15} /> : index + 1}</span><small>{label}</small>
          </div>
        ))}
      </div>

      <input className="form-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {Object.entries(campaign).map(([name, value]) => <input key={name} type="hidden" name={name} value={value || ""} />)}

      <section className="request-form__panel" data-step="1" hidden={step !== 1}>
        <div className="request-form__heading"><span>01</span><div><h2>Primeiro, conte quem é você</h2><p>Esses dados permitem identificar e manter contato sobre a sua solicitação.</p></div></div>
        <div className="request-form__grid">
          <label className="field field--wide"><span>Nome completo *</span><input name="fullName" minLength={5} maxLength={140} required autoComplete="name" placeholder="Digite seu nome completo" /></label>
          <label className="field"><span>WhatsApp com DDD *</span><input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(67) 99999-9999" /></label>
          <label className="field"><span>Data de nascimento *</span><input name="birthDate" type="date" required autoComplete="bday" /></label>
          <label className="field"><span>CEP residencial *</span><input name="postalCode" required inputMode="numeric" pattern="[0-9. -]{8,10}" placeholder="79000-000" autoComplete="postal-code" /></label>
          <label className="field field--grow"><span>Rua / avenida *</span><input name="street" required maxLength={180} autoComplete="address-line1" /></label>
          <label className="field field--number"><span>Número *</span><input name="addressNumber" required maxLength={20} /></label>
          <label className="field"><span>Complemento</span><input name="addressComplement" maxLength={120} autoComplete="address-line2" /></label>
          <label className="field"><span>Bairro *</span><input name="neighborhood" required maxLength={120} /></label>
          <label className="field"><span>Cidade *</span><input name="city" required maxLength={120} defaultValue="Campo Grande" autoComplete="address-level2" /></label>
          <label className="field field--uf"><span>UF *</span><input name="state" required maxLength={2} defaultValue="MS" autoComplete="address-level1" /></label>
        </div>
      </section>

      <section className="request-form__panel" data-step="2" hidden={step !== 2}>
        <div className="request-form__heading"><span>02</span><div><h2>O que precisa melhorar?</h2><p>Quanto mais claro for o relato, mais rápido o assessor poderá encaminhá-lo.</p></div></div>
        <div className="request-form__grid">
          <label className="field field--wide"><span>Categoria *</span><select name="category" required defaultValue=""><option value="" disabled>Selecione o assunto</option>{Object.entries(citizenRequestCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="request-same-address field--wide"><input type="checkbox" checked={sameAddress} onChange={(event) => copyAddress(event.target.checked)} /><span>O problema fica no meu endereço residencial</span></label>
          <label className="field"><span>CEP do problema</span><input name="problemPostalCode" inputMode="numeric" pattern="[0-9. -]{8,10}" placeholder="79000-000" /></label>
          <label className="field field--grow"><span>Rua / avenida do problema *</span><input name="problemStreet" required maxLength={180} /></label>
          <label className="field field--number"><span>Número</span><input name="problemNumber" maxLength={20} /></label>
          <label className="field"><span>Bairro do problema *</span><input name="problemNeighborhood" required maxLength={120} /></label>
          <label className="field"><span>Cidade *</span><input name="problemCity" required maxLength={120} defaultValue="Campo Grande" /></label>
          <label className="field field--wide"><span>Ponto de referência</span><input name="problemReference" maxLength={240} placeholder="Ex.: em frente à escola, esquina com..." /></label>
          <label className="field field--wide"><span>Descreva a situação *</span><textarea name="description" required minLength={20} maxLength={3000} rows={7} placeholder="Explique o problema, há quanto tempo acontece e como afeta o local." /></label>
          <label className="request-check field--wide"><input name="urgent" type="checkbox" /><span><strong>Há risco imediato para pessoas?</strong><small>Marque somente em situações que exigem atenção prioritária.</small></span></label>
          <label className="request-upload field--wide"><ImagePlus size={23} /><span><strong>Adicionar fotos</strong><small>Até 3 arquivos JPG, PNG ou WebP, com no máximo 8 MB cada.</small></span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label>
        </div>
      </section>

      <section className="request-form__panel" data-step="3" hidden={step !== 3}>
        <div className="request-form__heading"><span>03</span><div><h2>Privacidade e envio</h2><p>Confira as regras de uso dos dados antes de registrar sua indicação.</p></div></div>
        <div className="request-consents">
          <label className="consent-card consent-card--required"><input name="privacyAccepted" type="checkbox" required /><span><ShieldCheck size={25} /><span><strong>Li o aviso de privacidade e concordo com o uso dos dados para registrar, encaminhar e acompanhar esta solicitação. *</strong><small>Seus dados de contato e endereço não serão exibidos publicamente. <Link href="/privacidade" target="_blank">Ler o aviso completo</Link>.</small></span></span></label>
          <label className="consent-card"><input name="relationshipConsent" type="checkbox" /><span><span className="whatsapp-mark">W</span><span><strong>Quero manter contato pelo WhatsApp</strong><small>Autorizo o mandato do vereador Junior Coringa a enviar mensagens pelo WhatsApp, incluindo atualizações, informações e felicitações de aniversário. Posso cancelar a qualquer momento enviando “SAIR”.</small></span></span></label>
        </div>
        <div className="request-disclaimer"><strong>Importante</strong><p>O mandato fará a análise e o encaminhamento aos órgãos competentes. O registro não substitui serviços de emergência nem garante prazo ou execução pelo poder público.</p></div>
      </section>

      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      <div className="request-form__actions">
        {step > 1 && <button className="button button--ghost-dark" type="button" onClick={() => setStep((current) => current - 1)}><ChevronLeft size={18} /> Voltar</button>}
        {step < 3 ? <button className="button" type="button" onClick={advance}>Continuar <ChevronRight size={18} /></button> : <button className="button" type="submit" disabled={sending}>{sending ? <><Loader2 className="spin" size={18} /> Enviando...</> : <>Enviar indicação <ChevronRight size={18} /></>}</button>}
      </div>
    </form>
  );
}
