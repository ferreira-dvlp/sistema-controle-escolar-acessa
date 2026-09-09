/* ===================================================================
   app.js — Funções e dados COMPARTILHADOS entre todas as páginas
   ---------------------------------------------------------------
   Este arquivo não faz nada sozinho: ele só define funções e listas
   que professor.js, admin.js e inicio.js usam. Por isso ele é
   carregado em TODAS as páginas, sempre antes dos outros arquivos
   de lógica (menos firebase-config.js, que vem antes até deste).
   =================================================================== */

/* Tipos de equipamento que o sistema controla hoje. Se um dia a
   escola adquirir Tablets, por exemplo, é só adicionar aqui (e criar
   o campo correspondente no estoque). */
const TIPOS = ["chromebook", "positivo"];
const TIPO_LABEL = { chromebook: "Chromebook", positivo: "Positivo" };


/* ---------- Avisos rápidos na tela (toast) ---------- */

/* Mostra uma mensagem pequena no rodapé da tela por alguns segundos
   e depois some sozinha. `tipo` é opcional: "success" (verde) ou
   "error" (vermelho) — sem isso, fica neutro. */
function showToast(msg, tipo) {
  const el = document.createElement("div");
  el.className = "toast" + (tipo ? " " + tipo : "");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200); // some sozinho depois de ~3,2s
}

/* Transforma um "timestamp" do Firestore (o jeito que ele guarda
   data+hora) num texto legível tipo "09/09/2026 14:30". */
function formatDataHora(timestamp) {
  if (!timestamp) return "-";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}


/* ---------- Estoque de equipamentos (Firestore: config/estoque) ---------- */

/* Roda uma vez, na primeira vez que o sistema é usado: se o documento
   de estoque ainda não existir no banco, cria ele com os números
   iniciais abaixo. Depois disso, quem controla o total é a tela de
   administração (aba Inventário) — esses números aqui só valem pro
   "nascimento" do sistema. */
async function garantirEstoqueInicial() {
  const ref = db.collection("config").doc("estoque");
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      chromebook: { total: 44, disponivel: 44 },
      positivo: { total: 115, disponivel: 115 }
    });
  }
}

/* Mesma ideia, mas para a lista de nomes de professores que aparece
   nos seletores de agendamento. Começa vazia — o admin cadastra os
   nomes depois, pela tela de administração. */
async function garantirProfessoresInicial() {
  const ref = db.collection("config").doc("professores");
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ lista: [] });
  }
}

/* "Escuta" o documento de estoque em tempo real: toda vez que ele
   mudar no banco (em qualquer aba, de qualquer pessoa), a função
   `callback` é chamada de novo com os dados atualizados. É assim que
   o número de "disponível" atualiza sozinho na tela, sem precisar
   recarregar a página. */
function ouvirEstoque(callback) {
  return db.collection("config").doc("estoque").onSnapshot((snap) => {
    if (snap.exists) callback(snap.data());
  });
}

/* Mesma ideia do ouvirEstoque, mas para a lista de nomes de
   professores cadastrados. */
function ouvirProfessores(callback) {
  return db.collection("config").doc("professores").onSnapshot((snap) => {
    callback(snap.exists ? snap.data().lista || [] : []);
  });
}

/* Escuta TODOS os agendamentos/retiradas/devoluções de equipamento
   (a coleção "movimentacoes" no Firestore), sempre em tempo real e
   ordenados do mais novo pro mais antigo. Cada "movimentação" é um
   registro com status: "agendado" → "retirado" → "devolvido"
   (ou "cancelado" no meio do caminho). */
function ouvirMovimentacoes(callback) {
  return db.collection("movimentacoes").orderBy("criadoEm", "desc").onSnapshot((snap) => {
    const lista = [];
    snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
    callback(lista);
  });
}


/* ---------- Botões de escolha (aquelas "pílulas" clicáveis) ---------- */

/* Liga os cliques de um grupo de botões (ex: os botões de Tipo,
   Período) para que só UM fique marcado por vez — como um grupo de
   rádio, só que com visual de botão. O valor escolhido fica salvo em
   `estadoSelecao[chave]`. `aoMudar` é uma função opcional chamada
   toda vez que a escolha muda (usada, por exemplo, pra recalcular a
   disponibilidade na hora). */
function configurarBotoesEscolha(containerId, estadoSelecao, chave, aoMudar) {
  const container = document.getElementById(containerId);
  container.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".choice-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      estadoSelecao[chave] = btn.dataset.val;
      if (aoMudar) aoMudar();
    });
  });
}

/* Como a função acima, mas permite marcar MAIS DE UM botão ao mesmo
   tempo (usado no seletor de "Aulas", já que dá pra reservar mais de
   uma aula no mesmo agendamento). Em vez de guardar um valor só,
   guarda uma LISTA de valores marcados em `estadoSelecao[chave]`. */
function configurarBotoesMultiEscolha(containerId, estadoSelecao, chave, aoMudar) {
  estadoSelecao[chave] = estadoSelecao[chave] || [];
  const container = document.getElementById(containerId);
  container.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.val;
      const lista = estadoSelecao[chave];
      const idx = lista.indexOf(val);
      if (idx === -1) {
        // ainda não estava marcado → marca
        lista.push(val);
        btn.classList.add("selected");
      } else {
        // já estava marcado → desmarca
        lista.splice(idx, 1);
        btn.classList.remove("selected");
      }
      if (aoMudar) aoMudar();
    });
  });
}


/* ---------- Formatação de aulas e períodos ---------- */

/* Recebe um objeto com `.aulas` (array de strings, ex: ["2","3","4"])
   e devolve um texto pronto pra exibir:
   - uma aula só           → "3ª aula"
   - aulas seguidas        → "2ª–4ª aula"  (intervalo, mais compacto)
   - aulas NÃO seguidas     → "1ª, 3ª aulas"
   Também entende o campo antigo `aula` (no singular, string única),
   de registros feitos antes dessa função existir. */
function formatarAulas(m) {
  const aulas = m && m.aulas ? m.aulas : (m && m.aula ? [String(m.aula)] : []);
  if (!aulas.length) return "-";
  const nums = aulas.map(Number).sort((a, b) => a - b);

  // verifica se os números formam uma sequência sem "buracos" (2,3,4)
  let contigua = true;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) { contigua = false; break; }
  }

  if (nums.length === 1) return nums[0] + "ª aula";
  if (contigua) return nums[0] + "ª–" + nums[nums.length - 1] + "ª aula";
  return nums.map((n) => n + "ª").join(", ") + " aulas";
}

const PERIODO_LABEL = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };


/* ---------- Abas internas (Equipamentos/Salas, Inventário/Registro/...) ---------- */

/* Liga o clique dos botões de aba (".tab-btn") pra mostrar/esconder
   o painel correspondente (".tab-panel"). Cada botão tem um
   data-tab="algo" que precisa bater com o data-tab-panel="algo" do
   painel que ele deve abrir. Usado tanto na tela do professor
   (Equipamentos/Salas) quanto na do admin (Inventário/Registro/
   Salas/Histórico). */
function configurarAbas() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector('[data-tab-panel="' + btn.dataset.tab + '"]').classList.add("active");
    });
  });
}


/* ---------- Salas (Biblioteca / Sala do Acessa) ---------- */

const SALAS = ["biblioteca", "acessa"];
const SALA_LABEL = { biblioteca: "Biblioteca", acessa: "Sala do Acessa" };

/* Valor curto salvo/exibido quando o professor não tem uma série/
   turma fixa pra aquele uso da sala (ex: vai usar mais de uma vez no
   dia, com turmas diferentes). Só aparece nos formulários de sala
   (professor) e no registro manual (admin) — no de equipamento a
   série é sempre obrigatória de verdade. */
const SEM_SERIE_ESPECIFICA = "Sem série específica";

/* Lista de séries/turmas que aparecem no seletor, separadas por
   período (porque as turmas da manhã não são as mesmas da tarde). */
const SERIES_POR_PERIODO = {
  manha: ["TESTE", "6ºA", "6ºB", "6ºC", "6ºD", "7ºA", "7ºB", "8ºA", "8ºB", "8ºC", "9ºA", "9ºB", "9ºC"],
  tarde: ["TESTE", "1ºA", "1ºB", "1ºC", "1ºD", "2ºA", "2ºB", "3ºA", "3ºB"]
};

/* Preenche um <select> de série/turma com as opções do período
   escolhido. Precisa ser chamada de novo toda vez que o período
   mudar (o conteúdo do select depende dele). `incluirSemSerie: true`
   adiciona a opção "Sem série específica" no topo da lista — só use
   isso nos formulários de sala, não no de equipamento. */
function preencherSelectSeries(selectId, periodo, incluirSemSerie) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const opcoes = SERIES_POR_PERIODO[periodo] || [];
  select.innerHTML = periodo
    ? '<option value="">Selecione a série/turma...</option>'
    : '<option value="">Selecione o período primeiro...</option>';

  if (incluirSemSerie && opcoes.length > 0) {
    const opt = document.createElement("option");
    opt.value = SEM_SERIE_ESPECIFICA;
    opt.textContent = SEM_SERIE_ESPECIFICA;
    select.appendChild(opt);
  }

  opcoes.forEach((serie) => {
    const opt = document.createElement("option");
    opt.value = serie;
    opt.textContent = serie;
    select.appendChild(opt);
  });
  select.disabled = opcoes.length === 0; // trava o select se não tiver período escolhido ainda
}

/* Escuta em tempo real a coleção "reservasSalas" no Firestore — cada
   reserva de Biblioteca/Sala do Acessa é um documento aqui, com
   status "pendente" → "confirmado" (pelo admin) ou "cancelado". */
function ouvirReservasSalas(callback) {
  return db.collection("reservasSalas").orderBy("criadoEm", "desc").onSnapshot((snap) => {
    const lista = [];
    snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
    callback(lista);
  });
}

/* Diz se uma sala já está ocupada numa combinação de
   data + período + aulas. Diferente do equipamento (que tem
   quantidade), sala é "tudo ou nada": ou está livre, ou já tem
   alguém. `ignorarId` serve pra excluir a própria reserva da
   checagem, útil se um dia isso virar editável. */
function salaOcupada(reservas, sala, data, periodo, aulas, ignorarId) {
  if (!aulas || aulas.length === 0) return false;
  return reservas.some((r) =>
    r.id !== ignorarId &&
    r.sala === sala &&
    r.data === data &&
    r.periodo === periodo &&
    (r.status === "pendente" || r.status === "confirmado") && // reservas canceladas não contam
    (r.aulas || []).some((a) => aulas.includes(a)) // basta UMA aula em comum pra dar conflito
  );
}


/* ---------- Disponibilidade de equipamento por horário ---------- */

/* Calcula quantas unidades de `tipo` (ex: "chromebook") ainda estão
   livres para uma data + período + conjunto de aulas específico,
   levando em conta o que já está agendado OU retirado nesse mesmo
   horário (equipamento devolvido/cancelado não conta mais).

   Como o professor pode reservar mais de uma aula ao mesmo tempo
   (ex: 2ª à 4ª), e o equipamento precisa estar livre em TODAS elas
   simultaneamente, o resultado é o PIOR CASO entre as aulas
   escolhidas — não a soma. Ex: se sobra 20 na 2ª aula mas só 5 na
   3ª aula, o sistema mostra 5 (porque é o gargalo).

   `movimentacoes` é a lista completa vinda de ouvirMovimentacoes.
   `ignorarId` permite excluir o próprio registro da conta (útil se um
   dia isso virar editável, pra não "competir consigo mesmo"). */
function calcularDisponibilidadeHorario(movimentacoes, estoque, tipo, data, periodo, aulas, ignorarId) {
  if (!estoque || !estoque[tipo]) return 0;
  const total = estoque[tipo].total;
  if (!aulas || aulas.length === 0) return total;

  // primeiro filtra só o que realmente compete pelo mesmo tipo/dia/período
  const relevantes = movimentacoes.filter((m) =>
    m.id !== ignorarId &&
    m.tipo === tipo &&
    m.data === data &&
    m.periodo === periodo &&
    (m.status === "agendado" || m.status === "retirado")
  );

  // depois, para cada aula escolhida, soma quanto já está reservado
  // nela e guarda o pior caso (menor sobra) entre todas
  let piorCaso = total;
  aulas.forEach((aula) => {
    const reservado = relevantes
      .filter((m) => (m.aulas || (m.aula ? [String(m.aula)] : [])).includes(String(aula)))
      .reduce((soma, m) => soma + m.quantidade, 0);
    const livre = total - reservado;
    if (livre < piorCaso) piorCaso = livre;
  });

  return Math.max(0, piorCaso); // nunca devolve número negativo
}
