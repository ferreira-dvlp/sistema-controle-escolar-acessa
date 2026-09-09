/* ===================================================================
   inicio.js — Lógica da tela inicial (index.html)
   ---------------------------------------------------------------
   Essa página é só uma "vitrine": mostra a disponibilidade de
   equipamentos e salas, mas não tem nenhum formulário — pra agendar
   de verdade, é preciso ir na aba "Sou professor(a)". Por isso este
   arquivo é bem mais curto que professor.js.
   =================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await garantirEstoqueInicial();
  ouvirEstoque(renderInventarioInicio);       // atualiza os cards de Chromebook/Positivo
  ouvirReservasSalas(renderSalasInicio);      // atualiza os cards de Biblioteca/Sala do Acessa
});

/* Mostra "X / Y" (disponível / total) pra cada tipo de equipamento. */
function renderInventarioInicio(estoque) {
  TIPOS.forEach((tipo) => {
    const el = document.getElementById("inv-" + tipo);
    if (el && estoque[tipo]) {
      el.innerHTML = '<span class="num">' + estoque[tipo].disponivel + '</span> <small>/ ' + estoque[tipo].total + '</small>';
    }
  });
}

/* Mostra se cada sala está "Livre" hoje ou quantas reservas
   CONFIRMADAS ela já tem no dia. Importante: isso é uma visão do dia
   inteiro, não "ocupada neste minuto exato" — o sistema não sabe que
   horário do relógio corresponde a cada aula, só sabe a data. */
function renderSalasInicio(reservas) {
  const hoje = new Date().toISOString().slice(0, 10);

  SALAS.forEach((sala) => {
    const el = document.getElementById("sala-" + sala);
    if (!el) return;

    const reservasHoje = reservas.filter((r) => r.sala === sala && r.status === "confirmado" && r.data === hoje);

    if (reservasHoje.length === 0) {
      el.innerHTML = '<span class="num">Livre</span>';
    } else {
      el.innerHTML = '<span class="num">' + reservasHoje.length + '</span> <small>reserva(s) hoje</small>';
    }
  });
}
