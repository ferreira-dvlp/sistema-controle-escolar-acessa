/* ===================================================================
   admin.js — Lógica da tela de administração (admin.html)
   ---------------------------------------------------------------
   Organizado nesta ordem:
   1. Login (senha) e inicialização
   2. Inventário (quantidade total de cada equipamento)
   3. Professores (lista de nomes autorizados a agendar)
   4. Registro manual de retirada/devolução
   5. Ações em registros individuais (retirar, cancelar, devolver...)
   6. Painéis: estatísticas, pendentes, ativas, histórico
   7. Reservas de sala (Biblioteca / Sala do Acessa)
   =================================================================== */

// Guarda a versão mais recente de cada coleção do Firestore, sempre
// atualizada em tempo real pelos "ouvir..." do app.js.
let estoqueAtual = null;
let professoresAtual = [];
let movimentacoesAtual = [];
let reservasSalasAtual = [];

// O que o admin já escolheu no formulário de "Novo registro manual".
let selecionado = { tipo: null, periodo: null, aulas: [] };

document.addEventListener("DOMContentLoaded", () => {
  configurarLogin();
  configurarAbas(); // troca entre Inventário / Registro / Salas / Histórico

  // Se o admin já tinha digitado a senha certa nessa mesma aba do
  // navegador (sessionStorage não sobrevive a fechar o navegador),
  // pula direto pro painel sem pedir senha de novo.
  if (sessionStorage.getItem("admin_autenticado") === "true") {
    liberarAcesso();
  }
});


/* ---------- Login (senha) ---------- */

/* Liga o botão "Entrar" e a tecla Enter no campo de senha. A senha
   certa vem de ADMIN_PASSWORD, definida em js/admin-auth.js (não
   fica neste arquivo de propósito, pra ser fácil de trocar sem mexer
   na lógica). */
function configurarLogin() {
  const btnEntrar = document.getElementById("btn-entrar");
  const input = document.getElementById("input-senha");

  const tentarEntrar = () => {
    if (input.value === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_autenticado", "true");
      liberarAcesso();
    } else {
      showToast("Senha incorreta.", "error");
      input.value = "";
    }
  };

  btnEntrar.addEventListener("click", tentarEntrar);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") tentarEntrar(); });
}

/* Esconde a tela de senha, mostra o painel, e chama iniciarAdmin()
   (que só roda de verdade UMA vez, mesmo que essa função seja
   chamada de novo). */
function liberarAcesso() {
  document.getElementById("tela-login").classList.add("hidden");
  document.getElementById("conteudo-admin").classList.remove("hidden");
  iniciarAdmin();
}

let adminJaIniciado = false; // trava pra não duplicar os listeners do Firestore

/* Liga tudo que o painel de admin precisa: os "ouvir..." em tempo
   real de cada coleção do Firestore, e os cliques dos botões e
   formulários. Só roda depois que a senha foi aceita. */
async function iniciarAdmin() {
  if (adminJaIniciado) return;
  adminJaIniciado = true;

  await garantirEstoqueInicial();
  await garantirProfessoresInicial();

  ouvirEstoque((estoque) => {
    estoqueAtual = estoque;
    renderInventario(estoque);
  });

  ouvirProfessores((lista) => {
    professoresAtual = lista;
    renderProfessorSelect(lista); // popula o <select> do registro manual
    renderProfessorList(lista);   // desenha a lista com botão "Remover"
  });

  ouvirMovimentacoes((lista) => {
    movimentacoesAtual = lista;
    renderStats(lista);
    renderPendentes(lista);
    renderAtivas(lista);
    renderHistorico(lista);
  });

  ouvirReservasSalas((lista) => {
    reservasSalasAtual = lista;
    renderSalasPendentes(lista);
    renderSalasConfirmadas(lista);
  });

  // liga os botões de escolha do formulário "Novo registro manual"
  configurarBotoesEscolha("r-tipo", selecionado, "tipo");
  configurarBotoesEscolha("r-periodo", selecionado, "periodo", () => preencherSelectSeries("r-serie", selecionado.periodo, true));
  configurarBotoesMultiEscolha("r-aula", selecionado, "aulas");

  // os botões "Salvar" de cada card de inventário têm um
  // data-tipo="chromebook"/"positivo" indicando qual editar
  document.querySelectorAll("[data-tipo]").forEach((btn) => {
    btn.addEventListener("click", () => salvarTotal(btn.dataset.tipo));
  });

  document.getElementById("btn-retirada").addEventListener("click", criarRetiradaManual);
  document.getElementById("btn-devolucao").addEventListener("click", registrarDevolucaoManual);
  document.getElementById("btn-add-professor").addEventListener("click", adicionarProfessor);
}


/* ---------- Inventário ---------- */

/* Atualiza os números "X / Y" dos cards de inventário. O campo de
   edição (input numérico) também é atualizado, MAS só se o admin não
   estiver digitando nele agora (senão o valor mudaria embaixo do
   dedo da pessoa enquanto ela escreve). */
function renderInventario(estoque) {
  TIPOS.forEach((tipo) => {
    const valorEl = document.getElementById("inv-" + tipo);
    const editEl = document.getElementById("edit-" + tipo);
    if (valorEl && estoque[tipo]) {
      valorEl.innerHTML = '<span class="num">' + estoque[tipo].disponivel + '</span> <small>/ ' + estoque[tipo].total + '</small>';
    }
    if (editEl && estoque[tipo] && document.activeElement !== editEl) {
      editEl.value = estoque[tipo].total;
    }
  });
}

/* Salva um novo total pra um tipo de equipamento. Recalcula o
   "disponível" na hora: se, por exemplo, 5 já estavam em uso e o
   total mudou de 40 pra 30, o disponível vira 25 (30 - 5), nunca
   fica negativo. */
async function salvarTotal(tipo) {
  const novoTotal = parseInt(document.getElementById("edit-" + tipo).value, 10);
  if (isNaN(novoTotal) || novoTotal < 0) return showToast("Informe um número válido.", "error");

  const atual = estoqueAtual[tipo];
  const emUso = atual.total - atual.disponivel;
  const novoDisponivel = Math.max(0, novoTotal - emUso);

  try {
    await db.collection("config").doc("estoque").update({
      [tipo]: { total: novoTotal, disponivel: novoDisponivel }
    });
    showToast(TIPO_LABEL[tipo] + " atualizado.", "success");
  } catch (e) {
    showToast("Erro ao salvar: " + e.message, "error");
  }
}


/* ---------- Professores ---------- */

/* Preenche o <select> "Professor responsável" do registro manual com
   a lista de nomes cadastrados. */
function renderProfessorSelect(lista) {
  const select = document.getElementById("r-professor");
  select.innerHTML = '<option value="">Selecione...</option>';
  lista.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
}

/* Desenha a lista de professores cadastrados, cada um com um botão
   "Remover" ao lado. */
function renderProfessorList(lista) {
  const container = document.getElementById("lista-professores");
  if (lista.length === 0) {
    container.innerHTML = '<div class="empty-state neutral">Nenhum professor cadastrado ainda.</div>';
    return;
  }
  container.innerHTML = "";
  lista.forEach((nome) => {
    const div = document.createElement("div");
    div.className = "record";
    div.innerHTML = `<div class="record-info"><div class="title">${nome}</div></div>`;
    const btn = document.createElement("button");
    btn.className = "btn btn-danger";
    btn.style.width = "auto";
    btn.style.padding = "6px 12px";
    btn.textContent = "Remover";
    btn.addEventListener("click", () => removerProfessor(nome));
    div.appendChild(btn);
    container.appendChild(div);
  });
}

/* Adiciona um nome novo à lista de professores (evita duplicar se o
   nome já existir). */
async function adicionarProfessor() {
  const input = document.getElementById("novo-professor");
  const nome = input.value.trim();
  if (!nome) return showToast("Digite um nome.", "error");
  if (professoresAtual.includes(nome)) return showToast("Esse professor já está na lista.", "error");

  try {
    await db.collection("config").doc("professores").update({
      lista: firebase.firestore.FieldValue.arrayUnion(nome)
    });
    input.value = "";
    showToast("Professor adicionado.", "success");
  } catch (e) {
    showToast("Erro ao adicionar: " + e.message, "error");
  }
}

async function removerProfessor(nome) {
  try {
    await db.collection("config").doc("professores").update({
      lista: firebase.firestore.FieldValue.arrayRemove(nome)
    });
    showToast("Professor removido.", "success");
  } catch (e) {
    showToast("Erro ao remover: " + e.message, "error");
  }
}


/* ---------- Registro manual (retirada / devolução) ---------- */
/* Usado quando o equipamento sai/volta fisicamente da sala sem ter
   passado por um agendamento prévio do professor. */

/* Cria uma retirada diretamente (sem agendamento anterior): valida o
   formulário, confere se ainda tem estoque suficiente, grava a
   movimentação já com status "retirado" e desconta do estoque na
   hora. */
async function criarRetiradaManual() {
  const quantidade = parseInt(document.getElementById("r-quantidade").value, 10);
  const professor = document.getElementById("r-professor").value;
  const numeros = document.getElementById("r-numeros").value.trim();
  const serie = document.getElementById("r-serie").value;
  const { tipo, periodo, aulas } = selecionado;

  if (!tipo) return showToast("Selecione o tipo de equipamento.", "error");
  if (!quantidade || quantidade < 1) return showToast("Informe uma quantidade válida.", "error");
  if (!professor) return showToast("Selecione o professor responsável.", "error");
  if (!periodo) return showToast("Selecione o período.", "error");
  if (!aulas || aulas.length === 0) return showToast("Selecione ao menos uma aula.", "error");

  if (estoqueAtual[tipo].disponivel < quantidade) {
    return showToast("Só há " + estoqueAtual[tipo].disponivel + " " + TIPO_LABEL[tipo] + " disponível(is) agora.", "error");
  }

  try {
    await db.collection("movimentacoes").add({
      tipo, quantidade, professor, periodo,
      serie: serie || null, // série é opcional aqui (diferente do formulário do professor)
      aulas: aulas.slice().sort((a, b) => Number(a) - Number(b)),
      numeros: numeros || null, // números dos notebooks usados, se informado
      data: new Date().toISOString().slice(0, 10), // sempre "hoje", já que é uma saída física agora
      status: "retirado",
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      retiradoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("config").doc("estoque").update({
      [tipo + ".disponivel"]: firebase.firestore.FieldValue.increment(-quantidade)
    });
    showToast("Retirada registrada.", "success");
    limparFormularioManual();
  } catch (e) {
    showToast("Erro ao registrar: " + e.message, "error");
  }
}

/* Registra a devolução usando o mesmo formulário manual: procura,
   entre as retiradas ativas, uma que bata com o tipo + professor
   escolhidos. Se achar exatamente uma, devolve ela. Se não achar
   nenhuma, ou achar mais de uma (ex: o mesmo professor tem duas
   retiradas ativas do mesmo tipo), pede pra usar a lista "Retiradas
   ativas" em vez disso, onde dá pra escolher a exata. */
async function registrarDevolucaoManual() {
  const professor = document.getElementById("r-professor").value;
  const { tipo } = selecionado;

  if (!tipo) return showToast("Selecione o tipo de equipamento.", "error");
  if (!professor) return showToast("Selecione o professor responsável.", "error");

  const candidatos = movimentacoesAtual.filter(
    (m) => m.status === "retirado" && m.tipo === tipo && m.professor === professor
  );

  if (candidatos.length === 0) {
    return showToast("Nenhuma retirada ativa encontrada para esse professor e equipamento.", "error");
  }
  if (candidatos.length > 1) {
    return showToast("Há mais de uma retirada ativa — use o botão \"Devolver\" na lista de retiradas ativas.", "error");
  }

  await devolverPorId(candidatos[0].id, tipo, candidatos[0].quantidade);
  limparFormularioManual();
}

/* Limpa o formulário "Novo registro manual" depois de usar (ou pra
   começar de novo). */
function limparFormularioManual() {
  document.getElementById("r-quantidade").value = "";
  document.getElementById("r-numeros").value = "";
  selecionado = { tipo: null, periodo: null, aulas: [] };
  document.querySelectorAll(".choice-btn").forEach((b) => b.classList.remove("selected"));
  preencherSelectSeries("r-serie", null, true);
}


/* ---------- Ações em registros individuais ---------- */
/* Estas funções são chamadas pelos botões dentro de cada linha das
   listas (Retirar agora / Cancelar / Devolver / Salvar números). */

/* Confirma a retirada de um agendamento que o professor já tinha
   feito: muda o status pra "retirado", registra o horário e os
   números dos notebooks (se informados), e desconta do estoque —
   só agora, na hora que o equipamento sai de fato, não quando foi
   agendado. */
async function retirarAgora(id, tipo, quantidade, numeros) {
  if (estoqueAtual[tipo].disponivel < quantidade) {
    return showToast("Só há " + estoqueAtual[tipo].disponivel + " " + TIPO_LABEL[tipo] + " disponível(is) agora.", "error");
  }
  try {
    await db.collection("movimentacoes").doc(id).update({
      status: "retirado",
      retiradoEm: firebase.firestore.FieldValue.serverTimestamp(),
      numeros: numeros || null
    });
    await db.collection("config").doc("estoque").update({
      [tipo + ".disponivel"]: firebase.firestore.FieldValue.increment(-quantidade)
    });
    showToast("Retirada confirmada.", "success");
  } catch (e) {
    showToast("Erro: " + e.message, "error");
  }
}

/* Cancela um agendamento que ainda não virou retirada (não mexe no
   estoque, porque esse agendamento nunca chegou a descontar nada). */
async function cancelarAgendamento(id) {
  try {
    await db.collection("movimentacoes").doc(id).update({ status: "cancelado" });
    showToast("Agendamento cancelado.", "success");
  } catch (e) {
    showToast("Erro: " + e.message, "error");
  }
}

/* Registra a devolução de uma retirada ativa: muda status pra
   "devolvido" e devolve a quantidade pro estoque disponível. */
async function devolverPorId(id, tipo, quantidade) {
  try {
    await db.collection("movimentacoes").doc(id).update({
      status: "devolvido",
      devolvidoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("config").doc("estoque").update({
      [tipo + ".disponivel"]: firebase.firestore.FieldValue.increment(quantidade)
    });
    showToast("Devolução registrada.", "success");
  } catch (e) {
    showToast("Erro: " + e.message, "error");
  }
}

/* Atualiza só o texto dos "números dos notebooks" de uma retirada já
   ativa — usado quando um notebook trava e precisa trocar por outro
   número, sem precisar cancelar/refazer a retirada inteira. */
async function atualizarNumeros(id, numeros) {
  try {
    await db.collection("movimentacoes").doc(id).update({ numeros: numeros || null });
    showToast("Números atualizados.", "success");
  } catch (e) {
    showToast("Erro: " + e.message, "error");
  }
}


/* ---------- Painéis: estatísticas, pendentes, ativas, histórico ---------- */

/* Calcula os 3 números do resumo no topo da aba Inventário:
   - Em uso agora: soma as quantidades de tudo com status "retirado"
   - Agendamentos pendentes: quantos ainda não foram retirados
   - Devoluções hoje: quantos foram devolvidos NO DIA DE HOJE */
function renderStats(lista) {
  const emUso = lista.filter((m) => m.status === "retirado").reduce((s, m) => s + m.quantidade, 0);
  const pendentes = lista.filter((m) => m.status === "agendado").length;

  const hoje = new Date().toISOString().slice(0, 10);
  const devolucoesHoje = lista.filter((m) => {
    if (m.status !== "devolvido" || !m.devolvidoEm) return false;
    const d = m.devolvidoEm.toDate ? m.devolvidoEm.toDate() : new Date(m.devolvidoEm);
    return d.toISOString().slice(0, 10) === hoje;
  }).length;

  document.getElementById("st-em-uso").textContent = emUso;
  document.getElementById("st-pendentes").textContent = pendentes;
  document.getElementById("st-devolucoes-hoje").textContent = devolucoesHoje;
}

/* Monta o HTML de UMA linha de movimentação (usado no Histórico).
   `badge` é a etiqueta colorida de status, `acoesHtml` são botões
   extras opcionais (não usado no histórico, só deixado genérico caso
   precise no futuro). */
function linhaMovimentacao(m, badge, acoesHtml) {
  const dataFmt = m.data ? m.data.split("-").reverse().join("/") : "-";
  const div = document.createElement("div");
  div.className = "record";
  div.innerHTML = `
    <div class="record-info">
      <div class="title">${TIPO_LABEL[m.tipo]} · ${m.quantidade} un. — ${m.professor}${m.serie ? ' · ' + m.serie : ''}</div>
      <div class="sub">${dataFmt} · ${PERIODO_LABEL[m.periodo] || m.periodo} · ${formatarAulas(m)}</div>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      ${badge}
      ${acoesHtml || ""}
    </div>
  `;
  return div;
}

/* Lista "Agendamentos pendentes": cada linha tem um campo de texto
   pra anotar os números dos notebooks ANTES de confirmar a retirada,
   mais os botões "Retirar agora" (vira uma retirada de verdade,
   desconta do estoque) e "Cancelar" (só marca como cancelado). */
function renderPendentes(lista) {
  const container = document.getElementById("lista-pendentes");
  const pendentes = lista.filter((m) => m.status === "agendado");

  if (pendentes.length === 0) {
    container.innerHTML = '<div class="empty-state">✅ Nenhum agendamento pendente.</div>';
    return;
  }

  container.innerHTML = "";
  pendentes.forEach((m) => {
    const dataFmt = m.data ? m.data.split("-").reverse().join("/") : "-";
    const div = document.createElement("div");
    div.className = "record";
    div.style.flexDirection = "column";
    div.style.alignItems = "stretch";
    div.style.gap = "10px";
    div.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div class="record-info">
          <div class="title">${TIPO_LABEL[m.tipo]} · ${m.quantidade} un. — ${m.professor}${m.serie ? ' · ' + m.serie : ''}</div>
          <div class="sub">${dataFmt} · ${PERIODO_LABEL[m.periodo] || m.periodo} · ${formatarAulas(m)}</div>
        </div>
        <span class="badge blue">Agendado</span>
      </div>
      <input type="text" class="input-numeros" placeholder="Números dos notebooks utilizados (ex: 15 a 55) — opcional">
      <div style="display:flex; gap:6px;">
        <button class="btn btn-green btn-retirar" style="flex:1;">Retirar agora</button>
        <button class="btn btn-outline btn-cancelar" style="width:auto; padding:10px 16px;">Cancelar</button>
      </div>
    `;

    // pega o valor digitado no campo de números NA HORA do clique
    div.querySelector(".btn-retirar").addEventListener("click", () => {
      const numeros = div.querySelector(".input-numeros").value.trim();
      retirarAgora(m.id, m.tipo, m.quantidade, numeros);
    });
    div.querySelector(".btn-cancelar").addEventListener("click", () => cancelarAgendamento(m.id));

    container.appendChild(div);
  });
}

/* Lista "Retiradas ativas": equipamento que já está fisicamente fora
   da sala, aguardando devolução. Mostra os números dos notebooks já
   registrados (ou "não informado"), com um botão "Editar números"
   que revela um campo pra corrigir isso a qualquer momento — sem
   precisar mexer no resto do registro. */
function renderAtivas(lista) {
  const container = document.getElementById("lista-ativas");
  const ativas = lista.filter((m) => m.status === "retirado");

  if (ativas.length === 0) {
    container.innerHTML = '<div class="empty-state">✅ Nenhuma retirada ativa no momento.</div>';
    return;
  }

  container.innerHTML = "";
  ativas.forEach((m) => {
    const dataFmt = m.data ? m.data.split("-").reverse().join("/") : "-";
    const div = document.createElement("div");
    div.className = "record";
    div.style.flexDirection = "column";
    div.style.alignItems = "stretch";
    div.style.gap = "10px";
    div.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div class="record-info">
          <div class="title">${TIPO_LABEL[m.tipo]} · ${m.quantidade} un. — ${m.professor}${m.serie ? ' · ' + m.serie : ''}</div>
          <div class="sub">${dataFmt} · ${PERIODO_LABEL[m.periodo] || m.periodo} · ${formatarAulas(m)}</div>
        </div>
        <span class="badge orange">Em uso</span>
      </div>
      <div class="sub numeros-display">Números: ${m.numeros ? m.numeros : "não informado"}</div>
      <div class="edit-numeros hidden" style="display:flex; gap:6px;">
        <input type="text" class="input-editar-numeros" value="${m.numeros ? m.numeros.replace(/"/g, '&quot;') : ""}" placeholder="Ex: 15 a 55" style="flex:1;">
        <button class="btn btn-cyan btn-salvar-numeros" style="width:auto; padding:8px 12px;">Salvar</button>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-blue-fill btn-devolver" style="flex:1;">Devolver</button>
        <button class="btn btn-outline btn-editar-toggle" style="width:auto; padding:10px 16px;">Editar números</button>
      </div>
    `;

    const linhaEdit = div.querySelector(".edit-numeros");
    const linhaDisplay = div.querySelector(".numeros-display");

    div.querySelector(".btn-devolver").addEventListener("click", () => devolverPorId(m.id, m.tipo, m.quantidade));

    // "Editar números" só mostra/esconde o campo de edição — não
    // salva nada sozinho, é o botão "Salvar" logo abaixo que grava.
    div.querySelector(".btn-editar-toggle").addEventListener("click", () => {
      linhaEdit.classList.toggle("hidden");
      linhaDisplay.classList.toggle("hidden");
    });

    div.querySelector(".btn-salvar-numeros").addEventListener("click", async () => {
      const novoValor = div.querySelector(".input-editar-numeros").value.trim();
      await atualizarNumeros(m.id, novoValor);
      linhaDisplay.textContent = "Números: " + (novoValor || "não informado");
      linhaEdit.classList.add("hidden");
      linhaDisplay.classList.remove("hidden");
    });

    container.appendChild(div);
  });
}

/* Lista "Histórico recente": as últimas 15 movimentações já
   finalizadas (devolvidas ou canceladas). Não tem botões de ação —
   é só consulta. */
function renderHistorico(lista) {
  const container = document.getElementById("lista-historico");
  const historico = lista
    .filter((m) => m.status === "devolvido" || m.status === "cancelado")
    .slice(0, 15); // só as 15 mais recentes, pra não ficar uma lista infinita

  if (historico.length === 0) {
    container.innerHTML = '<div class="empty-state neutral">Sem histórico ainda.</div>';
    return;
  }

  container.innerHTML = "";
  historico.forEach((m) => {
    const badge = m.status === "devolvido"
      ? '<span class="badge teal">Devolvido</span>'
      : '<span class="badge purple">Cancelado</span>';
    const linha = linhaMovimentacao(m, badge);
    if (m.numeros) {
      const p = document.createElement("div");
      p.className = "sub";
      p.style.marginTop = "-4px";
      p.textContent = "Números: " + m.numeros;
      linha.querySelector(".record-info").appendChild(p);
    }
    container.appendChild(linha);
  });
}


/* ---------- Reservas de sala (Biblioteca / Sala do Acessa) ---------- */

/* Aprova uma reserva de sala: muda o status de "pendente" pra
   "confirmado". Diferente do equipamento, não mexe em estoque
   nenhum — sala não tem quantidade. */
async function confirmarReservaSala(id) {
  try {
    await db.collection("reservasSalas").doc(id).update({
      status: "confirmado",
      confirmadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("Reserva confirmada.", "success");
  } catch (e) {
    showToast("Erro: " + e.message, "error");
  }
}

/* Cancela uma reserva de sala (pendente ou já confirmada). Uma vez
   cancelada, ela para de "travar" aquele horário — outro professor
   já pode reservar a mesma sala pro mesmo dia/aula. */
async function cancelarReservaSala(id) {
  try {
    await db.collection("reservasSalas").doc(id).update({ status: "cancelado" });
    showToast("Reserva cancelada.", "success");
  } catch (e) {
    showToast("Erro: " + e.message, "error");
  }
}

/* Monta o HTML de uma linha de reserva de sala (sem botões — quem
   chama essa função decide quais botões adicionar depois). */
function linhaReservaSala(r) {
  const dataFmt = r.data ? r.data.split("-").reverse().join("/") : "-";
  const div = document.createElement("div");
  div.className = "record";
  div.innerHTML = `
    <div class="record-info">
      <div class="title">${SALA_LABEL[r.sala]} — ${r.professor}${r.serie ? ' · ' + r.serie : ''}</div>
      <div class="sub">${dataFmt} · ${PERIODO_LABEL[r.periodo] || r.periodo} · ${formatarAulas(r)}</div>
    </div>
  `;
  return div;
}

/* Lista "Reservas de sala pendentes" — cada uma com botão
   "Confirmar" (libera o horário de vez) ou "Cancelar". */
function renderSalasPendentes(lista) {
  const container = document.getElementById("lista-salas-pendentes");
  const pendentes = lista.filter((r) => r.status === "pendente");

  if (pendentes.length === 0) {
    container.innerHTML = '<div class="empty-state">✅ Nenhuma reserva pendente.</div>';
    return;
  }

  container.innerHTML = "";
  pendentes.forEach((r) => {
    const div = linhaReservaSala(r);
    const acoes = document.createElement("div");
    acoes.style.display = "flex";
    acoes.style.gap = "6px";

    const btnConfirmar = document.createElement("button");
    btnConfirmar.className = "btn btn-green";
    btnConfirmar.style.width = "auto";
    btnConfirmar.style.padding = "6px 12px";
    btnConfirmar.textContent = "Confirmar";
    btnConfirmar.addEventListener("click", () => confirmarReservaSala(r.id));

    const btnCancelar = document.createElement("button");
    btnCancelar.className = "btn btn-outline";
    btnCancelar.style.width = "auto";
    btnCancelar.style.padding = "6px 12px";
    btnCancelar.textContent = "Cancelar";
    btnCancelar.addEventListener("click", () => cancelarReservaSala(r.id));

    acoes.appendChild(btnConfirmar);
    acoes.appendChild(btnCancelar);
    div.appendChild(acoes);
    container.appendChild(div);
  });
}

/* Lista "Reservas confirmadas" — só o botão "Cancelar" (pra quando
   algo mudar depois de já ter sido aprovado). */
function renderSalasConfirmadas(lista) {
  const container = document.getElementById("lista-salas-confirmadas");
  const confirmadas = lista.filter((r) => r.status === "confirmado");

  if (confirmadas.length === 0) {
    container.innerHTML = '<div class="empty-state neutral">Nenhuma reserva confirmada ainda.</div>';
    return;
  }

  container.innerHTML = "";
  confirmadas.forEach((r) => {
    const div = linhaReservaSala(r);
    const btnCancelar = document.createElement("button");
    btnCancelar.className = "btn btn-outline";
    btnCancelar.style.width = "auto";
    btnCancelar.style.padding = "6px 12px";
    btnCancelar.textContent = "Cancelar";
    btnCancelar.addEventListener("click", () => cancelarReservaSala(r.id));
    div.appendChild(btnCancelar);
    container.appendChild(div);
  });
}
