# ICOR — Arquitetura e Contratos

Leia junto com `docs/DESIGN.md`. Este documento é o **contrato** entre módulos. Se o código de outro módulo já existir, leia-o e conforme-se a ele; se divergir deste documento, registre a divergência em `docs/notes/<sua-area>.md` (nunca edite arquivos de outra área).

## Regras gerais

- **Vanilla JS, ES modules**, sem build obrigatório. `game/` é servível diretamente. Sem dependências em runtime. Caminhos SEMPRE relativos (`./`, `../`) — o jogo roda em subpasta do GitHub Pages (`/icor/`).
- **Texto do jogo em português do Brasil**, curto, seco, adulto, dark fantasy brutal. Identificadores de código em inglês ou português sem acento; ids de dados `snake_case` ASCII.
- **Estado global `G`** (`core/state.js`) é JSON puro. Nada de funções/Map/Set/classes dentro de G. Todo estado que precisa sobreviver ao app ser fechado vai em G (inclusive combate em andamento, evento em andamento, saque pendente).
- **Salvar**: chame `save()` (`core/save.js`) depois de cada mudança relevante (ação de combate, chegada em nó, ação na cidade, escolha de evento). `flow.*` já salva.
- **Aleatoriedade**: use `R` (`core/rng.js`), cujo estado vive em `G.rng` (determinístico e persistido). Para geração com seed fixa use `makeRng(seed)`. Nunca `Math.random()` em lógica de jogo.
- **Lógica separada da UI**: `systems/*` e `data/*` não tocam no DOM (testáveis em Node). `ui/*` lê G, chama sistemas, redesenha.
- **Toque**: tudo por botões ≥ 44px. Nada de hover, teclado, gestos obrigatórios. Mostre custo (tempo/Fôlego/itens) e chance (%) nos botões (`button(label, fn, {sub})`). Ações inválidas: botão desabilitado com `why`.
- **Ajuda contextual**: use `helpButton(topic)` / `hintOnce(topic)` de `ui/help.js`.
- **Sons**: `sfx(name)` de `core/bus.js` (nomes na seção Áudio). **Toast**: `toast(text, kind)`.
- **Sem TODOs em funcionalidades essenciais.** Nada de botão sem implementação.
- Arquivos grandes são OK, mas divida por responsabilidade (ex.: `systems/combat/engine.js`, `ai.js`, `damage.js`).

## Árvore e donos

```
game/
  index.html  manifest.webmanifest  sw.js  icons/           [F shell]
  css/base.css                                              [núcleo — já existe]
  css/shell.css css/character.css css/combat.css css/expedition.css css/city.css css/events.css  [cada área a sua]
  js/main.js                                                [núcleo/F]
  js/core/{state,rng,util,bus,save}.js                      [núcleo — já existe; F pode corrigir save.js]
  js/systems/flow.js                                        [núcleo — já existe]
  js/ui/{app,dom}.js                                        [núcleo — já existe]
  js/ui/help.js js/ui/audio.js js/ui/screens/shell.js       [F]
  js/ui/hud.js js/ui/screens/character.js                   [A]
  js/ui/screens/combat.js                                   [B]
  js/ui/screens/expedition.js                               [C]
  js/ui/screens/city.js                                     [D]
  js/ui/screens/event.js                                    [E]
  js/data/{items,backgrounds,talents,mutations,traits,wounds}.js   [A]
  js/data/{techniques,statuses,enemies,companions}.js + js/data/enemies/*.js   [B]
  js/data/regions.js js/data/encounters.js                  [C]
  js/data/{city,factions,story,contracts}.js                [D]
  js/data/events/*.js                                       [E]
  js/systems/{character,items,wounds,effects,checks,loot,names}.js   [A]
  js/systems/combat/*.js                                    [B]
  js/systems/{expedition,mapgen,camp}.js                    [C]
  js/systems/{time,city,factions,lineage,campaign,siege,contracts}.js [D]
  js/systems/events.js                                      [E]
tests/                                                      [cada área: tests/<area>.test.mjs; F: run-all.mjs, e2e.mjs]
tools/                                                      [F]
docs/notes/<area>.md                                        [cada área]
```

Cada `ui/screens/<area>.js` exporta `default` = array de definições de tela e, opcionalmente, `export function init()` (registrar ganchos `flow.setHook`, etc.). `main.js` importa todos.

## Núcleo (já implementado)

- `core/state.js`: `getG()`, `setG(g)`, `newCampaign({seed, houseName})` — **ver a forma de G no arquivo** (tempo, chaga, campaign, city, factions, lineage, hero, world, expedition, combat, event, log).
- `core/rng.js`: `R.float() R.int(a,b) R.chance(pct) R.pick(arr) R.weighted([[v,w]...]) R.shuffle(arr) R.dice(n,m) R.range([min,max])`; `makeRng(seed)` mesma API; `hashSeed(str)`.
- `core/util.js`: `clamp sum clone byId sign pct cap plural uid(prefix) timeOf(hours)->{day,hour} isNightHour fmtHour esc`.
- `core/bus.js`: `on emit toast(text,kind) sfx(name)`; eventos `render`, `toast`, `sfx`, `log`, `saved`, `error`.
- `core/save.js`: `save() load() hasSave() wipe() exportSave() importSave(str) loadMeta() saveMeta(m) loadSettings() saveSettings(s)`.
- `ui/dom.js`: `h(sel, props, ...kids)`, `button(label, onClick, {kind, sub, disabled, why, icon, badge, sound})`, `bar(v,max,kind,label)`, `chip(text, kind, title)`, `section(title,...)`, `kv(k,v,kind)`, `prose(text)`, `grid(kids, cols)`, `tabs(list, active, onPick)`, `haptic()`, `clear(el)`.
- `ui/app.js`: `registerScreen(def) go(id, params, {replace}) back() refresh() modal({...}) sheet({...}) confirmBox(text, opts)->Promise<bool> toastMsg(text, kind) reportError(e) setHud(fn) currentScreen()`. Tela: `{ id, hud?:bool, render({main, dock, params, refresh}), onEnter?, onExit? }`. Ações principais vão no `dock` (rodapé ao alcance do polegar).
- `systems/flow.js`: `setHook(name, fn)`, `combatEnded(outcome)`, `eventEnded(info)`, `lootDone()`, `heroDied(cause, info)`, `heroCreated()`, `campaignEnded(type, info)`.

CSS: use as classes de `css/base.css` (`.btn .btn-primary .btn-blood .btn-danger .btn-ghost .btn-small .btn-wide .btn-left .panel .panel-title .chip .chip-bad/good/warn/info/rot/blood/corr .bar .bar-hp/stam/dread/corr/light/chaga/xp .kv .prose .grid .grid-2 .grid-3 .tabs .row .stack .muted .small .mono .t-good/bad/warn/ichor/rot/blood/dread/corr .fx-shake .fx-hit .dock-row`). Variáveis de cor em `:root`. Prefixe classes novas da sua área (`.cb-` combate, `.ex-` expedição, `.ct-` cidade, `.ch-` personagem, `.ev-` eventos, `.sh-` shell).

---

## Vocabulário canônico

### Atributos
`for` Força, `des` Destreza, `vig` Vigor, `von` Vontade, `ast` Astúcia.

### Partes do corpo (herói e humanoides)
`cabeca`, `tronco`, `bracoD` (braço da arma), `bracoE` (braço do escudo), `pernas`. Inimigos podem ter partes próprias (ex.: `asas`, `saco_bile`, `lanterna`, `galhada`, `tentaculo`).

### Tipos de dano
`corte`, `perf` (perfuração), `impacto`, `fogo`, `icor`.

### Classes de arma
| id | mãos | perfil |
|---|---|---|
| `espada` | 1 | corte/perf equilibrada, boa para aparar |
| `machado` | 1 | corte pesado, decepa, quebra escudos |
| `maca` | 1 | impacto, fratura, atordoa, boa contra placas |
| `lanca` | 1-2 | perf, alcance 1, mantém distância |
| `adaga` | 1 | rápida, sangramento, golpes baixos, arremesso, execução |
| `cutelo` | 1 | corte de açougueiro, desmembra, lento-ish |
| `montante` | 2 | corte, varredura (todos engajados), executor |
| `martelo` | 2 | impacto devastador, lento, derruba |
| `mangual` | 1 | impacto que ignora escudo/bloqueio |
| `foice` | 2 | corte em arco, alcance 1, colheita (bônus em feridos) |
| `besta` | 2 | perf à distância, precisa recarregar |
| `desarmado` | — | soco/chute, agarrar (padrão sem arma) |
| `gancho` | — | prótese de braço: corte/perf, puxa inimigos |

Mão secundária (`off`): `escudo` (bloqueio), `tocha` (luz + fogo + assusta feras), arma de 1 mão leve (adaga/espada curta: ataque secundário), ou vazio. Arma de 2 mãos ocupa `main` e bloqueia `off`.

### Atributos de escala
Armas escalam com letras por atributo: `scale: { for: 'B', des: 'D' }`. Bônus de dano = atributo × coef (`S` 1.6, `A` 1.3, `B` 1.0, `C` 0.7, `D` 0.4, `E` 0.2).

### Qualidade
`q`: 0 Enferrujado (−20%), 1 Comum, 2 Bom (+15%), 3 Obra-prima (+30%). Afeta dano/armadura/durabilidade e preço.

### Ids canônicos de itens (A DEVE definir todos; outros módulos podem referenciá-los)
- **Materiais**: `sucata`, `couro`, `osso`, `tendao`, `pano`, `sebo`, `ervas`, `polvora`, `sal`, `bile`, `ferro_negro`, `lasca_divina`, `carne_podre`, `cabelo_bruxa`, `dente`.
- **Consumíveis**: `racao`, `tocha`, `bandagem`, `tala`, `aguardente`, `unguento`, `tonico`, `oleo`, `veneno`, `bomba`, `bomba_cal`, `sal_bento`, `sanguessuga`, `elixir_icor`, `ferro_quente`, `papoula`, `agua_benta`, `faca_arremesso`, `virote` (munição de besta).
- **Armas base (pelo menos)**: `faca`, `adaga`, `espada_curta`, `espada_longa`, `machadinha`, `machado_guerra`, `cutelo`, `porrete`, `maca`, `lanca`, `montante`, `martelo_guerra`, `mangual`, `foice`, `besta`, `gancho_protese`. (+ variantes/únicas por região)
- **Armaduras base**: `capuz`, `elmo_ferro`, `elmo_fechado`, `gibao`, `couraca_couro`, `cota_malha`, `peitoral_placas`, `luvas_couro`, `bracais_ferro`, `calcas_couro`, `grevas_ferro`. **Mão secundária**: `escudo_madeira`, `escudo_ferro`, `broquel`, `tocha_mao` (tocha empunhada).
- **Amuletos**: `amuleto_*` (vários). **Chaves/quest**: `chave_*`, `fragmento_olho`, `fragmento_lingua`, `fragmento_mao`, `fragmento_ventre`, `tomo_*` (ensina técnica).
- **Tokens de saque** (resolvidos por `loot.js`): `@weapon:T`, `@armor:T`, `@offhand:T`, `@trinket:T`, `@consumable:T`, `@material:T`, `@any:T` (T = tier 1..5 ≈ região).

### Ids canônicos de inimigos (B define; C/E/D referenciam)
- r1 Campos de Cinza: `saqueador`, `besteiro`, `cao_chaga`, `lavrador_oco`, `corvos`, `ceifeiro` (elite), chefe `mae_colheita`.
- r2 Floresta dos Enforcados: `enforcado`, `lobo_tendao`, `bruxa_casca`, `cacador_cabecas`, `tecela`, `cervo_podre` (elite), chefe `rei_galhado`.
- r3 Catacumbas de Sal: `esqueleto_placas`, `carnical`, `sacerdote_renegado`, `verme_ossos`, `costurado`, `guardiao_sal` (elite), chefe `bispo_costurado`.
- r4 Vel-Maren: `afogado`, `pescador`, `sereia_carcaca`, `caranguejo_ossario`, `enguia_icor`, `cavaleiro_mare` (elite), chefe `voz_submersa`.
- r5 O Cadáver: `anticorpo`, `filho_icor`, `verme_divino`, `bebedor_ascendido`, `anjo_carne` (elite), chefe `coracao`.
- Humanos/genéricos: `desertor`, `zelote`, `bebedor`, `cacador_bruxas`, `carniceiro_rival`, `aberracao` (herdeiro corrompido — escala com o morto), `horda_oco` (cerco).
Na Onda 1, B implementa **r1 completo + humanos genéricos + `mae_colheita`**; os demais entram na Onda 2 com o mesmo formato.

### Regiões
`r1` Campos de Cinza, `r2` Floresta dos Enforcados, `r3` Catacumbas de Sal, `r4` Vel-Maren, `r5` O Cadáver.

### Facções
`sutura` (Igreja da Sutura), `coroa` (Coroa / Guarda Cinzenta), `guilda` (Guilda dos Carniceiros), `bebedores` (Bebedores de Icor).

### Serviços da cidade (D)
`ferreiro`, `barbeiro`, `boticario`, `templo`, `quartel`, `guilda`, `taverna`, `antro` (Bebedores, oculto), `casa`, `muralha`, `portao` (sair em expedição).

### Sons (`sfx(name)`)
`tap deny hit hit_heavy crit sever block parry miss death enemy_death heal coin ichor step door fire camp levelup dread corrupt bell siege win lose scream bone squelch whisper`.

### Tópicos de ajuda (`helpButton(id)`)
`inicio combate partes intencoes folego defesas moral pavor corrupcao feridas icor nivel maestria expedicao luz fome peso acampar cidade chaga faccoes linhagem testes itens qualidade uncao contratos cerco`.

---

## Modificadores (`mods`) — chaves canônicas

Talentos, traços, mutações, feridas, itens e amuletos declaram `mods: { chave: número }`. `derive()` (A) soma tudo em `D.mods`. Consumidores leem `D.mods.<chave> || 0`.

| chave | efeito | quem consome |
|---|---|---|
| `for des vig von ast` | +atributo | A (derive) |
| `hpMax` `hpMaxPct` `staminaMax` `staminaRegen` `carry` | recursos | A |
| `acc` `eva` `crit` `speed` | precisão, esquiva, crítico (pontos %), velocidade (% mais rápido) | A→B |
| `armor_all` | +armadura em todas as partes | A |
| `dmg_all dmg_corte dmg_perf dmg_impacto dmg_fogo dmg_icor` | % de dano causado | B |
| `sever` `fracture` `bleed` | % chance de decepar / fraturar / potência de sangramento causado | B |
| `parry` `block` `riposte` `dodge` | % bônus de aparar, bloqueio, dano de contra-ataque, esquiva ativa | B |
| `execute` | % dano/efeito de execução | B |
| `dreadResist corrResist bleedResist infectResist fireResist poisonResist` | % de redução | A/B/C |
| `dread_on_kill dread_on_execute hp_on_kill hp_on_execute` | variação ao matar/executar | B |
| `regen lifesteal` | PV por turno / % de dano roubado | B |
| `first_strike` | começa o combate adiantado na linha do tempo (pontos de tempo) | B |
| `intent` | +nível de detalhe das intenções inimigas | A/B |
| `unarmed` | % dano desarmado | B |
| `night_acc dark` | reduz penalidade noturna / de escuridão | B/C |
| `light_eff food_eff` | % duração de tocha / eficiência de ração | C |
| `ambush` `travel` `stealth` `scout` | −% emboscada, −% tempo de viagem, furtividade, revelar nós | C |
| `loot ichor_find` | % saque, % Icor encontrado | A/B/C |
| `price` | −% preço em lojas | D |
| `heal_rate camp_heal` | % cura de feridas, % cura ao acampar | A/C |
| `check_for check_des check_vig check_von check_ast` | bônus em testes | A |

---

## Área A — Personagem, Itens, Efeitos

### Herói (`G.hero`)
```js
{
  uid, name, gen,              // geração na linhagem
  bg: 'desertor',              // origem (BACKGROUNDS)
  attrs: { for, des, vig, von, ast },
  level: 1, ichorDrunk: 0,
  talents: [], traits: [], mutations: [],
  hp, dread: 0, corruption: 0,
  wounds: [ { uid, id, part, days, infected:false, treated:false } ],  // id em WOUNDS; days=-1 permanente
  prosthetics: { bracoD: null|'gancho', bracoE: null|'gancho', pernas: null|'perna_pau', cabeca: null|'olho_vidro' },
  mastery: { espada: 0, ... },  // usos acumulados por classe de arma
  techniques: [],              // técnicas extras aprendidas (ids em data/techniques.js)
  equip: { main:null, off:null, cabeca:null, tronco:null, bracos:null, pernas:null, amuleto1:null, amuleto2:null },  // instâncias
  inv: [],                     // instâncias
  coin: 0, ichor: 0,           // moedas e frascos de Icor carregados
  companion: null,             // ver B (companions)
  hunger: 0,                   // horas desde a última refeição (C usa)
  stats: { kills:0, executions:0, severed:0, expeditions:0, daysAlive:0 },
  flags: {},
}
```
### Item: definição (`ITEMS[id]`) e instância
```js
// definição
{ id, name, type: 'weapon'|'armor'|'offhand'|'consumable'|'material'|'trinket'|'key'|'ammo'|'tome',
  weight, value, tier: 1..5, desc, rarity?: 'comum'|'raro'|'unico',
  // weapon
  cls, hands: 1|2, dmg:[min,max], dtype, scale:{for:'B',des:'D'}, time: 100, stam: 2, reach: 0|1, ranged?: true,
  crit: 5, props: ['sangra','decepa','atordoa','fura','alcance','arremesso','recarga','varredura','quebra_escudo','ignora_bloqueio','apara','pesada','silenciosa'],
  // armor
  slot: 'cabeca'|'tronco'|'bracos'|'pernas', armor: { corte, perf, impacto, fogo }, heavy: 0..3,
  // offhand
  kind: 'shield'|'torch'|'weapon', block?: 0..80, stamBlock?: n, light?: true,
  // consumable
  use: { field: bool, combat: bool, time?: n (tempo de combate), effects: [efeitos], combat?: 'id_especial' },
  // trinket
  mods: { ... }, 
  dur?: durabilidade máxima (armas/armaduras)
}
// instância
{ uid, id, q: 0..3, dur, n: 1 (pilha), ench: null|'id_uncao', mods?: {...}, name?: 'nome único' }
```
`armor` de uma peça se aplica: `cabeca`→cabeca; `tronco`→tronco; `bracos`→bracoD e bracoE; `pernas`→pernas.

### APIs (A)
```js
// systems/character.js
createHero({ name, bg, attrs, gen=1 }) -> hero           // equipa kit da origem, hp cheio
rollHeir(G, rng) -> { name, bg, attrs, traits }          // candidato aleatório (D usa na linhagem)
derive(hero) -> D                                         // puro; ver abaixo
levelUpCost(hero) -> { ichor, corruption }
canLevelUp(hero) -> bool
levelUp(hero, attr, talentId) -> lines                    // gasta Icor, aplica corrupção, +1 atributo, talento
talentChoices(hero, rng) -> [talentId x3]
addDread(G, n, why) -> { lines, collapse:bool }           // aplica resistência; trata Colapso fora de combate
addCorruption(G, n, why) -> { lines, mutationPending:bool, transformed:bool }   // 100 = flow.heroDied('Transformação', {corrupted:true})
mutationChoices(hero, rng) -> [mutationId x2]; applyMutation(hero, id)
heal(hero, n); damageHero(G, n, why) -> { died:bool }     // fora de combate
// D = derive(hero)
{ attrs:{for,des,vig,von,ast} (efetivos), hpMax, staminaMax, staminaRegen, carryMax, load, overloaded,
  acc, eva, crit, speed, armor:{ cabeca:{corte,perf,impacto,fogo}, tronco, bracoD, bracoE, pernas },
  dreadResist, corrResist, bleedResist, infectResist,
  checkBonus:{for,des,vig,von,ast}, intentDetail: 0|1|2,
  canTwoHand, canShield, canFlee, lostParts:['bracoE',...],
  weapon:{ inst, def, cls, hands, dmg:[min,max] (já com qualidade e escala), dtype, time, stam, reach, ranged, crit, props },
  offhand:{ inst, def, kind:'shield'|'torch'|'weapon'|'none', block, stamBlock, light },
  mods: { ...todas as chaves somadas }, tags: [strings] }

// systems/items.js
makeItem(id, { q=1, n=1 }) -> inst; itemDef(instOrId) -> def; itemName(inst) -> string (inclui qualidade/unção)
addItem(hero, inst) -> { ok, reason } (respeita pilhas; peso pode exceder: overloaded)
removeItem(hero, id, n=1) -> bool; countItem(hero, id) -> n; hasItem(hero, id, n=1)
equip(hero, uid) -> { ok, reason } ; unequip(hero, slot)
useItem(G, uid, { inCombat:false }) -> { ok, lines, pending }   // fora de combate (B trata uso em combate lendo def.use)
weightOf(inst); totalWeight(hero); itemValue(inst) -> moedas; repairCost(inst)
describeItem(inst) -> [linhas]  // para folhas de detalhe
degrade(inst, n)   // durabilidade; 0 = quebrado (dano/armadura pela metade)

// systems/wounds.js
inflictWound(G, { part, dtype, sev }) -> wound|null       // sev 1 leve, 2 grave, 3 mutilante; aplica perdas permanentes
tickWounds(G, hours) -> lines                              // cura natural, sangramento fora de combate, infecção→necrose→amputação
treatWound(G, woundUid, method: 'bandagem'|'tala'|'ferro_quente'|'cirurgia'|'amputar'|'protese') -> lines
woundMods(hero) -> mods  (usado por derive)
describeWound(w) -> { name, effect, days }

// systems/checks.js
checkChance(G, { attr, diff=0, bonus=0 }) -> pct      // fórmula do DESIGN; usa D.checkBonus e traços
rollCheck(G, check) -> { ok, roll, chance, crit: roll<=chance/5, fumble: roll>95 }
diffLabel(diff) -> 'Fácil'|'Média'|'Difícil'|'Brutal'

// systems/effects.js  (linguagem comum de efeitos — eventos, itens, cidade, contratos)
applyEffects(G, effects, ctx={}) -> { lines:[{text, kind}], pending:[...] }
checkCond(G, cond) -> bool ; describeCond(cond) -> string ; describeEffects(effects) -> string (curto, ex.: "+20 moedas, -1 ração")

// systems/loot.js
rollLoot(G, table, { tier, bonus }) -> { items:[inst], coin, ichor }   // table: [[idOrToken, weight, nMin?, nMax?], ...] + campos coin:[a,b], ichor:[a,b], rolls
randomItem(G, { type, cls, tier, slot }) -> inst
shopStock(G, serviceId, tier) -> [inst]   // D usa nas lojas

// systems/names.js
randomName(rng, sex?) ; houseName(rng) ; npcName(rng)
```
### Linguagem de efeitos (ops)
```js
{ op:'hp', n }                  // +cura / −dano (pode matar -> pending death)
{ op:'dread', n } { op:'corruption', n }
{ op:'coin', n } { op:'ichor', n }
{ op:'item', id, n=1, q? }      // dar item (id ou token '@weapon:2')
{ op:'take', id, n=1 }          // remover item
{ op:'loot', table, tier }      // rola tabela de saque -> vai para G.pendingLoot (tela de saque)
{ op:'wound', part?, dtype, sev }   // part omitido = aleatório
{ op:'healWounds', n? }         // cura n feridas leves (ou todas)
{ op:'trait', id } { op:'untrait', id } { op:'mutation', id? }
{ op:'rep', f, n }              // facção
{ op:'chaga', n, why? }
{ op:'time', h }                // avança horas (chama time.advanceTime de D)
{ op:'light', h } { op:'food', n }   // expedição: horas de luz / rações (C)
{ op:'flag', k, v=true } { op:'count', k, n=1 }
{ op:'combat', enemies:[ids|{id,dist,elite}], ambush?:'enemy'|'hero', boss?:bool, onWin?:[efeitos], onFlee?:[efeitos], text? }   // pending
{ op:'event', id }              // encadeia evento (pending)
{ op:'reveal', n }              // revela n nós do mapa (C)
{ op:'mastery', cls, n } { op:'learn', id }   // técnica
{ op:'companion', id } { op:'loseCompanion' }
{ op:'unlock', k }              // G.city.unlocked[k] = true
{ op:'journal', text }          // diário
{ op:'log', text, kind }
{ op:'random', table:[ { w, effects:[...], text? } ] }
{ op:'kill', cause }            // morte do herói (pending death)
{ op:'stamina', n }             // só em combate (B)
{ op:'attr', a, n }             // altera atributo permanentemente
{ op:'heal', n }                // alias de hp positivo
{ op:'questStep', f, step }     // avança missão de facção (D)
{ op:'fragment', id, to }       // fragmentos do deus (D)
{ op:'siegeDefense', n }        // muralha (D)
```
`pending` (retornado por applyEffects): `{type:'combat', spec}`, `{type:'event', id}`, `{type:'death', cause}`, `{type:'loot'}`.

### Condições
```js
{ has:'id', n? } { attr:'for', min } { flag:'k', eq? } { notFlag:'k' } { rep:{ f, min?, max? } } { coin:n } { ichor:n }
{ trait:'id' } { notTrait:'id' } { bg:'id' } { corruption:{min?,max?} } { dread:{min?,max?} } { partOk:'bracoD' }
{ chaga:{min?,max?} } { day:{min?,max?} } { region:'r2' } { night:true } { companion:true } { level:{min} }
{ boss:'r1' } { service:'antro' } { any:[...] } { all:[...] } { not:{...} }
```
### Testes
`{ attr:'for', diff: 0|20|40|60, bonus? }` — chance mostrada no botão. Origem/traço podem dar opções exclusivas (`cond: {bg:'acougueiro'}`).

### Telas (A) — `ui/screens/character.js`
`create` (criação: nome, origem, distribuir pontos, resumo da build; ao concluir: `G.hero = createHero(...)`, `flow.heroCreated()`), `sheet` (abas: Status, Equipamento, Mochila, Corpo/Feridas, Dádivas/Mutações/Traços, Maestria), `levelup` (atributo + escolher dádiva + aviso de corrupção), `mutation` (escolher 1 de 2 quando pendente), `loot` (lê `G.pendingLoot = {items, coin, ichor, source, title}`; pegar/deixar tudo por peso; `flow.lootDone()`), folha de item (equipar/usar/descartar/comparar).
`ui/hud.js`: `renderHud(el, screenId)` — barras compactas Vida/Pavor/Corrupção, Icor/moedas, dia/hora, Chaga, Luz/rações quando em expedição, botão Menu (abre menu de pausa F: `import('./screens/shell.js').then(m=>m.openPauseMenu())`) e botão Ficha (go('sheet')).

---

## Área B — Combate

### Estado `G.combat` (JSON puro, salvo a cada ação)
```js
{ id, round, time, log:[{text, kind}],
  actors: [ { uid, side:'hero'|'ally'|'enemy', def:'saqueador', name, hp, hpMax, stamina, staminaMax, next /*tempo da próxima ação*/,
              dist /* 0..2 (inimigos/aliados relativos ao herói) */, parts:{ id:{ hp, max, armor:{...}, state:'ok'|'ferido'|'destruido'|'decepado' } },
              statuses:[{ id, turns, stacks, src }], intent:{ id, target, part, windup, label, est:[min,max] } | null,
              morale, flags:{} } ],
  context: { source:'expedition'|'siege'|'event'|'city', nodeId?, region, onWin?:[efeitos], onFlee?:[efeitos], boss?:bool, canFlee:true },
  env: { dark:bool, night:bool, terrain:[...], corpses:n },
  result: null|'win'|'lose'|'fled', rewards?: {...} }
```
### APIs (B) — `systems/combat/index.js` reexporta
```js
startCombat(G, spec)          // spec: { enemies:[id|{id,dist,elite,level}], region, ambush, dark, night, boss, canFlee, context:{source,...}, onWin, onFlee }
heroActions(G) -> [ { id, label, sub, cost:{stam,time}, disabled, why, target:'enemy'|'part'|'none'|'self', kind } ]
targetsFor(G, actionId) -> [ { uid, name, dist, valid, why, parts:[{id, name, hit%, est:[min,max], state}] } ]
act(G, { action, target?, part?, item? }) -> { events:[...] }   // executa ação do herói e avança IAs até a próxima vez do herói ou fim
previewHit(G, actionId, targetUid, partId) -> { hit, est:[min,max], crit, sever, notes:[] }
finishCombat(G) -> { result, loot... }   // aplica recompensas (ichor/moedas ao herói, itens -> G.pendingLoot{source}), maestria, bestiário; G.combat=null; chama flow.combatEnded(outcome)
```
Herói morre → `flow.heroDied(causa, { region, nodeId, killer })` (não navega sozinho).
Feridas no herói → `inflictWound` (A). Pavor/Corrupção no herói → `addDread`/`addCorruption` (A). Itens consumíveis em combate: leia `def.use.combat`.

### Dados (B)
- `data/techniques.js`: `TECHNIQUES[id] = { id, name, cls|'geral', mastery: 0..3, stam, time (mult ou absoluto), dmgMult, dtype?, hitMod, partBias?, effects:[...], desc, target }`, `CLASS_TECHNIQUES[cls]` (lista por nível de maestria), `MASTERY_THRESHOLDS = [0, 12, 35, 80]`.
- `data/statuses.js`: `STATUSES[id] = { id, name, kind:'bad'|'good', desc, ... }`.
- `data/enemies/*.js` + `data/enemies.js` (agrega e exporta `ENEMIES`): `{ id, name, region, tier, hp, armor por parte, parts:{...}, speed, morale, dread (aura), behavior/AI, intents:[...], loot:[[id,peso]...], coin, ichor, xp?, tags:['fera','humano','morto','chaga','enxame','chefe'], weak:[], desc (curta, brutal) }`.
- `data/companions.js`: sequazes contratáveis (cão de guerra, mercenário, penitente, batedora...).
- Tela `combat` (ui/screens/combat.js): linha do tempo, inimigos com distância/intenção/partes, painel do herói (Vida, Fôlego, Pavor, estados, feridas), ações no dock, seleção de alvo/parte com % e dano estimado, registro de combate, tela de resultado.

## Área C — Expedição

- `data/regions.js`: `REGIONS[id] = { id, name, tier, travelHours (da cidade), desc, nodeCount, enemies (pesos por tipo), events tags, bossId, nestEnemy, unlock: {boss:'r1'} | null, dark?: bool, palette }`.
- `data/encounters.js`: `ENCOUNTERS[region] = [ { id, enemies:[...], w, minChaga?, night? } ]` usando ids canônicos de inimigos.
- `systems/mapgen.js`: `genRegionMap(seed, regionId) -> { nodes:{ id:{ id, x, y, type, depth, links:[ids] } }, entry, boss }` (determinístico, persistido em `G.world.regions[id].map`).
- `systems/expedition.js`: `ensureRegion(G, id)`, `startExpedition(G, regionId)` (viagem custa horas; luz/rações vêm do inventário: item `tocha` acende; `racao` consumida a cada 12h), `availableMoves(G)`, `moveTo(G, nodeId)` (custo de horas, luz, fome, emboscada → chegada resolve nó: combate/evento/ruína/acampamento/santuário/mercador/ninho/carcaça/passagem/chefe), `campAt(G, opts)`, `returnToCity(G)`, `expeditionLog`. Registra ganchos `combatEnd:expedition`, `eventEnd:expedition`, `eventEnd:camp`, `lootDone:expedition`.
- `G.expedition = { region, node, path:[], light /*horas*/, torchLit:bool, hoursOut, cleared:{nodeId:true}, log:[], pendingNode?, ambushRisk }`. Nós e descobertas persistem em `G.world.regions[id]` (`discovered`, `nests`, `carcasses`, `shortcuts`).
- Telas: `map` (mapa SVG/DOM tocável com nós revelados, legenda, info do nó selecionado, custo de mover), `camp`, `travel` (resumo da viagem/partida com checklist de suprimentos), tela de nó especial (ruína, santuário, mercador, carcaça).
- Escuridão/noite/luz/fome/peso conforme DESIGN. Usa `advanceTime` (D) para o relógio global.

## Área D — Cidade, Campanha, Facções, Linhagem

- `systems/time.js`: `advanceTime(G, hours, { where:'city'|'field' }) -> lines` — avança `G.time`, a cada novo dia: Chaga +1 (+modificadores), `tickWounds` (A), contagem de dias vivos, gatilhos de cerco (30/60/90 → `G.campaign.pendingSiege`), Chaga ≥ 100 → `flow.campaignEnded('fall')`. Também `day(G)`, `hour(G)`, `isNight(G)`, `addChaga(G, n, why)`.
- `systems/city.js` (serviços, lojas com `shopStock`, preços com reputação/`price`, cura de feridas no barbeiro, ritos no templo, venda de Icor, contratos, taverna/sequazes, casa/baú/melhorias, muralha), `systems/factions.js` (reputação, efeitos cruzados, missões de facção), `systems/contracts.js`, `systems/siege.js` (cerco: combate na muralha via `startCombat` com `context.source='siege'` ou resolução por defesa), `systems/lineage.js` (gancho `heroDeath`: registra morto, carcaça em `G.world.regions[r].carcasses`, Chaga +3, gera 3 herdeiros com `rollHeir`; tela `heirs`), `systems/campaign.js` (intro, atos, fragmentos, finais, gancho `heroCreated`, `campaignEnd`).
- `data/city.js`, `data/factions.js`, `data/story.js` (intro, marcos, finais), `data/contracts.js`.
- Telas: `intro`, `city` (hub com distritos/serviços e eventos do dia), uma tela por serviço (`svc` com params `{id}` ou telas próprias), `heirs`, `ending`, `journal`, `factions`.
- Eventos diários da cidade usam o motor de eventos (E) com `source:'daily'` e pool `city`.

## Área E — Eventos

- `systems/events.js`:
```js
pickEvent(G, { pool:'field'|'city'|'camp'|'ruin'|'shrine'|'night', region, tags }) -> id|null   // respeita once, cond, peso, cooldown (G.campaign.flags)
startEvent(G, id, ctx={source}) -> void   // G.event = { id, ctx, stage:'choose', result:null }
eventView(G) -> { title, text, options:[{ idx, label, sub, disabled, why, kind }] }   // sub mostra chance% e custos
choose(G, idx) -> { text, lines, pending }   // aplica efeitos; G.event.stage='result'
finishEvent(G)   // processa pending: combate (startCombat com context.source = ctx.source e onWin), evento encadeado, morte; senão flow.eventEnded({source})
```
- Formato do evento:
```js
{ id, pool:'field'|'city'|'camp'|'ruin'|'shrine'|'night', region:['r1']|'any', tags:[], w:1, once?:bool, cond?:{...}, cooldown?:dias,
  title, text,
  options: [ { label, cond?, hideIfNot?:bool, cost?:[efeitos sempre aplicados], check?:{attr,diff},
               success:{ text, effects:[...] }, fail?:{ text, effects:[...] } } ] }   // sem check: usa success
```
- Conteúdo: muitos eventos curtos com escolhas reais (risco, custo, recompensa, consequência), opções exclusivas por origem/traço/item/facção, cadeias. Brutal e adulto, sem excesso de texto.
- Tela `event`.

## Área F — Shell, PWA, Ajuda, Áudio, Ferramentas, Testes

- `ui/screens/shell.js`: `title` (Continuar / Nova campanha / Configurações / Como jogar / Instalar no iPhone / Exportar-Importar save / Créditos), menu de pausa `openPauseMenu()` (Salvar e voltar ao título, Configurações, Ajuda, Diário), `settings` (som, volume, vibração, confirmações, apagar campanha), `help` (codex com todos os tópicos), `install` (instruções Safari → Compartilhar → Adicionar à Tela de Início; detectar standalone).
- `ui/help.js`: `HELP[topic] = { title, body }`, `showHelp(topic)`, `helpButton(topic)` (botão "?" pequeno), `hintOnce(topic)` (mostra na primeira vez; guarda em settings.seenHelp).
- `ui/audio.js`: WebAudio sintetizado (sem arquivos), inicia após primeiro toque, `on('sfx')`, ambiente opcional (drone), mudo/volume.
- PWA: `manifest.webmanifest`, `sw.js` (cache versionado, atualização segura: nova versão espera e aplica no título/menu), `icons/` (gerados por `tools/gen-icons.mjs`), metadados iOS, áreas seguras, `visibilitychange`/`pagehide` → `save()`, retorno ao app, viewport dinâmica.
- `tools/`: `serve.mjs`, `build.mjs`, `gen-sw.mjs`, `gen-icons.mjs`. `.github/workflows/pages.yml`.
- `tests/run-all.mjs` (roda `tests/*.test.mjs` em Node com DOM nenhum), `tests/e2e.mjs` (Playwright **WebKit** com dispositivo iPhone, servidor em subpasta `/icor/`).
