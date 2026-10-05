// Sprites em pixel art (12×12) desenhados a partir de mapas de caracteres.
const PAL = {
  k: '#0e1218', w: '#f3efe4', l: '#c3cad6', e: '#8a93a3', E: '#4c5464',
  r: '#d9473c', R: '#8e2a25', o: '#f08a3c', y: '#f4d35e', Y: '#b8902a',
  g: '#6cbf4f', G: '#2e6b3a', b: '#3b82d6', B: '#1e3f78', c: '#6ad6e8', C: '#2a8ca0',
  p: '#ee7fb0', P: '#8e5bc8', n: '#9a6236', N: '#5a3a20', s: '#ecc097', S: '#b07a52',
  u: '#d39a3e', U: '#8c5d1d', m: '#3fa58f', M: '#1f5e55', v: '#b8e0ff',
};

const S = {
  hero_arp: ['..........y.', '.....kkk..yk', '....krrrk.u.', '...krssskku.', '...ksksks.u.', '...kssssk.u.', '....kbbk..u.', '...kbbbbkku.', '..ksbbbbs.u.', '...kbBBbk.u.', '...kBk.kBku.', '...kk...kk..'],
  hero_far: ['....kkkk....', '...kyyyyk...', '..kyyyyyyk..', '...kssssk...', '...ksksk....', '...kssssk...', '..kyyyyyyk..', '.kyyykyyyk..', '.ksyyyyyyok.', '..kyyyyyyoyk', '..kNk..kNkok', '..kk....kk..'],
  hero_mer: ['...kkkk...c.', '..kmmmmk.ckc', '..kccvcck.c.', '..kmssmk..c.', '...kssk...c.', '..kmmmmk..c.', '.kmmmmmmkkc.', '.ksmmmmms.c.', '..kmmmmk..c.', '..kMkkMk....', '..kMk.kMk...', '..kk...kk...'],
  hero_can: ['....kkkk....', '...kNNNNk...', '..kNssssNk..', '..kNsksskN..', '..kNssssNk..', '..kNkppkNk..', '..kppppppk..', '.kpppppppwk.', '.kspppppwwk.', '..kpppppkk..', '..kPPPPPPk..', '..kkkkkkkk..'],
  crab: ['............', '.kk......kk.', 'krrk....krrk', 'kr.rk..kr.rk', '.krrkkkkrrk.', '..krrrrrrk..', '.krwkrrkwrk.', 'krrrrrrrrrrk', 'kroRRRRRRork', '.kRk.kk.kRk.', 'k.k......k.k', '............'],
  drowned: ['....kkkk....', '...kmmmmk...', '...kmkmkk...', '...kmmmmk...', '....kMMk....', '..kbbbbbbk..', '.kmbBbbBbmk.', '.km.bbbb.mk.', '..k.bBBb.k..', '....kBkBk...', '....kBkBk...', '...kkk.kkk..'],
  eel: ['............', '......kkkk..', '.....kyyyyk.', '....kyykyyk.', '....kyyyyk..', '...kyyk.....', '..kyyk..kk..', '..kyyk.kyyk.', '..kyyykyyk..', '...kyyyyk...', '....kkkk....', '............'],
  gull: ['............', '............', 'k.........k.', 'kwk.....kwk.', '.kwwk.kwwk..', '..kwwwwwk...', '...kwwwwkk..', '...kwlwwkok.', '....kwwkk...', '.....kk.....', '............', '............'],
  smuggler: ['...kkkkkk...', '..kNNNNNNk..', '....ksssk...', '....kskskk..', '....kssk.ko.', '...knnnnkoyo', '..knnnnnnko.', '..ksnnnnk...', '...knnnnk...', '...kNkkNk...', '...kNk.kNk..', '...kk...kk..'],
  barnacle: ['......o.....', '.....kyk....', '......k.....', '...kkkkkk...', '..klelelek..', '.kelleellek.', '.klekllelek.', '.kellelllek.', '.klleelelek.', '..keeeeeek..', '...kkkkkk...', '............'],
  captain: ['..kkkkkkkk..', '.kNNNNNNNNk.', '...kssssk...', '...kskskk...', '...ksssk....', '..krrwwrrk..', '.krrrwwrrrk.', '.ksrrrrrrsk.', '..krryyrrk..', '..kRRRRRRk..', '...kNk.kNk..', '...kk...kk..'],
  polyp: ['..p.p.p.p...', '..kpkpkpk...', '...kpppk....', '...kpwpk....', '....kpk.....', '....kpk.....', '....kpk.....', '...kppk.....', '...kpppk....', '..kppppppk..', '..kRRRRRRk..', '...kkkkkk...'],
  jelly: ['............', '...kkkkkk...', '..kppppppk..', '.kpwpppppPk.', '.kppppppppk.', '.kkkkkkkkkk.', '..p.p..p.p..', '..p..p.p..p.', '...p.p..p.p.', '..p..p..p...', '...p...p....', '............'],
  urchin: ['.k...k...k..', '..k..k..k...', 'k..kPPPk..k.', '.kkPPPPPPk..', '..PPPwPPPPk.', 'kkPPPPPPPPkk', '..PPPPPPPP..', '.kkPPPPPPkk.', 'k..kPPPPk..k', '..k..k..k...', '.k...k...k..', '............'],
  hermit: ['............', '....kkkkk...', '...knnnnnk..', '..knNNNnnk..', '..knNnNNnk..', '..knNNnnnk..', '..knnnnnnk..', '.kkknnnnkk..', 'krrkkkkkrrk.', 'kr.rrrrrr.k.', '.k.kk.kk.k..', '............'],
  moray: ['............', '...kkkkk....', '..kggggggk..', '.kgggwkggk..', '.kggggggggk.', '.kgk.kkkkk..', '.kgkwwkk....', '.kgggggk....', '..kGggggk...', '...kGgggk...', '....kGGgk...', '.....kkk....'],
  puffer: ['............', '...k.k.k....', '..kkyyyykk..', '.kyyyyyyyyk.', 'kyykyyyyyyyk', '.kyyyyyyyyyk', 'kyyyyyyyyyk.', '.kyywwwwyyk.', '..kyyyyyyk..', '...k.k.k....', '............', '............'],
  matron: ['p.p..p..p.p.', 'kpk.kpk.kpk.', '.kpkpppkpk..', '..kpppppk...', '.kppwkwppk..', '.kpppppppk..', 'kpppRRRpppk.', 'kppRRRRRppk.', '.kpppppppk..', '..kRRRRRk...', '.kRRRRRRRk..', '.kkkkkkkkk..'],
  automaton: ['....kkkk....', '...kuuuuk...', '...kuyuyk...', '...kuuuuk...', '..kkUUUUkk..', '.kuuuuuuuuk.', 'kukuuuuuukuk', 'kUkuUUUUkuUk', '.k.kuuuuk.k.', '...kUkkUk...', '...kuk.kuk..', '..kkkk.kkkk.'],
  acolyte: ['....kkkk....', '...kbbbbk...', '..kbBBBBbk..', '..kbBssBbk..', '..kbBkkBbk..', '..kbbbbbbk..', '.kbbbybbbbk.', '.kbbbybbbbk.', '..kbbbbbbk..', '..kbbbbbbk..', '.kbbbbbbbbk.', '.kkkkkkkkkk.'],
  sentinel: ['...kkkkkk...', '..kuuuuuuk..', '..kuUccUuk..', '..kuUccUuk..', '..kuuuuuuk..', '...kUUUUk...', '..kuuuuuuk..', '.kuuUuuUuuk.', '.kuuUuuUuuk.', '..kuuuuuuk..', '.kUUUUUUUUk.', '.kkkkkkkkkk.'],
  shade: ['....kkkk....', '...kEEEEk...', '..kEEEEEEk..', '..kEcEEcEk..', '..kEEEEEEk..', '.kEEEkkEEEk.', '.kEEEEEEEEk.', '.kEEEEEEEEk.', '..kEEEEEEk..', '..kE.EE.Ek..', '...k.kk.k...', '............'],
  bellmimic: ['.....kk.....', '....kuuk....', '...kuuuuk...', '..kuuuuuuk..', '..kuwkkwuk..', '..kuuuuuuk..', '.kuuuuuuuuk.', '.kuwkwkwkuk.', 'kuuuuuuuuuuk', 'kUUUUUUUUUUk', '.kkkkUUkkkk.', '.....kk.....'],
  crossbow: ['....kkkk....', '...kuuuuk...', '...kucuck...', '...kuuuuk...', 'kkkkkUUkkkkk', 'knnnnuunnnnk', 'kk.kuuuuk.kk', '...kuuuuk...', '...kuUUuk...', '...kUkkUk...', '...kuk.kuk..', '..kkk..kkk..'],
  conductor: ['....kkkk..w.', '...kssssk.w.', '...ksksskw..', '...kssssw...', '..kkwwwwkk..', '.kEEEwwEEEk.', '.ksEEEEEEk..', '..kEEEEEEk..', '..kEEEEEEk..', '..kEEEEEEk..', '.kEEEEEEEEk.', '.kkkkkkkkkk.'],
  abyssal: ['...kkkkkk...', '..kBBBBBBk..', '.kBcBBBBcBk.', '.kBBBBBBBBk.', '.kBkwkwkwBk.', '..kBBBBBBk..', '.kBBBBBBBBk.', 'kBkBBBBBBkBk', 'kckBBBBBBkck', '...kBBBBk...', '..kBBk.kBBk.', '..kkk...kkk.'],
  priest: ['.....kkkk..u', '....kmmmmk.u', '...kmMssMk.u', '...kmskskk.u', '...kmMssMk.u', '..kmmmmmmkku', '.kmmmwwmmmku', '.kmmmwwmmmk.', '..kmmmmmmk..', '..kmmmmmmk..', '.kmmmmmmmmk.', '.kkkkkkkkkk.'],
  squid: ['.....kk.....', '....kPPk....', '...kPPPPk...', '..kPPPPPPk..', '..kPPPPPPk..', '..kPwPPwPk..', '..kPPPPPPk..', '...kPPPPk...', '..kPkPPkPk..', '.kPk.PP.kPk.', '.Pk..PP..kP.', 'P...P..P...P'],
  echo: ['............', '....kvvk....', '...v....v...', '..v.kvvk.v..', '.v.v....v.v.', '.v.v.ww.v.v.', '.v.v.ww.v.v.', '.v.v....v.v.', '..v.kvvk.v..', '...v....v...', '....kvvk....', '............'],
  saltgolem: ['...kkkkkk...', '..kwwwwwwk..', '..kwkwwkwk..', '..kwwwwwwk..', '.kkllllllkk.', 'kwwwwwwwwwwk', 'kwkwwwwwwkwk', 'klkllllllklk', 'k.kwwwwwwk.k', '..kwlk.kwk..', '..kwwk.kwwk.', '..kkkk.kkkk.'],
  leviathan: ['..kkkk......', '.kBBBBkk....', 'kBBcBBBBkk..', 'kBBBBBBBBBk.', 'kBkwkwkwkBBk', 'kB.......kBk', 'kBkwkwkwkBBk', '.kBBBBBBBBk.', '..kkBBBBBk..', '....kBBBBk..', '.....kBBBk..', '......kkk...'],
  carranca: ['..kkkkkkkk..', '.knnnnnnnnk.', 'knnNNnnNNnnk', 'knnwkNNkwnnk', 'knnnnnnnnnnk', 'knnnnNNnnnnk', 'knnNnnnnNnnk', '.knnkkkknnk.', '.knnkrrknnk.', '..knnkknnk..', '...knnnnk...', '....kkkk....'],
  gardener: ['p.k..p..k.p.', 'kpkpkpkpkpk.', '.kpppppppk..', '..kpRRRRpk..', '..kRwRRwRk..', '..kRRRRRRk..', '.kpkRRRRkpk.', 'kpkRRRRRRkpk', 'kk.kRRRRk.kk', '...kRRRRk...', '..kRRk.kRRk.', '..kkk...kkk.'],
  sineiro: ['....kkkk....', '...kEEEEk...', '..kEEEEEEk..', '..kEkyykEk..', '..kEEEEEEk..', '..kEEEEEEkk.', '.kEEEEEEEkuk', '.kEEEEEEEkuk', '..kEEEEEkuuu', '..kEEEEEEkkk', '.kEEEEEEEEk.', '.kkkkkkkkkk.'],
  maren: ['...kkkkkk...', '..kGGGGGGk..', '.kGGssssGGk.', '.kGskssksGk.', '.kGssssssGk.', '.kGGsppsGGk.', 'kGGkccccGGGk', 'kG.kccccc.Gk', 'kG.kcwcwck.k', '...kccccck..', '..kcccccccc.', '..kkkkkkkkk.'],
  captive: ['....kkkk....', '...knnnnk...', '...kssssk...', '...ksksk....', '...kssssk...', '..kwwwwwwk..', '.ksweeewsk..', '.e.kwwwwk.e.', '..ekwwwwke..', '...kNkkNk...', '..kNk..kNk..', '..kk....kk..'],
  // objetos
  barrel: ['............', '...kkkkkk...', '..knnnnnnk..', '..kEEEEEEk..', '..knnnnnnk..', '..knnnonnk..', '..knnnnnnk..', '..kEEEEEEk..', '..knnnnnnk..', '...kkkkkk...', '............', '............'],
  bell: ['.....kk.....', '....kuuk....', '...kuyuuk...', '...kuuuuk...', '..kuuuuuuk..', '..kuyuuuuk..', '.kuuuuuuuuk.', 'kuuuuuuuuuuk', 'kUUUUUUUUUUk', '.kkkkkkkkkk.', '.....kUk....', '......k.....'],
  crate: ['............', '.kkkkkkkkkk.', '.knnNnnNnnk.', '.knNnnnnNnk.', '.kNnnnnnnNk.', '.knnnnnnnnk.', '.kNnnnnnnNk.', '.knNnnnnNnk.', '.knnNnnNnnk.', '.kkkkkkkkkk.', '............', '............'],
  chain: ['....kkk.....', '...kekek....', '....kkk.....', '...kkekk....', '..kek.kek...', '...kkekk....', '....kkk.....', '...kekek....', '....kkk.....', '...kkekk....', '..kEEEEEk...', '..kkkkkkk...'],
  statue: ['....kkkk....', '...klllk....', '...klklk....', '...kllllk...', '..kllllllk..', '.kleellllek.', '..klllllk...', '..klllllk...', '...klllk....', '..kllllllk..', '.keeeeeeeek.', '.kkkkkkkkkk.'],
  beacon: ['.....yy.....', '....yyyy....', '....kyyk....', '...kuyyuk...', '....kuuk....', '....kwwk....', '....krrk....', '....kwwk....', '....krrk....', '...kwwwwk...', '..kEEEEEEk..', '..kkkkkkkk..'],
  chest: ['............', '............', '..kkkkkkkk..', '.knnnnnnnnk.', '.kuuuuuuuuk.', '.knnnyynnnk.', '.knnnyynnnk.', '.knnnnnnnnk.', '.kkkkkkkkkk.', '............', '............', '............'],
  pearl: ['............', '............', '............', '....kkk.....', '...kwwlk....', '..kwwwllk...', '..kwwlllk...', '...kllek....', '....kkk.....', '............', '............', '............'],
  harpoon: ['..........yk', '.........yk.', '........uk..', '.......uk...', '......uk....', '.....uk.....', '....uk......', '...uk.......', '..uk........', '............', '............', '............'],
  memory: ['............', '.....P......', '....PvP.....', '...PvwvP....', '..PvwwwvP...', '...PvwvP....', '....PvP.....', '.....P......', '............', '............', '............', '............'],
};

const cache = new Map();

export function spriteCanvas(name, tint = null) {
  const k = name + (tint || '');
  if (cache.has(k)) return cache.get(k);
  const rows = S[name] || S.captive;
  const cv = document.createElement('canvas');
  cv.width = 12; cv.height = 12;
  const g = cv.getContext('2d');
  for (let y = 0; y < 12; y++) {
    const row = (rows[y] || '').padEnd(12, '.').slice(0, 12);
    for (let x = 0; x < 12; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = tint && ch !== 'k' ? tint : (PAL[ch] || '#f0f');
      g.fillRect(x, y, 1, 1);
    }
  }
  cache.set(k, cv);
  return cv;
}

export function spriteDataURL(name, scale = 4) {
  const src = spriteCanvas(name);
  const cv = document.createElement('canvas');
  cv.width = 12 * scale; cv.height = 12 * scale;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, cv.width, cv.height);
  return cv.toDataURL();
}

export const SPRITE_NAMES = Object.keys(S);
export { S as SPRITES };
