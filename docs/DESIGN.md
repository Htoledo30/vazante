# ICOR — O Deus Apodrecido

RPG de dark fantasy brutal para iPhone (PWA). Híbrido: **campanha persistente** (cidade, facções, relógio do apocalipse, história com finais) + **expedições roguelike** (mapa de nós, combate tático de partes do corpo, morte permanente do personagem) + **linhagem** (quando você morre, seu herdeiro continua — e seu cadáver fica no mundo).

Tom: adulto, sujo, sem heroísmo de conto de fadas. Sangue, mutilação, fome, fé doente, escolhas sem saída limpa. Texto curto e seco; a brutalidade vem das **mecânicas** (membros decepados, ferimentos que não saram, a corrupção que dá poder e te devora).

---

## 1. Premissa

Há trinta anos um deus caiu do céu. Seu cadáver — do tamanho de uma cordilheira — apodrece no centro do **Ermo**. Do corpo escorre o **Icor**, sangue divino que dá força a quem o bebe e transforma quem bebe demais. A podridão que se espalha a partir do cadáver chama-se **a Chaga**: ela corrompe a terra, os animais e os mortos.

**Valdrem** é a última cidade murada. Você é membro de uma casa decadente de **Carniceiros** — saqueadores de Icor que entram no Ermo para colher o sangue do deus. A Chaga avança todo dia. Quando chegar a 100, Valdrem cai.

Para acabar com isso, alguém precisa chegar ao **Coração** do deus. Quatro facções querem decidir o que fazer com ele.

## 2. Pilares

1. **Cada ferida é uma decisão.** Combate por partes do corpo: decepar o braço do inimigo cancela seus golpes; quebrar suas pernas impede que avance. O mesmo vale para você — e as suas feridas te acompanham por dias, às vezes para sempre.
2. **O Icor é tudo e cobra tudo.** O mesmo recurso é dinheiro, experiência, oferenda e veneno. Vender, beber, ofertar ou ungir armas — escolha.
3. **O tempo é o inimigo.** Toda viagem, descanso, cura e treino custa dias. A Chaga não espera.
4. **A morte é um capítulo, não um reset.** Seu herdeiro herda a casa, o mapa, a reputação — e precisa buscar o seu cadáver (talvez já transformado em monstro).
5. **Informação é poder.** Inimigos anunciam intenções; Astúcia revela mais. Conhecer o mundo (mapas, fraquezas) é progressão.

## 3. Ciclo central

```
CIDADE (Valdrem)                         EXPEDIÇÃO (Ermo)
 - vender/gastar Icor                     - escolher caminho no mapa de nós
 - curar feridas (custa dias)             - luz (tocha) e comida se esgotam
 - comprar/melhorar equipamento           - combates, eventos, ruínas, ninhos
 - contratos e missões de facção          - acampar (risco de emboscada)
 - eventos diários / cercos               - empurrar mais fundo ou voltar
 - subir de nível bebendo Icor  <------>  - carregar loot (peso)
        ^                                         |
        |  morte -> herdeiro, cadáver no mapa     v
        +---------------- Chaga +1/dia -----------+
```

Curto prazo: sobreviver à expedição e voltar com Icor. Médio: preparar build, cumprir contratos, curar, derrotar o chefe da região. Longo: alinhar-se com uma facção, reunir os Fragmentos do deus, chegar ao Coração antes que a Chaga chegue a 100.

## 4. Personagem

### Atributos (1–10; criação: 3 base + bônus de origem + 4 pontos livres; máximo 6 na criação)
| Atributo | Afeta |
|---|---|
| **FOR** Força | dano de armas pesadas (escala), capacidade de carga, quebrar/empurrar, testes de força |
| **DES** Destreza | precisão, esquiva, armas leves, velocidade das ações, testes de agilidade |
| **VIG** Vigor | Vida máx., Fôlego máx., resistência a sangramento/infecção/fome |
| **VON** Vontade | resistência a Pavor, ritos, reduz ganho de Corrupção, intimidação |
| **AST** Astúcia | ver intenções detalhadas, achar armadilhas/loot, alquimia, negociação, mapa |

Teste de atributo: `chance% = clamp(5, 95, 35 + attr*8 + bônus - dificuldade)`; dificuldades: Fácil 0, Média 20, Difícil 40, Brutal 60. **A chance é sempre mostrada no botão.**

### Recursos
- **Vida (PV)**: `36 + VIG*7 + nível*4`.
- **Fôlego** (só em combate): máx `6 + VIG`; recupera `3 + bônus − peso da armadura` por turno próprio. Ações custam Fôlego. A 0: **Exausto** (esquiva −20, ações +25% tempo).
- **Pavor** (0–100): sobe com horrores, escuridão, ferimentos graves, aliados mortos. 50 Abalado (−5 precisão), 75 Aterrorizado (−10 precisão, 10% de perder o turno), 100 **Colapso** (fuga em pânico / fúria cega / catatonia; depois volta a 70). Cai com descanso, bebida, fé, execuções.
- **Corrupção** (0–100): sobe ao beber Icor, usar ritos, mutações, golpes de Icor. A cada 25: escolha 1 de 2 **mutações** (poder + defeito). 100: você **se transforma** — morte; seu corpo vira uma Aberração no mapa.
- **Moedas**, **Icor** (frascos), materiais.

### Corpo e feridas
Partes: **Cabeça, Tronco, Braço da arma (D), Braço do escudo (E), Pernas.**
Golpes recebidos atingem uma parte. Golpes fortes (≥ 20% da Vida máx. num acerto, ou críticos) podem causar **feridas** conforme o tipo de dano:
- Corte → Corte profundo (sangra), Tendão cortado; extremo: **membro decepado**.
- Impacto → Fratura (braço: −30% dano/sem 2 mãos; pernas: sem fuga, −esquiva; costelas: −Fôlego), Concussão.
- Perfuração → Perfuração (sangra, risco de infecção), **olho perdido** (cabeça).
- Fogo/Icor → Queimadura, Necrose.
Feridas curam com **dias** de descanso ou com o **Barbeiro-cirurgião** (moedas, às vezes dias). Infecção não tratada piora: necrose → amputação. Perdas permanentes podem receber **próteses** (gancho que é arma, perna de pau, olho de vidro).

### Progressão
- **Nível** (beber Icor): custa `nível+1` frascos e **+6 Corrupção** (reduzido por VON). Ganha +1 atributo e escolhe 1 de 3 **Dádivas** (talentos).
- **Maestria de arma**: usar uma classe de arma acumula maestria; níveis 1/2/3 liberam técnicas novas daquela classe.
- **Técnicas** extras: tomos, mestres na cidade, eventos.
- **Equipamento** com propriedades próprias, qualidade, durabilidade, **unção** (encantamento com Icor).
- **Traços** ganhos por eventos (cicatrizes, vícios, fobias, juramentos) — positivos e negativos.
- **Mutações** com a Corrupção.
- **Conhecimento**: mapas descobertos, fraquezas de inimigos registradas no Bestiário (após matar N de um tipo, suas partes/armaduras ficam visíveis).
- **Casa/Linhagem**: melhorias permanentes da casa, herança, baú.

### Origens (exemplos)
Desertor, Açougueiro, Flagelante, Ladra de Túmulos, Caçador de Bruxas, Cirurgiã de Campo, Ex-Bebedor, Gladiador do Fosso. Cada uma: bônus de atributo, equipamento inicial, 1 traço exclusivo e opções exclusivas em eventos.

## 5. Combate

Por turnos com **linha do tempo** (iniciativa contínua): cada ação tem custo de **tempo**; ações rápidas (adaga ~70) agem com mais frequência que pesadas (montante ~150). A fila dos próximos turnos é visível.

- **Distância** por inimigo: 0 Corpo a corpo, 1 Perto, 2 Longe. Armas corpo a corpo exigem 0 (lanças alcançam 1). Armas de disparo preferem ≥1. Recuar de inimigos engajados provoca golpe de oportunidade.
- **Intenções**: cada inimigo mostra sua próxima ação (alvo e parte; dano estimado). Com AST alta: números exatos; baixa: vago. Ações **carregadas** (windup) são fortes e podem ser **interrompidas** (atordoar, decepar o braço, empurrar).
- **Mirar partes**: torso fácil; cabeça difícil (crítico, atordoa, mata); membros intermediários e incapacitam. Cada parte tem armadura por tipo de dano (Corte/Perfuração/Impacto). Partes destruídas: decepada (corte), esmagada (impacto), perfurada (perf.). Efeitos: braço da arma perdido → inimigo perde ataques daquele braço; pernas → não avança, cai; cabeça → morte/cegueira; partes especiais (sacos de bile, olhos extras, lanterna).
- **Defesas** (duram até seu próximo turno): Guarda (bloqueio com escudo/arma, custa Fôlego por golpe), Esquiva (DES), Aparar (contra corpo a corpo: sucesso → contra-ataque + atordoa; falha → dano extra).
- **Ações gerais**: Avançar, Recuar, Chutar/Empurrar, Executar (inimigo caído/atordoado/moribundo: morte brutal, −Pavor seu, −moral deles), Itens, Trocar arma, Fugir.
- **Estados**: Sangrando, Atordoado, Caído, Cego, Queimando, Envenenado, Infectado, Aterrorizado, Enredado, Exausto, Furioso, Untado (óleo), etc.
- **Moral**: humanos e feras fogem ou se rendem (render-se → poupar ou executar: consequências). Fogo assusta feras. Mortos-vivos não têm moral, mas causam Pavor.
- **Terreno/ambiente**: escuridão (−precisão, +Pavor), lama, tochas, corpos no chão (Fosseiros comem para curar).
- **Companheiro** (opcional): age na linha do tempo com ordem (Atacar / Proteger / Segurar).

Inimigos importantes exigem abordagens diferentes: armadura de placas pede impacto; enxames pedem varredura/fogo; carniçais pedem matar rápido antes que comam os corpos; sacerdotes reerguem mortos (mate-o primeiro ou destrua os corpos); arqueiros fogem do engajamento.

## 6. Expedição

- Região = **mapa de nós persistente na campanha** (layout gerado uma vez por campanha; conteúdo se renova a cada expedição conforme a Chaga). Nós descobertos ficam no mapa para os herdeiros.
- Mover entre nós custa **horas**. Relógio de 24h: noite = inimigos piores, mais Pavor, mais Icor.
- **Luz** (horas de tocha). Sem luz: emboscadas, Pavor por hora, não enxerga tipos de nós.
- **Fome**: 1 ração a cada 12h; sem comer: −regeneração, depois perda de Vida.
- **Peso**: acima da capacidade, viagens mais lentas e −Fôlego.
- Tipos de nó: Combate, Evento, Ruína (loot + armadilha), Acampamento, Santuário, Mercador errante, Ninho (elite; destruir reduz Chaga), Carcaça (herdeiros mortos), Passagem (atalho para a cidade), Chefe, Entrada.
- **Acampar**: recupera Vida/Pavor, custa ração e horas; risco de emboscada (fogo/vigia/lugar). Opções: vigiar, tratar feridas, rezar, cozinhar.
- Voltar: andar até a Entrada ou uma Passagem aberta. Morrer: o loot fica no cadáver.

### Regiões
1. **Campos de Cinza** — vilarejos queimados, saqueadores, cães da Chaga, camponeses ocos. Chefe: **Mãe-Colheita** (espantalho de cadáveres costurados).
2. **Floresta dos Enforcados** — mortos pendurados que caem do alto, lobos de tendão, bruxas da casca. Chefe: **O Rei Galhado**.
3. **Catacumbas de Sal** — esqueletos de placas, carniçais, sacerdotes renegados da Sutura. Chefe: **O Bispo Costurado**.
4. **Vel-Maren, a Cidade Afogada** — afogados que explodem, pescadores de homens, cantos que enlouquecem. Chefe: **A Voz Submersa**.
5. **O Cadáver** — dentro da carne do deus. Chefe final: **O Coração**.

## 7. Cidade, tempo e facções

- **Chaga** começa em 10 e sobe +1/dia (+ eventos). Cercos em 30/60/90: a horda ataca a Muralha (você pode lutar). Falhar = distrito perdido (serviço fechado). Chaga 100 = Valdrem cai (fim da campanha).
- Reduzir a Chaga: matar chefes (−12), destruir ninhos (−3), ofertar Icor à Sutura, certos contratos.
- **Serviços**: Ferreiro, Barbeiro-cirurgião, Boticário, Templo da Sutura, Quartel da Guarda, Guilda dos Carniceiros, Taverna (sequazes, boatos), Antro dos Bebedores (oculto), Casa (linhagem, baú), Muralha.
- Ações na cidade custam tempo; dormir passa o dia; eventos diários com escolhas.
- **Facções** (−100..100): **Igreja da Sutura** (costurar o deus de volta), **Coroa/Guarda Cinzenta** (queimar tudo, lei marcial), **Guilda dos Carniceiros** (lucro), **Bebedores** (beber o deus). Reputação muda preços, serviços, missões e finais; agradar uma irrita outras.

## 8. História e finais

Cada chefe regional deixa um **Fragmento** do deus (Olho, Língua, Mão, Ventre). Entregar a uma facção = grande reputação e avanço da linha de missões dela; guardar = poder relíquia com Corrupção.
No Coração, os finais disponíveis dependem de reputação e fragmentos: **Sutura** (o deus costurado desperta), **Coroa** (fogo e cinza), **Guilda** (vender o coração, êxodo), **Bebedores** (você bebe o deus), **Enterro** (final próprio, exige sacrifício). Derrota: Valdrem cai.

## 9. Morte e linhagem

Morreu: escolha 1 de 3 herdeiros (origem/traços aleatórios, herdam a relíquia da casa). Cidade, facções, mapa e Chaga continuam. O cadáver vira nó **Carcaça** com o equipamento que levava; se morreu por Corrupção, o cadáver é uma **Aberração** elite. Cada morte custa +3 Chaga (moral da cidade) e −1 em algo da casa.

## 10. Salvamento

Autosave em todo ponto relevante (após cada ação de combate, cada nó, cada ação na cidade) + `visibilitychange/pagehide`. Um slot de campanha (estilo ferro), com backup automático. Exportar/importar save.
