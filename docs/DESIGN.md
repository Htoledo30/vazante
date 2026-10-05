# VAZANTE — A Cidade sob a Maré (documento de design)

## Visão
RPG tático roguelite com campanha narrativa, para iPhone em retrato.
O mar recua todas as manhãs ("a vazante") e revela Aurélia, a cidade afogada há 300 anos.
Você é uma vazanteira de Salgema, a vila no penhasco. Desce à cidade em expedições,
enfrenta o que vive lá embaixo e descobre por que o mar está indo embora.

**Diferencial:** a MARÉ é o sistema central. Cada combate tem uma *Tábua de Marés*
(previsão visível do nível da água por rodada). O terreno tem elevação (0, 1, 2);
a água sobe e desce, alagando ruas, apagando fogo, conduzindo choque, afundando
construtos pesados, encalhando águas-vivas, drenando o Fôlego. Todas as classes
interagem com a água de forma diferente.

## Pilares
1. **Táticas legíveis**: todo inimigo mostra o que vai fazer (telegrafia). Ataques
   relativos acompanham o inimigo se ele for empurrado; ataques "de alvo fixo"
   (arremessos) ficam no quadrado. Informação completa → decisões, não sorte.
2. **Terreno sistêmico**: água rasa/funda, fogo, óleo (flutua e queima sobre a água),
   coral, algas, ralos, barris, sinos. Empurrar é tão importante quanto bater.
3. **Builds distintas**: 4 ofícios com mecânicas próprias (arpão que precisa ser
   recuperado; fogo e luz; caça submersa; manipulação da Tábua de Marés),
   atributos com efeito direto, habilidades, trajes e relíquias com sinergias.
4. **Campanha que avança entre expedições**: chefes dão Versos, resgatar
   desaparecidos muda a vila, conhecimento do bestiário dá bônus, a vila é
   reconstruída com Conchas. Três finais. Pós-jogo com Marés Vivas (níveis de dificuldade).

## Ciclo central
Vila (preparar: ofício, arma, contrato, atalho) → Expedição (mapa de nós por distrito:
combate, elite, evento, mercador, bolsão de ar, tesouro, resgate → chefe) →
Após cada chefe: **voltar à superfície** (guarda tudo) ou **descer mais** (risco) →
Morte: "a maré te devolve à praia" — mantém conhecimento, Versos, resgates e metade
das pérolas convertidas em Conchas → Vila: gastar Conchas, conversas, história.

## Regras de combate (resumo)
- Tabuleiro 7×8. Turno do jogador: 1 Movimento (até MOV casas) + 1 Ação, em qualquer
  ordem. Movimento pode ser desfeito enquanto não agir. Itens "rápidos" não gastam ação.
- Fôlego: energia das habilidades; +1 por turno; água funda drena (−1 por rodada).
- Ordem: jogador → inimigos executam intenções (na ordem numerada) → ambiente
  (fogo, veneno, afogamento) → a maré muda conforme a Tábua → inimigos se movem e
  telegrafam → jogador.
- Água: rasa (profundidade 1) custa 2 de movimento e molha; funda (2+) idem, drena
  Fôlego, afunda inimigos *pesados*, afoga inimigos comuns (1 dano/rodada).
- Molhado: +1 dano de choque, não pega fogo. Choque em água se espalha por toda a
  água conectada (inclusive em você).
- Colisão: empurrar contra parede/unidade causa 1 (+Ímpeto/2) ignorando armadura;
  coral dá +1; ouriço +2.

## Atributos
- **Vigor**: +2 Vida máxima por ponto.
- **Ímpeto**: +1 de dano de colisão a cada 2 pontos; habilidades [Ímp] escalam.
- **Fôlego**: +1 Fôlego máximo por ponto.
- **Canto**: habilidades [Canto] escalam; +1 previsão da maré a cada 2 pontos.

## Estrutura
Distritos: Porto Afogado → Jardins de Coral → Bairro dos Sinos → Catedral do Abismo.
Chefes: A Carranca, O Jardineiro, O Sineiro, Maren (a Última Cantora).
Finais: Silêncio (matar Maren), Maré Mansa (devolver a Concha-Mãe), Coroa de Sal (cantar os três Versos).
