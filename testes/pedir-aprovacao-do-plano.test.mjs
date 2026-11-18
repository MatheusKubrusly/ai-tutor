import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../plugins/tutor/scripts/pedir-aprovacao-do-plano.mjs', import.meta.url));
const REPOSITORIO = join('/', 'repositorios', 'ai-tutor');
const CONFIGURACAO = join('/', 'configuracao-falsa');

function decisao(file_path) {
  const resultado = spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify({ tool_name: 'Edit', cwd: REPOSITORIO, tool_input: { file_path } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: CONFIGURACAO },
  });
  assert.equal(resultado.status, 0);
  return resultado.stdout ? JSON.parse(resultado.stdout).hookSpecificOutput.permissionDecision : 'passa';
}

test('o plano, a árvore de cenários, as regras e os planos do Claude Code pedem aprovação', () => {
  const arquivos = [
    join(REPOSITORIO, 'docs', 'plano-do-metodo.md'),
    join(REPOSITORIO, 'docs', 'cenarios-de-interacao.md'),
    join(REPOSITORIO, 'protocolo', 'nucleo-provisorio.md'),
    join(CONFIGURACAO, 'plans', 'um-plano.md'),
  ];
  for (const arquivo of arquivos) {
    assert.equal(decisao(arquivo), 'ask', arquivo);
  }
});

test('os demais arquivos não pedem aprovação', () => {
  const arquivos = [
    join(REPOSITORIO, 'README.md'),
    join(REPOSITORIO, 'docs', 'outro-documento.md'),
    join(REPOSITORIO, 'docs', 'cenarios-de-interacao.md.bak'),
    join(REPOSITORIO, 'plugins', 'tutor', 'hooks', 'hooks.json'),
  ];
  for (const arquivo of arquivos) {
    assert.equal(decisao(arquivo), 'passa', arquivo);
  }
});
