#!/usr/bin/env node
// Pede a aprovação do Matheus antes de cada edição num plano, para que ele veja
// a comparação mesmo no modo de planejamento, que libera esse arquivo sem perguntar.
// É chamado pelo Claude Code antes de Edit e Write (hooks/hooks.json).

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const pastaDeConfiguracao = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const pastaDosPlanos = join(pastaDeConfiguracao, 'plans') + sep;

try {
  const dados = JSON.parse(readFileSync(0, 'utf8'));
  const arquivo = resolve(dados.tool_input?.file_path ?? '');

  if (arquivo.startsWith(pastaDosPlanos)) {
    const resposta = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: 'Edição num plano: aprove ou rejeite antes de gravar.',
      },
    };
    process.stdout.write(JSON.stringify(resposta));
  }
} catch {
  // Se a entrada não puder ser lida, segue o fluxo normal: o hook não pode travar o trabalho
}
