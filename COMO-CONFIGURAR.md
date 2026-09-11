# Como configurar e publicar o sistema

Este guia assume que você não é programador(a) — vá seguindo os passos na ordem.

## Parte 1 — Criar o banco de dados (Firebase)

1. Acesse **https://console.firebase.google.com** e faça login com a conta Google institucional da escola.
2. Clique em **"Adicionar projeto"**, dê um nome (ex: `controle-acesso-sua-escola`) e siga o assistente (pode desativar o Google Analytics, não é necessário).
3. Dentro do projeto, no menu lateral, clique em **"Compilação" > "Firestore Database"**.
4. Clique em **"Criar banco de dados"**.
   - Escolha a localização mais próxima (`southamerica-east1` — São Paulo).
   - Em modo de segurança, escolha **"Iniciar no modo de teste"** por enquanto (vamos ajustar as regras no Passo 4).
5. Ainda no console, clique no ícone de engrenagem (canto superior esquerdo) > **"Configurações do projeto"**.
6. Role até **"Seus aplicativos"** e clique no ícone **`</>`** (Web) para registrar um app.
7. Dê um apelido (ex: `controle-acesso-web`) e clique em **"Registrar app"**.
8. O Firebase vai mostrar um bloco de código com `firebaseConfig = { ... }`. Copie os valores de dentro dele.

## Parte 2 — Colar a configuração no sistema

1. Dentro da pasta `js/`, copie o arquivo `firebase-config.example.js` e cole a cópia na mesma pasta com o nome `firebase-config.js` (sem o "-example").
2. Abra o `firebase-config.js` (o novo, sem "-example") e substitua cada `"COLOQUE_AQUI"` pelo valor correspondente que você copiou no Firebase.
3. Salve o arquivo.

## Parte 2.1 — Definir a senha de administração

1. Dentro da pasta `js/`, copie o arquivo `admin-auth.example.js` e cole a cópia na mesma pasta com o nome `admin-auth.js` (sem o "-example").
2. Abra o `admin-auth.js` (o novo, sem "-example") e troque `"troque-esta-senha"` pela senha que você quer usar para entrar em `admin.html`.
3. Salve o arquivo.

> Atenção: essa senha protege a tela, mas fica escrita neste arquivo. Não é uma proteção forte — não use uma senha que você usa em outro lugar importante. Ela só existe para impedir que qualquer pessoa que ache o link do sistema entre direto na administração.

## Parte 3 — Regras de segurança do banco

Como o sistema não usa login individual, o acesso aos dados é protegido apenas pelo link não ser divulgado publicamente. Ainda assim, é importante impedir que qualquer pessoa na internet acesse o banco diretamente (fora do site).

1. No Firebase, vá em **Firestore Database > Regras**.
2. Substitua o conteúdo por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Clique em **"Publicar"**.

## Parte 4 — Colocar o site no ar (Firebase Hosting)

Você vai precisar instalar duas ferramentas gratuitas uma única vez: **Node.js** e o **Firebase CLI**.

1. Baixe e instale o Node.js em **https://nodejs.org** (escolha a versão "LTS").
2. Abra o "Prompt de Comando" (Windows) ou "Terminal" (Mac) e rode:
   ```
   npm install -g firebase-tools
   firebase login
   ```
   (vai abrir o navegador pedindo para logar com a mesma conta Google usada no Firebase)
3. Navegue até a pasta do projeto (`sistema-controle-escolar-acessa`) pelo terminal, por exemplo:
   ```
   cd Downloads/projeto-controle-escolar-acessa
   ```
4. Rode:
   ```
      firebase init hosting
   ```
   - Escolha **"Use an existing project"** e selecione o projeto que você criou.
   - Pasta pública: digite `.` (ponto, significa "esta pasta").
   - "Configure as a single-page app": responda **N** (não).
   - Não sobrescreva o `index.html` se perguntar.
5. Rode:
   ```
   firebase deploy
   ```
6. Ao final, o terminal mostra um link parecido com `https://controle-acesso.web.app` — esse é o endereço definitivo do sistema.

Sempre que quiser atualizar o site no futuro (depois de qualquer alteração nos arquivos), basta rodar `firebase deploy` de novo dentro da pasta.

## Parte 5 — Compartilhar com os professores

- Envie o link (ex: `https://controle-acesso.web.app/professor.html`) para os professores agendarem.
- Guarde para você o link da administração: `https://controle-acesso.web.app/admin.html`.
- Primeiro passo depois de publicar: entre na tela de administração e cadastre os nomes dos professores em **"Professores cadastrados"** — sem isso, ninguém aparece na lista de agendamento.

## Dúvidas comuns

- **A tela fica em branco / não carrega os dados:** confira se os valores em `js/firebase-config.js` foram colados corretamente, sem aspas faltando.
- **Erro "Missing or insufficient permissions":** revise a Parte 3 (regras do Firestore).
