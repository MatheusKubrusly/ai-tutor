// Provisório, só para a implementação acelerada: o que os ganchos desta pasta têm em comum.
// Reconhece a sessão principal pelo nome dado com /rename e o plano do método e a árvore de
// cenários pelo conteúdo do repositório (a pasta que tem protocolo/nucleo-provisorio.md), e não
// pelo nome da pasta, para valer em qualquer clone ou cópia de trabalho do git (worktree).
// Sai do plugin, junto com o resto desta pasta, quando o Matheus declarar o método implementado.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const NOMES = ['plano-do-metodo.md', 'cenarios-de-interacao.md'];
const MARCA_DO_REPOSITORIO = join('protocolo', 'nucleo-provisorio.md');

export const SESSAO_PRINCIPAL = 'ai-tutor · sessão principal';

export const PASTA_DA_REDE = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'tutor', 'rede');

export function nomeDaSessao(arquivoDaConversa) {
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

const ehRaiz = (pasta) => existsSync(join(pasta, MARCA_DO_REPOSITORIO));

// O caminho é o plano ou a árvore de cenários de um repositório do método
export function ehReservado(caminho) {
  const pasta = dirname(caminho);
  return NOMES.includes(basename(caminho)) && basename(pasta) === 'docs' && ehRaiz(dirname(pasta));
}

// Raízes dos repositórios do método que contêm alguma das pastas dadas
export function raizes(...pastas) {
  const achadas = new Set();
  for (const inicio of pastas.filter(Boolean)) {
    let pasta = resolve(inicio);
    for (;;) {
      if (ehRaiz(pasta)) {
        achadas.add(pasta);
        break;
      }
      if (dirname(pasta) === pasta) break;
      pasta = dirname(pasta);
    }
  }
  return [...achadas];
}

// O plano e a árvore de cenários de uma raiz
export const reservadosDe = (raiz) => NOMES.map((nome) => join(raiz, 'docs', nome));
