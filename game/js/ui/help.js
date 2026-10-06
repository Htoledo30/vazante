// Ajuda do ICOR: codex de regras (curto, direto), botão "?" contextual e dicas de primeira vez.
//
//   HELP[topic] = { title, group, body, tip?, see?:[topics] }
//   showHelp(topic)        -> folha com o tópico (navega entre relacionados)
//   helpButton(topic, opts)-> botão "?" pequeno (>= 36px) que abre showHelp
//   hintOnce(topic, opts)  -> mostra o tópico UMA vez (settings.seenHelp); retorna true se mostrou
//
// Textos seguem as regras reais do DESIGN/ARCHITECTURE. Os números aqui são os do contrato.
// body: parágrafos separados por linha em branco; linhas iniciadas por "• " viram lista.
import { h, button } from './dom.js';
import { loadSettings, saveSettings } from '../core/save.js';

export const HELP_GROUPS = [
  ['basico', 'Primeiros passos'],
  ['combate', 'Combate'],
  ['corpo', 'Corpo e mente'],
  ['progresso', 'Progressão'],
  ['ermo', 'Expedição'],
  ['cidade', 'Cidade e campanha'],
  ['itens', 'Equipamento'],
];

export const HELP = {
  // ---------------- básico ----------------
  inicio: {
    group: 'basico', title: 'Início rápido',
    body: `Um deus apodrece no Ermo. O sangue dele, o Icor, é dinheiro, poder e veneno. A Chaga sobe todo dia; em 100, Valdrem cai.

• Na cidade: compre ração e tochas, cure feridas, pegue contratos.
• Saia pelo Portão. No mapa, escolha nós; cada passo custa horas, luz e comida.
• Lute, saqueie, volte com Icor antes que a tocha apague.
• Beba Icor para subir de nível — e apodreça um pouco.
• Morreu? Seu herdeiro continua. Seu cadáver fica lá fora.

Tudo é por toque. Botões mostram custo e chance. Botão apagado diz o motivo ao ser tocado.`,
    tip: 'Na primeira expedição, volte cedo. Viver é progredir.',
    see: ['combate', 'expedicao', 'chaga', 'linhagem'],
  },
  testes: {
    group: 'basico', title: 'Testes de atributo',
    body: `Arriscar algo rola um teste de atributo. A chance aparece no botão antes de escolher.

• Chance = 35 + atributo × 8 + bônus − dificuldade (mínimo 5%, máximo 95%).
• Dificuldade: Fácil 0 · Média 20 · Difícil 40 · Brutal 60.
• FOR força, DES agilidade, VIG resistência, VON fé e nervos, AST esperteza.

Origem, traços e itens abrem opções exclusivas. Sucesso crítico (rolagem baixa) às vezes dá mais.`,
    tip: 'Abaixo de 50%, pense no preço do fracasso, não no prêmio.',
    see: ['inicio', 'itens'],
  },
  // ---------------- combate ----------------
  combate: {
    group: 'combate', title: 'Combate',
    body: `Turnos numa linha do tempo. Cada ação custa tempo: adaga age rápido (~70), montante devagar (~150). A fila mostra quem age a seguir.

• Escolha a ação no dock, depois o alvo e a parte do corpo.
• O botão mostra Fôlego, tempo, chance de acerto e dano estimado.
• Distância: 0 corpo a corpo, 1 perto, 2 longe. Avance para golpear; lanças e foices alcançam 1; bestas preferem distância.
• Recuar de quem está engajado provoca golpe de oportunidade.

• No máximo dois inimigos lutam colados em você; os outros circulam esperando a vez — ou atiram.
• Executar: só em inimigo caído, atordoado ou moribundo. Morte brutal, reduz seu Pavor e quebra a moral deles.
• Fugir nem sempre é possível (pernas quebradas, chefes).`,
    tip: 'Matar primeiro quem cura ou levanta mortos vale mais que dano bruto.',
    see: ['partes', 'intencoes', 'folego', 'defesas', 'moral'],
  },
  partes: {
    group: 'combate', title: 'Partes do corpo',
    body: `Todo golpe atinge uma parte. Mirar muda tudo.

• Tronco: fácil de acertar, dano honesto.
• Cabeça: difícil. Crítico, atordoa, pode matar ou cegar.
• Braços: decepar ou quebrar o braço da arma cancela os golpes daquele braço.
• Pernas: quebradas, o inimigo não avança, cai e não foge.
• Partes especiais: sacos de bile, olhos extras, lanternas, galhadas. Estoure-as.

Cada parte tem armadura própria contra corte, perfuração e impacto. Destruída: decepada (corte), esmagada (impacto) ou perfurada.`,
    tip: 'Placas resistem a corte. Leve uma maça.',
    see: ['combate', 'intencoes', 'feridas'],
  },
  intencoes: {
    group: 'combate', title: 'Intenções',
    body: `Cada inimigo mostra o que fará a seguir: alvo, parte e dano estimado.

• AST baixa: aviso vago. AST alta: números exatos.
• Ações carregadas (preparação) batem forte, mas podem ser interrompidas: atordoe, empurre ou decepe o braço antes que caiam.
• Defenda-se contra o golpe anunciado ou mate o atacante antes que ele aja.`,
    tip: 'Um golpe carregado é um convite para quebrar um braço.',
    see: ['defesas', 'partes', 'combate'],
  },
  folego: {
    group: 'combate', title: 'Fôlego',
    body: `Recurso de combate. Ataques, defesas e técnicas custam Fôlego.

• Máximo: 6 + VIG.
• Recupera 3 + bônus − peso da armadura a cada turno seu.
• Em 0 você fica Exausto: esquiva −20 e ações 25% mais lentas.
• Guarda gasta Fôlego por golpe bloqueado.
• Costelas fraturadas e excesso de peso reduzem o Fôlego.`,
    tip: 'Termine o turno com Fôlego para se defender.',
    see: ['defesas', 'peso', 'combate'],
  },
  defesas: {
    group: 'combate', title: 'Defesas',
    body: `Uma defesa dura até o seu próximo turno.

• Guarda: bloqueia com escudo ou arma. Custa Fôlego por golpe aparado no escudo.
• Esquiva: depende de DES; pior com armadura pesada, pernas feridas ou exaustão.
• Aparar: só contra corpo a corpo. Sucesso: contra-ataque e o inimigo fica atordoado. Falha: dano extra.

Manguais ignoram escudos. Machados quebram escudos.`,
    tip: 'Apare só quando a chance for boa. Errar dói em dobro.',
    see: ['folego', 'intencoes'],
  },
  moral: {
    group: 'combate', title: 'Moral',
    body: `Humanos e feras têm moral. Ver aliados morrerem, perder membros e execuções a derrubam.

• Moral baixa: fogem ou se rendem.
• Rendido: poupe (consequências, testemunhas) ou execute (Pavor −, reputação muda).
• Fogo assusta feras.
• Mortos-vivos não têm moral — mas causam Pavor.`,
    tip: 'Executar o líder às vezes encerra a luta.',
    see: ['combate', 'pavor'],
  },
  // ---------------- corpo e mente ----------------
  pavor: {
    group: 'corpo', title: 'Pavor',
    body: `O medo vai de 0 a 100. Sobe com horrores, escuridão, ferimentos graves e aliados mortos.

• 50 Abalado: −5 de precisão.
• 75 Aterrorizado: −10 de precisão e 10% de perder o turno.
• 100 Colapso: fuga em pânico, fúria cega ou catatonia. Depois volta a 70.

Cai com descanso, bebida, fé e execuções. VON resiste.`,
    tip: 'Mantenha a tocha acesa. A escuridão alimenta o Pavor.',
    see: ['luz', 'acampar', 'corrupcao'],
  },
  corrupcao: {
    group: 'corpo', title: 'Corrupção',
    body: `O deus entra em você. De 0 a 100.

• Sobe ao beber Icor, usar ritos, golpes de Icor e mutações.
• A cada 25: escolha 1 de 2 mutações. Poder real, defeito real.
• 100: você se transforma. É a morte — e seu corpo vira uma Aberração no Ermo, esperando seu herdeiro.

VON reduz o ganho.`,
    tip: 'Corrupção não cai fácil. Gaste-a como dinheiro que você não terá de novo.',
    see: ['icor', 'nivel', 'linhagem'],
  },
  feridas: {
    group: 'corpo', title: 'Feridas',
    body: `Golpes fortes (20% da Vida máxima num acerto, ou críticos) deixam feridas na parte atingida.

• Corte: corte profundo (sangra), tendão cortado; no extremo, membro decepado.
• Impacto: fratura (braço −30% dano e sem duas mãos; pernas sem fuga; costelas −Fôlego), concussão.
• Perfuração: sangra, infecciona; na cabeça, olho perdido.
• Fogo/Icor: queimadura, necrose.

Feridas saram com dias de descanso ou com o Barbeiro-cirurgião. Infecção não tratada vira necrose, e necrose vira amputação. Perdas permanentes aceitam próteses: gancho (é arma), perna de pau, olho de vidro.`,
    tip: 'Bandagem e tala no campo valem mais que ouro no bolso.',
    see: ['partes', 'cidade', 'acampar'],
  },
  // ---------------- progressão ----------------
  icor: {
    group: 'progresso', title: 'Icor',
    body: `Sangue do deus, em frascos. Tudo depende dele.

• Vender: moedas na cidade.
• Beber: subir de nível (custa Corrupção).
• Ofertar à Sutura: reduz a Chaga, rende reputação.
• Ungir armas e armaduras: poder com Icor.

À noite e mais fundo no Ermo há mais Icor — e coisas piores guardando.`,
    tip: 'Decida o destino de cada frasco antes de sair.',
    see: ['nivel', 'uncao', 'chaga'],
  },
  nivel: {
    group: 'progresso', title: 'Nível',
    body: `Você sobe de nível bebendo Icor.

• Custo: nível atual + 1 frascos.
• Cada nível: +6 Corrupção (reduzida por VON), +1 atributo, 1 de 3 Dádivas.
• Vida: 36 + VIG × 7 + nível × 4.

Atributos vão de 1 a 10.`,
    tip: 'Um nível a mais pode valer menos que três frascos vendidos para curar uma fratura.',
    see: ['icor', 'corrupcao', 'maestria'],
  },
  maestria: {
    group: 'progresso', title: 'Maestria de arma',
    body: `Usar uma classe de arma acumula maestria nela.

• Níveis 1, 2 e 3 liberam técnicas novas daquela classe.
• Trocar de arma recomeça a contagem naquela classe.
• Tomos, mestres na cidade e eventos ensinam técnicas extras.

Classes: espada, machado, maça, lança, adaga, cutelo, montante, martelo, mangual, foice, besta, desarmado, gancho.`,
    tip: 'Escolha uma arma principal cedo. Técnicas mudam o combate.',
    see: ['itens', 'combate'],
  },
  // ---------------- expedição ----------------
  expedicao: {
    group: 'ermo', title: 'Expedição',
    body: `O Ermo é um mapa de nós que persiste na campanha. O que você descobre fica para os herdeiros.

• Mover entre nós custa horas, luz e comida.
• Nós: Combate, Evento, Ruína, Acampamento, Santuário, Mercador, Ninho (elite; destruir reduz a Chaga), Carcaça (um morto seu), Passagem (atalho), Chefe, Entrada.
• Noite (20h–6h): inimigos piores, mais Pavor, mais Icor.
• Volte pela Entrada ou por uma Passagem aberta.
• Morreu lá fora: o saque fica no cadáver.`,
    tip: 'Conte as horas de tocha que faltam para voltar, não para avançar.',
    see: ['luz', 'fome', 'peso', 'acampar'],
  },
  luz: {
    group: 'ermo', title: 'Luz',
    body: `A tocha queima em horas.

• Sem luz: não vê o tipo dos nós, sofre emboscadas e ganha Pavor a cada hora.
• Escuridão em combate: menos precisão, mais Pavor.
• Tocha na mão secundária: luz, fogo e feras com medo — mas sem escudo.`,
    tip: 'Leve uma tocha a mais do que acha que precisa.',
    see: ['expedicao', 'pavor'],
  },
  fome: {
    group: 'ermo', title: 'Fome',
    body: `Uma ração a cada 12 horas fora da cidade.

• Sem comer: a regeneração para.
• Depois: você perde Vida.
• VIG resiste. Cozinhar no acampamento rende mais.`,
    tip: 'Carne podre alimenta. Também adoece.',
    see: ['expedicao', 'acampar'],
  },
  peso: {
    group: 'ermo', title: 'Peso',
    body: `Capacidade de carga cresce com FOR.

• Acima do limite: viagens mais lentas e menos Fôlego.
• Armadura pesada reduz a recuperação de Fôlego.
• Saque pesado obriga escolhas: deixe algo para trás.`,
    tip: 'Icor pesa pouco. Armaduras velhas pesam muito.',
    see: ['folego', 'itens'],
  },
  acampar: {
    group: 'ermo', title: 'Acampar',
    body: `Parar recupera Vida e reduz Pavor. Custa ração e horas.

• Risco de emboscada: depende do fogo, da vigia e do lugar.
• Opções: vigiar, tratar feridas, rezar, cozinhar.
• Fogo aceso: mais conforto, mais olhos te vendo.`,
    tip: 'Acampe antes da noite, não durante.',
    see: ['fome', 'feridas', 'pavor'],
  },
  // ---------------- cidade e campanha ----------------
  cidade: {
    group: 'cidade', title: 'Valdrem',
    body: `A última cidade murada. Toda ação custa tempo; dormir passa o dia.

• Ferreiro: armas, armaduras, reparo.
• Barbeiro-cirurgião: feridas, amputações, próteses.
• Boticário: remédios e venenos.
• Templo da Sutura: ritos, ofertas de Icor.
• Quartel, Guilda, Taverna (sequazes, boatos), Antro dos Bebedores (oculto).
• Casa: linhagem, baú, melhorias. Muralha: defesa contra cercos.

Distritos perdidos em cercos fecham seus serviços.`,
    tip: 'Cada dia na cidade é um ponto de Chaga. Planeje antes de dormir.',
    see: ['chaga', 'faccoes', 'contratos', 'cerco'],
  },
  chaga: {
    group: 'cidade', title: 'Chaga',
    body: `O relógio do fim. Começa em 10 e sobe 1 por dia, mais com eventos e mortes.

• 30, 60 e 90: cercos à Muralha.
• 100: Valdrem cai. Fim da campanha.
• Reduzem: matar chefes (−12), destruir ninhos (−3), ofertar Icor à Sutura, certos contratos.
• Cada morte de herdeiro: +3.`,
    tip: 'Ninhos parecem desvio. São tempo comprado.',
    see: ['cerco', 'cidade', 'linhagem'],
  },
  faccoes: {
    group: 'cidade', title: 'Facções',
    body: `Quatro poderes querem decidir o destino do deus. Reputação de −100 a 100.

• Igreja da Sutura: costurar o deus de volta.
• Coroa / Guarda Cinzenta: queimar tudo, lei marcial.
• Guilda dos Carniceiros: lucro acima de tudo.
• Bebedores de Icor: beber o deus.

Reputação muda preços, serviços, missões e finais. Agradar uma irrita outras. Fragmentos do deus entregues a uma facção valem muito.`,
    tip: 'Não dá para agradar todos. Escolha cedo quem você vai trair.',
    see: ['contratos', 'cidade'],
  },
  contratos: {
    group: 'cidade', title: 'Contratos',
    body: `Trabalhos da Guilda, do Quartel, do Templo e de quem pagar.

• Têm objetivo, prazo em dias e recompensa.
• Cumprir: moedas, reputação, às vezes Chaga reduzida.
• Falhar ou estourar o prazo: reputação perdida.`,
    tip: 'Pegue contratos na região para onde você já ia.',
    see: ['faccoes', 'expedicao'],
  },
  cerco: {
    group: 'cidade', title: 'Cerco',
    body: `Quando a Chaga chega a 30, 60 e 90, a horda ataca a Muralha.

• A defesa da Muralha (0–100) pesa no resultado.
• Você pode lutar na Muralha.
• Derrota: um distrito cai e seu serviço fecha para sempre.

Reforce a Muralha antes: contratos e ações no Quartel.`,
    tip: 'Esteja na cidade quando a Chaga se aproximar de um cerco.',
    see: ['chaga', 'cidade'],
  },
  linhagem: {
    group: 'cidade', title: 'Linhagem e morte',
    body: `A morte é permanente para o personagem, não para a casa.

• Escolha 1 de 3 herdeiros (origem e traços aleatórios). A relíquia da casa passa adiante.
• Cidade, facções, mapa e Chaga continuam.
• O cadáver vira nó Carcaça com o equipamento que levava. Vá buscá-lo.
• Morte por Corrupção: o cadáver é uma Aberração elite.
• Cada morte: +3 Chaga e −1 em algo da casa.`,
    tip: 'O equipamento perdido espera na Carcaça. Nem sempre sozinho.',
    see: ['corrupcao', 'chaga'],
  },
  // ---------------- itens ----------------
  itens: {
    group: 'itens', title: 'Itens e equipamento',
    body: `Espaços: arma principal, mão secundária, cabeça, tronco, braços, pernas e dois amuletos.

• Armas escalam com atributos (S, A, B, C, D, E): S é o melhor.
• Duas mãos ocupam a mão secundária.
• Mão secundária: escudo (bloqueio), tocha (luz, fogo), arma leve (ataque extra).
• Armaduras protegem partes específicas contra corte, perfuração, impacto e fogo.
• Durabilidade em 0: dano e armadura pela metade. Repare no Ferreiro.

Consumíveis salvam vidas: bandagem, tala, aguardente, unguento, tônico, óleo, bombas, sal bento, ferro quente.`,
    tip: 'Toque num item para comparar com o equipado.',
    see: ['qualidade', 'uncao', 'peso'],
  },
  qualidade: {
    group: 'itens', title: 'Qualidade',
    body: `Todo equipamento tem qualidade:

• Enferrujado: −20%.
• Comum: normal.
• Bom: +15%.
• Obra-prima: +30%.

Afeta dano, armadura, durabilidade e preço.`,
    tip: 'Uma maça comum boa vence uma espada enferrujada bonita.',
    see: ['itens', 'uncao'],
  },
  uncao: {
    group: 'itens', title: 'Unção',
    body: `Ungir é encantar com Icor. Uma unção por peça.

• Gasta frascos de Icor (e às vezes materiais).
• Dá efeitos fortes: fogo, sangramento, dano de Icor, resistência.
• Golpes de Icor podem somar Corrupção a quem empunha.`,
    tip: 'Ungir a arma principal multiplica tudo o que você já faz bem.',
    see: ['icor', 'itens', 'corrupcao'],
  },

  // ---------------- extras (além do contrato) ----------------
  controles: {
    group: 'basico', title: 'Controles',
    body: `Tudo por toque, com uma mão.

• Rodapé: as ações principais, ao alcance do polegar.
• Botões mostram custo e chance antes da escolha.
• Botão apagado: toque para saber por quê.
• "?" dourado: a regra daquele assunto.
• Menu (☰) no topo: diário, ajuda, configurações, salvar e sair.`,
    tip: 'Nada exige gesto ou toque longo. Um toque basta.',
    see: ['inicio', 'salvar'],
  },
  salvar: {
    group: 'basico', title: 'Salvamento',
    body: `O jogo salva sozinho a cada ação e quando você sai do app. Não há como voltar atrás numa escolha.

• Continuar retoma exatamente onde parou, até no meio de um combate.
• Backup: copie o texto e guarde fora do aparelho.
• Instalado na Tela de Início, o iPhone não apaga o progresso por falta de uso.`,
    tip: 'Faça um backup antes de começar uma campanha nova.',
    see: ['linhagem', 'controles'],
  },
  distancia: {
    group: 'combate', title: 'Distância',
    body: `Cada inimigo está a uma distância de você.

• 0 corpo a corpo · 1 perto · 2 longe.
• Corpo a corpo exige 0. Lanças e foices alcançam 1.
• Bestas e arremessos preferem 1 ou mais.
• Avançar e recuar custam tempo. Recuar de quem está colado provoca golpe de oportunidade.
• Pernas quebradas: o inimigo não avança.`,
    tip: 'Arqueiros fogem do engajamento. Feche a distância ou quebre suas pernas.',
    see: ['combate', 'partes'],
  },
  execucao: {
    group: 'combate', title: 'Execução',
    body: `Só contra inimigos caídos, atordoados ou moribundos.

• Morte certa e brutal.
• Reduz seu Pavor.
• Derruba a moral dos que assistem.
• Custa tempo: os outros agem enquanto você termina o serviço.`,
    tip: 'Atordoe com maça ou chute, depois execute.',
    see: ['moral', 'pavor', 'combate'],
  },
  estados: {
    group: 'combate', title: 'Estados',
    body: `Condições que duram alguns turnos.

• Sangrando: perde Vida a cada turno.
• Atordoado: perde a vez. Pode ser executado.
• Caído: fácil de acertar e de executar.
• Cego: precisão despenca.
• Queimando, Envenenado, Infectado: dano que continua.
• Enredado: não se move.
• Exausto: sem Fôlego; esquiva menor, ações lentas.
• Furioso: bate mais forte, defende pior.
• Untado: óleo; o fogo pega fácil.`,
    tip: 'Toque num estado para ver o efeito exato.',
    see: ['folego', 'feridas', 'pavor'],
  },
  mutacoes: {
    group: 'corpo', title: 'Mutações',
    body: `A cada 25 de Corrupção, o deus muda seu corpo. Você escolhe 1 de 2.

• Toda mutação dá um poder e cobra um defeito.
• São permanentes.
• Algumas abrem opções em eventos — e fecham portas na cidade.`,
    tip: 'Leia o defeito duas vezes. Ele dura o resto da vida.',
    see: ['corrupcao', 'icor'],
  },
  noite: {
    group: 'ermo', title: 'Noite',
    body: `Das 20h às 6h o Ermo muda.

• Inimigos mais fortes e mais numerosos.
• Mais Pavor.
• Mais Icor para quem sobreviver.`,
    tip: 'A noite paga bem. Cobra antes.',
    see: ['luz', 'expedicao', 'pavor'],
  },
  fragmentos: {
    group: 'cidade', title: 'Fragmentos do deus',
    body: `Cada chefe regional guarda um pedaço do deus: Olho, Língua, Mão, Ventre.

• Entregar a uma facção: grande reputação e avanço na missão dela.
• Guardar: poder de relíquia, com Corrupção.
• No Coração, os finais possíveis dependem dos fragmentos e da reputação.`,
    tip: 'Quem recebe os fragmentos decide o fim do mundo.',
    see: ['faccoes', 'corrupcao'],
  },
};

/** Ordem de exibição por grupo. */
export function topicsByGroup() {
  return HELP_GROUPS.map(([id, label]) => ({ id, label, topics: Object.keys(HELP).filter((k) => HELP[k].group === id) }));
}

/** Converte o body em nós (parágrafos e listas). */
export function helpBody(topic) {
  const t = HELP[topic];
  if (!t) return h('div.prose', h('p', 'Tópico desconhecido.'));
  const blocks = String(t.body).split(/\n\n+/);
  return h('div.sh-help-body.prose', blocks.map((b) => {
    const lines = b.split('\n');
    if (lines.every((l) => l.startsWith('• '))) return h('ul.sh-help-list', lines.map((l) => h('li', l.slice(2))));
    return h('p', b);
  }), t.tip ? h('p.sh-help-tip', h('b', 'Dica: '), t.tip) : null);
}

let openSheet = null;
/** Abre uma folha com o tópico. Retorna o controle da folha (ou null). */
export function showHelp(topic) {
  const t = HELP[topic];
  if (!t) {
    // tópico desconhecido: abre o codex em vez de não fazer nada
    console.warn('[help] tópico desconhecido:', topic);
    return import('./app.js').then((app) => { app.go('help'); return null; });
  }
  return import('./app.js').then((app) => {
    try { openSheet?.close(); } catch { /* ignore */ }
    const body = () => h('div',
      helpBody(topic),
      t.see?.length ? h('div.sh-help-see',
        h('div.small.muted', 'Veja também'),
        h('div.row.row-wrap', t.see.filter((s) => HELP[s]).map((s) => button(HELP[s].title, () => showHelp(s), { kind: ['ghost', 'small'] })))) : null);
    openSheet = app.sheet({
      title: t.title, body, cls: 'sh-help-sheet',
      buttons: [
        { label: 'Codex completo', kind: 'ghost', onClick: () => app.go('help', { topic }) },
        { label: 'Entendi', kind: 'primary' },
      ],
    });
    return openSheet;
  });
}

/** Botão "?" pequeno (≥ 36px). Não propaga o toque para o elemento pai. */
export function helpButton(topic, opts = {}) {
  const b = h('button.sh-help-btn', {
    type: 'button',
    attrs: { 'aria-label': `Ajuda: ${HELP[topic]?.title || topic}` },
    on: { click: (e) => { e.stopPropagation(); e.preventDefault(); showHelp(topic); } },
  }, opts.label || '?');
  return b;
}

// ---------------- dicas de primeira vez ----------------
const queue = [];
let showing = false;

export function hintSeen(topic) { return !!loadSettings().seenHelp?.[topic]; }

/** Esquece todas as dicas vistas (Configurações → Rever dicas). */
export function resetHints() {
  const s = loadSettings();
  s.seenHelp = {};
  s.hints = true;
  saveSettings(s);
}

/**
 * Mostra o tópico na primeira vez que for chamado (por configuração do aparelho).
 * Seguro para chamar dentro de render(): marca na hora, mostra logo depois.
 * opts.text: texto curto alternativo (ex.: dica específica da tela).
 */
export function hintOnce(topic, opts = {}) {
  if (!HELP[topic]) return false;
  const s = loadSettings();
  if (s.hints === false) return false;
  s.seenHelp = s.seenHelp || {};
  if (s.seenHelp[topic]) return false;
  s.seenHelp[topic] = Date.now();
  saveSettings(s);
  if (typeof document === 'undefined') return true;
  queue.push({ topic, text: opts.text });
  if (!showing) setTimeout(nextHint, opts.delay ?? 350);
  return true;
}

function nextHint() {
  const item = queue.shift();
  if (!item) { showing = false; return; }
  showing = true;
  import('./app.js').then((app) => {
    const t = HELP[item.topic];
    app.sheet({
      title: `Dica · ${t.title}`,
      cls: 'sh-hint-sheet',
      body: () => item.text ? h('div.prose', h('p', item.text), h('p.sh-help-tip', h('b', 'Dica: '), t.tip || '')) : helpBody(item.topic),
      onClose: () => setTimeout(nextHint, 200),
      buttons: [
        { label: 'Sem dicas', kind: 'ghost', onClick: () => { const s = loadSettings(); s.hints = false; saveSettings(s); queue.length = 0; } },
        { label: 'Entendi', kind: 'primary' },
      ],
    });
  }).catch(() => { showing = false; });
}
