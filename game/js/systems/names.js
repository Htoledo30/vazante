// ICOR — nomes (Área A). Nomes ásperos, de vilarejo e de guerra.
import { R } from '../core/rng.js';

const MALE = ['Aldric', 'Bertram', 'Caspar', 'Dagr', 'Edric', 'Falk', 'Gunnar', 'Hollan', 'Ivo', 'Jorund', 'Kael', 'Lothar', 'Mattias', 'Norvel',
  'Osric', 'Piet', 'Ragn', 'Sigmar', 'Tobiah', 'Ulf', 'Varn', 'Wendel', 'Yorick', 'Zeb', 'Anselm', 'Brom', 'Corvin', 'Doran', 'Egil', 'Fenn',
  'Gerd', 'Hask', 'Isak', 'Joss', 'Konrad', 'Lenz', 'Merek', 'Nils', 'Orm', 'Rudger', 'Stellan', 'Tor', 'Udo', 'Vidar', 'Wilm'];
const FEMALE = ['Agnes', 'Brunhild', 'Cassia', 'Dagna', 'Edda', 'Frida', 'Gisla', 'Hedda', 'Ilse', 'Jutta', 'Katrin', 'Liesel', 'Magda', 'Nell',
  'Odila', 'Petra', 'Ragna', 'Sigrun', 'Thora', 'Ursel', 'Vesna', 'Wilma', 'Ysolde', 'Alma', 'Berit', 'Clothilde', 'Dorte', 'Elke', 'Freya',
  'Greta', 'Hilde', 'Imke', 'Kerstin', 'Lene', 'Margit', 'Nora', 'Ottilie', 'Runa', 'Svea', 'Tilde', 'Ulla', 'Wanda'];
const EPITHETS = ['o Manco', 'a Muda', 'Dente-Torto', 'Mão-Preta', 'o Queimado', 'a Viúva', 'Sem-Orelha', 'o Magro', 'a Ruiva', 'Olho-Branco',
  'o Coveiro', 'a Parteira', 'Sete-Dedos', 'o Bastardo', 'a Cega', 'Cara-Rachada', 'o Penitente', 'a Açougueira', 'Pele-de-Sal', 'o Calado'];
const HOUSES = ['Vharn', 'Kessel', 'Morrow', 'Grieve', 'Ardo', 'Salgueda', 'Corvara', 'Malvas', 'Ystrel', 'Ruthven', 'Dorne', 'Brannoc', 'Thal', 'Oskar'];

/** Nome próprio. sex: 'm' | 'f' (aleatório se omitido). */
export function randomName(rng = R, sex) {
  const s = sex || (rng.chance(50) ? 'm' : 'f');
  return rng.pick(s === 'f' ? FEMALE : MALE);
}

export function houseName(rng = R) { return rng.pick(HOUSES); }

/** Nome de NPC com alcunha ("Gerd Sete-Dedos"). */
export function npcName(rng = R) {
  return `${randomName(rng)} ${rng.pick(EPITHETS)}`;
}
