import type { RelatorioCaixas } from "./caixas";
import { formatCurrency, formatDate } from "./format";
import type { RelatorioFornecedor, RelatorioOperacao, RelatorioSobra } from "./relatorio";

function esc(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cabecalho(titulo: string, de: string, ate: string, extra?: string): string {
  const periodo = de === ate ? formatDate(de) : `${formatDate(de)} a ${formatDate(ate)}`;
  return `
    <header>
      <p class="marca">Galpão Empório</p>
      <h1>${esc(titulo)}</h1>
      <p class="periodo">Período: ${esc(periodo)}${extra ? ` · ${esc(extra)}` : ""}</p>
    </header>
  `;
}

function estilos(): string {
  return `
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      html, body { background: #fff; color: #171717; }
      body { font-family: "Segoe UI", Arial, sans-serif; font-size: 12px; margin: 0; padding: 8px; }
      header { border-bottom: 2px solid #166534; padding-bottom: 10px; margin-bottom: 16px; }
      .marca { text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #166534; font-weight: 700; margin: 0; }
      h1 { font-size: 20px; margin: 4px 0 2px; }
      .periodo { margin: 0; color: #525252; }
      h2 { font-size: 13px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; color: #404040; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { border-bottom: 1px solid #e5e5e5; padding: 6px 8px; text-align: left; }
      th { font-size: 10px; text-transform: uppercase; color: #737373; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      tfoot td { font-weight: 700; border-top: 2px solid #171717; }
      .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
      .card { flex: 1; min-width: 110px; border: 1px solid #e5e5e5; border-radius: 8px; padding: 8px 10px; }
      .card strong { display: block; font-size: 18px; }
      .card span { color: #737373; font-size: 10px; text-transform: uppercase; }
      .grupo { margin-bottom: 18px; page-break-inside: avoid; }
      .grupo h3 { margin: 0 0 6px; font-size: 14px; }
      .obs { color: #525252; font-size: 11px; font-style: italic; margin-top: 2px; }
      .vazio { color: #737373; }
    </style>
  `;
}

function documento(titulo: string, corpo: string): string {
  return `<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>${esc(titulo)}</title>
      ${estilos()}
    </head>
    <body>${corpo}</body>
  </html>`;
}

export function imprimirRelatorioOperacao(relatorio: RelatorioOperacao) {
  const titulo = "Relatório da operação";
  const linhasDia = relatorio.dias
    .map(
      (dia) => `
      <tr>
        <td>${esc(formatDate(dia.data))}</td>
        <td class="num">${dia.recebido}</td>
        <td class="num">${dia.feitoBom}</td>
        <td class="num">${dia.feitoFraco}</td>
        <td class="num">${dia.perda}</td>
      </tr>`,
    )
    .join("");

  const corpo = `
    ${cabecalho(titulo, relatorio.de, relatorio.ate)}
    <div class="cards">
      <div class="card"><strong>${relatorio.recebido}</strong><span>Recebido</span></div>
      <div class="card"><strong>${relatorio.feitoBom}</strong><span>Feito bom</span></div>
      <div class="card"><strong>${relatorio.feitoFraco}</strong><span>Feito fraco</span></div>
      <div class="card"><strong>${relatorio.perda}</strong><span>Perda</span></div>
    </div>
    <h2>Por dia</h2>
    ${
      relatorio.dias.length === 0
        ? `<p class="vazio">Nenhum movimento neste período.</p>`
        : `<table>
            <thead><tr><th>Data</th><th class="num">Recebido</th><th class="num">Bom</th><th class="num">Fraco</th><th class="num">Perda</th></tr></thead>
            <tbody>${linhasDia}</tbody>
          </table>`
    }
    ${
      relatorio.observacoes.length === 0
        ? ""
        : `<h2>Observações</h2>
          <table>
            <thead><tr><th>Data</th><th>Fornecedor</th><th>Mercadoria</th><th>Observação</th></tr></thead>
            <tbody>
              ${relatorio.observacoes
                .map(
                  (item) => `
                <tr>
                  <td>${esc(formatDate(item.data))}</td>
                  <td>${esc(item.produtor)}</td>
                  <td>${esc(item.mercadoria)}</td>
                  <td>${esc(item.texto)}</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>`
    }
  `;
  abrirImpressao(titulo, corpo);
}

export function imprimirRelatorioFornecedor(relatorio: RelatorioFornecedor, verPreco = true) {
  const titulo = "Relatório por fornecedor";
  const grupos = relatorio.grupos
    .map((grupo) => {
      const linhas = grupo.linhas
        .map(
          (linha) => `
          <tr>
            <td>${esc(formatDate(linha.data))}</td>
            <td>${esc(linha.mercadoria)}${linha.observacao ? `<div class="obs">${esc(linha.observacao)}</div>` : ""}</td>
            <td class="num">${linha.veio}</td>
            <td class="num">${linha.boa}</td>
            <td class="num">${linha.fraca}</td>
            <td class="num">${linha.perda}</td>
            ${
              verPreco
                ? `<td class="num">${
                    linha.preco == null && linha.precoFraco == null
                      ? "—"
                      : [linha.preco != null ? formatCurrency(linha.preco) : null, linha.precoFraco != null ? formatCurrency(linha.precoFraco) : null]
                          .filter(Boolean)
                          .join("<br>")
                  }</td>
            <td class="num">${linha.preco == null && linha.precoFraco == null ? "—" : formatCurrency(linha.valor)}</td>`
                : ""
            }
          </tr>`,
        )
        .join("");
      return `
        <div class="grupo">
          <h3>${esc(grupo.produtor)}</h3>
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Mercadoria</th>
                <th class="num">Veio</th><th class="num">Boa</th><th class="num">Fraca</th><th class="num">Perda</th>
                ${verPreco ? `<th class="num">Preço</th><th class="num">Valor</th>` : ""}
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
            <tfoot>
              <tr>
                <td colspan="2">Total ${esc(grupo.produtor)}</td>
                <td class="num">${grupo.veio}</td>
                <td class="num">${grupo.boa}</td>
                <td class="num">${grupo.fraca}</td>
                <td class="num">${grupo.perda}</td>
                ${verPreco ? `<td></td><td class="num">${formatCurrency(grupo.valor)}</td>` : ""}
              </tr>
            </tfoot>
          </table>
        </div>`;
    })
    .join("");

  const corpo = `
    ${cabecalho(titulo, relatorio.de, relatorio.ate, relatorio.grupos.length === 1 ? relatorio.grupos[0].produtor : undefined)}
    <div class="cards">
      <div class="card"><strong>${relatorio.veio}</strong><span>Caixas recebidas</span></div>
      ${verPreco ? `<div class="card"><strong>${formatCurrency(relatorio.valor)}</strong><span>Total a pagar</span></div>` : ""}
    </div>
    ${relatorio.grupos.length === 0 ? `<p class="vazio">Nenhuma carga neste período.</p>` : grupos}
  `;
  abrirImpressao(titulo, corpo);
}

function rotuloFraca(qtd: number, fraca: number) {
  if (fraca <= 0) return "";
  return fraca >= qtd ? " FR" : ` ${fraca} FR`;
}

export function imprimirRelatorioSobra(relatorio: RelatorioSobra) {
  const titulo = relatorio.fornecedor ? `Sobra em estoque · ${relatorio.fornecedor}` : "Sobra em estoque";
  const resumo =
    relatorio.porMercadoria.length === 0
      ? `<p class="vazio">Nada sobrando nesse dia.</p>`
      : `<table>
          <thead><tr><th>Mercadoria</th><th class="num">Sobra</th></tr></thead>
          <tbody>
            ${relatorio.porMercadoria
              .map((item) => `<tr><td>${esc(item.mercadoria)}</td><td class="num">${item.qtd} cx</td></tr>`)
              .join("")}
          </tbody>
          <tfoot><tr><td>Total</td><td class="num">${relatorio.total} cx</td></tr></tfoot>
        </table>`;
  const grupos = relatorio.dias
    .map(
      (dia) => `
      <div class="grupo">
        <h3>${esc(formatDate(dia.data))} · ${dia.total} cx</h3>
        <table>
          <thead><tr><th>Fornecedor</th><th>Mercadoria</th><th class="num">Sobra</th></tr></thead>
          <tbody>
            ${dia.itens
              .map(
                (item) => `<tr>
                  <td>${esc(item.produtor)}</td>
                  <td>${esc(item.mercadoria)}</td>
                  <td class="num">${item.qtd} cx${rotuloFraca(item.qtd, item.fraca)}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
          <tfoot><tr><td colspan="2">Total do dia</td><td class="num">${dia.total} cx</td></tr></tfoot>
        </table>
      </div>`,
    )
    .join("");

  const corpo = `
    ${cabecalho(titulo, relatorio.posicao, relatorio.posicao, relatorio.fornecedor)}
    <div class="cards">
      <div class="card"><strong>${relatorio.lotes}</strong><span>Lotes</span></div>
      <div class="card"><strong>${relatorio.total} cx</strong><span>Sobra em estoque</span></div>
    </div>
    <h2>Por mercadoria</h2>
    ${resumo}
    ${relatorio.dias.length ? `<h2>Por dia da carga</h2>${grupos}` : ""}
  `;
  abrirImpressao(titulo, corpo);
}

export function imprimirRelatorioCaixas(relatorio: RelatorioCaixas) {
  const titulo = "Relatório de caixas";
  const extra = relatorio.tipo ? `Tipo: ${relatorio.tipo}` : "Todos os tipos";
  const linhasDia = relatorio.movimentos
    .map(
      (item) => `
      <tr>
        <td>${esc(formatDate(item.data))}</td>
        <td>${esc(item.fornecedor)}</td>
        <td class="num">${item.veio || "—"}</td>
        <td class="num">${item.pegou || "—"}</td>
        <td>${esc(
          item.detalhe.length
            ? item.detalhe.map((parte) => `${parte.pegou} ${parte.tipo}`).join(" · ")
            : "—",
        )}</td>
      </tr>`,
    )
    .join("");
  const linhasFornecedor = relatorio.fornecedores
    .map(
      (item) => `
      <tr>
        <td>${esc(item.nome)}</td>
        <td class="num">${item.veio || "—"}</td>
        <td class="num">${item.pegou || "—"}</td>
        <td class="num">${item.estoque}</td>
      </tr>`,
    )
    .join("");

  const corpo = `
    ${cabecalho(titulo, relatorio.de, relatorio.ate, extra)}
    <div class="cards">
      <div class="card"><strong>${relatorio.veio}</strong><span>Veio</span></div>
      <div class="card"><strong>${relatorio.pegou}</strong><span>Pegou</span></div>
      <div class="card"><strong>${relatorio.estoque}</strong><span>Com os fornecedores</span></div>
    </div>
    <h2>Por dia</h2>
    ${
      relatorio.movimentos.length === 0
        ? `<p class="vazio">Nenhum movimento de caixa neste período.</p>`
        : `<table>
            <thead><tr><th>Data</th><th>Fornecedor</th><th class="num">Veio</th><th class="num">Pegou</th><th>Tipo</th></tr></thead>
            <tbody>${linhasDia}</tbody>
          </table>`
    }
    <h2>Por fornecedor</h2>
    ${
      relatorio.fornecedores.length === 0
        ? `<p class="vazio">Nenhum fornecedor neste período.</p>`
        : `<table>
            <thead><tr><th>Fornecedor</th><th class="num">Veio</th><th class="num">Pegou</th><th class="num">Estoque dele</th></tr></thead>
            <tbody>${linhasFornecedor}</tbody>
          </table>`
    }
  `;
  abrirImpressao(titulo, corpo);
}

function abrirImpressao(titulo: string, corpo: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", titulo);
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const janela = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!janela || !doc) {
    iframe.remove();
    window.alert("Não foi possível abrir o PDF.");
    return;
  }

  doc.open();
  doc.write(documento(titulo, corpo));
  doc.close();

  const imprimir = () => {
    janela.focus();
    janela.print();
    window.setTimeout(() => iframe.remove(), 2000);
  };

  if (doc.readyState === "complete") {
    window.setTimeout(imprimir, 150);
  } else {
    iframe.addEventListener("load", () => window.setTimeout(imprimir, 150), { once: true });
  }
}
