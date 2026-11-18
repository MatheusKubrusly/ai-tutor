#!/usr/bin/env node
// Pede a aprovação do Matheus antes de cada edição num plano ou nas regras do método,
// para que ele veja a comparação mesmo quando o modo de planejamento ou o modo
// automático gravariam o arquivo sem perguntar.
// É chamado pelo Claude Code antes de Edit e Write (hooks/hooks.json).

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const pastaDeConfiguracao = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const pastaDosPlanos = join(pastaDeConfiguracao, 'plans') + sep;
// O plano do método, a árvore de cenários e as regras, no repositório ai-tutor
const ARQUIVOS_DO_METODO = /[\\/]ai-tutor[\\/](docs[\\/](plano-do-metodo|cenarios-de-interacao)\.md$|protocolo[\\/])/;

try {
  const dados = JSON.parse(readFileSync(0, 'utf8'));
  const arquivo = resolve(dados.tool_input?.file_path ?? '');

  if (arquivo.startsWith(pastaDosPlanos) || ARQUIVOS_DO_METODO.test(arquivo)) {
    const resposta = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: 'Edição num plano ou nas regras do método: aprove ou rejeite antes de gravar.',
      },
    };
    process.stdout.write(JSON.stringify(resposta));
  }
} catch {
  // Se a entrada não puder ser lida, segue o fluxo normal: o hook não pode travar o trabalho
}
