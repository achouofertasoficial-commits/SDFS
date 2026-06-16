import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { 
  getDocuments, 
  addDocument, 
  updateDocument,
  deleteDocument,
  searchDocuments, 
  getChats, 
  createChat, 
  deleteChat,
  getChatMessages, 
  addChatMessage, 
  getGeneratedScripts, 
  isSupabaseConnected, 
  getSupabaseConfig, 
  updateSupabaseConfig,
  getSupabaseError,
  getSupabaseStatus,
  getChatWithMessages,
  getCurrentScriptByChat,
  getScriptVersions,
  rollbackScriptVersion
} from "./server/db";

import { generateScriptWithGemini, getGeminiError } from "./server/ragService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // 1. API: Health Check & Connection Status
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date() });
  });

  // Base endpoint for central health and connection tracking
  app.get("/api/status", async (req, res) => {
    try {
      const dbStatus = getSupabaseStatus();
      const docs = await getDocuments();
      const scripts = await getGeneratedScripts();

      const stats = {
        totalDocs: docs.length,
        totalNatives: docs.filter(d => d.content_type === 'native' || d.category === 'RedM Natives').length,
        totalExamples: docs.filter(d => d.content_type === 'exemplo' || d.category === 'Scripts Exemplo' || d.category === 'Scripts Base').length,
        totalSnippets: docs.filter(d => d.content_type === 'snippet' || d.content_type === 'padrão_de_segurança').length,
      };

      res.json({
        supabaseConnected: dbStatus.supabaseConnected,
        supabaseConfigured: dbStatus.supabaseConfigured,
        supabaseUsingFallback: dbStatus.supabaseUsingFallback,
        supabaseError: dbStatus.supabaseError,
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        geminiError: getGeminiError(),
        stats,
        scriptsCount: scripts.length,
        config: {
          supabaseUrl: getSupabaseConfig().url ? `${getSupabaseConfig().url.substring(0, 15)}...` : null,
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
          geminiConfigured: !!process.env.GEMINI_API_KEY
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/kb/status", async (req, res) => {
    try {
      // Point /api/kb/status to the improved shared /api/status model
      const dbStatus = getSupabaseStatus();
      const docs = await getDocuments();
      const scripts = await getGeneratedScripts();

      const stats = {
        totalDocs: docs.length,
        totalNatives: docs.filter(d => d.content_type === 'native' || d.category === 'RedM Natives').length,
        totalExamples: docs.filter(d => d.content_type === 'exemplo' || d.category === 'Scripts Exemplo' || d.category === 'Scripts Base').length,
        totalSnippets: docs.filter(d => d.content_type === 'snippet' || d.content_type === 'padrão_de_segurança').length,
      };

      res.json({
        supabaseConnected: dbStatus.supabaseConnected,
        supabaseUrl: getSupabaseConfig().url ? `${getSupabaseConfig().url.substring(0, 15)}...` : null,
        supabaseError: dbStatus.supabaseError,
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        geminiError: getGeminiError(),
        stats,
        scriptsCount: scripts.length,
        // Added for backward compatibility checks
        supabaseConfigured: dbStatus.supabaseConfigured,
        supabaseUsingFallback: dbStatus.supabaseUsingFallback,
        config: {
          supabaseUrl: getSupabaseConfig().url ? `${getSupabaseConfig().url.substring(0, 15)}...` : null,
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
          geminiConfigured: !!process.env.GEMINI_API_KEY
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Diagnostic sandbox route (strictly non-production)
  app.post("/api/debug/supabase-test", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "O diagnóstico está desativado em produção por motivos de conformidade." });
    }

    try {
      console.log("Iniciando teste de conexão e persistência no Supabase real...");
      // 1. Inserir
      const tempDoc = await addDocument({
        title: "Diagnóstico RSG Forge AI",
        category: "debugging",
        subcategory: "diagnóstico",
        framework: "RSG",
        content_type: "documentação",
        trust_level: "alto",
        tags: ["debug", "test", "temp-validate"],
        content: "Este é um arquivo temporário de teste para validar se a conexão e o CRUD estão funcionando no Supabase.",
        technical_notes: "Ciclo de diagnósticos do RSG forge."
      });

      console.log("✓ Documento temporário criado:", tempDoc.id);

      // 2. Buscar/Ler para testar leitura
      const docs = await getDocuments();
      const found = docs.find(d => d.id === tempDoc.id);
      if (!found) {
        throw new Error("Falha na gravação/leitura: O documento inserido não foi encontrado na base.");
      }

      console.log("✓ Documento temporário lido da base.");

      // 3. Excluir
      const deleted = await deleteDocument(tempDoc.id);
      if (!deleted) {
        throw new Error("Falha na exclusão do documento temporário.");
      }

      console.log("✓ Documento temporário removido com sucesso.");

      res.json({
        success: true,
        message: "Teste de conexão, gravação, leitura e exclusão no Supabase concluído com 100% de sucesso!",
        details: {
          tempId: tempDoc.id,
          steps: ["insert", "read", "delete"]
        }
      });
    } catch (err: any) {
      console.error("❌ Erro no teste de diagnóstico do Supabase:", err);
      res.status(500).json({
        success: false,
        message: "Falha durante o ciclo CRUD de teste no Supabase.",
        error: err.message || "Erro desconhecido",
        supabaseUrl: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 15)}...` : "Não configurada",
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasAnonKey: !!process.env.SUPABASE_ANON_KEY
      });
    }
  });

  // 2. API: Knowledge Documents
  app.get("/api/kb/documents", async (req, res) => {
    try {
      const docs = await getDocuments();
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/kb/documents", async (req, res) => {
    try {
      const { title, category, subcategory, framework, content_type, source_url, trust_level, tags, content, technical_notes } = req.body;
      
      if (!title || !category || !content_type || !content) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes: title, category, content_type, content" });
      }

      const newDoc = await addDocument({
        title,
        category,
        subcategory: subcategory || undefined,
        framework: framework || 'RSG',
        content_type,
        source_url: source_url || undefined,
        trust_level: trust_level || 'medio',
        tags: Array.isArray(tags) ? tags : [],
        content,
        technical_notes: technical_notes || undefined
      });

      res.status(201).json(newDoc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/kb/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, category, subcategory, framework, content_type, source_url, trust_level, tags, content, technical_notes } = req.body;
      
      const updated = await updateDocument(id, {
        title,
        category,
        subcategory: subcategory === null ? undefined : subcategory,
        framework: framework || 'RSG',
        content_type,
        source_url: source_url === null ? undefined : source_url,
        trust_level,
        tags: Array.isArray(tags) ? tags : [],
        content,
        technical_notes: technical_notes === null ? undefined : technical_notes
      });

      if (updated) {
        res.json(updated);
      } else {
        res.status(404).json({ error: "Documento não encontrado para edição." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/kb/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await deleteDocument(id);
      if (success) {
        res.json({ success: true, message: "Documento excluído com sucesso." });
      } else {
        res.status(404).json({ error: "Documento não encontrado para exclusão." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. API: Search / Query RAG Documents
  app.get("/api/kb/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || '';
      const category = (req.query.category as string) || 'all';
      const results = await searchDocuments(query, category);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. API: Chats Threads
  app.get("/api/chats", async (req, res) => {
    try {
      const chats = await getChats();
      res.json(chats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chats", async (req, res) => {
    try {
      const { title } = req.body;
      const newChat = await createChat(title);
      res.status(201).json(newChat);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/chats/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await deleteChat(id);
      if (success) {
        res.json({ success: true, message: "Sessão excluída com sucesso." });
      } else {
        res.status(404).json({ error: "Sessão não encontrada para exclusão." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. API: Chat Messages & AI Process (RAG Pipeline)
  app.get("/api/chats/:id/messages", async (req, res) => {
    try {
      const messages = await getChatMessages(req.params.id);
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chats/:id/messages", async (req, res) => {
    const chatId = req.params.id;
    const { content } = req.body;
    try {
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: "O conteúdo da mensagem não pode estar vazio" });
      }

      // a. Salva a mensagem do usuário no banco
      const userMsg = await addChatMessage({
        chat_id: chatId,
        role: 'user',
        content: content
      });

      // b. Para o MODO PROJETO VIVO:
      // - Buscamos o histórico completo do chat
      const history = await getChatMessages(chatId);
      
      // - Buscamos o script atual ativo se houver
      const currentScript = await getCurrentScriptByChat(chatId);

      // c. Processa o pipeline RAG com a Gemini API no backend passando o histórico e o script atual
      const responseG = await generateScriptWithGemini(content, chatId, history, currentScript);

      // d. Salva a resposta da IA no banco
      const modelMsg = await addChatMessage({
        chat_id: chatId,
        role: 'model',
        content: responseG.content,
        retrieved_context: responseG.retrievedContext
      });

      res.status(200).json({
        userMessage: userMsg,
        modelMessage: modelMsg,
        hasScript: responseG.hasScript,
        scriptDetail: responseG.scriptDetail
      });

    } catch (err: any) {
      console.error("Erro na rota de envio de mensagem:", err);
      let errorText = "Não consegui interpretar a resposta da Gemini porque ela veio incompleta ou em JSON inválido. Reformule o pedido ou tente novamente.";
      if (err.message && !err.message.includes("JSON_INVALID_OR_TRUNCATED")) {
        errorText = `Ocorreu um erro no servidor: ${err.message}. Reformule o pedido ou tente novamente.`;
      }

      try {
        const modelMsg = await addChatMessage({
          chat_id: chatId,
          role: 'model',
          content: errorText,
          retrieved_context: []
        });

        res.status(200).json({
          userMessage: { id: "error-user", chat_id: chatId, role: "user", content: content || "", created_at: new Date().toISOString() },
          modelMessage: modelMsg,
          hasScript: false,
          scriptDetail: null
        });
      } catch (saveErr) {
        res.status(200).json({
          userMessage: { id: "error-user", chat_id: chatId, role: "user", content: content || "", created_at: new Date().toISOString() },
          modelMessage: { id: "error-model", chat_id: chatId, role: "model", content: errorText, created_at: new Date().toISOString() },
          hasScript: false,
          scriptDetail: null
        });
      }
    }
  });

  // Alias para garantir máxima compatibilidade com as requisições do frontend
  app.post("/api/chat/:id/message", async (req, res) => {
    const chatId = req.params.id;
    const { content } = req.body;
    try {
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: "O conteúdo da mensagem não pode estar vazio" });
      }

      const userMsg = await addChatMessage({
        chat_id: chatId,
        role: 'user',
        content: content
      });

      const history = await getChatMessages(chatId);
      const currentScript = await getCurrentScriptByChat(chatId);
      const responseG = await generateScriptWithGemini(content, chatId, history, currentScript);

      const modelMsg = await addChatMessage({
        chat_id: chatId,
        role: 'model',
        content: responseG.content,
        retrieved_context: responseG.retrievedContext
      });

      res.status(200).json({
        userMessage: userMsg,
        modelMessage: modelMsg,
        hasScript: responseG.hasScript,
        scriptDetail: responseG.scriptDetail
      });
    } catch (err: any) {
      console.error("Erro na rota de envio de mensagem (alias):", err);
      let errorText = "Não consegui interpretar a resposta da Gemini porque ela veio incompleta ou em JSON inválido. Reformule o pedido ou tente novamente.";
      if (err.message && !err.message.includes("JSON_INVALID_OR_TRUNCATED")) {
        errorText = `Ocorreu um erro no servidor: ${err.message}. Reformule o pedido ou tente novamente.`;
      }

      try {
        const modelMsg = await addChatMessage({
          chat_id: chatId,
          role: 'model',
          content: errorText,
          retrieved_context: []
        });

        res.status(200).json({
          userMessage: { id: "error-user", chat_id: chatId, role: "user", content: content || "", created_at: new Date().toISOString() },
          modelMessage: modelMsg,
          hasScript: false,
          scriptDetail: null
        });
      } catch (saveErr) {
        res.status(200).json({
          userMessage: { id: "error-user", chat_id: chatId, role: "user", content: content || "", created_at: new Date().toISOString() },
          modelMessage: { id: "error-model", chat_id: chatId, role: "model", content: errorText, created_at: new Date().toISOString() },
          hasScript: false,
          scriptDetail: null
        });
      }
    }
  });

  // Retorna todas as versões de um script específico
  app.get("/api/chats/:chatId/current-script", async (req, res) => {
    try {
      const { chatId } = req.params;
      const currentScript = await getCurrentScriptByChat(chatId);
      res.json(currentScript);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Retorna todas as versões de um script específico
  app.get("/api/scripts/:scriptId/versions", async (req, res) => {
    try {
      const { scriptId } = req.params;
      const versions = await getScriptVersions(scriptId);
      res.json(versions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Executa o restore/rollback de uma versão anterior gravando como uma nova versão corrente
  app.post("/api/scripts/:scriptId/rollback/:versionId", async (req, res) => {
    try {
      const { scriptId, versionId } = req.params;
      const resultObj = await rollbackScriptVersion(scriptId, versionId);
      if (resultObj) {
        const { rolledBackVersion, oldVersionNumber } = resultObj;

        // Grava mensagem automática do modelo/sistema sobre o rollback
        const msgContent = `Versão v${oldVersionNumber} restaurada como a nova versão atual v${rolledBackVersion.version_number}.`;
        await addChatMessage({
          chat_id: rolledBackVersion.chat_id,
          role: 'model',
          content: `🔄 **[Restauração do Projeto]** ${msgContent}`
        });

        res.json({
          success: true,
          message: "Versão restaurada com sucesso como nova versão atual.",
          version: rolledBackVersion
        });
      } else {
        res.status(404).json({ error: "Versão ou Script não encontrados para rollback." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // 6. API: Generated Scripts List
  app.get("/api/scripts", async (req, res) => {
    try {
      const scripts = await getGeneratedScripts();
      res.json(scripts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. API: Save Manual Configuration Credentials Override
  app.post("/api/configs/update", async (req, res) => {
    try {
      const { geminiApiKey, supabaseUrl: subUrl, supabaseAnonKey: subKey } = req.body;

      if (geminiApiKey !== undefined) {
        process.env.GEMINI_API_KEY = geminiApiKey;
      }

      let active = false;
      if (subUrl !== undefined && subKey !== undefined) {
        active = updateSupabaseConfig(subUrl, subKey);
      }

      res.json({
        success: true,
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        supabaseConnected: isSupabaseConnected(),
        supabaseActive: active
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware setup for assets/front-end serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server executing at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting backend server:", err);
});
