// Atalhos para escrever eventos de forma compacta (Área E). Só dados — sem lógica de jogo.
// Ids de traços/origens/sequazes ficam centralizados aqui para remapear num lugar só.

// ---------- ids externos (A: backgrounds/traits; B: companions) ----------
export const BG = {
  desertor: 'desertor', acougueiro: 'acougueiro', flagelante: 'flagelante', ladra: 'ladra_tumulos',
  cacador: 'cacador_bruxas', cirurgia: 'cirurgia', bebedor: 'ex_bebedor', gladiador: 'gladiador',
};
export const TR = {
  canibal: 'canibal',           // comeu carne humana
  viciado: 'viciado_icor',      // vício em Icor
  carrasco: 'carrasco',         // execuções acalmam
  piedoso: 'piedoso',           // fé que segura o Pavor
  impiedoso: 'impiedoso',       // ninguém te comove
  marcado: 'marca_coroa',           // ferrete da Coroa: criminal
  cicatriz: 'rosto_retalhado', // rosto que assusta
  insone: 'insone',             // não dorme direito
  fobia_fogo: 'medo_fogo',
  fobia_escuro: 'medo_escuro',
  ouvido: 'ouvido_do_deus',     // ouve o cadáver sussurrar
  pele_dura: 'pele_curtida',
  faro: 'faro_da_chaga',        // fareja podridão
  jurado: 'juramento_sangue',   // jurou vingança
  amaldicoado: 'amaldicoado',   // maldição de bruxa
  sobrevivente: 'sobrevivente', // já devia ter morrido
};
export const COMP = { cao: 'cao_guerra', mercenario: 'mercenario', penitente: 'penitente', batedora: 'batedora' };

// ---------- dificuldades ----------
export const FAC = 0; export const MED = 20; export const DIF = 40; export const BRU = 60;

// ---------- efeitos ----------
export const hp = (n) => ({ op: 'hp', n });
export const dmg = (n) => ({ op: 'hp', n: -n });
export const heal = (n) => ({ op: 'heal', n });
export const dread = (n) => ({ op: 'dread', n });
export const corr = (n) => ({ op: 'corruption', n });
export const coin = (n) => ({ op: 'coin', n });
export const ichor = (n) => ({ op: 'ichor', n });
export const item = (id, n = 1, q) => (q == null ? { op: 'item', id, n } : { op: 'item', id, n, q });
export const take = (id, n = 1) => ({ op: 'take', id, n });
export const loot = (table, tier = 'R') => ({ op: 'loot', table, tier });
export const wound = (dtype, sev = 1, part) => (part ? { op: 'wound', part, dtype, sev } : { op: 'wound', dtype, sev });
export const healW = (n) => (n == null ? { op: 'healWounds' } : { op: 'healWounds', n });
export const trait = (id) => ({ op: 'trait', id });
export const untrait = (id) => ({ op: 'untrait', id });
export const mutation = () => ({ op: 'mutation' });
export const rep = (f, n) => ({ op: 'rep', f, n });
export const chaga = (n, why) => (why ? { op: 'chaga', n, why } : { op: 'chaga', n });
export const time = (h) => ({ op: 'time', h });
export const light = (n) => ({ op: 'light', n });
export const food = (n) => ({ op: 'food', n });
export const flag = (k, v = true) => ({ op: 'flag', k, v });
export const count = (k, n = 1) => ({ op: 'count', k, n });
export const fight = (enemies, o = {}) => ({ op: 'combat', enemies, ...o });
export const chain = (id) => ({ op: 'event', id });
export const reveal = (n = 1) => ({ op: 'reveal', n });
export const journal = (text) => ({ op: 'journal', text });
export const log = (text, kind = 'info') => ({ op: 'log', text, kind });
/** rnd([peso, [efeitos], 'texto opcional'], ...) */
export const rnd = (...rows) => ({ op: 'random', table: rows.map(([w, effects, text]) => (text ? { w, effects, text } : { w, effects })) });
export const kill = (cause) => ({ op: 'kill', cause });
export const attr = (a, n) => ({ op: 'attr', a, n });
export const companion = (id) => ({ op: 'companion', id });
export const loseComp = () => ({ op: 'loseCompanion' });
export const unlock = (k) => ({ op: 'unlock', k });
export const mastery = (cls, n) => ({ op: 'mastery', cls, n });
export const siege = (n) => ({ op: 'siegeDefense', n });

// ---------- condições ----------
export const has = (id, n = 1) => (n === 1 ? { has: id } : { has: id, n });
export const bg = (id) => ({ bg: id });
export const tr = (id) => ({ trait: id });
export const notTr = (id) => ({ notTrait: id });
export const fl = (k, eq) => (eq === undefined ? { flag: k } : { flag: k, eq });
export const nfl = (k) => ({ notFlag: k });
export const repMin = (f, min) => ({ rep: { f, min } });
export const repMax = (f, max) => ({ rep: { f, max } });
export const corrMin = (min) => ({ corruption: { min } });
export const dreadMin = (min) => ({ dread: { min } });
export const chagaMin = (min) => ({ chaga: { min } });
export const dayMin = (min) => ({ day: { min } });
export const attrMin = (a, min) => ({ attr: a, min });
export const coinMin = (n) => ({ coin: n });
export const ichorMin = (n) => ({ ichor: n });
export const partOk = (p) => ({ partOk: p });
export const any = (...c) => ({ any: c });
export const all = (...c) => ({ all: c });
export const not = (c) => ({ not: c });
export const COMPANION = { companion: true };
export const NIGHT = { night: true };

// ---------- testes / opções ----------
/** ck('for', MED, [mod(has('tocha'), 15, 'tocha')]) */
export const ck = (a, diff = MED, mods) => (mods ? { attr: a, diff, mods } : { attr: a, diff });
export const mod = (cond, n, label) => ({ cond, n, label });
export const res = (text, ...effects) => ({ text, effects });

// Inimigos por papel (resolvidos pela região do evento em systems/events.js): '%fera', '%morto', '%humano', '%elite', '%atirador', '%enxame'
export const FERA = '%fera'; export const MORTO = '%morto'; export const HUMANO = '%humano';
export const ELITE = '%elite'; export const ATIRADOR = '%atirador'; export const ENXAME = '%enxame';

// Tabelas de saque comuns (tier 'R' = tier da região atual)
export const LT = {
  pobre: [['@material:R', 4, 1, 2], ['@consumable:R', 3], ['sucata', 3, 1, 3], ['pano', 2, 1, 2]],
  bau: [['@weapon:R', 2], ['@armor:R', 2], ['@consumable:R', 4, 1, 2], ['@material:R', 3, 1, 3], ['@trinket:R', 1]],
  cripta: [['@trinket:R', 2], ['@weapon:R', 2], ['osso', 3, 1, 3], ['lasca_divina', 1], ['@consumable:R', 2]],
  soldado: [['@weapon:R', 3], ['@armor:R', 3], ['bandagem', 2, 1, 2], ['virote', 2, 2, 6], ['racao', 2, 1, 2]],
  alquimia: [['@consumable:R', 5, 1, 2], ['ervas', 3, 1, 3], ['bile', 2], ['polvora', 2], ['sal', 2]],
  rico: [['@trinket:R', 3], ['@weapon:R', 2], ['@armor:R', 2], ['@any:R', 3]],
};
