/* ===================================================================
   professor.js — Lógica da tela do professor (index.html e
   professor.html usam este mesmo arquivo)
   ---------------------------------------------------------------
   Duas partes bem separadas, que dá pra ler independentemente:
   1. Agendamento de EQUIPAMENTO (Chromebook/Positivo)
   2. Reserva de SALA (Biblioteca/Sala do Acessa)
   Ambas seguem o mesmo padrão: guardar a escolha atual num objeto
   (`selecionado` / `selecionadoSala`), mostrar uma prévia de
   disponibilidade em tempo real, e só then salvar no Firestore
   quando o formulário for enviado.
   =================================================================== */

// Guarda a versão mais recente dos dados vindos do Firestore, pra
// poder recalcular disponibilidade sem precisar buscar de novo no
// banco toda hora (os "ouvir..." do app.js já mantêm isso atualizado
// sozinhos, em tempo real).
let estoqueAtual = null;
let movimentacoesAtual = [];
let reservasSalasAtual = [];

// O que o professor já escolheu no formulário de EQUIPAMENTO.
let selecionado = { tipo: null, periodo: null, aulas: [] };
// O que o professor já escolheu no formulário de SALA.
let selecionadoSala = { sala: null, periodo: null, aulas: [] };

document.addEventListener("DOMContentLoaded", async () => {
  configurarAbas(); // liga a troca entre as abas "Equipamentos" / "Salas"

  await garantirEstoqueInicial();
  await garantirProfessoresInicial();

  // Toda vez que o estoque mudar no banco (em qualquer aba, de
  // qualquer pessoa), atualiza os cards e a prévia de disponibilidade.
  ouvirEstoque((estoque) => {
    estoqueAtual = estoque;
    renderInventario(estoque);
    atualizarPreviewDisponibilidade();
  });

  // A lista de professores alimenta os dois seletores de nome (o do
  // formulário de equipamento e o do formulário de sala).
  ouvirProfessores((lista) => {
    renderProfessores(lista);
    renderProfessoresSala(lista);
  });

  // Toda mudança nos agendamentos de equipamento (novo, retirado,
  // devolvido, cancelado) atualiza a lista "Próximos agendamentos" e
  // recalcula a disponibilidade — é assim que o "vaga fechada" reflete
  // na hora quando outro professor agenda o mesmo horário.
  ouvirMovimentacoes((lista) => {
    movimentacoesAtual = lista;
    renderAgendamentos(lista);
    atualizarPreviewDisponibilidade();
  });

  // Mesma lógica, só que para as reservas de sala.
  ouvirReservasSalas((lista) => {
    reservasSalasAtual = lista;
    renderReservasSalas(lista);
    atualizarPreviewSala();
  });

  // --- Formulário de equipamento: liga os botões de escolha ---
  configurarBotoesEscolha("f-tipo", selecionado, "tipo", atualizarPreviewDisponibilidade);
  configurarBotoesEscolha("f-periodo", selecionado, "periodo", aoMudarPeriodoEquip);
  configurarBotoesMultiEscolha("f-aula", selecionado, "aulas", atualizarPreviewDisponibilidade);
  document.getElementById("f-data").addEventListener("change", atualizarPreviewDisponibilidade);
  document.getElementById("btn-agendar").addEventListener("click", criarAgendamento);

  // --- Formulário de sala: mesma ideia ---
  configurarBotoesEscolha("s-sala", selecionadoSala, "sala", atualizarPreviewSala);
  configurarBotoesEscolha("s-periodo", selecionadoSala, "periodo", aoMudarPeriodoSala);
  configurarBotoesMultiEscolha("s-aula", selecionadoSala, "aulas", atualizarPreviewSala);
  document.getElementById("s-data").addEventListener("change", atualizarPreviewSala);
  document.getElementById("btn-reservar-sala").addEventListener("click", criarReservaSala);

  // Não deixa escolher uma data no passado em nenhum dos dois formulários.
  const hoje = new Date().toISOString().slice(0, 10);
  document.getElementById("f-data").min = hoje;
  document.getElementById("s-data").min = hoje;
});

/* Quando o período do formulário de EQUIPAMENTO muda, o select de
   série precisa ser repreenchido (as turmas da manhã são diferentes
   das da tarde) e a prévia de disponibilidade precisa recalcular. */
function aoMudarPeriodoEquip() {
  preencherSelectSeries("f-serie", selecionado.periodo);
  atualizarPreviewDisponibilidade();
}

/* Mesma ideia, para o formulário de SALA — aqui a série pode incluir
   a opção "Sem série específica" (por isso o `true` no final). */
function aoMudarPeriodoSala() {
  preencherSelectSeries("s-serie", selecionadoSala.periodo, true);
  atualizarPreviewSala();
}


/* ============================= EQUIPAMENTO ============================= */

/* Atualiza os cards "Chromebook X/Y" e "Positivo X/Y" com os números
   mais recentes do estoque. */
function renderInventario(estoque) {
  TIPOS.forEach((tipo) => {
    const el = document.getElementById("inv-" + tipo);
    if (el && estoque[tipo]) {
      el.innerHTML = '<span class="num">' + estoque[tipo].disponivel + '</span> <small>/ ' + estoque[tipo].total + '</small>';
    }
  });
}

/* Preenche o <select> "Seu nome" do formulário de equipamento com a
   lista de professores cadastrados pelo admin. Se a lista estiver
   vazia, mostra um aviso pedindo pra falar com o administrador. */
function renderProfessores(lista) {
  const select = document.getElementById("f-professor");
  const avisoVazio = document.getElementById("sem-professores");
  select.innerHTML = '<option value="">Selecione seu nome...</option>';
  lista.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
  avisoVazio.classList.toggle("hidden", lista.length > 0);
}

/* Mesma lista de nomes, mas pro seletor do formulário de SALA. */
function renderProfessoresSala(lista) {
  const select = document.getElementById("s-professor");
  select.innerHTML = '<option value="">Selecione seu nome...</option>';
  lista.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  });
}

/* Mostra, em tempo real, quantas unidades ainda sobram para a
   data+período+aula(s) que o professor está escolhendo AGORA (antes
   mesmo de confirmar o agendamento). Some se faltar algum campo
   ainda não preenchido. Fica vermelho se a disponibilidade for zero. */
function atualizarPreviewDisponibilidade() {
  const el = document.getElementById("preview-disponibilidade");
  if (!el) return;

  const { tipo, periodo, aulas } = selecionado;
  const data = document.getElementById("f-data").value;

  if (!tipo || !periodo || !data || !aulas || aulas.length === 0 || !estoqueAtual || !estoqueAtual[tipo]) {
    el.classList.add("hidden");
    return;
  }

  const disponivel = calcularDisponibilidadeHorario(movimentacoesAtual, estoqueAtual, tipo, data, periodo, aulas);

  el.classList.remove("hidden");
  el.innerHTML = "Disponível para " + formatarAulas({ aulas }) + " nesse dia: <strong>" + disponivel + "</strong> de " + estoqueAtual[tipo].total;
  el.style.color = disponivel === 0 ? "var(--red)" : "";
}

/* Roda quando o professor clica em "Agendar". Valida todos os
   campos, confere de novo (do lado do servidor de dados, não só
   visualmente) se ainda sobra disponibilidade suficiente, e só então
   grava o agendamento no Firestore com status "agendado" — ele fica
   pendente até o admin confirmar a retirada de verdade. */
async function criarAgendamento() {
  const professor = document.getElementById("f-professor").value;
  const quantidade = parseInt(document.getElementById("f-quantidade").value, 10);
  const data = document.getElementById("f-data").value;
  const serie = document.getElementById("f-serie").value;
  const { tipo, periodo, aulas } = selecionado;

  // validações básicas — cada uma cancela o envio e avisa o motivo
  if (!professor) return showToast("Selecione seu nome.", "error");
  if (!tipo) return showToast("Selecione o tipo de equipamento.", "error");
  if (!quantidade || quantidade < 1) return showToast("Informe uma quantidade válida.", "error");
  if (!data) return showToast("Selecione a data de uso.", "error");
  if (!periodo) return showToast("Selecione o período.", "error");
  if (!serie) return showToast("Selecione a série/turma.", "error");
  if (!aulas || aulas.length === 0) return showToast("Selecione ao menos uma aula.", "error");

  if (!estoqueAtual || !estoqueAtual[tipo]) {
    return showToast("Não foi possível verificar o estoque, tente novamente.", "error");
  }

  // checagem "de verdade": será que ainda cabe, considerando tudo que
  // já foi agendado por OUTRAS pessoas nesse mesmo horário?
  const disponivelSlot = calcularDisponibilidadeHorario(movimentacoesAtual, estoqueAtual, tipo, data, periodo, aulas);

  if (quantidade > disponivelSlot) {
    return showToast(
      "Só há " + disponivelSlot + " " + TIPO_LABEL[tipo] + " disponível(is) para " +
      formatarAulas({ aulas }) + " nesse dia.",
      "error"
    );
  }

  const btn = document.getElementById("btn-agendar");
  btn.disabled = true; // evita clique duplo enquanto salva

  try {
    await db.collection("movimentacoes").add({
      tipo, quantidade, professor, periodo, serie,
      aulas: aulas.slice().sort((a, b) => Number(a) - Number(b)), // salva sempre em ordem crescente
      data,
      status: "agendado",
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("Agendamento confirmado!", "success");

    // limpa o formulário pra um próximo agendamento
    document.getElementById("f-quantidade").value = "";
    selecionado = { tipo: null, periodo: null, aulas: [] };
    document.querySelectorAll(".choice-btn").forEach((b) => b.classList.remove("selected"));
    preencherSelectSeries("f-serie", null);
    atualizarPreviewDisponibilidade();
  } catch (e) {
    showToast("Erro ao agendar: " + e.message, "error");
  } finally {
    btn.disabled = false;
  }
}

/* Desenha a lista "Próximos agendamentos" — mostra tudo que está
   "agendado" (ainda não retirado) ou "retirado" (já em uso), pra
   qualquer professor ver a agenda geral, não só a própria. */
function renderAgendamentos(lista) {
  const container = document.getElementById("lista-agendamentos");
  const pendentes = lista.filter((m) => m.status === "agendado" || m.status === "retirado");

  if (pendentes.length === 0) {
    container.innerHTML = '<div class="empty-state neutral">Nenhum agendamento no momento.</div>';
    return;
  }

  container.innerHTML = "";
  pendentes.forEach((m) => {
    const div = document.createElement("div");
    div.className = "record";
    const dataFmt = m.data ? m.data.split("-").reverse().join("/") : "-"; // AAAA-MM-DD → DD/MM/AAAA
    div.innerHTML = `
      <div class="record-info">
        <div class="title">${TIPO_LABEL[m.tipo]} · ${m.quantidade} un. — ${m.professor}${m.serie ? ' · ' + m.serie : ''}</div>
        <div class="sub">${dataFmt} · ${PERIODO_LABEL[m.periodo] || m.periodo} · ${formatarAulas(m)}</div>
      </div>
      <span class="badge ${m.status === 'retirado' ? 'orange' : 'blue'}">${m.status === 'retirado' ? 'Em uso' : 'Agendado'}</span>
    `;
    container.appendChild(div);
  });
}


/* ============================= SALAS ============================= */
/* Reserva de Biblioteca / Sala do Acessa. Segue o mesmo padrão do
   equipamento (prévia em tempo real + validação + gravação), mas sem
   quantidade: sala é "livre ou ocupada", não tem meio-termo. Toda
   reserva de sala fica "pendente" até o admin confirmar. */

const SALA_STATUS_LABEL = { pendente: "Aguardando confirmação", confirmado: "Confirmado", cancelado: "Cancelado" };
const SALA_STATUS_BADGE = { pendente: "amber", confirmado: "blue", cancelado: "purple" };

/* Mostra, em tempo real, se a sala escolhida está livre ou ocupada
   para a data+período+aula(s) selecionados — antes mesmo de enviar. */
function atualizarPreviewSala() {
  const el = document.getElementById("preview-sala");
  if (!el) return;

  const { sala, periodo, aulas } = selecionadoSala;
  const data = document.getElementById("s-data").value;

  if (!sala || !periodo || !data || !aulas || aulas.length === 0) {
    el.classList.add("hidden");
    return;
  }

  const ocupada = salaOcupada(reservasSalasAtual, sala, data, periodo, aulas);

  el.classList.remove("hidden");
  if (ocupada) {
    el.innerHTML = SALA_LABEL[sala] + " já está reservada para " + formatarAulas({ aulas }) + " nesse dia.";
    el.style.color = "var(--red)";
  } else {
    el.innerHTML = SALA_LABEL[sala] + " está livre para " + formatarAulas({ aulas }) + " nesse dia.";
    el.style.color = "";
  }
}

/* Roda quando o professor clica em "Reservar". Valida os campos,
   confere de novo se a sala continua livre (pode ser que alguém
   tenha reservado um segundo antes) e grava a reserva como
   "pendente" — só vira "confirmado" quando o admin aprovar. */
async function criarReservaSala() {
  const professor = document.getElementById("s-professor").value;
  const data = document.getElementById("s-data").value;
  const serie = document.getElementById("s-serie").value;
  const { sala, periodo, aulas } = selecionadoSala;

  if (!professor) return showToast("Selecione seu nome.", "error");
  if (!sala) return showToast("Selecione a sala.", "error");
  if (!data) return showToast("Selecione a data de uso.", "error");
  if (!periodo) return showToast("Selecione o período.", "error");
  if (!serie) return showToast("Selecione a série/turma.", "error");
  if (!aulas || aulas.length === 0) return showToast("Selecione ao menos uma aula.", "error");

  if (salaOcupada(reservasSalasAtual, sala, data, periodo, aulas)) {
    return showToast(SALA_LABEL[sala] + " já está reservada para " + formatarAulas({ aulas }) + " nesse dia.", "error");
  }

  const btn = document.getElementById("btn-reservar-sala");
  btn.disabled = true;

  try {
    await db.collection("reservasSalas").add({
      sala, professor, periodo, serie,
      aulas: aulas.slice().sort((a, b) => Number(a) - Number(b)),
      data,
      status: "pendente",
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("Reserva enviada! Aguardando confirmação do administrador.", "success");

    // limpa o formulário
    selecionadoSala = { sala: null, periodo: null, aulas: [] };
    document.querySelectorAll("#s-sala .choice-btn, #s-periodo .choice-btn, #s-aula .choice-btn")
      .forEach((b) => b.classList.remove("selected"));
    preencherSelectSeries("s-serie", null, true);
    atualizarPreviewSala();
  } catch (e) {
    showToast("Erro ao reservar: " + e.message, "error");
  } finally {
    btn.disabled = false;
  }
}

/* Desenha a lista "Próximas reservas de sala" — mostra tanto as
   pendentes quanto as já confirmadas, com uma etiqueta colorida
   indicando o status de cada uma. */
function renderReservasSalas(lista) {
  const container = document.getElementById("lista-reservas-salas");
  const ativas = lista.filter((r) => r.status === "pendente" || r.status === "confirmado");

  if (ativas.length === 0) {
    container.innerHTML = '<div class="empty-state neutral">Nenhuma reserva de sala no momento.</div>';
    return;
  }

  container.innerHTML = "";
  ativas.forEach((r) => {
    const div = document.createElement("div");
    div.className = "record";
    const dataFmt = r.data ? r.data.split("-").reverse().join("/") : "-";
    div.innerHTML = `
      <div class="record-info">
        <div class="title">${SALA_LABEL[r.sala]} — ${r.professor}${r.serie ? ' · ' + r.serie : ''}</div>
        <div class="sub">${dataFmt} · ${PERIODO_LABEL[r.periodo] || r.periodo} · ${formatarAulas(r)}</div>
      </div>
      <span class="badge ${SALA_STATUS_BADGE[r.status]}">${SALA_STATUS_LABEL[r.status]}</span>
    `;
    container.appendChild(div);
  });
}
