#!/usr/bin/env node
// Provisório, só para a implementação acelerada: reserva o plano do método e a árvore de
// cenários à sessão principal ("ai-tutor · sessão principal"), como pede o núcleo provisório
// ("Várias sessões na mesma pasta"). As outras sessões propõem as mudanças por comentário na issue.
// Lê o comando antes de ele rodar e barra os casos conhecidos; a rede de proteção
// (rede-do-plano.mjs) pega o que passar por aqui.
// Sai do plugin, junto com o resto desta pasta e os blocos dela em hooks/hooks.json, quando o
// Matheus declarar o método implementado.
// É chamado pelo Claude Code antes de Edit, Write e Bash (hooks/hooks.json).

import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { ehReservado, nomeDaSessao, raizes, reservadosDe, SESSAO_PRINCIPAL } from './sessao-principal.mjs';

// Corpo de um heredoc (do fim da linha com <<MARCA até a linha MARCA): ali o texto não é comando
const HEREDOC = /(<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\2)([^\n]*)\n[\s\S]*?\n[ \t]*\3[ \t]*(?=\n|$)/g;

// Pedaços de um comando: texto entre aspas duplas ou simples, redirecionamento (>, 2>&1, <<),
// separador de comandos (&&, ||, ;, |, &, quebra de linha, parênteses) ou palavra solta
const PEDACO = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\d*[<>]+&?\d*|&>>?)|(&&|\|\||[;|&\n()])|([^\s"';|&()<>]+)/g;

// Programas que copiam ou movem: o destino é o último argumento ou o da opção -t
const COPIAM = new Set(['cp', 'mv', 'ln', 'install', 'rsync', 'git mv']);
const ACOES_DO_FIND = new Set(['-delete', '-exec', '-execdir', '-ok', '-okdir']);
// Limite para comandos dentro de comandos (bash -c 'eval "sh -c ..."')
const PROFUNDIDADE_MAXIMA = 3;

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
    } else if (solta !== undefined) {
      comandos.at(-1).push(...expandirChaves(solta).map((texto) => ({ texto, citada: false })));
    } else {
      comandos.at(-1).push({ texto: duplas ?? simples, citada: true });
    }
  }
  return comandos.filter((palavras) => palavras.length);
}

// Expande {a,b} como o terminal: docs/plano.md{,.bak} vira docs/plano.md e docs/plano.md.bak
function expandirChaves(texto) {
  let profundidade = 0;
  let inicio = -1;
  let virgulas = [];
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '{' && profundidade++ === 0) {
      inicio = i;
      virgulas = [];
    } else if (texto[i] === ',' && profundidade === 1) {
      virgulas.push(i);
    } else if (texto[i] === '}' && profundidade > 0 && --profundidade === 0 && virgulas.length) {
      const limites = [inicio, ...virgulas, i];
      const partes = limites.slice(0, -1).map((limite, k) => texto.slice(limite + 1, limites[k + 1]));
      return partes.flatMap((parte) => expandirChaves(texto.slice(0, inicio) + parte + texto.slice(i + 1)));
    }
  }
  return [texto];
}

// Converte um padrão do terminal (*, ? e [...]) numa expressão regular
function paraRegex(padrao) {
  let regex = '';
  for (let i = 0; i < padrao.length; i++) {
    const fim = padrao[i] === '[' ? padrao.indexOf(']', i + 2) : -1;
    if (padrao[i] === '*') {
      regex += '[^/]*';
    } else if (padrao[i] === '?') {
      regex += '[^/]';
    } else if (fim > 0) {
      const classe = padrao.slice(i + 1, fim).replace(/^!/, '^').replace(/\\/g, '\\\\');
      regex += `[${classe}]`;
      i = fim;
    } else {
      regex += padrao[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${regex}$`);
}

// O caminho e todas as pastas acima dele
function acima(caminho) {
  const lista = [caminho];
  while (dirname(lista.at(-1)) !== lista.at(-1)) lista.push(dirname(lista.at(-1)));
  return lista;
}

// Cada argumento vira um alvo: um caminho, ou um padrão quando tem *, ? ou [ fora das aspas
function alvo(texto, pasta, citada) {
  const caminho = resolve(pasta, texto.replace(/^~(?=\/|$)/, process.env.HOME ?? '~'));
  const padrao = !citada && /[*?[]/.test(texto) ? paraRegex(caminho) : null;
  return { texto, citada, caminho, padrao, casa: (outro) => (padrao ? padrao.test(outro) : outro === caminho) };
}

function ehPasta(caminho, escrito) {
  if (escrito.endsWith('/')) return true;
  try {
    return statSync(caminho).isDirectory();
  } catch {
    return false;
  }
}

// cp, mv, ln, install, rsync e git mv: confere o destino e, no mv, também a origem
function alteraNaCopia(programa, resto, alvoDe, ehReservadoAlvo, atinge) {
  const aceitaT = programa !== 'rsync' && programa !== 'git mv';
  let destino = null;
  const argumentos = [];
  for (let i = 0; i < resto.length; i++) {
    const { texto } = resto[i];
    if (aceitaT && texto === '-t' && resto[i + 1]) destino = alvoDe(resto[++i]);
    else if (aceitaT && texto.startsWith('--target-directory=')) destino = alvoDe({ ...resto[i], texto: texto.slice(19) });
    else if (!texto.startsWith('-')) argumentos.push(resto[i]);
  }
  if (!destino && argumentos.length < 2) return false;
  const naPasta = Boolean(destino) || ehPasta(alvoDe(argumentos.at(-1)).caminho, argumentos.at(-1).texto);
  destino ??= alvoDe(argumentos.pop());
  const origens = argumentos.map(alvoDe);

  if (ehReservadoAlvo(destino)) return true;
  if (naPasta && origens.some((origem) => ehReservadoAlvo(alvo(join(destino.caminho, basename(origem.texto)), '/', origem.citada)))) return true;
  if ((programa === 'mv' || programa === 'git mv') && origens.some(atinge)) return true;
  return programa === 'rsync' && resto.some(({ texto }) => texto.startsWith('--delete')) && atinge(destino);
}

// Devolve o trecho do comando que altera um arquivo reservado, ou null se nenhum altera
function trechoQueAltera(comando, pastaInicial, conhecidos, profundidade = 0) {
  let pasta = pastaInicial;
  // O alvo é um arquivo reservado (ou, se for padrão, casa com um dos reservados conhecidos)
  const ehReservadoAlvo = (a) => (a.padrao ? conhecidos.some(a.casa) : ehReservado(a.caminho));
  // O alvo é um arquivo reservado ou uma pasta que contém um
  const atinge = (a) => ehReservadoAlvo(a) || conhecidos.some((reservado) => acima(reservado).some(a.casa));

  for (const palavras of comandosSimples(comando)) {
    const trecho = palavras.map(({ texto }) => texto).join(' ');
    let [primeira, ...resto] = palavras;
    while (/^\w+=/.test(primeira?.texto ?? '')) [primeira, ...resto] = resto;
    let programa = primeira?.texto;
    if (programa === 'cd') {
      pasta = alvo(resto[0]?.texto ?? process.env.HOME ?? pasta, pasta, true).caminho;
      continue;
    }
    if (programa === 'git') {
      while (resto[0]?.texto.startsWith('-')) {
        const opcao = resto.shift().texto;
        const valor = opcao === '-C' || opcao === '-c' ? resto.shift() : null;
        if (opcao === '-C' && valor) pasta = alvo(valor.texto, pasta, true).caminho;
      }
      programa = `git ${resto.shift()?.texto ?? ''}`;
    }

    const alvoDe = ({ texto, citada }) => alvo(texto, pasta, citada);
    if (COPIAM.has(programa)) {
      if (alteraNaCopia(programa, resto, alvoDe, ehReservadoAlvo, atinge)) return trecho;
      continue;
    }
    switch (programa) {
      case 'rm':
      case 'git rm':
      case 'git checkout':
      case 'git restore':
      case 'truncate':
        if (resto.filter(({ texto }) => !texto.startsWith('-')).map(alvoDe).some(atinge)) return trecho;
        break;
      case 'dd':
        if (resto.some(({ texto, citada }) => texto.startsWith('of=') && atinge(alvo(texto.slice(3), pasta, citada)))) return trecho;
        break;
      case 'find': {
        const partida = [];
        for (const palavra of resto) {
          if (/^[-(!]/.test(palavra.texto)) break;
          partida.push(alvoDe(palavra));
        }
        if (!partida.length) partida.push(alvo('.', pasta, true));
        if (resto.some(({ texto }) => ACOES_DO_FIND.has(texto)) && partida.some(atinge)) return trecho;
        break;
      }
      case 'bash':
      case 'sh':
      case 'zsh':
      case 'eval': {
        const opcaoC = resto.findIndex(({ texto }) => /^-[a-z]*c[a-z]*$/.test(texto));
        const interno = programa === 'eval' ? resto.map(({ texto }) => texto).join(' ') : resto[opcaoC + 1]?.texto;
        if (opcaoC < 0 && programa !== 'eval') break;
        if (interno && profundidade < PROFUNDIDADE_MAXIMA && trechoQueAltera(interno, pasta, conhecidos, profundidade + 1)) return trecho;
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

  let oQue = null;
  if (dados.tool_name === 'Bash') {
    const conhecidos = raizes(pastaInicial, process.env.CLAUDE_PROJECT_DIR).flatMap(reservadosDe);
    const trecho = trechoQueAltera(dados.tool_input?.command ?? '', pastaInicial, conhecidos);
    if (trecho) oQue = `O comando \`${trecho}\` foi barrado`;
  } else {
    const arquivo = resolve(pastaInicial, dados.tool_input?.file_path ?? '');
    if (ehReservado(arquivo)) oQue = `A edição de ${arquivo} foi barrada`;
  }

  if (oQue) {
    const nome = nomeDaSessao(dados.transcript_path ?? '');
    if (nome !== SESSAO_PRINCIPAL) negar(oQue, nome);
  }
} catch {
  // Se a entrada do Claude Code não puder ser lida, não há o que conferir: segue o fluxo normal
}
process.exit(0);
