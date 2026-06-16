import { GoogleGenAI, Type } from "@google/genai";
import { searchDocuments, saveGeneratedScript, addChatMessage } from "./db";
import { KnowledgeDocument, GeneratedScript } from "../src/types";

// Lazy-initialization of GoogleGenAI
let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

export function buildPromptWithContext(userRequest: string, retrievedDocs: KnowledgeDocument[]): string {
  let prompt = `REQUISIÇÃO DO USUÁRIO: "${userRequest}"\n\n`;
  
  if (retrievedDocs.length > 0) {
    prompt += `CONTEXTO EXTRAÍDO DA BASE DE CONHECIMENTO (Use estas regras/exemplos como prioridade absoluta):\n`;
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
  
  return prompt;
}

interface RAGResponse {
  content: string;
  hasScript: boolean;
  retrievedContext: KnowledgeDocument[];
  scriptDetail?: {
    title: string;
    description: string;
    files: Record<string, string>;
    dependencies: string[];
    install_steps: string[];
    warnings: string[];
    generated_by?: 'gemini' | 'mock' | 'manual';
  };
}

export async function generateScriptWithGemini(userRequest: string, chatId: string): Promise<RAGResponse> {
  const docs = await searchKnowledge(userRequest);
  
  // Limitar a no máximo 4 documentos relevantes para poupar tokens e manter foco
  const relevantDocs = docs.slice(0, 4);
  const promptMessage = buildPromptWithContext(userRequest, relevantDocs);
  
  const systemPrompt = `Você é uma IA engenheira sênior especialista em RedM usando RSG Framework. 
Antes de gerar qualquer script, consulte o contexto recuperado da base de conhecimento. 
Priorize padrões RSG Core, segurança server-side, separação client/server, validação de eventos, performance e compatibilidade com RedM. 
Nunca misture frameworks (não use QBCore, Vorp, ESX ou VRP).
Se a informação necessária NÃO estiver no contexto fornecido, avise com total transparência (ex: 'Esta informação não consta na base de conhecimento local, gerando com base em boas práticas gerais') e gere a solução mais segura possível.

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
              description: "O texto explicativo de resposta estruturada para o usuário, explicando onde colocar o script, o que foi feito e as boas práticas adotadas em português." 
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
                  description: "Escreva o código completo de cada arquivo aplicável. Insira apenas arquivos úteis para o recurso solicitado. Se um arquivo não for necessário, do não declare."
                },
                dependencies: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Lista de recursos dependentes (por exemplo: rsg-core, rsg-inventory, rsg-weathersync)"
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
    
    let savedScript: GeneratedScript | null = null;
    if (parsed.hasScript && parsed.scriptDetail) {
      // Salva o script gerado vinculando ao chatId
      savedScript = await saveGeneratedScript({
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
    }

    return {
      content: parsed.content,
      hasScript: parsed.hasScript,
      retrievedContext: relevantDocs,
      scriptDetail: parsed.hasScript && parsed.scriptDetail ? {
        title: parsed.scriptDetail.title,
        description: parsed.scriptDetail.description,
        files: parsed.scriptDetail.files || {},
        dependencies: parsed.scriptDetail.dependencies || [],
        install_steps: parsed.scriptDetail.install_steps || [],
        warnings: parsed.scriptDetail.warnings || [],
        generated_by: 'gemini'
      } : undefined
    };

  } catch (error: any) {
    console.error("Erro na chamada da Gemini API / RAG Service:", error);
    
    // Gerador de script fallback inteligente para dar uma experiência fantástica mesmo na ausência de chaves
    const isMock = userRequest.toLowerCase().includes("mineração") || userRequest.toLowerCase().includes("gold") || userRequest.toLowerCase().includes("ouro") || userRequest.toLowerCase().includes("bounty") || userRequest.toLowerCase().includes("procurado");
    
    if (isMock) {
      // Retorna uma simulação realista se o usuário estiver brincando com o exemplo padrão
      return {
        content: `⚠️ [AMB-LOCAL / SEM CHAVE GEMINI] Notei que pediu um script técnico. Como a chave GEMINI_API_KEY não foi configurada, estou gerando uma solução modelo estruturada a partir da base de conhecimento de fallback. 
        Para obter scripts 100% personalizados para qualquer ideia de RedM, insira sua chave Gemini nas Configurações do app.`,
        hasScript: true,
        retrievedContext: relevantDocs,
        scriptDetail: {
          title: "rsg-mockmine",
          description: "Protótipo simulado localmente de Recurso utilizando RSG Framework",
          files: {
            "fxmanifest.lua": `fx_version 'cerulean'\ngames { 'rdr3' }\nrdr3_warning 'Icknowwhatimdoing'\nauthor 'RSG Script Forge AI Fallback'\nshared_scripts { 'config.lua' }\nclient_scripts { 'client.lua' }\nserver_scripts { 'server.lua' }`,
            "config.lua": `Config = {}\nConfig.Location = vector3(-1189.2, -452.9, 45.1)\nConfig.MineTime = 4000\nConfig.Item = "gold_ore"`,
            "client.lua": `-- Script de Client Simulado\nlocal RSGCore = exports['rsg-core']:GetCoreObject()\n-- Executa o prompt nativo...\nRegisterCommand('testmine', function()\n    TriggerServerEvent('rsg-goldmine:server:reward')\nend, false)`,
            "server.lua": `-- Script de Server Seguro\nlocal RSGCore = exports['rsg-core']:GetCoreObject()\nRegisterNetEvent('rsg-goldmine:server:reward', function()\n    local src = source\n    local Player = RSGCore.Functions.GetPlayer(src)\n    if Player then\n        Player.Functions.AddItem("gold_ore", 1)\n        TriggerClientEvent('RSGCore:Notify', src, "Minerou 1x Ouro (MOCK)", "success")\n    end\nend)`
          },
          dependencies: ["rsg-core"],
          install_steps: [
            "Ative sua chave Gemini no painel de configurações para obter códigos reais complexos",
            "Insira rsg-mockmine na pasta resources",
            "Inicie no seu server.cfg: ensure rsg-mockmine"
          ],
          warnings: ["Este é um script de simulação local (Modo Demonstração) devido à ausência de chave API."],
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
