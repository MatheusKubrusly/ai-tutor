#!/usr/bin/env node
// Bloqueia comandos de terminal que gravam em arquivos do repositório por fora
// das ferramentas Edit e Write, para que toda mudança apareça no diff, e pede
// aprovação para os que trazem arquivos para dentro dele (cp, mv, patch, git apply).
// É chamado pelo Claude Code antes de cada comando Bash (hooks/hooks.json).
// Código 2 bloqueia o comando; código 0 deixa passar.

import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

// Comandos que editam arquivos no lugar ou gravam por código na linha de comando
const PROIBIDOS = [
  { padrao: /\bsed\s+(-[a-z]*\s+)*-[a-z]*i/i, nome: '`sed -i`' },
  { padrao: /\bperl\s+(-[a-z]*\s+)*-[a-z]*i/i, nome: '`perl -i`' },
  { padrao: /\bpython3?\b[^|;&]*(open\([^)]*,\s*(mode\s*=\s*)?['"][wax]|write_text|write_bytes)/, nome: 'Python gravando arquivo' },
  { padrao: /\bnode\b[^|;&]*\b(writeFile|appendFile)/, nome: 'Node gravando arquivo' },
];

// Redirecionamentos de saída (>, >>, 1>, &>) e o comando tee; a seta => não conta
const REDIRECIONAMENTO = /(?:^|[^0-9<&>=-])(?:[12]?>>?|&>>?)\s*([^\s;|&<>]+)|\btee\s+(?:-[a-z]+\s+)*([^\s;|&<>]+)/g;

// Corpo de um heredoc (do fim da linha com <<MARCA até a linha MARCA): ali um > nunca grava arquivo
const HEREDOC = /(<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\2)([^\n]*)\n[\s\S]*?\n[ \t]*\3[ \t]*(?=\n|$)/g;

// Comandos que trazem arquivos para dentro do repositório sem passar pela comparação
const TRAZEM_ARQUIVOS = /(?:^|[;&|(\n])\s*(cp|mv|patch|git\s+apply)\b([^;&|\n]*)/g;

// Destinos que não são arquivos do repositório
const LIBERADOS = ['/dev/null', '/dev/stdout', '/dev/stderr'];

function bloquear(motivo) {
  process.stderr.write(
    `Bloqueado: ${motivo}. Arquivos do repositório só são alterados com as ferramentas Edit e Write, ` +
      'para que o Matheus veja o diff (núcleo provisório, "Como editar os arquivos").\n'
  );
  process.exit(2);
}

function pedirAprovacao(motivo) {
  const resposta = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: motivo } };
  process.stdout.write(JSON.stringify(resposta));
  process.exit(0);
}

try {
  const dados = JSON.parse(readFileSync(0, 'utf8'));
  const comando = (dados.tool_input?.command ?? '').replace(HEREDOC, '$1$4');
  const raiz = process.env.CLAUDE_PROJECT_DIR || dados.cwd || process.cwd();
  const pastaAtual = dados.cwd || raiz;
  const resolver = (alvo) => resolve(pastaAtual, alvo.replace(/^['"]|['"]$/g, '').replace(/^~(?=\/)/, process.env.HOME ?? '~'));
  const dentroDoRepositorio = (caminho) =>
    (caminho === raiz || caminho.startsWith(raiz + sep)) && !caminho.startsWith(tmpdir() + sep);

  for (const { padrao, nome } of PROIBIDOS) {
    if (padrao.test(comando)) bloquear(`o comando usa ${nome}`);
  }

  for (const achado of comando.matchAll(REDIRECIONAMENTO)) {
    const alvo = (achado[1] ?? achado[2] ?? '').replace(/^['"]|['"]$/g, '');
    if (!alvo || alvo.startsWith('&') || LIBERADOS.includes(alvo)) continue;
    if (dentroDoRepositorio(resolver(alvo))) bloquear(`o comando grava em ${alvo}`);
  }

  for (const [, programa, argumentos] of comando.matchAll(TRAZEM_ARQUIVOS)) {
    const destino = /^(patch|git)/.test(programa)
      ? pastaAtual
      : resolver(argumentos.trim().split(/\s+/).filter((a) => !a.startsWith('-')).at(-1) ?? '');
    if (dentroDoRepositorio(destino)) {
      pedirAprovacao(`${programa} altera arquivos do repositório sem passar pela comparação; confira o comando antes de aprovar`);
    }
  }
} catch {
  // Se a entrada não puder ser lida, não bloqueia: o hook não pode travar o trabalho
}
process.exit(0);
