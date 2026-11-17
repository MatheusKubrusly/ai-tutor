#!/usr/bin/env node
// Provisório, só para a implementação acelerada: reserva o plano do método e a árvore de
// cenários à sessão principal ("ai-tutor · sessão principal"), como pede o núcleo provisório
// ("Várias sessões na mesma pasta"). As outras sessões propõem as mudanças por comentário na issue.
// Sai do plugin, junto com o bloco dele em hooks/hooks.json, quando o Matheus declarar o
// método implementado.
// É chamado pelo Claude Code antes de Edit, Write e Bash (hooks/hooks.json).

import { readFileSync, statSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';

const SESSAO_PRINCIPAL = 'ai-tutor · sessão principal';
const NOMES = ['plano-do-metodo.md', 'cenarios-de-interacao.md'];
const RESERVADOS = /[\\/]ai-tutor[\\/]docs[\\/](plano-do-metodo|cenarios-de-interacao)\.md$/;

// Corpo de um heredoc (do fim da linha com <<MARCA até a linha MARCA): ali o texto não é comando
const HEREDOC = /(<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\2)([^\n]*)\n[\s\S]*?\n[ \t]*\3[ \t]*(?=\n|$)/g;

// Pedaços de um comando: texto entre aspas duplas ou simples, redirecionamento (>, 2>&1, <<),
// separador de comandos (&&, ||, ;, |, &, quebra de linha, parênteses) ou palavra solta
const PEDACO = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\d*[<>]+&?\d*|&>>?)|(&&|\|\||[;|&\n()])|([^\s"';|&()<>]+)/g;

function nomeDaSessao(arquivoDaConversa) {
  let nome = '';
  try {
    for (const linha of readFileSync(arquivoDaConversa, 'utf8').split('\n')) {
      if (!linha.includes('"custom-title"')) continue;
      try {
        const registro = JSON.parse(linha);
        if (registro.type === 'custom-title' && typeof registro.customTitle === 'string') nome = registro.customTitle;
      } catch {
        // Linha incompleta: segue para a próxima
      }
    }
  } catch {
    // Conversa ilegível conta como sessão sem nome
  }
  return nome.trim();
}

function comandosSimples(comando) {
  const comandos = [[]];
  let pularProxima = false;
  for (const [, duplas, simples, redirecionamento, separador, solta] of comando.replace(HEREDOC, '$1$4').matchAll(PEDACO)) {
    if (separador) {
      comandos.push([]);
      pularProxima = false;
    } else if (redirecionamento) {
      pularProxima = !/&\d*$/.test(redirecionamento);
    } else if (pularProxima) {
      pularProxima = false;
    } else {
      comandos.at(-1).push(duplas ?? simples ?? solta);
    }
  }
  return comandos.filter((palavras) => palavras.length);
}

function ehPasta(caminho, escrito) {
  if (escrito.endsWith('/')) return true;
  try {
    return statSync(caminho).isDirectory();
  } catch {
    return false;
  }
}

// Devolve o trecho do comando que altera um arquivo reservado, ou null se nenhum altera
function trechoQueAltera(comando, pastaInicial, atinge) {
  let pasta = pastaInicial;
  const resolver = (alvo) => resolve(pasta, alvo.replace(/^~(?=\/|$)/, process.env.HOME ?? '~'));

  for (const palavras of comandosSimples(comando)) {
    const trecho = palavras.join(' ');
    let [programa, ...resto] = palavras;
    while (/^\w+=/.test(programa ?? '')) [programa, ...resto] = resto;
    if (programa === 'cd') {
      pasta = resolver(resto[0] ?? process.env.HOME ?? pasta);
      continue;
    }
    if (programa === 'git') {
      while (resto[0]?.startsWith('-')) {
        const opcao = resto.shift();
        const valor = opcao === '-C' || opcao === '-c' ? resto.shift() : null;
        if (opcao === '-C' && valor) pasta = resolver(valor);
      }
      programa = `git ${resto.shift() ?? ''}`;
    }

    const escritos = resto.filter((argumento) => !argumento.startsWith('-'));
    const caminhos = escritos.map(resolver);
    switch (programa) {
      case 'rm':
      case 'git rm':
      case 'git checkout':
      case 'git restore':
        if (caminhos.some(atinge)) return trecho;
        break;
      case 'cp':
      case 'mv':
      case 'git mv': {
        if (caminhos.length < 2) break;
        const destino = caminhos.at(-1);
        const origens = caminhos.slice(0, -1);
        const naPasta = ehPasta(destino, escritos.at(-1));
        if (RESERVADOS.test(destino) || (naPasta && origens.some((origem) => RESERVADOS.test(join(destino, basename(origem)))))) return trecho;
        if (programa !== 'cp' && origens.some(atinge)) return trecho;
        break;
      }
    }
  }
  return null;
}

function negar(oQue, nome) {
  const sessao = nome ? `se chama "${nome}"` : 'não tem nome (ou o arquivo da conversa não pôde ser lido)';
  const motivo =
    `${oQue}: só a sessão principal ("${SESSAO_PRINCIPAL}") altera o plano do método e a árvore de cenários ` +
    `(núcleo provisório, "Várias sessões na mesma pasta"). Esta sessão ${sessao}. Proponha a mudança por comentário na issue da tarefa.`;
  const resposta = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } };
  process.stdout.write(JSON.stringify(resposta));
  process.exit(0);
}

try {
  const dados = JSON.parse(readFileSync(0, 'utf8'));
  const pastaInicial = dados.cwd || process.cwd();
  const raiz = process.env.CLAUDE_PROJECT_DIR || pastaInicial;
  const doProjeto = NOMES.map((nome) => join(raiz, 'docs', nome)).filter((caminho) => RESERVADOS.test(caminho));
  const atinge = (caminho) =>
    RESERVADOS.test(caminho) || doProjeto.some((reservado) => reservado.startsWith(caminho.endsWith(sep) ? caminho : caminho + sep));

  let oQue = null;
  if (dados.tool_name === 'Bash') {
    const trecho = trechoQueAltera(dados.tool_input?.command ?? '', pastaInicial, atinge);
    if (trecho) oQue = `O comando \`${trecho}\` foi barrado`;
  } else {
    const arquivo = resolve(pastaInicial, dados.tool_input?.file_path ?? '');
    if (RESERVADOS.test(arquivo)) oQue = `A edição de ${arquivo} foi barrada`;
  }

  if (oQue) {
    const nome = nomeDaSessao(dados.transcript_path ?? '');
    if (nome !== SESSAO_PRINCIPAL) negar(oQue, nome);
  }
} catch {
  // Se a entrada do Claude Code não puder ser lida, não há o que conferir: segue o fluxo normal
}
process.exit(0);
