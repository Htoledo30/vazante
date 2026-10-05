// Manual dentro do jogo: regras apresentadas por tópicos.
export const MANUAL = [
  {
    id: 'basico', title: 'O básico',
    html: `
<p><b>Vazante</b> é um RPG tático por turnos. Você desce à cidade afogada em <b>expedições</b>: escolhe caminhos no mapa, luta, encontra relíquias, sobe de nível e enfrenta o guardião de cada distrito.</p>
<ul>
<li>Se cair, a maré te devolve à praia: você perde a expedição, mas mantém <b>metade das pérolas</b> (viram Conchas), o <b>conhecimento</b> do bestiário, as <b>memórias</b>, os <b>versos</b> e os <b>moradores resgatados</b>.</li>
<li>Depois de cada chefe você escolhe: <b>subir</b> (guarda todas as pérolas como Conchas) ou <b>descer</b> mais fundo.</li>
<li>Na vila, Conchas compram melhorias permanentes.</li>
</ul>`,
  },
  {
    id: 'combate', title: 'Seu turno',
    html: `
<p>Em cada turno você tem <b>1 Movimento</b> e <b>1 Ação</b>, em qualquer ordem.</p>
<ul>
<li><b>Mover:</b> toque numa casa azul. Pode <b>Desfazer</b> enquanto não agir.</li>
<li><b>Agir:</b> toque numa habilidade, depois num alvo amarelo. Aparece uma <b>prévia</b> (dano, empurrões, mortes 💀). Toque de novo no mesmo alvo para confirmar.</li>
<li>Habilidades com <b>⚡</b> são rápidas: não gastam a ação.</li>
<li><b>🫁 Fôlego</b> paga as habilidades. Recupera 1 por turno (não em água funda).</li>
<li><b>Defender</b> gasta a ação e dá 1 de Escudo até o seu próximo turno.</li>
<li>Toque em qualquer inimigo para ver vida, características e o que ele vai fazer. Toque numa casa vazia para ver o terreno.</li>
</ul>`,
  },
  {
    id: 'intencoes', title: 'Intenções inimigas',
    html: `
<p>Todo inimigo mostra o que vai fazer <b>antes</b> de agir. As casas <span class="legend" style="background:rgba(230,40,40,.5)"></span>vermelhas serão atingidas; o número é o dano; a seta, o empurrão. O círculo vermelho sobre o inimigo indica a <b>ordem</b> em que eles agem.</p>
<ul>
<li><b>Ataques relativos</b> (golpes, linhas, raios, investidas) <b>acompanham o inimigo</b>: se você o empurrar, o ataque sai para outro lado — talvez em outro monstro!</li>
<li><b>Ataques de alvo fixo</b> (arremessos, invocações, coral) ficam na casa marcada. Saia de lá.</li>
<li><span class="legend" style="background:rgba(255,150,40,.6)"></span>Laranja tracejado = ataque <b>carregando</b>: dispara uma rodada depois.</li>
<li><b>Atordoar</b> cancela o ataque preparado. Matar também.</li>
<li>⚠ marca onde <b>reforços</b> chegarão. Ficar em cima bloqueia (você leva 1).</li>
</ul>`,
  },
  {
    id: 'mare', title: 'A Tábua de Marés',
    html: `
<p>O topo da tela mostra o <b>nível da água</b> desta rodada e das próximas. Toque numa rodada da Tábua para ver no tabuleiro como ele ficará alagado.</p>
<ul>
<li>Cada casa tem <b>elevação</b> 0, 1 ou 2 (pontinhos no canto; casas mais claras são mais altas).</li>
<li>Se a maré for maior que a elevação: <b>água rasa</b>. Se for 2 ou mais acima: <b>água funda</b>.</li>
<li>Água custa <b>2 de movimento</b> por casa (para quem não nada) e deixa <b>Molhado</b>.</li>
<li><b>Água funda</b>: drena 1 de Fôlego por rodada (sem Fôlego, você se afoga); inimigos <b>pesados afundam na hora</b>; inimigos de terra se afogam (1 por rodada).</li>
<li>A maré apaga fogo — mas <b>óleo flutua</b> e continua queimando sobre a água.</li>
<li>Criaturas que só nadam <b>encalham</b> quando a água baixa.</li>
</ul>`,
  },
  {
    id: 'terreno', title: 'Terreno e elementos',
    html: `
<ul>
<li><b>Empurrar</b> contra parede, objeto ou outra unidade causa <b>colisão</b>: 1 de dano (+Ímpeto/2) que <b>ignora armadura</b>. A outra unidade também leva 1.</li>
<li><b>Coral</b>: obstáculo; colidir fere +1 e lasca o coral.</li>
<li><b>Ralo</b>: quem for empurrado para dentro é tragado (chefes resistem). Você sai ferido.</li>
<li><b>Algas</b>: param o movimento de quem entra.</li>
<li><b>Barril</b>: explode quando atingido (2 de fogo ao redor e óleo).</li>
<li><b>Sino</b>: golpeie para atordoar todos ao redor dele (menos você).</li>
<li><b>Fogo</b>: quem estiver em chamas sofre 1 por rodada; água apaga.</li>
<li><b>Choque</b>: em água, se espala por <b>toda a água conectada</b> — inclusive até você.</li>
<li><b>Tinta</b> (lulas): esconde as intenções de quem está nela.</li>
</ul>`,
  },
  {
    id: 'estados', title: 'Estados',
    html: `
<ul>
<li>🔥 <b>Em chamas</b>: 1 de dano por rodada.</li>
<li>☠ <b>Envenenado</b>: 1 de dano por rodada (o número são as rodadas).</li>
<li>💫 <b>Atordoado</b>: inimigo perde o ataque; você perde a próxima ação.</li>
<li>🌿 <b>Preso</b>: não se move nem é empurrado.</li>
<li>💧 <b>Molhado</b>: +1 de dano de choque; não pega fogo.</li>
<li>🎯 <b>Exposto</b>: +1 de dano de cada golpe.</li>
<li>🛡 <b>Escudo</b>: absorve dano até o próximo turno do dono.</li>
<li>🌊 <b>Submerso</b>: imune a dano físico e fogo.</li>
<li>🙃 <b>Virado</b>: sem armadura e sem agir.</li>
<li>🛢 <b>Oleado</b>: o próximo fogo causa +2.</li>
<li>🩸 <b>Sangrando</b>: perde 1 ao se mover.</li>
<li>🪝 <b>Fisgado</b>: preso ao arpão da Arpoadora.</li>
</ul>`,
  },
  {
    id: 'progressao', title: 'Progressão',
    html: `
<ul>
<li><b>Nível</b>: a cada nível escolha uma carta — nova habilidade (até 4 ativas), passiva, melhoria (+) ou atributo.</li>
<li><b>Atributos</b>: Vigor (+2 vida), Ímpeto (colisões e golpes [Ímp]), Fôlego (+1 Fôlego máx.), Canto (habilidades [Canto] e previsão da maré).</li>
<li><b>Relíquias</b>: efeitos passivos que mudam seu estilo. <b>Trajes</b>: um por vez.</li>
<li><b>Bestiário</b>: derrote 6 de uma espécie (3 com o Tratado) para <b>Estudá-la</b>: +1 de dano contra ela, para sempre.</li>
<li><b>Moradores resgatados</b> voltam à vila e dão bônus permanentes.</li>
<li><b>Memórias de Aurélia</b>: leve à Avó Zélia. Elas revelam a história — e abrem um dos finais.</li>
</ul>`,
  },
  {
    id: 'mapa', title: 'Mapa e locais',
    html: `
<ul>
<li>⚔ Combate · ☠ Elite (relíquia) · ❓ Mistério · ⚖ Mercador · 🫧 Bolsão de Ar (descanso) · 💎 Tesouro · 🆘 Resgate · 👁 Guardião.</li>
<li>Você vê duas linhas à frente; o resto fica na névoa (o Farol pode revelar tudo).</li>
<li>Combates rápidos (até a rodada 5) dão pérolas extras. Combates longos atraem reforços.</li>
</ul>`,
  },
  {
    id: 'salvar', title: 'Salvar e sair',
    html: `
<p>O jogo <b>salva sozinho</b> a cada ação, no próprio aparelho. Pode fechar o app a qualquer momento: ao voltar, você continua do mesmo turno.</p>
<p>No menu ☰ você pode voltar ao título ou abandonar a expedição (perde metade das pérolas). Em Opções há <b>exportar/importar</b> o save como texto, para backup.</p>`,
  },
];

export const INSTALL_HTML = `
<p>Vazante é um app da web: instale na tela de início para jogar em tela cheia, sem a barra do Safari, e offline.</p>
<ol>
<li>Abra o endereço do jogo no <b>Safari</b> do iPhone.</li>
<li>Toque em <b>Compartilhar</b> <span style="font-size:18px">⎋</span> (o quadrado com a seta para cima).</li>
<li>Role e escolha <b>Adicionar à Tela de Início</b>.</li>
<li>Mantenha <b>Abrir como App da Web</b> ligado (quando aparecer) e toque em <b>Adicionar</b>.</li>
<li>Abra o Vazante pelo ícone criado.</li>
</ol>
<p class="muted small">Depois do primeiro carregamento, o jogo funciona sem internet. Quando houver uma versão nova, aparecerá um aviso para atualizar — seu progresso é mantido.</p>`;
