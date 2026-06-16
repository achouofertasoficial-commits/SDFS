import { KnowledgeDocument } from './types';

export const initialKnowledgeBase: KnowledgeDocument[] = [
  {
    id: "rsg-core-init",
    title: "Inicialização do RSG Core e GetCoreObject",
    category: "RSG Core",
    subcategory: "Inicialização",
    framework: "RSG",
    content_type: "documentação",
    trust_level: "alto",
    tags: ["rsg-core", "init", "boilerplate", "getcoreobject"],
    content: `Como padrão de desenvolvimento no RSG Framework, todos os scripts (client e server) devem obter a instância do objeto do core para acessar as funções de callbacks, gerenciamento de jogadores, itens e comandos.

Código Padrão de Inicialização (Adicione no início do seu client.lua ou server.lua):
\`\`\`lua
local RSGCore = exports['rsg-core']:GetCoreObject()
\`\`\`

Não utilize loops pesados para tentar encontrar o core ou exportações obsoletas. Esta única chamada é performática e garante a compatibilidade com a última versão do RSG Core no RedM.`,
    technical_notes: "Compatível apenas com o RedM RSG Framework (versões pós-2023). Substitui o antigo TriggerEvent('RSGCore:GetObject')."
  },
  {
    id: "rsg-callbacks-pattern",
    title: "Callbacks Seguros entre Client e Server",
    category: "RSG Callbacks",
    subcategory: "Comunicação Client-Server",
    framework: "RSG",
    content_type: "padrão_de_segurança",
    trust_level: "alto",
    tags: ["callbacks", "server-callbacks", "segurança", "validação"],
    content: `O RSG Core fornece um sistema assíncrono muito robusto para consultar dados no servidor a partir do cliente sem a necessidade do uso confuso de pares de eventos (TriggerServerEvent / RegisterNetEvent). Isso é crucial para evitar trapaças (exploits), pois ações como transações financeiras, confirmações de itens e permissões devem ser avaliadas e autorizadas de forma estrita no servidor.

Definição no Server (server.lua):
\`\`\`lua
local RSGCore = exports['rsg-core']:GetCoreObject()

-- Registrar o callback no servidor
RSGCore.Functions.CreateCallback('my-resource:server:checkGold', function(source, cb, requiredAmount)
    local Player = RSGCore.Functions.GetPlayer(source)
    if not Player then return cb(false) end
    
    local goldItem = Player.Functions.GetItemByName('gold_ingot')
    if goldItem and goldItem.amount >= requiredAmount then
        cb(true)
    else
        cb(false)
    end
end)
\`\`\`

Consumo no Client (client.lua):
\`\`\`lua
local RSGCore = exports['rsg-core']:GetCoreObject()

-- Acionar o callback no cliente
local amt = 2
RSGCore.Functions.TriggerCallback('my-resource:server:checkGold', function(hasEnough)
    if hasEnough then
        -- O servidor validou que o jogador possui o ouro
        print("Tudo certo! Você possui os itens necessários.")
    else
        -- O servidor avisou que o jogador não possui
        print("Erro: Você não possui a quantidade necessária de lingotes de ouro.")
    end
end, amt)
\`\`\``,
    technical_notes: "Centralize todas as validações de itens e dinheiro no servidor. Nunca confie do lado cliente."
  },
  {
    id: "rsg-player-money",
    title: "Gerenciamento de Dinheiro e Itens no Servidor",
    category: "RSG Core",
    subcategory: "Funções de Jogador (Player)",
    framework: "RSG",
    content_type: "exemplo",
    trust_level: "alto",
    tags: ["dinheiro", "itens", "inventário", "addmoney", "removeitem"],
    content: `No RSG Framework, o controle de dinheiro e itens é feito exclusivamente através do objeto 'Player', obtido no servidor com RSGCore.Functions.GetPlayer(source).

Métodos Comuns de Dinheiro:
\`\`\`lua
-- Adicionar dinheiro (tipos: 'cash' ou 'bank')
Player.Functions.AddMoney('cash', 150)
Player.Functions.AddMoney('bank', 500)

-- Remover dinheiro (retorna true se tiver sucesso, false se não tiver o valor)
local success = Player.Functions.RemoveMoney('cash', 50)
\`\`\`

Métodos Comuns de Itens (Inventário):
\`\`\`lua
-- Adicionar item (nome do item, quantidade, slot, metadados)
Player.Functions.AddItem('water', 1)

-- Remover item
Player.Functions.RemoveItem('water', 1)

-- Buscar item por nome (retorna tabela do item ou nil se não encontrado)
local item = Player.Functions.GetItemByName('gold_ore')
if item then
    print("Quantidade de minério de ouro: " .. item.amount)
end
\`\`\`

Exemplo completo de evento de processamento seguro (server.lua):
\`\`\`lua
RegisterNetEvent('my-goldmine:server:processGold', function()
    local src = source
    local Player = RSGCore.Functions.GetPlayer(src)
    if not Player then return end
    
    local oreItem = Player.Functions.GetItemByName('gold_ore')
    if oreItem and oreItem.amount >= 3 then
        Player.Functions.RemoveItem('gold_ore', 3)
        -- Adiciona 1 pepita de ouro e 20 dólares de recompensa pelo esforço
        Player.Functions.AddItem('gold_nugget', 1)
        Player.Functions.AddMoney('cash', 20)
        TriggerClientEvent('RSGCore:Notify', src, "Minério de ouro processado!", "success")
    else
        TriggerClientEvent('RSGCore:Notify', src, "Você não tem minério de ouro suficiente (mínimo 3).", "error")
    end
end)
\`\`\``,
    technical_notes: "Sempre verifique 'Player.Functions.GetItemByName' antes de dar 'RemoveItem' para garantir que hacks não façam chamadas diretas com itens inexistentes."
  },
  {
    id: "rsg-commands",
    title: "Adição de Comandos Compartilhados e Administrativos",
    category: "RSG Commands",
    subcategory: "Comandos Administrativos",
    framework: "RSG",
    content_type: "documentação",
    trust_level: "alto",
    tags: ["comandos", "rsg-commands", "permissões", "admin"],
    content: `O RSG Core substitui a declaração tradicional de comandos por uma função integrada de registro que lida nativamente com controle de permissões de níveis de admin, god, etc.

Como registrar comandos Admin no Servidor (server.lua):
\`\`\`lua
local RSGCore = exports['rsg-core']:GetCoreObject()

-- RSGCore.Commands.Add(nome, descrição, argumentos, se argumentos são obrigatórios, handler, permissão)
RSGCore.Commands.Add('givescratch', 'Dá bilhetes de raspadinha para um jogador (Apenas Admin)', {
    {name = 'id', help = 'ID do Jogador'}, 
    {name = 'amount', help = 'Quantidade'}
}, true, function(source, args)
    local targetId = tonumber(args[1])
    local amount = tonumber(args[2]) or 1
    local Player = RSGCore.Functions.GetPlayer(targetId)
    
    if Player then
        Player.Functions.AddItem('scratchcard', amount)
        TriggerClientEvent('RSGCore:Notify', source, "Bilhete enviado!", "success")
    else
        TriggerClientEvent('RSGCore:Notify', source, "Jogador offline.", "error")
    end
end, 'admin') -- Nível de permissão necessário ('admin', 'god', etc.)
\`\`\`

Como registrar comandos públicos de utilidade (server.lua):
\`\`\`lua
RSGCore.Commands.Add('meuid', 'Mostre o seu ID atual no chat', {}, false, function(source)
    TriggerClientEvent('chat:addMessage', source, {
        args = { "SISTEMA", "Seu ID é: " .. source }
    })
end) -- Sem o último argumento, o comando torna-se liberado para todos os cidadãos do servidor
\`\`\``,
    technical_notes: "É um padrão fundamental usar RSGCore.Commands.Add para manter logs de comandos auditados e segregação de privilégios nativa."
  },
  {
    id: "redm-prompts-native",
    title: "Prompt Groups e Teclas de Interação compatíveis com RedM",
    category: "RedM Natives",
    subcategory: "UI Prompts",
    framework: "RSG",
    content_type: "snippet",
    trust_level: "alto",
    tags: ["redm", "prompts", "input", "interação", "keys"],
    content: `No RedM, as interações visuais seguras do jogador (como focar em objetos, pressionar teclas para coletar itens, etc.) são feitas configurando Prompt Groups nativos. O código abaixo cria um prompt de tecla de fácil reutilização para o RSG Framework.

Classe Helper de Interação do Prompt (client.lua):
\`\`\`lua
local promptGroup = GetRandomIntInRange(0, 0xffffff)
local actionPrompt

function SetupPrompts()
    -- Criar o prompt
    actionPrompt = UiPromptRegisterBegin()
    -- Definir o botão focado do RedM (Ex: Tecla G [0x760B966F] ou Tecla E [0xCEFD9220] ou J [0xF385F75C])
    UiPromptSetControlAction(actionPrompt, 0x760B966F) -- G
    
    -- Definir textos de exibição
    local str = CreateVarString(10, "LITERAL_STRING", "Minerar Ouro")
    UiPromptSetText(actionPrompt, str)
    
    -- Definir comportamento (Segurar para completar ou Apenas Pressionar)
    UiPromptSetStandardMode.2(actionPrompt, true) -- Segurar por cerca de 1,5 segundos
    
    -- Registrar no grupo
    UiPromptRegisterEnd(actionPrompt)
    UiPromptSetGroup(actionPrompt, promptGroup)
    UiPromptSetEnabled(actionPrompt, true)
    UiPromptSetVisible(actionPrompt, true)
end

-- Thread de Renderização do Prompt
CreateThread(function()
    SetupPrompts()
    while true do
        Wait(0)
        local playerPed = PlayerPedId()
        local playerCoords = GetEntityCoords(playerPed)
        local targetCoords = vector3(-1200.0, -500.0, 50.0) -- Exemplo de Coordenada
        
        local distance = #(playerCoords - targetCoords)
        if distance < 2.0 then
            -- Mostrar o grupo de prompt de forma otimizada
            local label = CreateVarString(10, "LITERAL_STRING", "Mina de Ouro")
            PromptSetActiveGroupThisFrame(promptGroup, label)
            
            -- Verificar clique/segurar completo do prompt
            if UiPromptHasHoldModeCompleted(actionPrompt) then
                print("Segurou o Prompt com sucesso!")
                TriggerServerEvent('my-resource:server:mine')
                Wait(3000) -- Evitar spam
            end
        else
            Wait(1000) -- Dorme por 1 segundo se estiver longe para economizar CPU
        end
    end
end)
\`\`\``,
    technical_notes: "Sempre durma o loop de coordenadas com Wait(1000) ou similar se o jogador estiver muito longe do ponto de interação, reduzindo o uso de CPU significativamente."
  },
  {
    id: "rsg-exports-notifications",
    title: "Sistema de Notificações nativas do RSG Core",
    category: "RSG Core",
    subcategory: "Notificações",
    framework: "RSG",
    content_type: "snippet",
    trust_level: "alto",
    tags: ["notify", "client-notify", "rsg-notify"],
    content: `O RSG Framework possui um sistema de notificação visual integrado que adapta avisos visuais bonitos e nativos no canto da tela do RedM.

Como enviar notificações do Servidor para um Cliente:
\`\`\`lua
-- No Servidor (Envia para um jogador específico através do seu Source ID)
TriggerClientEvent('RSGCore:Notify', source, "Mensagem de Sucesso!", "success")
TriggerClientEvent('RSGCore:Notify', source, "Aviso! Você corre perigo.", "error")
TriggerClientEvent('RSGCore:Notify', source, "Verifique sua mochila.", "primary")
\`\`\`

Como enviar notificações diretamente no Cliente:
\`\`\`lua
-- No Cliente (Envia apenas para si mesmo)
TriggerEvent('RSGCore:Notify', "Você recuperou suas forças!", "success")
\`\`\``,
    technical_notes: "Evite usar o nativo customizado de draw text ordinário se puder usar as notificações integradas do RSG - elas são consistentes com o design global da HUD."
  }
];

export const mockGeneratedScriptsList = [
  {
    id: "script-mining-base",
    chat_id: "chat-sample-1",
    title: "Sistema de Mineração de Ouro RSG",
    description: "Um script completo de mineração que utiliza prompts RedM nativos e validação server-side de segurança para evitar trapaças de duplicação ou spawn de pepitas.",
    framework: "RSG",
    dependencies: ["rsg-core", "rsg-inventory"],
    install_steps: [
      "Extraia a pasta para dentro de resources/[rsg]",
      "Adicione o item 'gold_ore' e 'gold_nugget' ao seu rsg-core/shared/items.lua",
      "Adicione 'ensure rsg-goldmine' no seu server.cfg"
    ],
    warnings: [
      "Valide se os itens gold_ore estão de fato cadastrados senão o inventário apresentará erros de null pointer",
      "É recomendado alterar as coordenadas do Config.lua para coincidir com as áreas de minas do seu servidor."
    ],
    files: {
      "fxmanifest.lua": `fx_version 'cerulean'
games { 'rdr3' }
rdr3_warning 'Icknowwhatimdoing'

author 'RSG Script Forge AI'
description 'Sistema de Mineração de Ouro para RSG Framework'
version '1.0.0'

shared_scripts {
    'config.lua'
}

client_scripts {
    'client.lua'
}

server_scripts {
    'server.lua'
}
`,
      "config.lua": `Config = {}

Config.Mines = {
    { name = "Mina Valentine", coords = vector3(-1189.24, -452.92, 45.10) },
    { name = "Mina Rhodes", coords = vector3(1243.51, -1211.23, 52.8) }
}

Config.InteractDistance = 2.0
Config.MineTime = 5000 -- Tempo de canalização em milissegundos
Config.ItemRequisito = "pickaxe"
Config.ItemGanho = "gold_ore"
Config.ProbabilidadePepita = 0.3 -- 30% de chance de vir pepita de ouro de bônus
`,
      "client.lua": `local RSGCore = exports['rsg-core']:GetCoreObject()
local isActive = false
local promptGroup = GetRandomIntInRange(0, 0xffffff)
local actionPrompt

local function SetupPrompts()
    actionPrompt = UiPromptRegisterBegin()
    UiPromptSetControlAction(actionPrompt, 0x760B966F) -- Tecla G
    local text = CreateVarString(10, "LITERAL_STRING", "Segure para Minerar")
    UiPromptSetText(actionPrompt, text)
    UiPromptSetStandardMode.2(actionPrompt, true) -- Hold mode
    UiPromptRegisterEnd(actionPrompt)
    UiPromptSetGroup(actionPrompt, promptGroup)
end

CreateThread(function()
    SetupPrompts()
    while true do
        local sleep = 1000
        if not isActive then
            local ped = PlayerPedId()
            local pCoords = GetEntityCoords(ped)
            
            for _, mine in ipairs(Config.Mines) do
                local dist = #(pCoords - mine.coords)
                if dist < Config.InteractDistance then
                    sleep = 0
                    local groupLabel = CreateVarString(10, "LITERAL_STRING", mine.name)
                    PromptSetActiveGroupThisFrame(promptGroup, groupLabel)
                    
                    if UiPromptHasHoldModeCompleted(actionPrompt) then
                        isActive = true
                        RSGCore.Functions.TriggerCallback('rsg-goldmine:server:hasPickaxe', function(hasItem)
                            if hasItem then
                                TriggerEvent('RSGCore:Notify', "Você começou a golpear a rocha...", "primary")
                                -- Simula animação de picareta RedM
                                TaskStartScenarioInPlace(ped, \`WORLD_HUMAN_MUSEUM_PICTURE_STARE\`, 0, true)
                                
                                Wait(Config.MineTime)
                                
                                ClearPedTasksImmediately(ped)
                                TriggerServerEvent('rsg-goldmine:server:reward')
                            else
                                TriggerEvent('RSGCore:Notify', "Você precisa de uma picareta no inventário!", "error")
                            end
                            isActive = false
                        end)
                        Wait(1000)
                    end
                end
            end
        end
        Wait(sleep)
    end
end)
`,
      "server.lua": `local RSGCore = exports['rsg-core']:GetCoreObject()

-- Validar se possui picareta
RSGCore.Functions.CreateCallback('rsg-goldmine:server:hasPickaxe', function(source, cb)
    local Player = RSGCore.Functions.GetPlayer(source)
    if not Player then return cb(false) end
    
    local item = Player.Functions.GetItemByName(Config.ItemRequisito)
    cb(item ~= nil)
end)

-- Dar recompensa segura
RegisterNetEvent('rsg-goldmine:server:reward', function()
    local src = source
    local Player = RSGCore.Functions.GetPlayer(src)
    if not Player then return end
    
    -- Validação de distância contra hackers que Triggeram o evento diretamente
    local ped = GetPlayerPed(src)
    local pedCoords = GetEntityCoords(ped)
    local nearMine = false
    
    for _, mine in ipairs(Config.Mines) do
        local dist = #(pedCoords - mine.coords)
        if dist < 10.0 then -- Margem de erro aceitável de 10 unidades
            nearMine = true
            break
        end
    end
    
    if not nearMine then
        -- Possível manipulação de eventos
        print(("[ANTIPROCESS] Jogador %s tentou minerar sem estar perto de uma mina!"):format(GetPlayerName(src)))
        return
    end

    -- Remover item picareta quebra opcional ou só verificar
    local hasItem = Player.Functions.GetItemByName(Config.ItemRequisito)
    if not hasItem then return end

    -- Recompensa garantida
    Player.Functions.AddItem(Config.ItemGanho, 1)
    TriggerClientEvent('RSGCore:Notify', src, "Você extraiu um minério de ouro!", "success")
    
    -- Recompensa bônus com probabilidade configurada
    if math.random() <= Config.ProbabilidadePepita then
        Player.Functions.AddItem("gold_nugget", 1)
        TriggerClientEvent('RSGCore:Notify', src, "Você encontrou uma pequena pepita de ouro de bônus!", "success")
    end
end)
`
    },
    created_at: "2026-06-16T12:00:00Z"
  }
];
