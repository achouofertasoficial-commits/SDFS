# RSG Script Forge AI 🚀

RSG Script Forge AI é um ecossistema inteligente de alta performance projetado especificamente para engenharia de scripts RedM no **RSG Framework**. Ele combina uma interface técnica moderna, barramento de cache local em memória, barramento RAG em banco Supabase, e a inteligência generativa avançada do modelo Gemini 3.5 Flash de forma 100% full-stack e segura.

---

## 🛠️ Stack Tecnológica

* **Backend / API Middleware**: Node + Express (TypeScript com `tsx` em desenvolvimento e `esbuild` para bundle de produção standalone).
* **Frontend SPA Layout**: React 19 + Vite + Tailwind CSS v4 para interfaces limpas e de alto contraste.
* **Inteligência Artificial (IA)**: `@google/genai` v2 (SDK Moderno da Google para inferência server-side com cache contextual e resposta estruturada em JSON).
* **Banco de Dados & RAG**: Supabase (PostgreSQL nativo com busca por texto completo, chaves estrangeiras relacionais e triggers automáticos de atualização).
* **Gestão de Metadados (`generated_by`)**: Rastreamento profundo da origem dos códigos através das tags `gemini`, `mock`, e `manual` que são persistidas no banco e geram alertas visuais dinâmicos em tela sobre a confiabilidade do script.
* **Modelo RAG Futuro**: O sistema está orquestrado com uma busca por similaridade textual exata e por tags. Um roadmap futuro prevê a extensão usando `pgvector` no PostgreSQL para embeddings semânticos densos conforme a base de dados escalar.

---

## 🚀 Como Iniciar Localmente

Para rodar o projeto localmente em sua máquina de trabalho, siga as instruções abaixo:

### 1. Clonar e Instalar Dependências
```bash
# Entre na pasta raiz do repositório
npm install
```

### 2. Configurar Arquivo de Ambientes
Copie o exemplo do arquivo `.env.example` e crie um arquivo `.env` na raiz do projeto:
```bash
cp .env.example .env
```
Preencha as variáveis de ambiente:
* `GEMINI_API_KEY`: Sua chave de faturamento oficial do Google AI Studio.
* `SUPABASE_URL`: A URL do seu banco Supabase.
* `SUPABASE_ANON_KEY`: A chave anônima pública para chamadas de API.

> 🔒 *Nota de Segurança:* Você também pode preencher e atualizar estes parâmetros diretamente na interface do app em **Configurações (Sincronizador de Credenciais)**. Isso aplicará a chave temporariamente em memória de execução no servidor Express, impedindo que dados do Gemini vazem para o código cliente do navegador.

### 3. Rodar os Servidores (Vite + Express)
Para iniciar os servidores concatenados em desenvolvimento (rodando nativamente na porta `3000`):
```bash
npm run dev
```
O app estará acessível em `http://localhost:3000`.

---

## 💾 Guia de Configuração do Supabase

Siga o passo a passo detalhado abaixo para preparar a nuvem do Supabase antes de interagir com o robô RAG:

### Passo 1: Criar sua Conta e Projeto
1. Acesse [database.supabase.com](https://supabase.com) e crie uma conta gratuita.
2. Crie um novo projeto, por exemplo: `RSG Script Forge Base`.
3. Guarde com segurança a senha mestra do banco, a **Project URL** e a **Anon/Public API Key** fornecidas no painel inicial do projeto.

### Passo 2: Executar o Blueprint de Tabelas SQL
1. No menu lateral do painel Supabase, clique em **SQL Editor**.
2. Clique em **New Query** (Nova consulta).
3. Abra o arquivo `/supabase-blueprint.sql` incluído no projeto, copie todo o seu conteúdo e cole-o no Editor SQL do Supabase.
4. Clique em **Run** (Executar).

Este script irá configurar de forma automática:
* A tabela `knowledge_documents` (para RAG).
* A tabela `ai_chats` (para sessões).
* A tabela `ai_messages` (para mensagens).
* A tabela `generated_scripts` (para recursos salvos).
* A tabela `app_configurations` (para credenciais dinâmicas).
* Triggers automáticos para manter os timestamps de `updated_at`.
* Índices de performance GIN para pesquisas textuais rápidas em tags, categorias e conteúdos de código lua.

---

## 🧪 Como Testar o Sistema de Forma Prática

Siga esta trilha de testes para validar todas as rotas e fallbacks do Script Forge:

### 1. Validando Estado de Conexão (Dashboard e Configurações)
* Inicialmente, ao abrir o **Dashboard**, os banners devem indicar explicitamente `FALLBACK LOCAL / MOCK` se você não preencheu nenhuma credencial.
* Vá para **Configurações (Sincronizador de Credenciais)**, insira suas chaves caso as tenha, e clique em **Salvar Configurações**. 
* O status mudará imediatamente para `CONECTADO` real, tanto em Banco de Dados quanto a Gemini Engine.

### 2. Cadastrando e Gerenciando Conhecimento (RAG CRUD)
* Acesse a guia **Base de Conhecimento** no menu lateral.
* No formulário à direita **"Cadastrar Conhecimento"**, preencha os campos para indexar um guia:
  * **Título**: `Como usar UI Prompts nativos do RedM`
  * **Categoria**: `RedM Natives`
  * **Tags**: `prompts, rsg, ui, native`
  * **Conteúdo**: Cole um exemplo em código Lua ensinando o uso correto de `UiPromptRegisterBegin`.
  * **Observações Técnicas**: `Sempre execute dentro de loops Thread com Wait(0) controlado.`
* Clique em **Indexar Tópico**. O documento será listado imediatamente na tabela de busca à esquerda.
* **Fluxo de Edição**: Clique no documento cadastrado para ver detalhes. Toque em **Editar**, modifique o campo e toque em **Atualizar Tópico na Base**. O documento se atualizará sincronizadamente no painel.
* **Fluxo de Exclusão**: Para limpar ou remover dados antigos, selecione o documento e clique em **Excluir** para deletá-lo do banco Supabase permanentemente.

### 3. Executando Consultas pelo Chat IA (RAG no Pipeline Gemini)
* Vá para a aba **Chat IA** no menu esquerdo.
* Clique no botão **"+"** superior para abrir uma nova conversa (ex: `Desenvolver Rob de Trem RSG`).
* Faça um prompt contendo palavras indexadas na sua base de dados (por exemplo, *"Preciso criar um script RSG que use UI Prompts na tela"*).
* A IA do Express buscará nativamente na base Supabase os tópicos relevantes, formatando o contexto RAG e alimentando o Gemini.
* No balão de resposta da IA, expanda o acordeão **"📚 Base Consultada"** para ver em tempo real quantos e quais documentos foram injetados no prompt contextual para guiar as decisões de arquitetura da IA.
* O script gerado aparecerá formatado e divido por arquivos (`fxmanifest.lua`, `config.lua`, `client.lua`, `server.lua`) no editor lateral direito para cópia imediata de código.

---

## 🛡️ Diretrizes de Arquitetura Limpa
* **Isolamento Completo**: Nenhuma chave ou token sensível é exportado para as compilações ou para o bundle JS do navegador, prevenindo ataques maliciosos no servidor.
* **Separabilidade de Framework**: Gerador calado exclusivamente para a infraestrutura do **RSG-Core**.
* **Proteção contra Over-Engineering**: Visual escuro, profissional e técnico intocado, fornecendo controle direto de arquivos de scaffolding ao dev profissional de servidores de RedM do faroeste.
