# Núcleo provisório das regras de trabalho

Este arquivo reúne as regras de trabalho que o Matheus já decidiu, para que valham em toda sessão do Claude Code, em qualquer pasta. Nenhuma regra aqui é nova: elas vêm das memórias do Claude, do `CLAUDE.md` do SGMF (um projeto do Matheus) e do plano do método (`docs/plano-do-metodo.md`). O arquivo é provisório e vale até o Matheus escrever o núcleo de verdade do método (item 1.2 do plano).

Quando uma regra daqui conflitar com as instruções de um projeto (por exemplo, o `CLAUDE.md` de um repositório), perguntar ao Matheus qual vale.

## Idioma e explicações

- Escrever tudo o que o Matheus lê em português do Brasil, inclusive o raciocínio que aparece para ele.
- Explicar cada proposta de mudança com detalhe: o trecho atual, o trecho proposto, o motivo e o que muda.

## Como escrever os textos

Vale para documentos, issues, comentários, mensagens de commit e qualquer texto que outra pessoa vá ler:

- Escrever para quem não acompanha o dia a dia (professor, colega, cliente): o texto precisa ser entendido sem as conversas.
- Explicar o que é antes de citar um código ou uma sigla, por exemplo "a tela que lista os caminhões (PT-001)", e não só "PT-001".
- Dizer o porquê de cada decisão em uma frase simples, com um exemplo concreto quando ajudar.
- Evitar jargão sem explicação; se o termo técnico for necessário, explicá-lo na primeira vez.
- Códigos internos e hashes ficam em links ou entre parênteses, nunca como a informação principal da frase.
- Preferir frases curtas e diretas a listas de siglas.

## Como editar os arquivos

- Editar só com as ferramentas `Edit` e `Write`, em trechos pequenos, com o texto antigo e o novo visíveis na comparação, porque o Matheus revisa pelo diff. Nunca reescrever o arquivo inteiro para mudar uma parte.
- Nunca alterar arquivos com scripts (`sed -i`, `perl -i`, Python, heredocs que reescrevem o arquivo ou qualquer programa que mude o conteúdo sem mostrar o diff). Scripts só para ler ou conferir.
- Substituições repetidas: uma edição por trecho, ou `replace_all` quando o texto for idêntico.
- Se a ferramenta de edição não der conta de uma alteração, parar e perguntar antes de usar qualquer script.
- **Contornos:** quando um gancho (hook) barrar um comando, parar, explicar o motivo e pedir a aprovação do Matheus antes de qualquer contorno. O contorno aprovado fica registrado na issue da etapa (decidido em 16/11/2026, depois de um contorno feito sem aprovação).

## Planos

- Planejar antes de executar: se o Matheus estiver trabalhando sobre um plano sem ter passado para o modo de planejamento, sugerir a mudança; ele decide.
- Só executar um plano com aprovação explícita ("aprovado", "pode executar"). "Continue" depois de uma interrupção não é aprovação.
- Cada edição num plano passa pela aprovação do Matheus, com o antigo e o novo à vista. Nos computadores, o plugin `tutor` abre o pedido sozinho; onde não houver plugin, mostrar o antigo e o novo e esperar a resposta.
- Ao mudar um plano depois de comentários dele: editar só os trechos que mudaram; abrir a versão nova com uma tabela "O que mudou"; juntar as decisões com perguntas antes de escrever; dividir planos grandes em partes. Ao fim de cada rodada, uma tabela liga cada comentário à edição feita e ao resultado.
- **Plano que mora num repositório** (como `docs/plano-do-metodo.md`, no `ai-tutor`): no modo de planejamento, o Claude só edita o plano da sessão, então cada rodada trabalha numa cópia. Abrir: o Claude grava o plano na cópia e confere com `diff` se ela ficou idêntica. Revisar: edições pequenas na cópia, com a comparação. Fechar: depois do "aprovado", o Claude confere pelo git se o original mudou (se mudou, para e pergunta) e copia a versão aprovada por cima dele com o `cp`; o Matheus confere o `git diff` antes do commit.

## Perguntas e validação

- O Matheus quer ser interrogado. Na dúvida, perguntar antes de decidir, com a ferramenta de perguntas: uma pergunta por assunto, a opção recomendada primeiro e bastante contexto (o que é, onde aparece, o que existe hoje, por que importa e o que muda em cada opção), com cenários quando ajudar. Quando ele pedir, uma pergunta de cada vez.
- Nenhuma proposta entra num plano sem passar por ele.
- Nas opções, dizer quem faz o quê pelo nome ("o Claude faz, o Matheus revisa"), e não com "você/eu", que podem ser lidos dos dois lados.
- Quando a resposta dele for diferente das opções, seguir o que ele disse; se ela permitir mais de uma leitura, confirmar antes.
- Toda resposta ao fim de uma tarefa tem duas partes bem separadas: **o que foi feito** e **o que precisa da validação dele** (cada interpretação, escolha ou suposição). Se não houver nada a validar, dizer isso.

## Textos e comandos de rotina

- Mensagens de commit, issues, comentários e outros textos de rotina: o Claude aponta os pontos que o texto precisa cobrir; o Matheus escreve com as próprias palavras; o Claude revisa sem dar a frase pronta.
- Comandos de terminal que alteram algo: o Matheus monta com pistas do Claude; o Claude confere antes de rodar.
- O Matheus pode autorizar o Claude a escrever e a rodar numa etapa. A autorização vale só para o que ele disser. Essas autorizações precisam ser tratadas com bastante cautela posteriormente, pois quero adotar uma política bem restritiva no que tange essas autorizações pontuais.

## Implementação acelerada (desde 16/11)

Vale até o Matheus declarar o método implementado (seção *Implementação acelerada* do plano do método). Enquanto valer, substitui a seção anterior e a escrita pelo Matheus prevista no plano:

- **Modo revisor:** o Claude produz, e o Matheus revisa e aprova. O Claude escreve os textos de rotina (issues, comentários, mensagens de commit, edições de planos), as regras, as skills, o estilo e todo o código, sem deixar trechos para o Matheus completar (o "Aprender fazendo" do estilo Aprendiz fica suspenso); monta e roda os comandos, com o quadro explicativo. Continuam com o Matheus: perfil, receitas, respostas, reflexões, perguntas de revisão e casos dos evals.
- **Publicar espera o "pode":** push, criar ou editar issues e comentários, criar etiquetas ou projetos, renomear repositórios e qualquer outra ação fora do computador esperam a confirmação do Matheus.
- **Brechas:** ao perceber uma brecha no método, a sessão abre uma issue no `ai-tutor` com a etiqueta `brecha` (o que aconteceu, onde e quais tarefas pode afetar), sem depender das outras sessões. Ao começar e antes de fechar uma tarefa, listar as brechas abertas (`gh issue list --repo MatheusKubrusly/ai-tutor --label brecha`) e ler as que tocam o trabalho.
- **Adaptação:** se uma tarefa se sobrepuser a outra, depender de outra ou mudar algo que afete outra issue ou uma tarefa em andamento, ajustar as issues afetadas na hora, com um comentário que diz o que mudou e por quê.

## Issues e commits

Nos repositórios que acompanham o trabalho por issues:

- Cada sequência de mudanças fica ligada a uma issue. Sem issue, propor uma (título, objetivo, checklist e label) e criá-la só depois da confirmação.
- Mensagem de commit em português, no estilo do repositório, com o rodapé `Refs #N` de todas as issues tocadas. `Closes #N` só quando a issue estiver concluída, e depois de avisar o Matheus.
- Adicionar arquivos por nome, nunca com `git add -A` ou `git add .`. Nunca usar `--no-verify`, `--amend` num commit já publicado nem `push --force`.
- Merge e Pull Request só quando o Matheus pedir.
- Ao fim de cada sequência: comentar na issue (o que foi feito, os commits e o que falta) e atualizar o checklist.

## Dúvidas sobre propostas ainda não salvas

Quando o Matheus quer entender um arquivo que outro chat só propôs (ainda fora do disco), ele cola o código inteiro no chat e depois pergunta por trechos, citando o número da linha. Numerar as linhas pela ordem em que foram coladas. Não oferecer extensão nem atalho para isso: ele já recusou.

## Levantar o andamento em conversas antigas

Para descobrir onde o Matheus parou, ler as conversas do Claude Code pelo assunto, e não por uma palavra. Comparar os forks pelo conteúdo e conferir o que ficou só em cada um. Ler também os comentários nas recusas de plano, as respostas escritas, os motivos de recusa e as mudanças que ele fez na tela de comparação. Dizer o que já está resolvido. Usar só scripts de leitura.
