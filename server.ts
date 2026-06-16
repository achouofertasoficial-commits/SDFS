import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { 
  getDocuments, 
  addDocument, 
  searchDocuments, 
  getChats, 
  createChat, 
  getChatMessages, 
  addChatMessage, 
  getGeneratedScripts, 
  isSupabaseConnected, 
  getSupabaseConfig, 
  updateSupabaseConfig 
} from "./server/db";

import { generateScriptWithGemini } from "./server/ragService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // 1. API: Health Check & Connection Status
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date() });
  });

  app.get("/api/kb/status", async (req, res) => {
    try {
      const docs = await getDocuments();
      const scripts = await getGeneratedScripts();
      
      const stats = {
        totalDocs: docs.length,
        totalNatives: docs.filter(d => d.content_type === 'native' || d.category === 'RedM Natives').length,
        totalExamples: docs.filter(d => d.content_type === 'exemplo' || d.category === 'Scripts Exemplo' || d.category === 'Scripts Base').length,
        totalSnippets: docs.filter(d => d.content_type === 'snippet' || d.content_type === 'padrão_de_segurança').length,
      };

      res.json({
        supabaseConnected: isSupabaseConnected(),
        supabaseUrl: getSupabaseConfig().url ? `${getSupabaseConfig().url.substring(0, 15)}...` : null,
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        stats,
        scriptsCount: scripts.length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
    try {
      const chatId = req.params.id;
      const { content } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({ error: "O conteúdo da mensagem não pode estar vazio" });
      }

      // a. Salva a mensagem do usuário no banco
      const userMsg = await addChatMessage({
        chat_id: chatId,
        role: 'user',
        content: content
      });

      // b. Processa o pipeline RAG com a Gemini API no backend
      const responseG = await generateScriptWithGemini(content, chatId);

      // c. Salva a resposta da IA no banco
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
