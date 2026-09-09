/* ===================================================================
   CONFIGURAÇÃO DO FIREBASE — ARQUIVO DE EXEMPLO
   ---------------------------------------------------------------
   Para rodar o sistema:
   1. Copie este arquivo e renomeie a cópia para "firebase-config.js"
      (na mesma pasta, js/).
   2. Preencha os valores abaixo com os dados do SEU projeto Firebase
      (Console do Firebase > Configurações do projeto > Geral >
      "Seus aplicativos" > SDK setup and configuration > Config).
   3. Salve. O arquivo firebase-config.js (sem "-example") é ignorado
      pelo git automaticamente, então pode preencher com a chave real
      sem risco de subir ela sem querer.

   Veja o passo a passo completo em COMO-CONFIGURAR.md.
   =================================================================== */

const firebaseConfig = {
  apiKey: "COLOQUE_AQUI",
  authDomain: "COLOQUE_AQUI.firebaseapp.com",
  projectId: "COLOQUE_AQUI",
  storageBucket: "COLOQUE_AQUI.appspot.com",
  messagingSenderId: "COLOQUE_AQUI",
  appId: "COLOQUE_AQUI"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
