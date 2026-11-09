import { AlertTriangle, Cake, Check, Clock3, MessageCircleMore, MessagesSquare, Send, ShieldCheck } from "lucide-react";
import { EvolutionManager } from "@/components/admin/evolution-manager";
import { getCommunicationCounts, getLatestWebhookReceipt, listRecentCommunicationEvents } from "@/lib/communications";
import { getEvolutionConfiguration, getEvolutionConnectionState, getEvolutionWebhookState } from "@/lib/evolution";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const configuration = getEvolutionConfiguration();
  const [connection, webhook] = await Promise.all([getEvolutionConnectionState(), getEvolutionWebhookState()]);
  const counts = getCommunicationCounts();
  const events = listRecentCommunicationEvents();
  const latestWebhook = getLatestWebhookReceipt();
  const webhookOutcomes: Record<string, string> = {
    recorded: "Mensagem recebida e vinculada",
    citizen_not_found: "Mensagem recebida, telefone não cadastrado",
    outgoing_ignored: "Mensagem enviada pelo próprio número",
    message_invalid: "Mensagem recebida em formato inválido",
    event_ignored: "Evento recebido e ignorado",
    payload_invalid: "Conteúdo de webhook inválido",
  };
  return <div className="admin-content whatsapp-page">
    <div className="admin-page-header"><div><span>Relacionamento autorizado</span><h1>WhatsApp e Evolution API</h1><p>Conecte o número do mandato, acompanhe os retornos e controle os envios automáticos.</p></div><EvolutionManager initialState={connection.state} configured={configuration.ready} initialWebhookActive={webhook.active} /></div>

    {!configuration.ready && <div className="admin-alert evolution-alert"><AlertTriangle size={19} /><div><strong>A conexão ainda não está configurada no site.</strong><span>Adicione no EasyPanel: {configuration.missing.join(", ")}.</span></div></div>}
    {configuration.ready && connection.error && <div className="admin-alert evolution-alert"><AlertTriangle size={19} /><div><strong>A Evolution API não respondeu.</strong><span>{connection.error}</span></div></div>}
    {configuration.sendingEnabled ? <div className="evolution-sending-state is-enabled"><Send size={18} /><div><strong>Disparos automáticos ativados</strong><span>A fila pode enviar mensagens quando a rotina agendada for executada.</span></div></div> : <div className="evolution-sending-state"><ShieldCheck size={18} /><div><strong>Disparos automáticos protegidos</strong><span>EVOLUTION_SEND_ENABLED está desligado. Nenhuma mensagem será enviada durante a configuração.</span></div></div>}

    <div className="admin-stats admin-stats--four whatsapp-stats">
      <article><span><MessagesSquare size={20} /></span><div><strong>{counts.total}</strong><small>Total na fila</small></div></article>
      <article><span><Clock3 size={20} /></span><div><strong>{counts.pending}</strong><small>Aguardando</small></div></article>
      <article><span><Send size={20} /></span><div><strong>{counts.sent}</strong><small>Enviadas</small></div></article>
      <article><span><AlertTriangle size={20} /></span><div><strong>{counts.failed}</strong><small>Com falha</small></div></article>
    </div>

    <div className="whatsapp-grid">
      <section className="admin-list-card evolution-setup">
        <div className="admin-list-card__heading"><h2>Como conectar o número</h2><span>Faça uma vez</span></div>
        <ol>
          <li><span>1</span><div><strong>Crie uma instância no Evolution Manager</strong><p>Use um nome simples, como <code>mandato-junior-coringa</code>, escolha WhatsApp Baileys, ignore grupos e não sincronize o histórico completo.</p></div></li>
          <li><span>2</span><div><strong>Leia o QR Code pelo celular</strong><p>No WhatsApp que será usado, abra <em>Configurações → Aparelhos conectados → Conectar um aparelho</em> e leia o QR Code exibido pela Evolution.</p></div></li>
          <li><span>3</span><div><strong>Informe a conexão no EasyPanel do site</strong><p>Adicione URL, chave da API, nome da instância e segredo do webhook. Depois faça um novo deploy.</p></div></li>
          <li><span>4</span><div><strong>Teste e configure os retornos</strong><p>Use os dois botões no topo desta página. O estado precisa aparecer como <b>Conectado</b>.</p></div></li>
          <li><span>5</span><div><strong>Ative somente depois do teste</strong><p>Altere <code>EVOLUTION_SEND_ENABLED</code> para <code>true</code> apenas quando o número e os modelos estiverem aprovados.</p></div></li>
        </ol>
      </section>

      <section className="admin-list-card evolution-config">
        <div className="admin-list-card__heading"><h2>Configuração reconhecida</h2><span>{configuration.ready ? "Completa" : "Incompleta"}</span></div>
        <dl>
          <div><dt>Endereço da API</dt><dd>{configuration.baseUrl || "Não configurado"}</dd></div>
          <div><dt>Nome da instância</dt><dd>{configuration.instance || "Não configurado"}</dd></div>
          <div><dt>Chave da API</dt><dd>{configuration.missing.includes("EVOLUTION_API_KEY") ? "Não configurada" : "Configurada e protegida"}</dd></div>
          <div><dt>Webhook</dt><dd>{webhook.active ? "Ativo e conferido" : webhook.error ? "Não foi possível conferir" : "Configuração divergente"}</dd></div>
          <div><dt>Último retorno</dt><dd>{latestWebhook ? `${webhookOutcomes[latestWebhook.outcome] || latestWebhook.outcome} · ${formatDateTime(latestWebhook.createdAt)}` : "Nenhum webhook recebido"}</dd></div>
          <div><dt>Envios</dt><dd>{configuration.sendingEnabled ? "Ativados" : "Desativados"}</dd></div>
        </dl>
      </section>
    </div>

    <section className="admin-list-card communication-templates"><div className="admin-list-card__heading"><h2>Mensagens preparadas</h2><span>Somente para contatos autorizados</span></div><div className="communication-template-grid"><article><span><Clock3 /></span><div><strong>Retorno após 30 dias</strong><p>Pergunta se a indicação foi atendida e solicita uma atualização do morador.</p></div></article><article><span><Cake /></span><div><strong>Feliz aniversário</strong><p>Mensagem cordial enviada na data de nascimento cadastrada.</p></div></article><article><span><ShieldCheck /></span><div><strong>Cancelamento imediato</strong><p>Quando a pessoa responde SAIR, os próximos envios são cancelados automaticamente.</p></div></article></div></section>

    <section className="admin-list-card communication-events"><div className="admin-list-card__heading"><h2>Retornos recentes</h2><span>{events.length} eventos</span></div>{events.length ? <div>{events.map((event) => <article key={event.id}><span className={event.direction === "inbound" ? "is-inbound" : "is-outbound"}>{event.direction === "inbound" ? <MessageCircleMore size={17} /> : <Check size={17} />}</span><div><strong>{event.fullName}{event.protocol ? ` · ${event.protocol}` : ""}</strong><p>{event.message || (event.direction === "inbound" ? "Resposta recebida" : "Mensagem enviada")}</p><small>{formatDateTime(event.createdAt)}</small></div></article>)}</div> : <div className="admin-empty"><span><MessageCircleMore size={28} /></span><h3>Nenhum retorno recebido</h3><p>As respostas aparecerão aqui quando o webhook estiver conectado.</p></div>}</section>
  </div>;
}
