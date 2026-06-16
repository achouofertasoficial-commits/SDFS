import { GoogleGenAI, Type } from "@google/genai";
import { searchDocuments, saveGeneratedScript, createScriptVersion, getScriptVersions } from "./db";
import { KnowledgeDocument, GeneratedScript, AIMessage } from "../src/types";

// Lazy-initialization of GoogleGenAI
let aiInstance: GoogleGenAI | null = null;
let geminiError: string | null = null;

export function getGeminiError(): string | null {
  return geminiError;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    geminiError = "GEMINI_API_KEY não configurada no ambiente.";
    throw new Error("GEMINI_API_KEY não configurada no ambiente. Configure em Configurações.");
  }
  
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

export async function searchKnowledge(query: string): Promise<KnowledgeDocument[]> {
  // text-based search filtering by title, tags, and content
  return await searchDocuments(query);
}

export function buildPromptWithContext(
  userRequest: string,
  retrievedDocs: KnowledgeDocument[],
  history: AIMessage[] = [],
  currentScript: GeneratedScript | null = null
): string {
  let prompt = "";

  if (history.length > 0) {
    prompt += "=== TRILHA DE CONVERSA ANTERIOR (HISTÓRICO) ===\n";
    // Pegar as últimas 6 mensagens para manter o contexto sem estourar limite do modelo
    const recentHistory = history.slice(-6);
    recentHistory.forEach(m => {
      prompt += `${m.role === 'user' ? 'Usuário' : 'IA'}: ${m.content}\n`;
    });
    prompt += "\n";
  }

  if (currentScript) {
    prompt += "=== SCRIPT ATUAL (ESTADO EXISTENTE DO PROJETO VIVO) ===\n";
    prompt += `Título do Script: ${currentScript.title}\n`;
    prompt += `Descrição Atual: ${currentScript.description}\n`;
    prompt += "Arquivos Atuais do Resource:\n";
    for (const [filename, content] of Object.entries(currentScript.files)) {
      prompt += `--- ARQUIVO JÁ EXISTENTE: ${filename} ---\n${content}\n-----------------------------------\n`;
    }
    prompt += "\n";
  }

  if (retrievedDocs.length > 0) {
    prompt += "=== CONTEXTO EXTRAÍDO DA BASE DE CONHECIMENTO (RAG) ===\n";
    retrievedDocs.forEach((doc, index) => {
      prompt += `[DOCUMENTO #${index + 1}]: ${doc.title} (${doc.category} - ${doc.content_type})\n`;
      prompt += `Tags: ${doc.tags.join(", ")}\n`;
      prompt += `Conteúdo:\n${doc.content}\n`;
      if (doc.technical_notes) {
        prompt += `Notas Técnicas Extra: ${doc.technical_notes}\n`;
      }
      prompt += `--------------------------------------------------\n\n`;
    });
  } else {
    prompt += `AVISO DE CONDIÇÃO: Nenhuma informação específica foi encontrada na base de conhecimento sobre este pedido. Explique ao usuário com total transparência que a busca não retornou dados específicos, mas gere a solução mais segura possível seguindo as regras básicas de padrão RSG Core do RedM.\n\n`;
  }
  
  prompt += `=== NOVA SOLICITAÇÃO DO USUÁRIO ===\n`;
  prompt += `Pedido Atual: "${userRequest}"\n\n`;
  prompt += "ATENÇÃO: Se houver arquivos existentes listados acima, você deve analisá-los, preservá-los e aplicar APENAS os aprimoramentos, adições ou correções solicitadas. Retorne sempre TODOS os arquivos finais e funcionais completos. Nunca use comentários sugerindo cortes ou omitindo código útil.";

  return prompt;
}

interface RAGResponse {
  content: string;
  hasScript: boolean;
  retrievedContext: KnowledgeDocument[];
  scriptDetail?: {
    title: string;
    description: string;
    change_summary: string;
    changed_files: string[];
    files: Record<string, string>;
    dependencies: string[];
    install_steps: string[];
    warnings: string[];
    generated_by?: 'gemini' | 'mock' | 'manual';
    version_id?: string;
    version_number?: number;
    script_id?: string;
  };
}

export function hasTechnicalIntent(message: string): boolean {
  const text = message.toLowerCase().trim();

  // Explicit mandatory triggers requested:
  const explicitTriggers = [
    "criar script", "fazer script", "gerar script", "desenvolver script", "novo script",
    "fazer sistema", "criar sistema", "desenvolver sistema", "gerar sistema", "fazer um sistema", "criar um sistema",
    "adicionar função", "add função", "acrescentar função", "inserir função", "colocar função", "adicionar funcao", "add funcao",
    "corrigir erro", "arrumar erro", "corrigir bug", "fix erro", "fix bug", "ajustar erro", "corrigir o erro", "consertar erro",
    "modificar", "alterar", "tunar", "mudar", "atualizar",
    "client.lua", "server.lua", "config.lua", "fxmanifest", "fxmanifest.lua", "shared.lua",
    "implementar recurso", "adicionar recurso", "criar recurso", "gerar recurso",
    "remover funcionalidade", "deletar", "apagar", "excluir",
    "melhorar script", "otimizar", "melhorar", "evoluir script",
    "criar resource", "fazer resource", "gerar resource"
  ];

  const generalTechnicalTerms = [
    "script", "sistema", "função", "funcao", "recurso", "resource", "erro", "bug", "codigo", "código", "lua", "sql", "database",
    "banco de dados", "fxmanifest", "event", "trigger", "callback", "hud", "inventario", "player", "exports", 
    "config", "coordenadas", "barber", "barbeiro", "job", "npc", "comando", "command"
  ];

  const hasTrigger = explicitTriggers.some(trigger => text.includes(trigger));
  const hasGeneric = generalTechnicalTerms.some(keyword => text.includes(keyword));

  return hasTrigger || hasGeneric;
}

export function isConversationalOnly(message: string): boolean {
  const text = message.toLowerCase().trim();

  // Quick check for super short greeting/test terms
  if (text.length <= 3) {
    return true;
  }

  const conversationalKeywords = [
    "olá", "ola", "oi", "bom dia", "boa tarde", "boa noite", "teste", "test", "tudo bem", "como vai", 
    "obrigado", "obrigada", "valeu", "vlw", "hello", "hi", "opa", "blz", "beleza", "salve", "eai", "eae", "show", "o que você faz"
  ];

  const containsConversational = conversationalKeywords.some(kw => text.includes(kw));
  const hasTech = hasTechnicalIntent(message);

  if (containsConversational && !hasTech) {
    return true;
  }

  if (!hasTech) {
    return true;
  }

  return false;
}

export function parseFilesFromMarkdown(content: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!content) return files;

  // Split content by header matches like "### FILE: filename" at the start of any line
  const parts = content.split(/(?:\r?\n|^)### FILE:\s*/i);
  // The first part is text before the first FILE block.
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const firstNewlineIndex = part.indexOf("\n");
    if (firstNewlineIndex === -1) continue;

    // The first line is the filename
    let filename = part.substring(0, firstNewlineIndex).trim();
    // Clean any decoration like markdown bold "**client.lua**" or backticks "`config.lua`"
    filename = filename.replace(/[\*`#:]/g, "").trim();
    if (!filename) continue;

    const rest = part.substring(firstNewlineIndex).trim();
    
    // We expect the code to reside in a markdown block, starting with ```language
    const codeStartMatch = rest.match(/^```[a-zA-Z0-9_-]*\r?\n/);
    if (codeStartMatch) {
      const codeStartOffset = codeStartMatch[0].length;
      const closingFenceIndex = rest.indexOf("```", codeStartOffset);
      if (closingFenceIndex !== -1) {
        const fileContent = rest.substring(codeStartOffset, closingFenceIndex).trim();
        files[filename] = fileContent;
      } else {
        // If truncated / not closed, take until the end
        const fileContent = rest.substring(codeStartOffset).trim();
        files[filename] = fileContent;
      }
    } else {
      // If no code fence is used, take the rest as raw file content
      files[filename] = rest;
    }
  }

  return files;
}

export function safeParseGeminiJson(text: string): any {
  if (!text) {
    throw new Error("O modelo gerou uma resposta vazia.");
  }
  let cleaned = text.trim();
  // Remove markdown fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/i, "");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/```$/, "");
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    console.error("Erro ao realizar parse do JSON da Gemini:", err, "Texto bruto:", text);
    throw new Error("JSON_INVALID_OR_TRUNCATED");
  }
}

export async function generateScriptWithGemini(
  userRequest: string,
  chatId: string,
  history: AIMessage[] = [],
  currentScript: GeneratedScript | null = null
): Promise<RAGResponse> {
  const docs = await searchKnowledge(userRequest);
  const relevantDocs = docs.slice(0, 4);

  // 1. GREETINGS AND GENTLE CHAT FILTER (No Gemini API call or heavy schemas requested)
  if (isConversationalOnly(userRequest)) {
    return {
      content: "Olá! Estou pronto para ajudar você a criar, corrigir ou evoluir scripts RedM/RSG. Descreva o sistema que deseja criar ou as modificações que precisa fazer no seu recurso atual.",
      hasScript: false,
      retrievedContext: []
    };
  }

  const promptMessage = buildPromptWithContext(userRequest, relevantDocs, history, currentScript);
  
  const systemPrompt = `Você é uma IA engenheira sênior especialista em RedM usando RSG Framework.
Você opera no modo de PROJETO VIVO (desenvolvimento contínuo). Sua tarefa é gerar ou atualizar recursos de RedM.

ATENÇÃO RIGOROSA PARA TAMANHO E DOCUMENTAÇÃO (EVITE RESPOSTAS TRUNCADAS):
- O token limit é precioso. Para NOVO SCRIPT, gere arquivos enxutos, modulares, com comentários mínimos úteis e sem decorações excessivas.
- Para ALTERAÇÃO INCREMENTAL, retorne APENAS os arquivos que mudaram ou devem fazer parte do resource final, reduzindo linhas repetidas desnecessariamente.
- O README.md deve ser direto, sem repetir a documentação da base RAG inteira. Seja objetivo com passos de instalação breves.
- Foque somente no necessário para o recurso funcionar sem erros de sintaxe ou referências inválidas.

ESTRATÉGIA SOBRE GERAÇÃO DE ARQUIVOS (IMPORTANTE):
- Nunca use o objeto JSON para colocar os arquivos de código. O objeto JSON de retorno NUNCA deve conter a chave "files" no "scriptDetail".
- Em vez disso, coloque e desenvolva TODO o código do script e todos os arquivos diretamente em formato markdown dentro do campo "content".
- Escreva cada arquivo usando de forma estrita o seguinte cabeçalho antes do código:
### FILE: nome_do_arquivo.extensao
\`\`\`lua
(conteúdo completo do arquivo)
\`\`\`

Exemplo no campo "content":
### FILE: fxmanifest.lua
\`\`\`lua
fx_version 'cerulean'
game 'rdr3'
\`\`\`

### FILE: config.lua
\`\`\`lua
Config = {}
\`\`\`

Certifique-se de que cada bloco de código seja completo e compilável sem cortes, placeholders como "... resto do código". Use arquivos inline com o cabeçalho "### FILE: ".

CONSIDERE ESTAS DIRETRIZES DE DESIGN:
- Mantenha padrão estrito do RSG Framework. Nunca misture VORP, QBCore, ESX ou VRP.
- Valide todas as ações críticas de forma estricta no server.lua para proteção contra exploits.
- Mantenha Config.lua para que o usuário configure coordenadas, timers, recompensas.
- Evite loops pesados (use Citizen.Wait adequados para não estourar a CPU do RedM).
- Use eventos com um prefixo único baseado no nome do resource para evitar colisões.

MODO 1 (Novo Script):
Se não houver script ou arquivos anteriores fornecidos no contexto, crie um novo resource RedM completo do zero.
Escreva os seguintes arquivos no formato ### FILE: no campo "content":
- fxmanifest.lua
- config.lua
- client.lua
- server.lua
- README.md (com tabelas SQL adicionais se o script requerer persistência no banco e itens para shared)

MODO 2 (Alteração incremental):
Se já houver um script existente (com arquivos anteriores) fornecido no contexto de entrada:
- Analise os arquivos atuais e aplique somente as mudanças solicitadas pelo usuário.
- Preserve todas as funcionalidades existentes. Nunca remova ou limpe códigos anteriores a menos que explicitamente solicitado.
- Retorne TODOS os arquivos atualizados em seu estado completo final em blocos ### FILE: no campo "content". Não use placeholders.
- No campo "change_summary", forneça um resumo técnico detalhado em português das melhorias aplicadas nesta versão.
- No campo "changed_files", liste os nomes dos arquivos que de fato sofreram alterações.

Você deve responder rigorosamente no formato JSON especificado.`;

  try {
    const ai = getGeminiClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2, // Baixa temperatura para manter precisão de código técnico
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { 
              type: Type.STRING, 
              description: "O texto explicativo de resposta estruturada para o usuário em português. TODOS os arquivos de código correspondentes (como fxmanifest.lua, config.lua, client.lua, server.lua e README.md) DEVEM ser obrigatoriamente incluídos por inteiro dentro desse campo 'content' em formato markdown, cada um demarcado com o cabeçalho '### FILE: nome_do_arquivo' antes de seu bloco de código correspondente com três crases. Nunca coloque placeholders." 
            },
            hasScript: { 
              type: Type.BOOLEAN, 
              description: "Deve ser true se você gerou ou modificou um script de RedM funcional com arquivos de código." 
            },
            scriptDetail: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Título descritivo do script (ex: 'rsg-saloon_robbery')" },
                description: { type: Type.STRING, description: "Pequeno parágrafo descrevendo o recurso" },
                change_summary: { type: Type.STRING, description: "Breve resumo do que foi alterado/acrescentado em relação à versão anterior (ex: 'Substituído lógica de fadiga, adicionado config de timer')" },
                changed_files: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Lista de arquivos criados/modificados nesta versão (ex: ['client.lua', 'config.lua'])"
                },
                dependencies: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Lista de recursos dependentes (por exemplo: rsg-core, rsg-inventory)"
                },
                install_steps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array de passos curtos para instalar o script no RedM"
                },
                warnings: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Avisos importantes de segurança, performance ou bugs comuns"
                }
              },
              required: ["title", "description", "change_summary", "changed_files"],
              description: "Detalhes dos arquivos gerados, preenchido apenas se hasScript for true. NÃO inclua nenhum campo 'files' dentro de scriptDetail no JSON."
            }
          },
          required: ["content", "hasScript"]
        }
      }
    });

    const bodyText = response.text;
    if (!bodyText) throw new Error("O modelo gerou uma resposta vazia.");
    
    let parsed;
    try {
      parsed = safeParseGeminiJson(bodyText);
    } catch (parseError: any) {
      // Catch JSON Parsing/truncation errors elegantly and assign geminiError
      geminiError = "Gemini respondeu, mas retornou JSON inválido/truncado.";
      return {
        content: "Não consegui interpretar a resposta da Gemini porque ela veio incompleta ou em JSON inválido. Reformule o pedido ou tente novamente.",
        hasScript: false,
        retrievedContext: relevantDocs
      };
    }

    geminiError = null;
    
    let activeScriptId = currentScript ? currentScript.id : null;
    let versionNum = 1;
    let versionId: string | undefined;

    if (parsed.hasScript && parsed.scriptDetail) {
      // Extract files dynamically from the markdown content field!
      const parsedFiles = parseFilesFromMarkdown(parsed.content);
      parsed.scriptDetail.files = parsedFiles;
    }

    if (parsed.hasScript && parsed.scriptDetail) {
      if (!currentScript) {
        // MODO 1: Novo Script & Criação de Versão v1
        const savedNew = await saveGeneratedScript({
          chat_id: chatId,
          title: parsed.scriptDetail.title || "Script sem título",
          description: parsed.scriptDetail.description || "Criado via RSG Forge AI",
          framework: "RSG",
          files: parsed.scriptDetail.files || {},
          dependencies: parsed.scriptDetail.dependencies || ["rsg-core"],
          install_steps: parsed.scriptDetail.install_steps || ["Coloque na pasta resources", "Inicie no server.cfg"],
          warnings: parsed.scriptDetail.warnings || [],
          generated_by: 'gemini'
        });
        activeScriptId = savedNew.id;
        
        const v1 = await createScriptVersion(savedNew.id, chatId, {
          version_number: 1,
          change_summary: "Criação Inicial do Script",
          user_request: userRequest,
          files: parsed.scriptDetail.files || {},
          dependencies: parsed.scriptDetail.dependencies || ["rsg-core"],
          install_steps: parsed.scriptDetail.install_steps || ["Coloque na pasta resources", "Inicie no server.cfg"],
          warnings: parsed.scriptDetail.warnings || [],
          generated_by: 'gemini'
        });
        versionId = v1.id;
        versionNum = 1;
      } else {
        // MODO 2: Alteração Incremental & Salva Versão vX
        const existingVersions = await getScriptVersions(currentScript.id);
        const maxNum = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.version_number)) : 1;
        versionNum = maxNum + 1;

        const vNext = await createScriptVersion(currentScript.id, chatId, {
          version_number: versionNum,
          change_summary: parsed.scriptDetail.change_summary || "Alteração incremental do script",
          user_request: userRequest,
          files: parsed.scriptDetail.files || {},
          dependencies: parsed.scriptDetail.dependencies || currentScript.dependencies,
          install_steps: parsed.scriptDetail.install_steps || currentScript.install_steps,
          warnings: parsed.scriptDetail.warnings || currentScript.warnings,
          generated_by: 'gemini'
        });
        versionId = vNext.id;
      }
    }

    return {
      content: parsed.content,
      hasScript: !!parsed.hasScript,
      retrievedContext: relevantDocs,
      scriptDetail: parsed.hasScript && parsed.scriptDetail ? {
        title: parsed.scriptDetail.title,
        description: parsed.scriptDetail.description,
        change_summary: parsed.scriptDetail.change_summary || "Melhoria do script",
        changed_files: parsed.scriptDetail.changed_files || ["client.lua", "server.lua"],
        files: parsed.scriptDetail.files || {},
        dependencies: parsed.scriptDetail.dependencies || [],
        install_steps: parsed.scriptDetail.install_steps || [],
        warnings: parsed.scriptDetail.warnings || [],
        generated_by: 'gemini',
        version_id: versionId,
        version_number: versionNum,
        script_id: activeScriptId || undefined
      } : undefined
    };

  } catch (error: any) {
    console.error("Erro na chamada da Gemini API / RAG Service:", error);

    // If it was of type JSON_INVALID_OR_TRUNCATED, we caught it in the inner block.
    // If we missed any parsing error that bubbled up, catch it here.
    if (error?.message === "JSON_INVALID_OR_TRUNCATED") {
      geminiError = "Gemini respondeu, mas retornou JSON inválido/truncado.";
      return {
        content: "Não consegui interpretar a resposta da Gemini porque ela veio incompleta ou em JSON inválido. Reformule o pedido ou tente novamente.",
        hasScript: false,
        retrievedContext: relevantDocs
      };
    }

    geminiError = error?.message || "Erro desconhecido na chamada Gemini";
    
    // Gerador de script fallback inteligente para dar uma experiência fantástica mesmo na ausência de chaves
    const isMock = userRequest.toLowerCase().includes("mineração") || userRequest.toLowerCase().includes("gold") || userRequest.toLowerCase().includes("ouro") || userRequest.toLowerCase().includes("bounty") || userRequest.toLowerCase().includes("procurado") || userRequest.toLowerCase().includes("fazenda") || userRequest.toLowerCase().includes("caça") || userRequest.toLowerCase().includes("script");
    
    if (isMock) {
      // Retorna uma simulação de script mock real sem salvá-la como versão em si para não poluir
      return {
        content: `⚠️ [MOCK ATIVO / SEM CHAVE GEMINI] Notei que solicitou uma evolução contínua no Projeto RSG. Como a chave GEMINI_API_KEY está ausente, estou simulando em modo demonstração local. Para persistir versões reais desse script de forma incremental, insira sua chave Gemini nas Configurações do app.`,
        hasScript: true,
        retrievedContext: relevantDocs,
        scriptDetail: {
          title: "rsg-mockservice",
          description: "Painel de Demonstração Interativa - Fallback do Script Forge AI",
          change_summary: "Simulação de melhoria contínua (Mock Fallback)",
          changed_files: ["client.lua", "server.lua"],
          files: {
            "fxmanifest.lua": `fx_version 'cerulean'\ngames { 'rdr3' }\nrdr3_warning 'Icknowwhatimdoing'\nauthor 'RSG Script Forge AI Fallback'\nshared_scripts { 'config.lua' }\nclient_scripts { 'client.lua' }\nserver_scripts { 'server.lua' }`,
            "config.lua": `Config = {}\nConfig.Location = vector3(-1189.2, -452.9, 45.1)\nConfig.ActionTime = 4000\nConfig.EventPrefix = "rsg-mockservice"`,
            "client.lua": `-- Script de Client Simulado de Evolução\nlocal RSGCore = exports['rsg-core']:GetCoreObject()\nRegisterCommand('runmockdemo', function()\n    TriggerServerEvent('rsg-mockservice:server:execute')\nend, false)`,
            "server.lua": `-- Script de Server Seguro contra Exploits\nlocal RSGCore = exports['rsg-core']:GetCoreObject()\nRegisterNetEvent('rsg-mockservice:server:execute', function()\n    local src = source\n    local Player = RSGCore.Functions.GetPlayer(src)\n    if Player then\n        TriggerClientEvent('RSGCore:Notify', src, "Ação em modo Demo (MOCK) efetuada", "success")\n    end\nend)`
          },
          dependencies: ["rsg-core"],
          install_steps: [
            "Configure sua KEY no Menu Configurações",
            "Ative o Supabase para salvar históricos de modificações reais"
          ],
          warnings: ["MOCK ATIVO (Modo Demonstração) - Insira a chave secreta para utilizar o poder gerador completo de IA."],
          generated_by: 'mock'
        }
      };
    }

    // Fallback geral explicativo
    return {
      content: `❌ Não foi possível gerar a resposta através da API da Gemini. 
      Motivo: ${error.message || "Erro desconhecido"}. 
      
      Dicas para resolver:
      1. Vá na aba de **Configurações** no menu lateral e cadastre sua **Gemini API Key** em modo sandbox local (ou cadastre suas chaves Supabase se quiser salvar na nuvem).
      2. No servidor, certifique-se de que a variável de ambiente \`GEMINI_API_KEY\` foi definida corretamente nas configurações de secrets do AI Studio.
      
      Você ainda pode gerenciar a **Base de Conhecimento** local e ver a listagem de scripts pre-cadastrados sem configurar as chaves!`,
      hasScript: false,
      retrievedContext: relevantDocs
    };
  }
}
