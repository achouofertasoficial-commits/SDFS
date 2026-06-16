-- ==========================================
-- RSG Script Forge AI - Supabase Database Schema
-- Place these queries inside your Supabase SQL Editor.
-- ==========================================

-- Enable UI search or pgvector extension if needed
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Tabela: knowledge_documents
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    framework TEXT NOT NULL DEFAULT 'RSG',
    content_type TEXT NOT NULL, -- 'documentação', 'native', 'evento', etc.
    source_url TEXT,
    trust_level TEXT DEFAULT 'medio', -- 'alto', 'medio', 'baixo'
    tags TEXT[] DEFAULT '{}',
    content TEXT NOT NULL,
    technical_notes TEXT,
    -- campo futuro para embeddings (comentado caso o pgvector não esteja ativo)
    -- embedding vector(1536), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices de busca textual simples de fallback
CREATE INDEX IF NOT EXISTS idx_kb_title ON knowledge_documents(title);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_documents(category);

-- 2. Tabela: ai_chats
CREATE TABLE IF NOT EXISTS ai_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT DEFAULT 'Novo Script Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela: ai_messages
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES ai_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'model', 'system'
    content TEXT NOT NULL,
    retrieved_context JSONB, -- Array de documentos de contexto resgatados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela: generated_scripts
CREATE TABLE IF NOT EXISTS generated_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES ai_chats(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    framework TEXT DEFAULT 'RSG',
    files JSONB NOT NULL DEFAULT '{}'::jsonb, -- Estrutura { "client.lua": "...", "server.lua": "..." }
    dependencies TEXT[] DEFAULT '{}',
    install_steps TEXT[] DEFAULT '{}',
    warnings TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- SEED DATA - Carga Inicial Recomendada
-- ==========================================

INSERT INTO knowledge_documents (title, category, subcategory, framework, content_type, trust_level, tags, content, technical_notes)
VALUES 
(
  'Inicialização do RSG Core e GetCoreObject', 
  'RSG Core', 
  'Inicialização', 
  'RSG', 
  'documentação', 
  'alto', 
  ARRAY['rsg-core', 'init', 'boilerplate', 'getcoreobject'], 
  'Como padrão de desenvolvimento no RSG Framework, todos os scripts (client e server) devem obter a instância do objeto do core para acessar as funções de callbacks, gerenciamento de jogadores, itens e comandos.

Código Padrão de Inicialização (Adicione no início do seu client.lua ou server.lua):
```lua
local RSGCore = exports['rsg-core']:GetCoreObject()
```

Não utilize loops pesados para tentar encontrar o core ou exportações obsoletas. Esta única chamada é performática e garante a compatibilidade com a última versão do RSG Core no RedM.',
  'Compatível apenas com o RedM RSG Framework (versões pós-2023). Substitui o antigo TriggerEvent(''RSGCore:GetObject'').'
),
(
  'Callbacks Seguros entre Client e Server', 
  'RSG Callbacks', 
  'Comunicação Client-Server', 
  'RSG', 
  'padrão_de_segurança', 
  'alto', 
  ARRAY['callbacks', 'server-callbacks', 'segurança', 'validação'], 
  'O RSG Core fornece um sistema assíncrono muito robusto para consultar dados no servidor a partir do cliente sem a necessidade do uso confuso de pares de eventos (TriggerServerEvent / RegisterNetEvent). Isso é crucial para evitar trapaças (exploits), pois ações como transações financeiras, confirmações de itens e permissões devem ser avaliadas e autorizadas de forma estrita no servidor.

Definição no Server (server.lua):
```lua
local RSGCore = exports['rsg-core']:GetCoreObject()

-- Registrar o callback no servidor
RSGCore.Functions.CreateCallback(''my-resource:server:checkGold'', function(source, cb, requiredAmount)
    local Player = RSGCore.Functions.GetPlayer(source)
    if not Player then return cb(false) end
    
    local goldItem = Player.Functions.GetItemByName(''gold_ingot'')
    if goldItem and goldItem.amount >= requiredAmount then
        cb(true)
    else
        cb(false)
    end
end)
```

Consumo no Client (client.lua):
```lua
local RSGCore = exports['rsg-core']:GetCoreObject()

-- Acionar o callback no cliente
local amt = 2
RSGCore.Functions.TriggerCallback(''my-resource:server:checkGold'', function(hasEnough)
    if hasEnough then
        -- O servidor validou que o jogador possui o ouro
        print("Tudo certo! Você possui os itens necessários.")
    else
        -- O servidor avisou que o jogador não possui
        print("Erro: Você não possui a quantidade necessária de lingotes de ouro.")
    end
end, amt)
```',
  'Centralize todas as validações de itens e dinheiro no servidor. Nunca confie do lado cliente.'
);
