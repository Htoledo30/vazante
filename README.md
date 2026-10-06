# ICOR — O Deus Apodrecido

RPG de **dark fantasy brutal** para iPhone, jogado no navegador e instalável como app (PWA). Sem anúncios, sem servidor, sem dependências: JavaScript puro, funciona offline.

> Há trinta anos um deus caiu do céu. Seu cadáver, do tamanho de uma cordilheira, apodrece no Ermo. Do corpo escorre o **Icor**: sangue divino que dá força a quem bebe e transforma quem bebe demais. A podridão que se espalha chama-se **a Chaga**. Quando ela chegar a 100, **Valdrem**, a última cidade murada, cai.
>
> Você é de uma casa decadente de **Carniceiros**: saqueadores que entram no Ermo para colher o sangue do deus.

**Jogar agora:** https://htoledo30.github.io/vazante/ (abra no Safari do iPhone → Compartilhar → Adicionar à Tela de Início).

**Conteúdo adulto:** violência explícita, mutilação, horror corporal, fanatismo religioso.

---

## Conceito

Três camadas que se alimentam:

| Camada | O que é | O que você decide |
|---|---|---|
| **Campanha** | Cidade, quatro facções, relógio do apocalipse (Chaga), história com finais | Quem apoiar, o que fazer com cada frasco de Icor, quando arriscar |
| **Expedição** | Mapa de nós persistente, luz e comida que acabam, combate tático por partes do corpo | Avançar ou voltar, lutar ou fugir, o que carregar |
| **Linhagem** | Morte permanente do personagem; o herdeiro continua | Recuperar o cadáver (talvez transformado em monstro), qual herdeiro escolher |

Pilares: **cada ferida é uma decisão** (decepar o braço do inimigo cancela os golpes dele; quebrar sua perna o impede de fugir — e o mesmo vale para você), **o Icor é tudo e cobra tudo** (dinheiro, experiência, oferenda e veneno), **o tempo é o inimigo** (todo descanso custa dias, a Chaga não espera), **a morte é um capítulo** e **informação é poder** (inimigos anunciam intenções).

## Como jogar

Tudo é por **toque**, com uma mão:

- **Rodapé (dock):** as ações principais ficam ao alcance do polegar.
- **Botões mostram custo e chance** antes de você escolher: Fôlego, tempo, % de acerto, dano estimado, % de sucesso de testes.
- **Botão apagado** ainda responde: tocar mostra o motivo (ex.: "sem Fôlego", "braço decepado").
- **"?" dourado** abre a regra daquele assunto. Na primeira vez que algo aparece, uma dica curta explica.
- **Menu (☰) no topo:** Continuar, Diário, Facções, Ajuda, Configurações, Salvar e sair.
- Sem gestos obrigatórios, sem teclado (exceto para colar um backup).

Primeira campanha, em 30 segundos:

1. **Nova campanha** → introdução → crie seu Carniceiro (nome, origem, atributos).
2. Em **Valdrem**: compre rações e tochas, veja contratos.
3. Saia pelo **Portão**. No mapa, toque num nó para ver o custo e vá.
4. Lute mirando partes do corpo. Leia as intenções. Execute quem cair.
5. Volte antes que a tocha apague. Venda, beba ou oferte o Icor.
6. Morreu? Escolha um herdeiro. Seu cadáver espera no Ermo.

O codex completo está em **Como jogar** (título ou menu).

## Sistemas

- **Atributos** FOR, DES, VIG, VON, AST (1–10). Testes: `chance = 35 + atributo×8 + bônus − dificuldade` (5–95%), sempre visível.
- **Recursos:** Vida, Fôlego (combate), Pavor (0–100: Abalado, Aterrorizado, Colapso), Corrupção (0–100: mutação a cada 25, transformação em 100), moedas, frascos de Icor.
- **Combate** em linha do tempo (ações rápidas agem mais vezes), distância 0/1/2, intenções inimigas, mira por parte do corpo (cabeça, tronco, braços, pernas e partes especiais), defesas (Guarda, Esquiva, Aparar), execuções, moral (fuga/rendição), escuridão, terreno.
- **Feridas** por tipo de dano (corte, perfuração, impacto, fogo/Icor): sangramento, fraturas, concussão, olho perdido, membro decepado, infecção → necrose → amputação, próteses.
- **Progressão:** nível bebendo Icor (+Corrupção), Dádivas, maestria por classe de arma (técnicas novas), traços, mutações, equipamento com qualidade, durabilidade e unção.
- **Expedição:** cinco regiões, mapa persistente, luz, fome, peso, noite, acampamento, ninhos, carcaças, passagens, chefes.
- **Cidade:** ferreiro, barbeiro-cirurgião, boticário, templo, quartel, guilda, taverna, antro oculto, casa (baú, melhorias), muralha. Eventos diários. Cercos em Chaga 30/60/90.
- **Facções:** Sutura, Coroa, Guilda, Bebedores — reputação, missões, fragmentos do deus, seis finais no Coração (mais a queda de Valdrem e a extinção da casa).
- **Linhagem:** herdeiros, relíquia da casa, cadáveres no mapa, Aberrações.

Detalhes de design: [`docs/DESIGN.md`](docs/DESIGN.md). Contratos entre módulos: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Comandos

Requer **Node.js 20+**. O jogo em si não tem dependências; o Playwright só é usado no teste ponta a ponta.

```bash
npm install                 # instala o Playwright (só para npm run test:e2e)
npx playwright install webkit   # uma vez, se o WebKit ainda não estiver instalado

npm run dev                 # serve game/ em http://localhost:8080/icor/ (sem build)
npm run build               # gera dist/ (ícones se faltarem, versão por hash, cache offline, .nojekyll)
npm run preview             # serve dist/ em http://localhost:8081/icor/ (igual ao GitHub Pages)
npm test                    # todos os testes Node (tests/*.test.mjs) com resumo
npm run test:e2e            # WebKit com perfil de iPhone 13: build, subpasta /icor/, offline, atualização
npm run test:e2e:dev        # mesmo teste servindo game/ direto
npm run check               # verificador de integração: imports, exports, telas, Math.random
npm run icons               # regenera os ícones em game/icons
```

Outros:

- `node tests/run-all.mjs combate` roda só os testes cujo nome contém "combate"; `--verbose` mostra tudo.
- `node tests/e2e.mjs --headed` abre a janela; screenshots e relatório JSON ficam em `tests/shots/`.
- `node tools/serve.mjs <pasta> <porta> <prefixo>` serve qualquer pasta (porta `0` = livre). Mostra também o endereço na rede local.

> No celular pela rede local (`http://192.168…`) o jogo roda, mas o modo offline/instalação exige **https** (ou localhost). Para testar a instalação no iPhone, publique no GitHub Pages.

## Publicação no GitHub Pages

O repositório já inclui o workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml): a cada push na `main` ele roda os testes, faz o build e publica `dist/`.

1. Crie o repositório no GitHub e faça push da `main`.
2. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Aguarde a aba **Actions** terminar ("Publicar ICOR"). O endereço aparece no resumo: `https://<usuario>.github.io/<repositorio>/`.

Todos os caminhos são relativos: o jogo funciona em subpasta sem configuração.

**Alternativa sem Actions (branch):** `npm run build`, depois publique o conteúdo de `dist/` numa branch `gh-pages` e escolha **Settings → Pages → Source: Deploy from a branch → gh-pages / (root)**:

```bash
npm run build
cd dist && git init -b gh-pages && git add -A && git commit -m "Publicar ICOR"
git push -f https://github.com/<usuario>/<repositorio>.git gh-pages
cd .. && rm -rf dist/.git
```

## Instalar no iPhone

1. Abra o endereço publicado no **Safari** (outros navegadores do iPhone não instalam de forma confiável).
2. Toque em **Compartilhar** (quadrado com seta para cima).
3. **Adicionar à Tela de Início** (role a lista; se não aparecer, "Editar Ações").
4. Mantenha **"Abrir como App da Web"** ligado (iOS 17+) e toque em **Adicionar**.
5. Abra pelo **ícone** (o olho dourado). Tela cheia, sem barra do navegador, funciona offline.

A tela **Instalar no iPhone** do jogo repete esses passos e detecta quando você já está no modo app.

> O Safari e o app instalado guardam saves **separados**. Se já jogou no navegador: **Backup → Copiar** no Safari, depois **Backup → Importar** dentro do app.

## Salvamento, fracasso e continuidade

- **Salva sozinho** em todo ponto relevante (cada ação de combate, cada nó, cada ação na cidade, cada escolha de evento) e quando o app vai para segundo plano ou é fechado.
- **Um slot de campanha**, estilo "modo ferro": não há como recarregar para desfazer uma escolha. O save tem verificação de integridade e uma cópia de reserva automática (se o principal corromper, a reserva é usada).
- **Continuar** retoma exatamente onde parou: no meio do combate, no evento, no saque, no mapa, na escolha de herdeiro.
- **Morte do personagem** não encerra a campanha: escolha um herdeiro; cidade, facções, mapa e Chaga continuam; o cadáver vira um nó no mapa com o equipamento (ou uma Aberração, se morreu por Corrupção).
- **Fim da campanha:** Chaga em 100 (Valdrem cai), casa extinta ou um dos finais no Coração do deus. Depois, **Nova campanha**.
- **Backup manual:** Título → Backup → Copiar (texto começando com `ICOR1:`). Guarde em Notas ou e-mail. Importar substitui a campanha do aparelho.
- **Proteção do iPhone:** instalado na Tela de Início, o iOS não apaga os dados por falta de uso. No Safari comum, dados de sites podem ser limpos após dias sem uso — instale ou faça backups.
- **Atualizações:** uma versão nova baixa em segundo plano e **espera**. O título mostra "Nova versão pronta"; ela só é aplicada no título, depois de salvar. Se você adiar três vezes, aplica sozinha na próxima vez que abrir o título. Nunca no meio de um combate.

## Estrutura de pastas

```
game/                       o jogo (servível direto, sem build)
  index.html  manifest.webmanifest  sw.js  icons/
  css/        base.css + uma folha por área (shell, character, combat, expedition, city, events)
  js/
    main.js                 inicialização (carrega cada área isoladamente)
    core/                   estado G, RNG determinístico, utilidades, barramento, save
    systems/                regras puras (testáveis em Node): personagem, combate, expedição, cidade, eventos...
    data/                   conteúdo: itens, inimigos, regiões, eventos, facções, história...
    ui/                     app (roteador, modais), dom (componentes), hud, help, audio
      screens/              telas de cada área (shell, character, combat, expedition, city, event)
tools/
  serve.mjs                 servidor estático com prefixo de subpasta
  build.mjs                 build de produção -> dist/
  gen-sw.mjs                versão por hash + lista do cache offline no sw.js
  gen-icons.mjs             ícones PNG gerados por código (sem dependências)
  check.mjs                 verificador de integração entre módulos
tests/
  run-all.mjs               roda tests/*.test.mjs
  *.test.mjs                testes Node por área
  e2e.mjs                   Playwright WebKit (iPhone 13), subpasta /icor/
docs/
  DESIGN.md  ARCHITECTURE.md  notes/<área>.md
.github/workflows/pages.yml publicação automática
```

## Validação

Executado no Windows 11 com Node 20+ e Playwright **WebKit** (motor do Safari) com o perfil **iPhone 13** (390×844, toque, DPR 3). **Não foi testado num iPhone físico** — ver Limitações.

| Verificação | Comando | Resultado |
|---|---|---|
| Integração estática (imports/exports, telas, ids de dados, sem `Math.random` na lógica) | `npm run check` | 0 erros, 0 avisos |
| Testes de lógica (combate, eventos, expedição, shell/save) | `npm test` | 4/4 arquivos passam |
| Ponta a ponta no **build** servido em subpasta `/icor/` | `npm run test:e2e` | 22 PASS · 0 FAIL · 0 SKIP |
| Todas as telas/abas com estado preparado (cidade, 6 abas da ficha, nível, mutação, 9 serviços e suas abas, mapa, facções, diário, cerco, Coração, final, herdeiros) | `node tests/screens.mjs` | 49 telas, 0 erros de página, sem rolagem horizontal, botões ≥ 35 px |
| Bot que joga pela interface (toques reais: criação → cidade → expedições → combates → morte → herdeiro) | `node tests/playthrough.mjs 350 <seed>` | seeds 3, 4 e 5: 0 erros; mortes, herdeiros e retorno à cidade funcionando |
| Balanceamento (bot "jogador médio", 40 lutas por encontro) | `node tests/sim-balance.mjs` | comuns da região 1: 88–100% de vitória com 41–85% de vida restante; chefe Mãe-Colheita: ~38% sem preparo |

O e2e cobre: carregamento em subpasta, metas iOS (viewport-fit, apple-touch-icon, standalone), manifest e ícones, service worker no escopo certo, botões ≥ 44 px, ajuda/configurações/backup/instalar, nova campanha → intro → criação → cidade, menu de pausa → "Salvar e sair", recarregar e **Continuar** no mesmo ponto, backup `ICOR1:`, **offline** após o primeiro carregamento (servidor derrubado), **atualização segura** (nova versão espera e é aplicada no título preservando a campanha), nenhum 404, nenhum erro de console.

Os testes Node cobrem: todos os 41 inimigos lutam até o fim sem travar, salvar/restaurar no meio da luta, itens e troca de arma em combate, formato de todos os 166 eventos + bot jogando 400 eventos, mapas determinísticos e conexos, bot jogando campanhas inteiras pelos sistemas (expedições, mortes, herdeiros, cadáveres), escolha da tela de retomada (combate, saque, herdeiros, final…), backup exportar → importar, atualização automática após 3 adiamentos, manifest/metas iOS/caminhos relativos, service worker (cache primeiro e offline) e o build.

Publicação conferida: o workflow "Publicar ICOR" do GitHub Actions passou (testes + build) e o endereço publicado foi aberto no WebKit com perfil de iPhone 13 — título carrega, service worker ativo no escopo `/vazante/`, Nova campanha abre a introdução, sem erros de console.

Screenshots: `tests/shots/` (e2e) e `tests/shots/screens/` (todas as telas).

## Limitações conhecidas

- **Não testado em iPhone físico.** A validação usa o WebKit do Playwright com o perfil do iPhone 13; diferenças reais do Safari no iOS (teclado virtual, gestos do sistema, áudio após bloqueio da tela) podem aparecer.
- No iPhone, páginas web não vibram (`navigator.vibrate` não existe no Safari); a opção de vibração vale para Android.
- A chave de silêncio do iPhone também silencia o jogo (proposital). O áudio só liga depois do primeiro toque (regra do iOS).
- Arte mínima: ícones/emoji e tipografia; o foco é mecânica e texto. Sons são sintetizados (Web Audio), sem trilha gravada.
- Balanceamento ajustado por simulação, não por jogadores: chefes são feitos para exigir preparo (Icor, unções, técnicas, consumíveis); um personagem nível 1 sem preparo perde a maioria das vezes.
- O Playwright/WebKit no Windows não simula "offline" com service worker via `setOffline`; o teste e2e corta a rede derrubando o servidor.
- Save só no aparelho (sem nuvem), um slot; use Backup para levar a campanha a outro aparelho. Safari e app instalado têm saves separados.
