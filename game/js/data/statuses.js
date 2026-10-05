import { register } from '../combat/registry.js';

register('statuses', {
  burn: { name: 'Em chamas', icon: '🔥', col: '#ff7a3d', desc: 'Sofre 1 de dano no fim de cada rodada. Entrar na água apaga.' },
  poison: { name: 'Envenenado', icon: '☠', col: '#9be35a', desc: 'Sofre 1 de dano por rodada (o número indica quantas rodadas restam).' },
  stun: { name: 'Atordoado', icon: '💫', col: '#ffe066', desc: 'Inimigo: perde o ataque planejado. Você: perde a ação do próximo turno.' },
  root: { name: 'Preso', icon: '🌿', col: '#7cc46a', desc: 'Não pode se mover nem ser empurrado.' },
  wet: { name: 'Molhado', icon: '💧', col: '#5ec8ff', desc: 'Recebe +1 de dano de choque e não pega fogo.' },
  mark: { name: 'Exposto', icon: '🎯', col: '#ff5a7a', desc: 'Recebe +1 de dano de cada golpe.' },
  shield: { name: 'Escudo', icon: '🛡', col: '#9fd3ff', desc: 'Absorve dano. Some no início do próprio turno.' },
  sub: { name: 'Submerso', icon: '🌊', col: '#3fb6c9', desc: 'Imune a dano físico e fogo. Volta à tona ao agir ou sair da água funda.' },
  flip: { name: 'Virado', icon: '🙃', col: '#ffb347', desc: 'Sem armadura e perde a próxima ação.' },
  oiled: { name: 'Oleado', icon: '🛢', col: '#b58a3a', desc: 'O próximo dano de fogo recebido causa +2.' },
  bleed: { name: 'Sangrando', icon: '🩸', col: '#e04040', desc: 'Perde 1 de vida ao se mover.' },
  hook: { name: 'Fisgado', icon: '🪝', col: '#ffd76a', desc: 'Preso ao arpão. Pode ser puxado.' },
  fort: { name: 'Fortificado', icon: '⛨', col: '#c0c0c0', desc: '+1 de armadura.' },
  shell: { name: 'Recolhido', icon: '🐚', col: '#e8c7a0', desc: '+3 de armadura contra golpes físicos. Colisões, fogo e choque ainda ferem.' },
  stranded: { name: 'Encalhado', icon: '🏖', col: '#e0c070', desc: 'Fora d\'água: não consegue se mover.' },
});
