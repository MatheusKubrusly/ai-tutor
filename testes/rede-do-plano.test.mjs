import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REDE = fileURLToPath(new URL('../plugins/tutor/scripts/provisorios/rede-do-plano.mjs', import.meta.url));
const LEITURA = fileURLToPath(new URL('../plugins/tutor/scripts/provisorios/reservar-plano-a-sessao-principal.mjs', import.meta.url));
const base = mkdtempSync(join(tmpdir(), 'rede-do-plano-'));
after(() => rmSync(base, { recursive: true, force: true }));

const configuracao = join(base, 'configuracao');
const PASTA_DA_REDE = join(configuracao, 'tutor', 'rede');
const repositorio = join(base, 'ai-tutor');
const PLANO = join(repositorio, 'docs', 'plano-do-metodo.md');
const CENARIOS = join(repositorio, 'docs', 'cenarios-de-interacao.md');
mkdirSync(join(repositorio, 'docs'), { recursive: true });
mkdirSync(join(repositorio, 'protocolo'), { recursive: true });
writeFileSync(join(repositorio, 'protocolo', 'nucleo-provisorio.md'), '');

function conversa(nome, customTitle) {
  const arquivo = join(base, `${nome}.jsonl`);
  writeFileSync(arquivo, JSON.stringify({ type: 'custom-title', customTitle }) + '\n');
  return arquivo;
}
const PRINCIPAL = conversa('principal', 'ai-tutor · sessão principal');
const AREA = conversa('area', 'ai-tutor · plugin');

function rodar(script, transcript_path, hook_event_name, tool_name, tool_input, tool_use_id) {
  const entrada = { session_id: 'teste', transcript_path, cwd: repositorio, hook_event_name, tool_name, tool_input, tool_use_id };
  const resultado = spawnSync(process.execPath, [script], {
    input: JSON.stringify(entrada),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configuracao, CLAUDE_PROJECT_DIR: repositorio },
  });
  assert.equal(resultado.status, 0);
  return resultado.stdout ? JSON.parse(resultado.stdout) : null;
}

let chamadas = 0;
// Simula um comando de terminal: o gancho de antes, a alteração feita pelo comando e o gancho de depois
function comando(transcript_path, command, alterar = () => {}, depois = 'PostToolUse') {
  const id = `toolu_teste_${++chamadas}`;
  rodar(REDE, transcript_path, 'PreToolUse', 'Bash', { command }, id);
  alterar();
  return rodar(REDE, transcript_path, depois, 'Bash', { command }, id);
}

function comecar() {
  writeFileSync(PLANO, 'plano original\n');
  writeFileSync(CENARIOS, 'árvore original\n');
  rmSync(PASTA_DA_REDE, { recursive: true, force: true });
}
const listar = (pasta) => (existsSync(join(PASTA_DA_REDE, pasta)) ? readdirSync(join(PASTA_DA_REDE, pasta)) : []);
const desfeitos = () => listar('desfeitos').map((nome) => readFileSync(join(PASTA_DA_REDE, 'desfeitos', nome), 'utf8'));

test('um comando que a leitura não pega e altera o plano é desfeito', () => {
  comecar();
  const command = 'f=plano-do-metodo; bash -c "truncate -s 0 docs/$f.md"';
  assert.equal(rodar(LEITURA, AREA, 'PreToolUse', 'Bash', { command }, 'toolu_leitura'), null);
  const resposta = comando(AREA, command, () => writeFileSync(PLANO, ''));
  assert.equal(readFileSync(PLANO, 'utf8'), 'plano original\n');
  assert.equal(resposta.decision, 'block');
  assert.match(resposta.systemMessage, /foi alterado e restaurado/);
  assert.deepEqual(desfeitos(), ['']);
});

test('o mesmo vale quando o comando falha, e um arquivo apagado volta', () => {
  comecar();
  const resposta = comando(AREA, 'python3 apaga.py', () => rmSync(CENARIOS), 'PostToolUseFailure');
  assert.equal(readFileSync(CENARIOS, 'utf8'), 'árvore original\n');
  assert.match(resposta.reason, /tinha apagado o arquivo/);
  assert.match(resposta.reason, /comentário na issue/);
});

test('uma edição da sessão principal no mesmo intervalo é preservada', () => {
  comecar();
  const resposta = comando(AREA, 'npm test', () => {
    writeFileSync(PLANO, 'plano editado pela principal\n');
    rodar(REDE, PRINCIPAL, 'PostToolUse', 'Edit', { file_path: PLANO }, 'toolu_edicao');
  });
  assert.equal(readFileSync(PLANO, 'utf8'), 'plano editado pela principal\n');
  assert.match(resposta.systemMessage, /não o restaurou/);
  assert.deepEqual(desfeitos(), []);
});

test('comandos que não tocam os arquivos não mudam nada', () => {
  comecar();
  assert.equal(comando(AREA, 'git status'), null);
  assert.equal(readFileSync(PLANO, 'utf8'), 'plano original\n');
  assert.deepEqual(listar('copias'), []);
  assert.deepEqual(desfeitos(), []);
});

test('um comando da sessão principal que cita o plano o altera e deixa o sinal', () => {
  comecar();
  const command = `cp ${join(base, 'copia.md')} docs/plano-do-metodo.md`;
  assert.equal(comando(PRINCIPAL, command, () => writeFileSync(PLANO, 'versão aprovada\n')), null);
  assert.equal(readFileSync(PLANO, 'utf8'), 'versão aprovada\n');
  assert.equal(listar('sinais').length, 1);
});

test('outro comando da sessão principal não deixa passar a mudança de uma sessão de área', () => {
  comecar();
  rodar(REDE, AREA, 'PreToolUse', 'Bash', { command: 'npm test' }, 'toolu_area');
  rodar(REDE, PRINCIPAL, 'PreToolUse', 'Bash', { command: 'git log' }, 'toolu_principal');
  writeFileSync(PLANO, 'mudança da área\n');
  assert.equal(rodar(REDE, PRINCIPAL, 'PostToolUse', 'Bash', { command: 'git log' }, 'toolu_principal'), null);
  const resposta = rodar(REDE, AREA, 'PostToolUse', 'Bash', { command: 'npm test' }, 'toolu_area');
  assert.equal(readFileSync(PLANO, 'utf8'), 'plano original\n');
  assert.match(resposta.systemMessage, /foi alterado e restaurado/);
  assert.deepEqual(listar('sinais'), []);
});
