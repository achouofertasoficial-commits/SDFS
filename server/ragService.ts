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

export async function generateScriptWithGemini(
  userRequest: string,
  chatId: string,
  history: AIMessage[] = [],
  currentScript: GeneratedScript | null = null
): Promise<RAGResponse> {
  const docs = await searchKnowledge(userRequest);
  
  // Limitar a no máximo 4 documentos relevantes para poupar tokens e manter foco
  const relevantDocs = docs.slice(0, 4);
  const promptMessage = buildPromptWithContext(userRequest, relevantDocs, history, currentScript);
  
  const systemPrompt = `Você é uma IA engenheira sênior especialista em RedM usando RSG Framework.
Você opera no modo de PROJETO VIVO (desenvolvimento contínuo). Sua tarefa é gerar ou atualizar recursos de RedM.

CONSIDERE ESTAS DIRETRIZES DE DESIGN:
- Mantenha padrão estrito do RSG Framework. Nunca misture VORP, QBCore, ESX ou VRP.
- Valide todas as ações críticas de forma estricta no server.lua para proteção contra exploits.
- Mantenha Config.lua para que o usuário configure coordenadas, timers, recompensas.
- Evite loops pesados (use Citizen.Wait adequados para não estourar a CPU do RedM).
- Use eventos com um prefixo único baseado no nome do resource para evitar colisões.

MODO 1 (Novo Script):
Se não houver script ou arquivos anteriores fornecidos no contexto, crie um novo resource RedM completo do zero:
- fxmanifest.lua
- config.lua
- client.lua
- server.lua
- README.md (com tabelas SQL adicionais se o script requerer persistência no banco e itens para shared)

MODO 2 (Alteração incremental):
Se já houver um script existente (com arquivos anteriores) fornecido no contexto de entrada:
- Analise os arquivos atuais e aplique somente as mudanças solicitadas pelo usuário.
- Preserve todas as funcionalidades existentes. Nunca remova ou limpe códigos anteriores a menos que explicitamente solicitado.
- Retorne TODOS os arquivos atualizados em seu estado completo final no objeto "files". Não retorne cortes ou placeholders como '-- resto do código'. O código deve ser completo e compilável!
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
              description: "O texto explicativo de resposta estruturada para o usuário, explicando onde colocar o script, o que foi feito de alterações e as boas práticas adotadas em português." 
            },
            hasScript: { 
              type: Type.BOOLEAN, 
              description: "Deve ser true se você gerou um script de RedM funcional com arquivos de código." 
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
                files: {
                  type: Type.OBJECT,
                  properties: {
                    "fxmanifest.lua": { type: Type.STRING, description: "Manifesto completo do recurso RedM" },
                    "config.lua": { type: Type.STRING, description: "Arquivo de configurações de coordenadas, itens e timers" },
                    "client.lua": { type: Type.STRING, description: "Código do cliente, prompts nativos do RedM, distâncias otimizadas" },
                    "server.lua": { type: Type.STRING, description: "Código do servidor, validação segura de dinheiro, itens e callbacks" },
                    "shared.lua": { type: Type.STRING, description: "Opcional. Código compartilhado ou tabelas compartilhadas" },
                    "README.md": { type: Type.STRING, description: "Passo a passo detalhado de instalação, tabelas SQL de banco de dados se houver, e itens para o shared/items.lua" }
                  },
                  description: "Escreva o código completo de cada arquivo aplicável. Insira apenas arquivos úteis para o recurso solicitado."
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
              required: ["title", "description", "files", "change_summary", "changed_files"],
              description: "Detalhes dos arquivos gerados, preenchido apenas se hasScript for true."
            }
          },
          required: ["content", "hasScript"]
        }
      }
    });

    const bodyText = response.text;
    if (!bodyText) throw new Error("O modelo gerou uma resposta vazia.");
    
    const parsed = JSON.parse(bodyText.trim());
    geminiError = null;
    
    let activeScriptId = currentScript ? currentScript.id : null;
    let versionNum = 1;
    let versionId: string | undefined;

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
      hasScript: parsed.hasScript,
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
