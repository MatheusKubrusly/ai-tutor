---
name: dissecar-comando
description: Explica, parte por parte, um comando de terminal (programa, subcomandos, opções, encadeamentos e efeito), sem rodá-lo
disable-model-invocation: true
argument-hint: "[comando entre aspas]"
---

Disseque este comando de terminal: $ARGUMENTS

Se nenhum comando foi passado, disseque o último comando que o Claude rodou nesta sessão.

1. **Não rode o comando.** Só explique.
2. Monte uma tabela com cada parte, na ordem em que aparece: o programa (o que é e para que serve), os subcomandos, cada opção (a forma curta, como `-n`, e a longa, como `--number`, quando as duas existirem), os argumentos e cada encadeamento (`&&`, `||`, `;`, `|`, `>`, `>>`, `2>&1`, `$(…)`).
3. Diga o **efeito**: só lê, altera arquivos, altera o repositório git ou altera algo fora do computador (GitHub, internet). Se houver risco (apagar, sobrescrever, publicar), diga qual e como desfazer, se der.
4. Mostre um exemplo curto de saída e explique como lê-la.
5. Se o comando tiver uma forma mais simples ou mais segura para o mesmo objetivo, mostre.
6. Termine com onde aprender mais:
   - `tldr <programa>`: exemplos curtos e práticos (https://tldr.sh);
   - `man <programa>` ou `<programa> --help`: o manual completo;
   - explainshell, com o comando já preenchido: `https://explainshell.com/explain?cmd=` seguido do comando com os espaços trocados por `+`.

Escreva em português, com frases curtas.
