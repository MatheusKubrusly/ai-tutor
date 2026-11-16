#!/usr/bin/env node
// Registra cada comando de terminal que o Claude roda, com a saída, num arquivo
// fora do repositório. Para acompanhar ao vivo, num terminal:
//   tail -f ~/.claude/logs/terminal.log
//
// É chamado pelo Claude Code depois de cada comando Bash (hooks PostToolUse e
// PostToolUseFailure, em hooks/hooks.json). Recebe os dados do comando em JSON
// pela entrada padrão. Nunca bloqueia nada: sempre termina com código 0.

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PASTA = join(homedir(), '.claude', 'logs');
const ARQUIVO = join(PASTA, 'terminal.log');
const MAX_LINHAS = 200; // saídas maiores são cortadas, para o registro continuar legível

function cortar(texto) {
  const linhas = texto.replace(/\s+$/, '').split('\n');
  if (linhas.length <= MAX_LINHAS) return linhas.join('\n');
  return [...linhas.slice(0, MAX_LINHAS), `… (mais ${linhas.length - MAX_LINHAS} linhas cortadas)`].join('\n');
}

try {
  const dados = JSON.parse(readFileSync(0, 'utf8'));
  if (dados.tool_name !== 'Bash') process.exit(0);

  const { command = '', description = '' } = dados.tool_input ?? {};
  const hora = new Date().toLocaleTimeString('pt-BR');
  const partes = [`\n━━━━━━━━━━━━━━━━ ${hora} ━━━━━━━━━━━━━━━━`];
  if (description) partes.push(`▶ ${description}`);
  partes.push(`$ ${command}`);

  if (dados.hook_event_name === 'PostToolUseFailure') {
    // O texto do erro começa com "Exit code N" e traz a saída do comando
    partes.push(cortar(String(dados.error ?? '')));
    partes.push(dados.is_interrupt ? '✘ interrompido' : '✘ terminou com erro');
  } else {
    const r = dados.tool_response ?? {};
    const saida = [r.stdout, r.stderr].filter(Boolean).join('\n');
    if (saida.trim()) partes.push(cortar(saida));
    partes.push(r.interrupted ? '✘ interrompido' : '✔ terminou sem erro');
  }

  mkdirSync(PASTA, { recursive: true });
  appendFileSync(ARQUIVO, partes.join('\n') + '\n');
} catch {
  // Um erro no registro não pode atrapalhar o trabalho do Claude
}
process.exit(0);
