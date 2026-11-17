import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../plugins/tutor/scripts/reservar-plano-a-sessao-principal.mjs', import.meta.url));
const base = mkdtempSync(join(tmpdir(), 'reservar-plano-'));
const repositorio = join(base, 'ai-tutor');
const PLANO = join(repositorio, 'docs', 'plano-do-metodo.md');
const CENARIOS = join(repositorio, 'docs', 'cenarios-de-interacao.md');
mkdirSync(join(repositorio, 'docs'), { recursive: true });
after(() => rmSync(base, { recursive: true, force: true }));

function conversa(nome, ...registros) {
  const arquivo = join(base, `${nome}.jsonl`);
  writeFileSync(arquivo, registros.map((registro) => JSON.stringify(registro)).join('\n') + '\n');
  return arquivo;
}
const titulo = (customTitle) => ({ type: 'custom-title', customTitle, sessionId: 'teste' });
const fala = (content) => ({ type: 'user', message: { role: 'user', content } });

const CONVERSAS = {
  principal: conversa('principal', titulo('ai-tutor · sessão principal')),
  area: conversa('area', titulo('ai-tutor · plugin')),
  semNome: conversa('sem-nome', fala('oi')),
  nomeNoTexto: conversa(
    'nome-no-texto',
    fala('Só a "ai-tutor · sessão principal" edita o plano.'),
    { type: 'user', subtype: 'custom-title', customTitle: 'ai-tutor · sessão principal' }
  ),
  renomeadaParaArea: conversa('renomeada-para-area', titulo('ai-tutor · sessão principal'), titulo('ai-tutor · plugin')),
  renomeadaParaPrincipal: conversa('renomeada-para-principal', titulo('ai-tutor · plugin'), titulo('ai-tutor · sessão principal')),
  inexistente: join(base, 'nao-existe.jsonl'),
};

function rodar(transcript_path, tool_name, tool_input) {
  const entrada = { session_id: 'teste', transcript_path, cwd: repositorio, hook_event_name: 'PreToolUse', tool_name, tool_input };
  const resultado = spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify(entrada),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repositorio },
  });
  assert.equal(resultado.status, 0);
  return resultado.stdout ? JSON.parse(resultado.stdout).hookSpecificOutput : null;
}
const decisao = (...argumentos) => rodar(...argumentos)?.permissionDecision ?? 'passa';

test('a sessão principal edita o plano e a árvore de cenários', () => {
  assert.equal(decisao(CONVERSAS.principal, 'Edit', { file_path: PLANO }), 'passa');
  assert.equal(decisao(CONVERSAS.principal, 'Write', { file_path: CENARIOS }), 'passa');
});

test('as outras sessões são barradas no plano e na árvore de cenários', () => {
  for (const nome of ['area', 'semNome', 'nomeNoTexto', 'renomeadaParaArea', 'inexistente']) {
    assert.equal(decisao(CONVERSAS[nome], 'Edit', { file_path: PLANO }), 'deny', nome);
    assert.equal(decisao(CONVERSAS[nome], 'Write', { file_path: CENARIOS }), 'deny', nome);
  }
});

test('vale o último nome dado à sessão', () => {
  assert.equal(decisao(CONVERSAS.renomeadaParaPrincipal, 'Edit', { file_path: PLANO }), 'passa');
});

test('a mensagem explica a regra e manda propor a mudança na issue', () => {
  const { permissionDecisionReason } = rodar(CONVERSAS.area, 'Edit', { file_path: PLANO });
  assert.match(permissionDecisionReason, /Esta sessão se chama "ai-tutor · plugin"/);
  assert.match(permissionDecisionReason, /comentário na issue/);
  assert.match(rodar(CONVERSAS.semNome, 'Edit', { file_path: PLANO }).permissionDecisionReason, /não tem nome/);
});

test('as outras sessões editam os demais arquivos e a cópia do plano', () => {
  const arquivos = [join(repositorio, 'README.md'), join(repositorio, 'protocolo', 'nucleo-provisorio.md'), join(homedir(), '.claude', 'plans', 'copia.md')];
  for (const file_path of arquivos) {
    assert.equal(decisao(CONVERSAS.area, 'Edit', { file_path }), 'passa', file_path);
  }
});

test('no terminal, as outras sessões não alteram o plano nem a árvore de cenários', () => {
  const barrados = [
    'cp rascunho.md docs/plano-do-metodo.md',
    'cp rascunho.md docs/plano-do-metodo.md 2>&1',
    `cp ${join(base, 'plano-do-metodo.md')} docs/`,
    `cp ${join(base, 'plano-do-metodo.md')} docs`,
    'mv docs/cenarios-de-interacao.md velho.md',
    'rm docs/plano-do-metodo.md',
    'rm -rf docs',
    'git rm docs/cenarios-de-interacao.md',
    'git mv docs/plano-do-metodo.md docs/plano.md',
    'git checkout -- docs/plano-do-metodo.md',
    'git restore .',
    'git status && cd docs && rm plano-do-metodo.md',
  ];
  for (const command of barrados) {
    assert.equal(decisao(CONVERSAS.area, 'Bash', { command }), 'deny', command);
  }
});

test('no terminal, os demais comandos passam', () => {
  const permitidos = [
    'git status',
    `cp docs/plano-do-metodo.md ${join(base, 'copia.md')}`,
    'git restore README.md',
    'echo "rm docs/plano-do-metodo.md"',
    "gh issue comment 13 --body-file - <<'EOF'\nrm docs/plano-do-metodo.md\nEOF",
  ];
  for (const command of permitidos) {
    assert.equal(decisao(CONVERSAS.area, 'Bash', { command }), 'passa', command);
  }
});

test('no terminal, a sessão principal traz de volta a cópia aprovada do plano', () => {
  const command = `cp ${join(homedir(), '.claude', 'plans', 'copia.md')} docs/plano-do-metodo.md`;
  assert.equal(decisao(CONVERSAS.principal, 'Bash', { command }), 'passa');
});
