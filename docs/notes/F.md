# Notas — Área F (shell, PWA, ajuda, áudio, ferramentas, testes)

## Arquivos
- `game/js/ui/screens/shell.js` — telas `title`, `settings`, `help`, `install`, `backup`, `credits`; `openPauseMenu()`; `init()`.
- `game/js/ui/help.js` — codex (`HELP`), `showHelp`, `helpButton`, `hintOnce`.
- `game/js/ui/audio.js` — WebAudio sintetizado (29 sons do contrato + ambiente).
- `game/css/shell.css` — prefixo `.sh-`.
- `game/manifest.webmanifest`, `game/sw.js`, `game/icons/*` (gerados), `game/index.html` (revisado).
- `tools/serve.mjs`, `tools/build.mjs`, `tools/gen-sw.mjs`, `tools/gen-icons.mjs`, `tools/check.mjs` (novo).
- `tests/run-all.mjs`, `tests/e2e.mjs`, `tests/shell.test.mjs`.
- `README.md`, `.github/workflows/pages.yml`, `package.json`, `.gitignore`.

## APIs reais

### ui/help.js
```js
HELP[topic] = { group, title, body, tip?, see?:[topics] }   // 28 tópicos do contrato (inicio … cerco)
HELP_GROUPS, topicsByGroup(), helpBody(topic) -> Node
showHelp(topic) -> Promise<sheet>      // folha com o tópico + "Veja também" + "Codex completo"
helpButton(topic, { label? }) -> <button class="sh-help-btn">  // 36×36, não propaga o clique para o pai
hintOnce(topic, { text?, delay? }) -> bool   // true se vai mostrar; marca settings.seenHelp[topic]; respeita settings.hints
hintSeen(topic) -> bool ; resetHints()
```
Uso típico: `section('Fôlego', helpButton('folego'), ...)`; no `render()` da tela: `hintOnce('combate')` (seguro chamar em todo render — só mostra uma vez; fila se houver várias).

### ui/audio.js
```js
initAudio(settings)            // liga ao barramento on('sfx') e ao primeiro toque (iOS)
unlockAudio() suspendAudio() resumeAudio()
configureAudio({ sound, music, volume })
playSfx(name) -> bool          // normalmente via sfx(name) do core/bus.js
playAmbient(kind|null) stopAmbient() ambientForScreen(screenId, G) -> kind
SFX_NAMES, AMBIENT_KINDS, audioState()
```
Sons: todos os do contrato. Apelidos aceitos: `blood gore→squelch, hurt→hit, kill→enemy_death, level→levelup, torch→fire, gold→coin, error→deny, break→bone, drink→ichor, pray→bell, horror→dread, flee/move→step`.
Ambiente automático pela tela (observa `#app[data-screen]`): title/intro/credits→`title`, city→`city`, expedição de dia→`field`, sem luz ou noite→`dark`, r5→`corpse`, combate→`combat` / `boss` (context.boss) / `siege` (context.source='siege'), event→`event`/`dark`, ending→`corpse`.

### ui/screens/shell.js
```js
default: [title, settings, help, install, backup, credits]   // todas hud:false
init()                       // ciclo de vida, viewport, áudio, SW, window.__ICOR__ (debug/e2e)
openPauseMenu()              // Continuar, Diário*, Facções*, Ficha*, Como jogar, Configurações, Som, Salvar e sair  (*se a tela existir)
resumeTarget(G, hasScreen)   // ended→ending · heirs(+hero morto/ausente)→heirs · combat→combat · event→event · pendingLoot→loot
                             // · hero.pendingMutation|hero.flags.mutationPending→mutation · sem herói→create · expedition→map (camp se expedition.camping) · city
campaignSummary(G)
confirmRisky(text, opts)     // confirmBox que respeita Configurações → "Confirmar ações perigosas"; opts.always força
continueCampaign() startNewCampaign()
updateStatus() checkForUpdate({quiet}) applyUpdate({auto})
getSettings() setSetting(k, v) applySettings(s)
wrapBackup(raw) unwrapBackup(text)   // formato "ICOR1:" + exportSave()
```
Configurações (em `icor.settings`): `sound music volume haptics confirmDanger seenHelp` (núcleo) + `hints textSize(0..2) reduceMotion updateSkips` (F).

### Navegação usada pelo shell
- Nova campanha: `newCampaign({})` → `save()` → `go('intro')` (fallback `create`). A casa/nome é decidida pela intro (D: `setHouse`).
- Menu: `go('journal')`, `go('factions')`, `go('sheet')` só aparecem se a tela existir (`hasScreen`).
- Telas do shell voltam com `back('title')`.

## Atualização segura (SW)
- `game/sw.js` tem `VERSION = 'dev'` (rede primeiro, cópia offline). O build roda `genSW(dist)`: VERSION = hash do conteúdo, ASSETS = todos os arquivos. **Não rodar gen-sw em game/** (a fonte fica em modo dev).
- Produção: cache-first da versão; navegação offline cai na casca (`./`). Install é tudo-ou-nada.
- Nova versão instala e espera. O título mostra "Nova versão pronta" + "Atualizar agora" (salva → SKIP_WAITING → reload no `controllerchange`). Menu de pausa avisa e oferece "Salvar, sair e atualizar". Cada vez que o jogador entra no jogo (Continuar/Nova campanha) com versão pendente conta um adiamento; com 3, aplica sozinho na próxima vez que o título abrir.
- Página pergunta a versão ao SW (`GET_VERSION`) e cai para `version.txt` (gerado no build).

## Ciclo de vida iOS
- `visibilitychange(hidden)`/`pagehide`/`beforeunload` → `save()` (se houver G) e suspende áudio; ao voltar: retoma áudio, recalcula viewport, `refresh()`, busca atualização (a cada 30 min).
- `--vh`, `--app-h`, `--kb` no `:root` (visualViewport). Com teclado aberto em campo de texto, `#app.sh-kb-open` (altura = viewport visível, dock oculto). Ao sair do campo, `scrollTo(0,0)` (bug de deslocamento do iOS).
- Zoom bloqueado: `touch-action: manipulation`, `gesturestart` e multitoque com preventDefault, `user-scalable=no`; campos com fonte ≥ 16px (evita zoom ao focar).

## Correções no núcleo (permitidas à F)
1. `main.js`: áreas importadas **dinamicamente e isoladas** (`Promise.allSettled`). Uma área quebrada não derruba o jogo; HUD reserva com botão Menu se `ui/hud.js` faltar; relatório em `window.__ICOR_BOOT__ = { loaded, failed }`. Mesma interface: `default` + `init()` por área.
2. `ui/app.js` `back()`: agora chama `onExit()` da tela atual (antes era pulado porque `cur = null` vinha antes de `go`).
3. `ui/dom.js`: `haptic()` respeita Configurações → Vibração; novo export `setHapticsEnabled(bool)` (assinaturas antigas intactas).

## Ferramentas
- `npm run check` (`tools/check.mjs`): sintaxe de todos os módulos, imports relativos existentes, **nomes importados existem no alvo**, `go('id')` para telas inexistentes, `Math.random` em systems/data, CSS ausente. Use para integrar as áreas.
- `tools/serve.mjs`: `startServer({root, port, prefix})` exportado; porta 0 = livre; prefixo padrão `/icor/`.
- `tools/build.mjs`: `build({ out })` exportado (o e2e usa uma pasta temporária).

## Testes
- `tests/shell.test.mjs` (23 casos): tópicos do contrato, textos curtos, números do DESIGN, hintOnce, sons do contrato, ambiente, telas exportadas, resumeTarget (+fallbacks), resumo, backup ida-e-volta com acentos, auto-update, confirmRisky, manifest + PNGs, index.html, gen-sw determinístico, **sw.js executado num escopo falso** (install, cache-first offline, fallback de navegação, GET_VERSION, SKIP_WAITING, limpeza de caches), sw dev, servidor, build, parser do check.
- `tests/e2e.mjs`: ver cabeçalho. Helpers: `tap(texto)`, `waitScreen(id)`, `advanceTo(ids)` (avança tocando o botão principal do dock e preenchendo inputs), `dismissLayers()`, `layoutIssues()` (rolagem horizontal + botões < 44px, `.btn-small`/`.sh-help-btn`/`.tab` ≥ 36px).

## Pendências de integração
- **A (hud.js)**: incluir botão "☰ Menu" com `import('./screens/shell.js').then(m => m.openPauseMenu())` (o e2e procura `header.hud button` com "Menu" ou "☰").
- **A**: se a mutação pendente usar outro campo que não `hero.pendingMutation`/`hero.flags.mutationPending`, avisar (resumeTarget).
- **C**: se o acampamento for tela própria, `G.expedition.camping = true` faz Continuar abrir `camp`.
- **D**: intro deve levar a `create`; `heirs`, `ending`, `journal`, `factions` são usados pelo shell.
- **Todos**: usar `confirmRisky()` (shell.js) em ações perigosas (fugir, amputar, beber Icor, vender relíquia) para respeitar a configuração; usar `helpButton(topic)`/`hintOnce(topic)` com os tópicos do contrato.
- Integrador: completar as seções "Validação" e "Limitações" do README.

## Estado do e2e (no momento da entrega da F)
14 PASS · 3 FAIL · 5 SKIP. FAILs = módulos/CSS de outras áreas ainda inexistentes (404) e os erros de console decorrentes. SKIPs = fluxo intro→criação→cidade, menu de pausa em jogo e retomada (dependem de A/D). PASS: título, metas iOS, manifest, ícones, SW no escopo /icor/, layout (sem rolagem horizontal, botões ≥ 44px), telas do shell, configurações persistem, backup, **offline**, **atualização segura v1→v2**.
