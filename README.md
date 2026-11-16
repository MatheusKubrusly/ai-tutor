# ai-tutor

Ferramentas do método de aprendizado com IA do Matheus. O objetivo do método é aprender mais, em menos tempo, sem copiar e colar o que a IA gera.

Por enquanto, o plugin `tutor` traz uma versão provisória do ambiente de trabalho do método, que vale em qualquer projeto:

- **Aprovação dos planos e das regras:** pede aprovação antes de cada edição num plano do Claude Code (`~/.claude/plans/`), no plano do método (`docs/plano-do-metodo.md`) e nas regras (`protocolo/`). Sem isso, o modo de planejamento e o modo automático gravam esses arquivos sem perguntar, e fica difícil conferir se cada comentário entrou da forma certa.
- **Bloqueio da edição por script:** barra os comandos de terminal que gravam em arquivos do projeto por fora das ferramentas de edição (por exemplo, `sed -i` ou `> arquivo`), para toda mudança aparecer na comparação. Para `cp`, `mv`, `patch` e `git apply` com destino no projeto, pede aprovação.
- **Registro do terminal:** grava cada comando que o Claude roda, com a saída, em `~/.claude/logs/terminal.log`.
- **Estilo de resposta "Aprendiz":** o Claude faz a tarefa ensinando (disseca cada comando novo, mostra um glossário antes de cada código e explica o porquê das escolhas). Vale sozinho enquanto o plugin estiver ligado.
- **Skill `/tutor:dissecar-comando`:** explica, parte por parte, um comando de terminal, sem rodá-lo.

As regras gerais de trabalho ficam em [`protocolo/nucleo-provisorio.md`](protocolo/nucleo-provisorio.md), que o `~/.claude/CLAUDE.md` de cada computador importa.

## Instalar

Em cada computador, rode no terminal:

```bash
claude plugin marketplace add MatheusKubrusly/ai-tutor
claude plugin install tutor@ai-tutor
```

Depois, abra uma sessão nova do Claude Code.

Para as regras gerais valerem também, crie o arquivo `~/.claude/CLAUDE.md` com a linha `@~/Repositories/ai-tutor/protocolo/nucleo-provisorio.md` (ajuste o caminho se o repositório estiver em outra pasta).

## Atualizar

Depois de uma mudança publicada neste repositório:

```bash
claude plugin marketplace update ai-tutor
claude plugin update tutor@ai-tutor
```

A versão nova vale na próxima sessão, ou depois de `/reload-plugins` numa sessão aberta.

## Acompanhar os comandos do Claude

Num terminal, rode `tail -f ~/.claude/logs/terminal.log`. O `tail` mostra o fim do arquivo, e o `-f` continua mostrando as linhas novas enquanto elas chegam. Para parar, `Ctrl+C`.

## Onde o fluxo vale

| Onde | Como |
|---|---|
| Computadores (VS Code, terminal) | Plugin: hook e comparação |
| Celular, tablet ou navegador, pelo Remote Control | Sessão local: plugin e pedido de aprovação. Exige o computador ligado, sem suspender, e o `claude` rodando; ao acordar, reconecta sozinho |
| Claude Code na nuvem (celular) | Sem plugin: regra do núcleo |
| claude.ai, ChatGPT, Gemini | Regra do núcleo |

Regra do núcleo: mostrar o antigo e o novo antes de gravar e esperar a resposta. Não há trava da ferramenta.
