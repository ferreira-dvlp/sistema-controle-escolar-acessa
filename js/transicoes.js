/* ===================================================================
   transicoes.js — Efeito de transição suave ao trocar de página
   ---------------------------------------------------------------
   Como o sistema usa páginas HTML separadas (index.html,
   professor.html, admin.html) e não é um "app de página única", uma
   troca de página normalmente é um corte seco. Este arquivo suaviza
   isso: quando alguém clica num link de navegação (Início / Sou
   professor(a) / Administração), a tela atual desliza pra fora antes
   de trocar de página de verdade.

   A entrada (fade-in ao carregar uma página nova) é feita só com CSS,
   pela animação em .wrap no style.css — não precisa de JS pra isso.
   =================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.querySelector(".wrap");
  if (!wrap) return;

  // só os links de navegação principal (não as abas internas tipo
  // Equipamentos/Salas, que já têm sua própria animação de entrada)
  document.querySelectorAll("nav.pill-tabs a.pill-tab").forEach((link) => {
    link.addEventListener("click", (e) => {
      const destino = link.getAttribute("href");
      if (!destino || link.classList.contains("active")) return; // já está nessa página, não faz nada

      e.preventDefault(); // segura a navegação por um instante
      wrap.classList.add("pagina-saindo"); // dispara a animação de saída (CSS)
      setTimeout(() => { window.location.href = destino; }, 150); // só então troca de página de verdade
    });
  });
});
