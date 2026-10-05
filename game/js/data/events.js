// Eventos narrativos com escolhas. Cada escolha pode exigir atributo, item, ofício ou pérolas.
// do(run, ctx) devolve { text, fight?: 'normal'|'elite'|'gulls'|'mimic', reward?: {...} }.
import { REG } from '../combat/registry.js';
import { rnd, pick } from '../core/rng.js';
import {
  healRun, healPct, hurtRun, addPearls, addItem, addRelic, rollRelic, rollItem, rollSuit, equipSuit,
  addXp, findMemory, memoriesLeft, upgradableSkills, hasSkill, activeCount, maxHp,
} from '../run/ops.js';
import { MEMORIES } from './story.js';

const A = (run, k) => run.hero.attrs[k] + ((REG.suits[run.hero.suit] || {}).mods?.[k] || 0);

function relicText(run, id) {
  if (!id) return 'Nada de valor restou.';
  addRelic(run, id);
  return `Você obtém a relíquia ${REG.relics[id].icon} ${REG.relics[id].name}: ${REG.relics[id].desc}`;
}
function itemText(run, id, n = 1) {
  let got = 0;
  for (let i = 0; i < n; i++) if (addItem(run, id)) got++;
  const it = REG.items[id];
  if (!got) { addPearls(run, 8 * n); return `Sua bolsa está cheia. Você troca ${it.name} por ${8 * n} pérolas com o primeiro vazanteiro que passa.`; }
  return `Você guarda ${got > 1 ? got + '× ' : ''}${it.icon} ${it.name}.`;
}
function memText(run, ctx) {
  const m = findMemory(run, ctx.meta);
  if (!m) { const x = addXp(run, 10); return `Não há mais memórias aqui. Você ganha ${x} de experiência refletindo.`; }
  return `✦ Memória de Aurélia: "${m.title}". (Leve-a à Avó Zélia.)`;
}

export const EVENTS = [
  {
    id: 'sunken_bell', title: 'O Sino Submerso', art: '🔔', d: [1, 3],
    text: 'Um sino do tamanho de uma casa jaz de lado na lama. Algo se move dentro dele, batendo contra o bronze.',
    choices: [
      { t: 'Tocar o sino', hint: 'Combate de elite → relíquia rara', do: (run) => ({ text: 'DONG. O som rasga a névoa. O que estava dentro sai — e não está sozinho.', fight: 'elite', bonusRelic: 2 }) },
      { t: 'Abafar o bronze com algas', req: { attr: 'fol', n: 2 }, do: (run) => ({ text: 'Você prende a respiração e trabalha em silêncio. Entre as algas, um pequeno sino de bolso.\n' + (run.hero.relics.includes('pocket_bell') ? (addPearls(run, 20), 'Você já tem um. Vende o bronze: +20 pérolas.') : relicText(run, 'pocket_bell')) }) },
      { t: 'Seguir em frente', do: () => ({ text: 'Alguns sinos é melhor não tocar.' }) },
    ],
  },
  {
    id: 'wounded_smuggler', title: 'Contrabandista Ferido', art: '🩹', d: [1, 2],
    text: 'Um homem vivo — vivo! — está preso sob um mastro caído. "Me ajuda e eu te mostro onde escondi a carga."',
    choices: [
      { t: 'Ajudar (gasta um consumível)', req: { items: 1 }, do: (run) => { run.hero.items.pop(); addPearls(run, 30); run.flags.revealMap = true; return { text: 'Você o ajuda a se levantar e divide seus suprimentos. Ele cumpre a palavra: 30 pérolas e um mapa rabiscado deste distrito (todos os locais revelados).' }; } },
      { t: 'Pegar a bolsa dele', do: (run) => { addPearls(run, 25); const d = hurtRun(run, 3); return { text: `Você arranca a bolsa. Ele crava uma faca na sua perna antes de você se afastar. +25 pérolas, −${d} de vida.` }; } },
      { t: 'Deixá-lo', do: () => ({ text: 'Você vira as costas. Os gritos dele ecoam por um bom tempo.' }) },
    ],
  },
  {
    id: 'salt_altar', title: 'Altar de Sal', art: '🧂', d: [0],
    text: 'Um altar de sal cristalizado, intocado pela água. Inscrições pedem uma oferenda.',
    choices: [
      { t: 'Oferecer sangue (−5 de vida)', req: { hp: 6 }, do: (run) => { hurtRun(run, 5); return { text: 'O sal bebe seu sangue e se abre como uma flor.\n' + relicText(run, rollRelic(run, 1)) }; } },
      { t: 'Cantar uma prece', req: { attr: 'can', n: 2 }, do: (run) => { const h = healPct(run, 100); return { text: `O altar ressoa com sua voz. Uma calma morna te envolve. +${h} de vida.` }; } },
      { t: 'Quebrar o altar', req: { attr: 'imp', n: 3 }, do: (run) => { addPearls(run, 35); run.flags.cursed = 1; return { text: 'O sal se parte e revela 35 pérolas. Um frio sobe pela sua espinha: no próximo combate, os inimigos causarão +1 de dano.' }; } },
      { t: 'Ir embora', do: () => ({ text: 'Você deixa o altar em paz.' }) },
    ],
  },
  {
    id: 'lumen_school', title: 'Cardume Luminoso', art: '🐠', d: [1, 2],
    text: 'Um cardume de peixes que brilham feito brasas nada em círculos numa poça funda.',
    choices: [
      { t: 'Pescar alguns', do: (run) => ({ text: itemText(run, 'fish', 2) }) },
      { t: 'Seguir as luzes', do: (run, ctx) => (rnd(run.rng) < 0.55 ? { text: 'As luzes te levam a uma câmara seca. No chão, algo brilha.\n' + (memoriesLeft(ctx.meta) ? memText(run, ctx) : (addPearls(run, 25), '+25 pérolas.')) } : { text: 'As luzes se apagam de uma vez. Na escuridão, algo te cerca!', fight: 'normal' }) },
      { t: 'Ignorar', do: () => ({ text: 'Bonito. Mas não é hora de turismo.' }) },
    ],
  },
  {
    id: 'singer_statue', title: 'Estátua da Cantora', art: '🗽', d: [2, 3, 4],
    text: 'Uma cantora de mármore, boca aberta num canto eterno. No pedestal, letras gastas. Nos olhos, duas safiras.',
    choices: [
      { t: 'Ler a inscrição', do: (run, ctx) => ({ text: memText(run, ctx) }) },
      { t: 'Arrancar as safiras', req: { attr: 'imp', n: 2 }, do: (run) => { addPearls(run, 35); const d = hurtRun(run, 4); return { text: `As pedras saem com um estalo — e a estátua desaba sobre seu ombro. +35 pérolas, −${d} de vida.` }; } },
      { t: 'Seguir', do: () => ({ text: 'Ela continua cantando para ninguém.' }) },
    ],
  },
  {
    id: 'trapped_air', title: 'Bolha de Ar Presa', art: '🫧', d: [0],
    text: 'Sob uma cúpula de vidro rachada, ar antigo — o ar de Aurélia — está preso há três séculos.',
    choices: [
      { t: 'Respirar fundo (−6 de vida)', req: { hp: 7 }, do: (run) => { hurtRun(run, 6); run.hero.attrs.fol += 1; return { text: 'O ar queima seus pulmões... e os alarga. +1 de Fôlego permanente nesta expedição.' }; } },
      { t: 'Encher garrafas', do: (run) => ({ text: itemText(run, 'airbubble', 2) }) },
    ],
  },
  {
    id: 'narrow_crack', title: 'Fenda Estreita', art: '🕳', d: [1, 2],
    text: 'Uma fenda entre duas paredes leva a um cofre afogado. É apertada. Muito apertada.',
    choices: [
      { t: 'Espremer-se (Fôlego 2+)', req: { attr: 'fol', n: 2 }, do: (run) => ({ text: 'Você expira tudo e desliza. Lá dentro:\n' + relicText(run, rollRelic(run, 1)) }) },
      { t: 'Alargar à força', req: { attr: 'imp', n: 3 }, do: (run) => { const d = hurtRun(run, 2); return { text: `Pedra cede, pedras caem. −${d} de vida, mas o cofre é seu.\n` + relicText(run, rollRelic(run, 1)) }; } },
      { t: 'Desistir', do: () => ({ text: 'Nem todo tesouro vale ficar entalada.' }) },
    ],
  },
  {
    id: 'eel_eggs', title: 'Ninho de Enguias', art: '🥚', d: [1],
    text: 'Dezenas de ovos translúcidos pulsam com pequenas faíscas.',
    choices: [
      { t: 'Levar alguns ovos', do: (run) => ({ text: 'Com cuidado, você enche dois frascos.\n' + itemText(run, 'eeljar', 2) }) },
      { t: 'Destruir o ninho', do: (run) => { const x = addXp(run, 10); return { text: `Menos enguias no mundo. +${x} de experiência.` }; } },
    ],
  },
  {
    id: 'hungry_coral', title: 'Coral Faminto', art: '🪸', d: [2],
    text: 'Um coral vermelho se estica na sua direção, como quem pede alguma coisa.',
    choices: [
      { t: 'Alimentá-lo (−5 de vida)', req: { hp: 6 }, do: (run) => { hurtRun(run, 5); return { text: 'Ele se fecha em torno da sua mão e solta um broto vivo.\n' + (run.hero.relics.includes('living_coral') ? relicText(run, rollRelic(run, 1)) : relicText(run, 'living_coral')) }; } },
      { t: 'Queimá-lo', req: { any: [{ cls: 'faroleiro' }, { item: 'oilbomb' }] }, do: (run) => { if (run.hero.cls !== 'faroleiro') run.hero.items.splice(run.hero.items.indexOf('oilbomb'), 1); addPearls(run, 20); const x = addXp(run, 12); return { text: `O coral chia e se desfaz, revelando pérolas incrustadas. +20 pérolas, +${x} de experiência.` }; } },
      { t: 'Afastar-se', do: () => ({ text: 'Você não alimenta coisas que se esticam na sua direção.' }) },
    ],
  },
  {
    id: 'anemones', title: 'Campo de Anêmonas', art: '🌺', d: [2],
    text: 'O único caminho atravessa um campo de anêmonas urticantes. Entre elas, cápsulas de seiva medicinal.',
    choices: [
      { t: 'Colher com cuidado (Fôlego 3+)', req: { attr: 'fol', n: 3 }, do: (run) => ({ text: itemText(run, 'tonic', 2) }) },
      { t: 'Atravessar correndo', do: (run) => { const d = hurtRun(run, 2); addPearls(run, 15); return { text: `Ardem como fogo. −${d} de vida. Do outro lado, um esqueleto com 15 pérolas.` }; } },
      { t: 'Dar a volta', do: () => ({ text: 'Demora, mas você chega inteira.' }) },
    ],
  },
  {
    id: 'dormant_automaton', title: 'Autômato Adormecido', art: '🤖', d: [3],
    text: 'Um autômato sineiro está sentado num degrau, desligado. Uma chave de corda pende das costas.',
    choices: [
      { t: 'Dar corda e cantar para ele', req: { attr: 'can', n: 2 }, do: (run) => ({ text: 'Os olhos dele piscam. Reconhece a melodia e te oferece uma peça das próprias entranhas.\n' + relicText(run, run.hero.relics.includes('stevedore') ? 'lead_boots' : 'stevedore') }) },
      { t: 'Desmontar', do: (run) => { addPearls(run, 30); return { text: 'Engrenagens de bronze valem bem. +30 pérolas.' }; } },
      { t: 'Dar corda (sem cantar)', do: () => ({ text: 'Ele desperta. E não gosta de você.', fight: 'normal' }) },
    ],
  },
  {
    id: 'ghost_choir', title: 'Coro Fantasma', art: '👻', d: [3, 4],
    text: 'Vozes sem corpo cantam numa capela afogada. A melodia é estranhamente familiar.',
    choices: [
      { t: 'Cantar junto', req: { attr: 'can', n: 3 }, do: (run) => { run.hero.attrs.can += 1; return { text: 'Sua voz se encaixa no coro como se sempre tivesse estado ali. +1 de Canto nesta expedição.' }; } },
      { t: 'Ouvir com atenção (−3 de vida)', req: { hp: 4 }, do: (run, ctx) => { hurtRun(run, 3); return { text: 'O canto entra pelos seus ouvidos como água gelada. −3 de vida. Mas você entende as palavras.\n' + memText(run, ctx) }; } },
      { t: 'Tapar os ouvidos e passar', do: () => ({ text: 'Você passa. As vozes se calam atrás de você, ofendidas.' }) },
    ],
  },
  {
    id: 'repentant_priest', title: 'Sacerdote Arrependido', art: '🙏', d: [4],
    text: 'Um sacerdote da maré, meio afogado, ajoelhado. "Não quero mais cantar para ela. Me escute, vazanteira."',
    choices: [
      { t: 'Ouvir a confissão', do: (run, ctx) => ({ text: '"Ela não é má. Só não sabe parar."\n' + memText(run, ctx) }) },
      { t: 'Pedir uma bênção', do: (run) => { healPct(run, 100); run.flags.highTide = 1; return { text: 'Ele toca sua testa com água salgada. Vida totalmente restaurada. Mas a maré te reconhece: no próximo combate, ela estará 1 nível mais alta.' }; } },
      { t: 'Acabar com o sofrimento dele', do: (run) => { const x = addXp(run, 15); return { text: `Ele não resiste. Agradece, até. +${x} de experiência.` }; } },
    ],
  },
  {
    id: 'bottomless_well', title: 'Poço Sem Fundo', art: '🌀', d: [3, 4],
    text: 'Um poço circular onde a água gira lentamente. Moedas e pérolas brilham nas paredes, cada vez mais fundo.',
    choices: [
      { t: 'Jogar 20 pérolas e pedir', req: { pearls: 20 }, do: (run) => { addPearls(run, -20); return { text: 'O redemoinho engole as pérolas e cospe outra coisa.\n' + relicText(run, rollRelic(run, 2)) }; } },
      { t: 'Mergulhar', req: { any: [{ cls: 'mergulhadora' }, { attr: 'fol', n: 4 }] }, do: (run, ctx) => ({ text: 'Você desce até a pressão doer. No fundo, entre ossos:\n' + relicText(run, rollRelic(run, 1)) + '\n' + memText(run, ctx) }) },
      { t: 'Não arriscar', do: () => ({ text: 'Você não confia em poços que giram.' }) },
    ],
  },
  {
    id: 'drowned_chest', title: 'Baú Afogado', art: '🧰', d: [0],
    text: 'Um baú cravejado de cracas, entreaberto. Lá dentro, um brilho... ou um par de olhos?',
    choices: [
      { t: 'Abrir', do: (run) => (rnd(run.rng) < 0.6 ? (addPearls(run, 25), { text: '+25 pérolas e:\n' + itemText(run, rollItem(run)) }) : { text: 'O baú tem dentes. E amigos.', fight: 'normal', bonusPearls: 20 }) },
      { t: 'Cutucar com o arpão primeiro', req: { attr: 'imp', n: 2 }, do: (run) => { addPearls(run, 15); return { text: 'O baú se fecha com um estalo, mordendo o vazio. Você o vira e sacode: +15 pérolas caem.' }; } },
      { t: 'Deixar', do: () => ({ text: 'Melhor não.' }) },
    ],
  },
  {
    id: 'gull_mast', title: 'Gaivotas no Mastro', art: '🐦', d: [1],
    text: 'Um mastro coberto de gaivotas carniceiras guarda um ninho cheio de coisas brilhantes.',
    choices: [
      { t: 'Espantá-las', do: () => ({ text: 'Elas não gostam nada da ideia.', fight: 'gulls', bonusRelicId: 'gull_feather' }) },
      { t: 'Contornar pela água fria (−3 de vida)', do: (run) => { const d = hurtRun(run, 3); return { text: `Você atravessa com água até o peito. −${d} de vida.` }; } },
    ],
  },
  {
    id: 'sunken_forge', title: 'Forja Submersa', art: '🔥', d: [3],
    text: 'Uma fornalha de Aurélia ainda arde sob a água, alimentada por um gás que borbulha do chão.',
    choices: [
      { t: 'Afiar uma técnica (−15 pérolas)', req: { pearls: 15, upgradable: true }, do: (run) => { addPearls(run, -15); const s = pick(run.rng, upgradableSkills(run)); s.lv = 2; return { text: `Você treina sob o calor. ${REG.skills[s.id].name} melhora: ${REG.skills[s.id].up}` }; } },
      { t: 'Forjar uma couraça (−30 pérolas)', req: { pearls: 30 }, do: (run) => { addPearls(run, -30); const id = pick(run.rng, ['rust', 'diving', 'barnacle']); equipSuit(run, id); return { text: `Você veste ${REG.suits[id].icon} ${REG.suits[id].name}: ${REG.suits[id].desc}` }; } },
      { t: 'Aquecer-se e seguir', do: (run) => { const h = healRun(run, 4); return { text: `O calor te faz bem. +${h} de vida.` }; } },
    ],
  },
  {
    id: 'flooded_library', title: 'Biblioteca Inundada', art: '📚', d: [3, 4],
    text: 'Estantes flutuam numa sala alagada. Alguns livros ainda são legíveis.',
    choices: [
      { t: 'Estudar táticas', do: (run) => { const x = addXp(run, 18); return { text: `Manuais de guerra de Aurélia. +${x} de experiência.` }; } },
      { t: 'Procurar crônicas', do: (run, ctx) => ({ text: memText(run, ctx) }) },
    ],
  },
  {
    id: 'window_girl', title: 'A Moça na Janela', art: '🪟', d: [2, 3],
    text: 'Numa janela alta, uma moça de cabelos de alga canta. Ela te vê — e para de cantar.',
    choices: [
      { t: 'Responder com o mesmo canto', req: { attr: 'can', n: 1 }, do: (run, ctx) => { run.hero.attrs.can += 1; return { text: 'Ela sorri, triste, e some. +1 de Canto nesta expedição.\n' + memText(run, ctx) }; } },
      { t: 'Chamar por ela', do: (run) => ({ text: 'Ela fecha a janela. A água ao redor começa a subir...', fight: 'normal' }) },
      { t: 'Desviar o olhar', do: () => ({ text: 'Você sente o olhar dela nas suas costas por muito tempo.' }) },
    ],
  },
  {
    id: 'old_net', title: 'Rede Antiga', art: '🕸', d: [1, 2],
    text: 'Uma rede de pesca de fibra de alga, trançada por mãos de mestre, presa num poste.',
    choices: [
      { t: 'Estudar a trama', req: { cls: 'arpoadora' }, do: (run) => { if (!hasSkill(run, 'a_net') && activeCount(run) < 4) { run.hero.skills.push({ id: 'a_net', lv: 1 }); return { text: 'Você aprende a técnica: Rede de Pesca agora faz parte do seu arsenal.' }; } const x = addXp(run, 12); return { text: `Uma trama admirável. +${x} de experiência.` }; } },
      { t: 'Levar a rede', do: (run) => ({ text: 'Dá para fazer uma âncora de arremesso com isso.\n' + itemText(run, 'anchorthrow') }) },
    ],
  },
  {
    id: 'stranded_jelly', title: 'Água-viva Gigante Encalhada', art: '🪼', d: [2],
    text: 'Uma água-viva do tamanho de uma carroça agoniza no seco, a poucos passos de uma poça funda.',
    choices: [
      { t: 'Empurrá-la para a água', req: { attr: 'imp', n: 2 }, do: (run) => { const d = hurtRun(run, 2); return { text: `Os tentáculos queimam (−${d}), mas ela desliza para a água. Em agradecimento, deixa algo para trás.\n` + relicText(run, run.hero.relics.includes('eel_heart') ? rollRelic(run, 1) : 'eel_heart') }; } },
      { t: 'Coletar o veneno', do: (run) => ({ text: itemText(run, 'eeljar') }) },
      { t: 'Deixá-la', do: () => ({ text: 'A maré vai voltar. Talvez a tempo.' }) },
    ],
  },
  {
    id: 'rival_divers', title: 'Vazanteiros Rivais', art: '🗡', d: [0],
    text: 'Três vazanteiros de Porto Escuro, a vila do outro lado da baía. "Essa área é nossa. Pague pedágio ou dê meia-volta."',
    choices: [
      { t: 'Pagar 15 pérolas', req: { pearls: 15 }, do: (run) => { addPearls(run, -15); return { text: 'Eles riem e, em troca, te dão uma bugiganga que acharam.\n' + relicText(run, rollRelic(run, 1)) }; } },
      { t: 'Recusar e lutar', do: () => ({ text: 'Eles sacam as facas — e as criaturas ao redor acordam com o barulho.', fight: 'normal', bonusPearls: 30 }) },
      { t: 'Dar meia-volta', do: () => ({ text: 'Não vale a briga.' }) },
    ],
  },
  {
    id: 'floating_memory', title: 'Luz na Água', art: '✨', d: [0], cond: (run, meta) => memoriesLeft(meta) > 0,
    text: 'Uma luz pálida flutua logo abaixo da superfície de uma poça, pulsando como um coração.',
    choices: [
      { t: 'Pegar a luz', do: (run, ctx) => ({ text: memText(run, ctx) }) },
      { t: 'Deixar quieta', do: () => ({ text: 'Algumas coisas devem ficar onde estão.' }) },
    ],
  },
  {
    id: 'tobias_debt', title: 'O Fiado do Tobias', art: '⚓', d: [2, 3, 4],
    text: 'Tobias, o mercador afogado, acena de um barco virado. "Vazanteira! Leve isso agora e me pague quando puder. Prometo que não cobro juros... muitos."',
    choices: [
      { t: 'Aceitar (pague 25 pérolas no próximo mercado)', do: (run) => { run.flags.debt = (run.flags.debt || 0) + 25; return { text: relicText(run, rollRelic(run, 1)) + '\nTobias anota a dívida num caderno encharcado.' }; } },
      { t: 'Recusar', do: () => ({ text: '"Sua perda!"' }) },
    ],
  },
];

export function checkReq(run, req) {
  if (!req) return true;
  if (req.any) return req.any.some((r) => checkReq(run, r) === true) ? true : 'Requisito não atendido';
  if (req.attr) return A(run, req.attr) >= req.n ? true : `Requer ${{ vig: 'Vigor', imp: 'Ímpeto', fol: 'Fôlego', can: 'Canto' }[req.attr]} ${req.n}`;
  if (req.items) return run.hero.items.length >= req.items ? true : 'Requer um consumível';
  if (req.item) return run.hero.items.includes(req.item) ? true : `Requer ${REG.items[req.item].name}`;
  if (req.cls) return run.hero.cls === req.cls ? true : `Requer ofício ${REG.classes[req.cls].name}`;
  if (req.pearls) return run.pearls >= req.pearls ? true : `Requer ${req.pearls} pérolas`;
  if (req.hp) return run.hero.hp >= req.hp ? true : 'Vida insuficiente';
  if (req.upgradable) return upgradableSkills(run).length ? true : 'Nenhuma técnica para melhorar';
  return true;
}

export function reqLabel(req) {
  if (!req) return '';
  if (req.any) return req.any.map(reqLabel).join(' ou ');
  if (req.attr) return `${{ vig: 'Vigor', imp: 'Ímpeto', fol: 'Fôlego', can: 'Canto' }[req.attr]} ${req.n}+`;
  if (req.cls) return REG.classes[req.cls].name;
  if (req.item) return REG.items[req.item].name;
  if (req.pearls) return `${req.pearls} pérolas`;
  if (req.items) return 'consumível';
  if (req.hp) return `${req.hp}+ vida`;
  if (req.upgradable) return 'técnica melhorável';
  return '';
}

export function pickEvent(run, meta) {
  const seen = run.seenEvents || [];
  const d = run.district;
  const pool = EVENTS.filter((e) => (e.d.includes(0) || e.d.includes(d)) && !seen.includes(e.id) && (!e.cond || e.cond(run, meta)));
  const ev = pool.length ? pick(run.rng, pool) : pick(run.rng, EVENTS.filter((e) => e.d.includes(0)));
  run.seenEvents = [...seen, ev.id];
  return ev.id;
}

export const eventById = (id) => EVENTS.find((e) => e.id === id);
