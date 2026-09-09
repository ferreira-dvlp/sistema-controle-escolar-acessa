# 📚 Controle de Equipamentos — Sala do Acessa

Sistema web desenvolvido para auxiliar no **controle, retirada, devolução e agendamento de equipamentos/espaços** utilizados de uma instituição de ensino.

O projeto foi desenvolvido com o objetivo de substituir controles manuais e facilitar o gerenciamento dos equipamentos e espaços disponíveis, permitindo que professores realizem agendamentos e que a administração acompanhe as movimentações em um único sistema.

---

## 🎯 Objetivo

Centralizar o gerenciamento dos recursos da Sala do Acessa, proporcionando:

* Controle da disponibilidade dos equipamentos;
* Registro de retiradas e devoluções;
* Agendamento de equipamentos;
* Reserva de espaços;
* Gerenciamento de professores;
* Acompanhamento de reservas pendentes;
* Histórico de movimentações.

---

## 🚀 Funcionalidades

### 👨‍🏫 Área do Professor

O professor pode consultar a disponibilidade dos equipamentos e realizar agendamentos.

#### Equipamentos

* Visualização da quantidade disponível;
* Agendamento de equipamentos;
* Seleção do tipo e quantidade de equipamentos;
* Definição de data, período e aulas;
* Consulta dos próprios agendamentos.

Atualmente, o sistema trabalha com:

* 💻 Chromebooks
* 💻 Notebooks Positivo

#### Salas

Permite reservar:

* 📚 Biblioteca
* 🖥️ Sala do Acessa

O sistema verifica conflitos de horário e impede que uma sala seja reservada por duas turmas simultaneamente.

As reservas de sala ficam **pendentes até a confirmação do administrador**.

---

### 🔐 Área Administrativa

A área administrativa é protegida por autenticação e permite o gerenciamento geral do sistema.

#### 📦 Inventário

* Resumo dos equipamentos;
* Quantidade total disponível;
* Visualização dos professores cadastrados.

#### 📝 Registro

* Registro manual de retirada;
* Registro de devolução;
* Confirmação de agendamentos;
* Registro dos números físicos dos equipamentos retirados;
* Edição dos equipamentos vinculados a uma retirada ativa.

#### 🏫 Salas

* Visualização de reservas pendentes;
* Confirmação de reservas;
* Cancelamento de reservas;
* Consulta das reservas confirmadas.

#### 📊 Histórico

* Histórico de devoluções;
* Histórico de cancelamentos;
* Consulta dos números dos equipamentos registrados durante as retiradas.

---

## 💻 Tecnologias utilizadas

* **HTML5** — estrutura das páginas;
* **CSS3** — estilização e responsividade;
* **JavaScript** — lógica e funcionalidades do sistema;
* **Firebase** — infraestrutura e integração com o backend;
* **Cloud Firestore** — armazenamento dos dados em tempo real;
* **Firebase Hosting** — hospedagem da aplicação.

---

## 🗂️ Estrutura do projeto

```text
controle-acesso/
│
├── index.html
├── professor.html
├── admin.html
├── 404.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── firebase-config.example.js
│   ├── admin-auth.example.js
│   ├── app.js
│   ├── professor.js
│   ├── admin.js
│   ├── inicio.js
│   └── transicoes.js
│
├── firebase.json
├── .firebaserc
├── COMO-CONFIGURAR.md
└── README.md
```

### Organização dos arquivos

| Arquivo          | Responsabilidade                                 |
| ---------------- | ------------------------------------------------ |
| `index.html`     | Página inicial do sistema                        |
| `professor.html` | Área destinada aos professores                   |
| `admin.html`     | Painel administrativo                            |
| `style.css`      | Estilos e responsividade                         |
| `app.js`         | Funções compartilhadas e comunicação com o banco |
| `professor.js`   | Funcionalidades da área do professor             |
| `admin.js`       | Funcionalidades administrativas                  |
| `inicio.js`      | Lógica da página inicial                         |
| `transicoes.js`  | Transições entre páginas                         |
| `firebase.json`  | Configuração do Firebase Hosting                 |
| `.firebaserc`    | Identificação do projeto Firebase                |

---

## 💻 Controle dos equipamentos

O sistema permite registrar quais equipamentos físicos foram retirados.

Por exemplo:

```text
15 a 55
```

ou:

```text
3, 7, 12, 40
```

Esse campo é propositalmente livre e pode ser preenchido:

* Durante uma retirada manual;
* Ao confirmar um agendamento;
* Posteriormente, enquanto a retirada estiver ativa.

Isso permite alterar os equipamentos registrados caso seja necessário substituir algum dispositivo durante a utilização.

---

## 🗄️ Banco de dados

Os dados são armazenados utilizando o **Cloud Firestore**.

A aplicação utiliza o banco para armazenar informações como:

* Professores;
* Agendamentos;
* Reservas;
* Retiradas;
* Devoluções;
* Histórico de movimentações.

As informações são sincronizadas em tempo real, permitindo que alterações realizadas no sistema sejam refletidas sem a necessidade de atualizar manualmente a página.

---

## ⚙️ Configuração

Para executar o projeto, é necessário configurar um projeto no Firebase e adicionar as credenciais correspondentes.

O passo a passo completo está disponível em:

**[COMO-CONFIGURAR.md](COMO-CONFIGURAR.md)**

Os arquivos de configuração são disponibilizados apenas como modelos:

```text
js/firebase-config.example.js
js/admin-auth.example.js
```

---

## 🔒 Segurança

Este projeto foi desenvolvido inicialmente para utilização em um ambiente escolar controlado.

As configurações de autenticação e as regras do Firestore devem ser adequadamente configuradas antes de utilizar o sistema em um ambiente de produção.

**Nunca publique credenciais ou configurações privadas diretamente no repositório.**

---

## 📱 Responsividade

A interface foi desenvolvida para funcionar em diferentes tamanhos de tela, permitindo a utilização do sistema em computadores, notebooks e dispositivos móveis.

---

## 📈 Possíveis melhorias

Algumas funcionalidades podem ser implementadas futuramente:

* [ ] Autenticação utilizando Firebase Authentication;
* [ ] Controle de permissões por usuário;
* [ ] Regras de segurança mais restritivas no Firestore;
* [ ] Cadastro completo de novos tipos de equipamentos;
* [ ] Controle individual dos equipamentos por número;
* [ ] Relatórios de utilização;
* [ ] Dashboard com indicadores;
* [ ] Exportação de dados;
* [ ] Sistema de notificações;
* [ ] Controle de Tablets.

---

## 👨‍💻 Sobre o projeto

Este projeto foi desenvolvido como uma solução prática para o gerenciamento dos recursos da Sala do Acessa de uma instituição de ensino.

Além de aplicar conhecimentos de desenvolvimento web, o projeto envolve conceitos de:

* Desenvolvimento de sistemas;
* Manipulação de dados;
* Banco de dados NoSQL;
* Integração com serviços em nuvem;
* Controle de acesso;
* Organização de código;
* Desenvolvimento de uma solução para um problema real.

---

## 📄 Licença

Este projeto é destinado para fins educacionais e de portfólio.

```
