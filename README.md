# ai-tutor

Ferramentas do método de aprendizado com IA do Matheus. O objetivo do método é aprender mais, em menos tempo, sem copiar e colar o que a IA gera.

Por enquanto, o plugin `tutor` faz uma coisa só: pede aprovação antes de cada edição num plano do Claude Code. Sem isso, o modo de planejamento altera o arquivo do plano sem perguntar, e fica difícil conferir se cada comentário entrou da forma certa.

## Instalar

Em cada computador, rode no terminal:

```bash
claude plugin marketplace add MatheusKubrusly/ai-tutor
claude plugin install tutor@ai-tutor
```

Depois, abra uma sessão nova do Claude Code.

## Onde o fluxo vale

| Onde | Como |
|---|---|
| Computadores (VS Code, terminal) | Plugin: hook e comparação |
| Celular, tablet ou navegador, pelo Remote Control | Sessão local: plugin e pedido de aprovação. Exige o computador ligado e o `claude` rodando |
| Claude Code na nuvem (celular) | Sem plugin: regra do núcleo |
| claude.ai, ChatGPT, Gemini | Regra do núcleo |

Regra do núcleo: mostrar o antigo e o novo antes de gravar e esperar a resposta. Não há trava da ferramenta.
