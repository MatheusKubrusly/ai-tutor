#!/usr/bin/env node
// Provisório, só para a implementação acelerada: rede de proteção do plano do método e da
// árvore de cenários. A leitura do comando (reservar-plano-a-sessao-principal.mjs) barra antes os
// casos conhecidos; a rede confere o efeito, qualquer que seja o jeito de escrever o comando.
// Antes de cada comando de terminal, guarda uma cópia dos dois arquivos; depois, se eles mudaram
// numa sessão que não é a principal, restaura a cópia, guarda a versão desfeita e avisa. Uma
// mudança feita pela sessão principal no mesmo intervalo (que deixa um sinal) não é desfeita.
// Sai do plugin, junto com o resto desta pasta, quando o Matheus declarar o método implementado.
// É chamado pelo Claude Code antes do Bash, depois de Edit, Write e Bash, e depois da falha do
// Bash (hooks/hooks.json).

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { ehReservado, nomeDaSessao, PASTA_DA_REDE, raizes, reservadosDe, SESSAO_PRINCIPAL } from './sessao-principal.mjs';

const PASTA_DAS_COPIAS = join(PASTA_DA_REDE, 'copias');
const PASTA_DOS_SINAIS = join(PASTA_DA_REDE, 'sinais');
const PASTA_DOS_DESFEITOS = join(PASTA_DA_REDE, 'desfeitos');
const UM_DIA = 24 * 60 * 60 * 1000;

const ler = (caminho) => {
  try {
    return readFileSync(caminho);
  } catch {
    return null;
  }
};

// Compara o conteúdo atual com o guardado na cópia (null quando o arquivo não existe)
const iguais = (atual, guardado) => (atual === null || guardado === null ? atual === guardado : atual.equals(Buffer.from(guardado, 'base64')));

const arquivoDaCopia = (idDaChamada) => join(PASTA_DAS_COPIAS, `${String(idDaChamada).replace(/[^\w-]/g, '_')}.json`);
const arquivoDoSinal = (caminho) => join(PASTA_DOS_SINAIS, createHash('sha1').update(caminho).digest('hex'));

function gravarSinal(caminho) {
  mkdirSync(PASTA_DOS_SINAIS, { recursive: true });
  writeFileSync(arquivoDoSinal(caminho), String(Date.now()));
}

const houveSinalDesde = (caminho, inicio) => Number(ler(arquivoDoSinal(caminho))?.toString()) >= inicio;

// Cópias de chamadas que não chegaram ao "depois" (por exemplo, negadas por outro gancho)
function apagarCopiasAntigas() {
  try {
    for (const nome of readdirSync(PASTA_DAS_COPIAS)) {
      const caminho = join(PASTA_DAS_COPIAS, nome);
      if (Date.now() - statSync(caminho).mtimeMs > UM_DIA) rmSync(caminho, { force: true });
    }
  } catch {
    // A pasta ainda não existe
  }
}

// Antes do comando: guarda o conteúdo dos arquivos reservados do repositório
function guardarCopia(dados) {
  apagarCopiasAntigas();
  const arquivos = raizes(dados.cwd, process.env.CLAUDE_PROJECT_DIR).flatMap(reservadosDe);
  if (!arquivos.length || !dados.tool_use_id) return;
  const conteudos = arquivos.map((caminho) => ({ caminho, conteudo: ler(caminho)?.toString('base64') ?? null }));
  mkdirSync(PASTA_DAS_COPIAS, { recursive: true });
  writeFileSync(arquivoDaCopia(dados.tool_use_id), JSON.stringify({ inicio: Date.now(), arquivos: conteudos }));
}

// Depois do comando: compara com a cópia e, fora da sessão principal, restaura
function conferirCopia(dados) {
  if (!dados.tool_use_id) return;
  const arquivo = arquivoDaCopia(dados.tool_use_id);
  const guardada = ler(arquivo);
  if (!guardada) return;
  rmSync(arquivo, { force: true });
  const copia = JSON.parse(guardada);
  const mudados = copia.arquivos.filter(({ caminho, conteudo }) => !iguais(ler(caminho), conteudo));
  if (!mudados.length) return;

  const comando = dados.tool_input?.command ?? '';
  if (nomeDaSessao(dados.transcript_path ?? '') === SESSAO_PRINCIPAL) {
    // Só conta como mudança da principal o comando que cita o arquivo: outro comando dela pode
    // ter terminado enquanto uma sessão de área mudava o arquivo
    for (const { caminho } of mudados) {
      if (comando.includes(basename(caminho, '.md'))) gravarSinal(caminho);
    }
    return;
  }

  const avisos = mudados.map(({ caminho, conteudo }) => {
    if (houveSinalDesde(caminho, copia.inicio)) {
      return `${caminho} mudou durante o comando, mas a sessão principal também o editou nesse intervalo, e a rede não o restaurou: confira o arquivo`;
    }
    const alterado = ler(caminho);
    let desfeito = 'o comando tinha apagado o arquivo';
    if (alterado) {
      mkdirSync(PASTA_DOS_DESFEITOS, { recursive: true });
      const destino = join(PASTA_DOS_DESFEITOS, `${new Date().toISOString().replace(/[:.]/g, '-')}-${basename(caminho)}`);
      writeFileSync(destino, alterado);
      desfeito = `a versão desfeita ficou em ${destino}`;
    }
    if (conteudo === null) rmSync(caminho, { force: true });
    else writeFileSync(caminho, Buffer.from(conteudo, 'base64'));
    return `${caminho} foi alterado e restaurado; ${desfeito}`;
  });

  const aviso = `Rede de proteção do plano, depois do comando \`${comando}\`: ${avisos.join('. ')}.`;
  const resposta = {
    systemMessage: aviso,
    decision: 'block',
    reason:
      `${aviso} Só a sessão principal ("${SESSAO_PRINCIPAL}") altera o plano do método e a árvore de cenários ` +
      '(núcleo provisório, "Várias sessões na mesma pasta"). Proponha a mudança por comentário na issue da tarefa.',
  };
  process.stdout.write(JSON.stringify(resposta));
}

// Depois de Edit ou Write: uma edição da sessão principal num arquivo reservado deixa o sinal
function marcarEdicao(dados) {
  const arquivo = resolve(dados.cwd || process.cwd(), dados.tool_input?.file_path ?? '');
  if (ehReservado(arquivo) && nomeDaSessao(dados.transcript_path ?? '') === SESSAO_PRINCIPAL) gravarSinal(arquivo);
}

try {
  const dados = JSON.parse(readFileSync(0, 'utf8'));
  if (dados.tool_name !== 'Bash') {
    if (dados.hook_event_name === 'PostToolUse') marcarEdicao(dados);
  } else if (dados.hook_event_name === 'PreToolUse') {
    guardarCopia(dados);
  } else {
    conferirCopia(dados);
  }
} catch {
  // Se a entrada não puder ser lida, segue o fluxo normal: o gancho não pode travar o trabalho
}
process.exit(0);
