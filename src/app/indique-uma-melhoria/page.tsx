import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, MapPin, MessageSquareText, ShieldCheck } from "lucide-react";
import { CitizenRequestForm } from "@/components/citizen-request-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Indique uma melhoria",
  description: "Envie uma indicação ao mandato do vereador Junior Coringa e acompanhe o encaminhamento.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function RequestPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const campaign = {
    utmSource: first(query.utm_source), utmMedium: first(query.utm_medium),
    utmCampaign: first(query.utm_campaign), utmContent: first(query.utm_content),
  };
  return <>
    <SiteHeader />
    <main className="request-page">
      <section className="request-hero">
        <div className="shell request-hero__grid">
          <div>
            <div className="eyebrow"><span /> Sua voz ajuda Campo Grande</div>
            <h1>Tem algo no seu bairro que <em>precisa melhorar?</em></h1>
            <p>Conte para o mandato. Sua indicação será organizada, encaminhada ao setor responsável e poderá ser acompanhada por protocolo.</p>
            <a className="button" href="#formulario">Fazer uma indicação <ArrowRight size={18} /></a>
          </div>
          <aside className="request-hero__card">
            <span><MessageSquareText size={29} /></span><h2>Um canal direto com o mandato</h2>
            <ul><li><CheckCircle2 size={18} /> Cadastro simples e seguro</li><li><CheckCircle2 size={18} /> Fotos e local exato do problema</li><li><CheckCircle2 size={18} /> Protocolo para acompanhar</li></ul>
          </aside>
        </div>
      </section>
      <section className="request-how">
        <div className="shell">
          <div className="section-heading section-heading--center"><div className="eyebrow eyebrow--dark"><span /> Como funciona</div><h2>Da sua mensagem ao <em>encaminhamento</em></h2></div>
          <div className="request-how__grid">
            <article><span><MapPin /></span><strong>1. Você relata</strong><p>Informe onde está o problema e, se puder, envie fotos.</p></article>
            <article><span><ClipboardCheck /></span><strong>2. A equipe analisa</strong><p>O assessor confere os dados e protocola no setor competente.</p></article>
            <article><span><MessageSquareText /></span><strong>3. Você acompanha</strong><p>Guarde seu link para consultar as mudanças de situação.</p></article>
          </div>
        </div>
      </section>
      <section className="request-form-section" id="formulario">
        <div className="shell request-form-layout">
          <div className="request-form-intro"><div className="eyebrow eyebrow--dark"><span /> Formulário oficial</div><h2>Envie sua indicação</h2><p>Os campos marcados com * são obrigatórios.</p><div className="request-privacy-note"><ShieldCheck size={24} /><div><strong>Seus dados são protegidos</strong><p>As informações pessoais são usadas para atendimento e acompanhamento, sem exposição pública.</p><Link href="/privacidade">Conheça o aviso de privacidade</Link></div></div></div>
          <CitizenRequestForm campaign={campaign} />
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
