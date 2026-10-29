import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIndicationDetails,
  extractLocation,
  extractNeighborhood,
  formatIndicationTitle,
} from "./legislative-content";

test("gera título com serviço, rua e bairro", () => {
  const details = buildIndicationDetails("Patrolamento e encascalhamento de via não pavimentada.", `
    SOLICITANDO QUE PROVIDENCIE O PATROLAMENTO E ENCASCLHAMENTO
    ENDEREÇO Rua das Palmeiras, nº 120\nBairro: JARDIM NOROESTE, Campo Grande
    Ponto de referência: próximo à escola municipal
    Junior Coringa
  `);
  assert.equal(details.location, "Rua das Palmeiras, nº 120");
  assert.equal(details.neighborhood, "Jardim Noroeste");
  assert.match(details.title, /^Patrolamento e cascalhamento na Rua das Palmeiras/);
  assert.match(details.title, /bairro Jardim Noroeste$/);
  assert.equal(details.enrichmentStatus, "complete");
});

test("gera título territorial com somente o bairro", () => {
  assert.equal(
    formatIndicationTitle("Cascalhamento e regularização de via não pavimentada", null, "Jardim Paulo Coelho"),
    "Cascalhamento e regularização no bairro Jardim Paulo Coelho",
  );
});

test("marca demanda territorial sem local para enriquecimento", () => {
  const details = buildIndicationDetails("Tapa-buracos em via com itinerário de transporte coletivo.", null);
  assert.equal(details.territorial, true);
  assert.equal(details.enrichmentStatus, "pending");
});

test("extrai múltiplas ruas e região", () => {
  const text = "SOLICITAMOS LIMPEZA NAS RUAS DAS FLORES E DOS IPÊS, NA REGIÃO DO NOVA LIMA, EM CAMPO GRANDE.";
  assert.equal(extractLocation(text), "Ruas das Flores e dos Ipês");
  assert.equal(extractNeighborhood(text), "Nova Lima");
});

test("não corta o bairro ao limitar título", () => {
  const title = formatIndicationTitle("Implantação de uma solução extremamente extensa e detalhada para melhoria da mobilidade e da segurança viária", "Avenida Prefeito Heráclito José Diniz de Figueiredo", "Jardim das Cerejeiras");
  assert.ok(title.length <= 160);
  assert.match(title, /bairro Jardim das Cerejeiras$/);
});

test("normaliza caixa e remove bairro e CEP repetidos do endereço", () => {
  const details = buildIndicationDetails("Tapa-buracos em via pública.", "RUA CARLOTA MASSA FARINA, JARDIM PACAEMBU, CEP 79000-000, CAMPO GRANDE/MS\nBAIRRO JARDIM PACAEMBU, CAMPO GRANDE");
  assert.equal(details.location, "Rua Carlota Massa Farina");
  assert.equal(details.neighborhood, "Jardim Pacaembu");
  assert.equal(details.title, "Operação tapa-buracos na Rua Carlota Massa Farina, bairro Jardim Pacaembu");
});

test("reconhece abreviação de rua no texto oficial", () => {
  const details = buildIndicationDetails("Revisão de iluminação pública em toda a extensão", "R. Jorge Adri - Campo Grande\nMS, 79065-602");
  assert.equal(details.location, "Rua Jorge Adri");
  assert.equal(details.title, "Manutenção da iluminação na Rua Jorge Adri");
  assert.equal(details.enrichmentStatus, "complete");
});

test("ignora menção narrativa a endereço e usa o campo oficial", () => {
  const details = buildIndicationDetails("Tapa-buracos e recapeamento asfáltico", `
    RECUPERAÇÃO DA VIA NO ENDEREÇO INFORMADO, EM RAZÃO DAS MÁS CONDIÇÕES.
    JUSTIFICATIVA: A PRESENTE SOLICITAÇÃO É NECESSÁRIA.
    4️⃣ ENDEREÇO
    TRAVESSA TAMBAIBA, Nº 18, EM FRENTE AO TERMINAL, BAIRRO VILA MORENINHA III, CAMPO GRANDE/MS.
  `);
  assert.equal(details.location, "Travessa Tambaiba, Nº 18, em Frente ao Terminal");
  assert.equal(details.neighborhood, "Vila Moreninha III");
  assert.match(details.title, /bairro Vila Moreninha III$/);
});

test("remove bairro duplicado do endereço", () => {
  const details = buildIndicationDetails("Poda de árvores", "Rua 26 de Agosto, Bairro Centro CEP 79000-000");
  assert.equal(details.location, "Rua 26 de Agosto");
  assert.equal(details.neighborhood, "Centro");
  assert.equal(details.title, "Poda e manejo de árvores na Rua 26 de Agosto, bairro Centro");
});

test("extrai bairro implícito ao final do assunto", () => {
  const details = buildIndicationDetails("Patrolamento na rua Sebastião Ferreira 307 Jardim Colorado", null);
  assert.equal(details.neighborhood, "Jardim Colorado");
  assert.equal(details.location, "Rua Sebastião Ferreira 307");
});

test("encaminha assunto genérico de indicação para revisão", () => {
  const details = buildIndicationDetails("Indicacao andreia duarte frutuoso rua sebastiao ferreira 307 jardim colorado", null);
  assert.equal(details.enrichmentStatus, "manual_review");
});

test("remove localidade do resumo do serviço para evitar bairro duplicado", () => {
  const details = buildIndicationDetails("Limpeza de canteiro central da Avenida Wilson Paes de Barros, bairro Serradinho", null);
  assert.equal(details.title, "Limpeza de canteiro central da Avenida Wilson Paes de Barros no bairro Serradinho");
  assert.equal(details.title.match(/bairro/gi)?.length, 1);
});

test("extrai bairro separado por travessão no campo de endereço", () => {
  const details = buildIndicationDetails("Operação tapa-buracos", "Endereço\nEndereço:\nRua Otorino Vieira com Rua José Garcia – Bairro Caiçara – Campo Grande/MS\nEndereço completo:");
  assert.equal(details.location, "Rua Otorino Vieira com Rua José Garcia");
  assert.equal(details.neighborhood, "Caiçara");
  assert.equal(details.title, "Operação tapa-buracos na Rua Otorino Vieira com Rua José Garcia, bairro Caiçara");
});
