import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { KnowledgeDocument, AIChat, AIMessage, GeneratedScript, ScriptVersion } from '../src/types';
import { initialKnowledgeBase, mockGeneratedScriptsList } from '../src/seedData';

// Dynamic server-side configuration variables
let supabaseUrl = process.env.SUPABASE_URL || '';
let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;
let supabaseError: string | null = null;

export function getSupabaseError(): string | null {
  return supabaseError;
}

// Standard RFC-4122 v4 UUID generator for secure insertion and local synchronization
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Local in-memory store for fallback/graceful execution
const localStore = {
  documents: [...initialKnowledgeBase],
  chats: [
    { id: "chat-sample-1", title: "Mineração de Ouro RSG Core", created_at: new Date().toISOString() }
  ] as AIChat[],
  messages: [] as AIMessage[],
  scripts: [...mockGeneratedScriptsList] as GeneratedScript[],
  versions: [] as ScriptVersion[]
};

function sanitizeSupabaseUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  while (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  if (cleaned.endsWith('/rest/v1')) {
    cleaned = cleaned.slice(0, -8);
  }
  while (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

export function updateSupabaseConfig(url: string, key: string) {
  const cleanUrl = sanitizeSupabaseUrl(url);
  supabaseUrl = cleanUrl;
  supabaseAnonKey = key;
  if (cleanUrl && key) {
    try {
      supabase = createClient(cleanUrl, key);
      supabaseError = null;
      console.log('Supabase client successfully updated.');
      return true;
    } catch (err: any) {
      console.log('Supabase client: local validation active');
      supabase = null;
      supabaseError = err.message || "Erro de inicialização do cliente Supabase";
      return false;
    }
  } else {
    supabase = null;
    supabaseError = null;
    return false;
  }
}

// Initialize Supabase from environment variables with safety constraints
const initSupabaseWithEnv = () => {
  const rawUrl = process.env.SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  const cleanUrl = sanitizeSupabaseUrl(rawUrl);

  if (!cleanUrl) {
    supabaseError = "SUPABASE_URL não posicionada (modo offline ativo).";
    console.log("ℹ️ Supabase: URL não inicializada. Ativando infraestrutura local.");
    return;
  }

  supabaseUrl = cleanUrl;
  supabaseServiceRoleKey = serviceRole;
  supabaseAnonKey = anonKey;

  let activeKey = serviceRole;
  if (!activeKey) {
    if (anonKey) {
      if (process.env.NODE_ENV !== "production") {
        console.log("ℹ️ Supabase: Usando chave ANON_KEY local.");
        activeKey = anonKey;
      } else {
        supabaseError = "SUPABASE_SERVICE_ROLE_KEY é opcional para execução local redundante.";
        console.log("ℹ️ Supabase: Service role vazia, mantendo fallback de segurança.");
        return;
      }
    } else {
      supabaseError = "Credenciais do Supabase ausentes (Nenhuma SERVICE_ROLE ou ANON_KEY encontrada).";
      console.log("ℹ️ Supabase: Nenhuma chave identificada, utilizando banco local.");
      return;
    }
  }

  try {
    supabase = createClient(cleanUrl, activeKey);
    supabaseError = null;
    console.log("✓ RSG Forge AI conectado com sucesso ao Supabase.");
  } catch (err: any) {
    supabaseError = err?.message || "Exceção ao criar cliente Supabase";
    console.log("ℹ️ Supabase: Uso do banco local em vigor.");
  }
};

// Execute initial configurations
initSupabaseWithEnv();

// Detailed status function to distinguish between connection states
export function getSupabaseStatus() {
  const isEnvConfigured = !!process.env.SUPABASE_URL && (!!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_ANON_KEY);
  const isRuntimeConfigured = !!supabaseUrl && !!supabaseAnonKey;
  const isConfigured = isEnvConfigured || isRuntimeConfigured;

  const connected = supabase !== null && supabaseError === null;

  let statusStr = "não configurado";
  if (connected) {
    statusStr = "conectado real";
  } else if (isConfigured && supabaseError) {
    statusStr = "configurado mas com erro";
  } else {
    statusStr = "fallback local ativo";
  }

  return {
    status: statusStr,
    supabaseConnected: connected,
    supabaseConfigured: isConfigured,
    supabaseUsingFallback: !connected,
    supabaseError: supabaseError,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

// Check initial variables
if (supabaseUrl && supabaseAnonKey && !supabase) {
  updateSupabaseConfig(supabaseUrl, supabaseAnonKey);
}


// Initialize messages fallback if empty
if (localStore.messages.length === 0) {
  localStore.messages.push({
    id: "msg-1",
    chat_id: "chat-sample-1",
    role: "user",
    content: "Como criar um script de mineração de ouro simples com RSG?",
    created_at: new Date(Date.now() - 50000).toISOString()
  });
  localStore.messages.push({
    id: "msg-2",
    chat_id: "chat-sample-1",
    role: "model",
    content: `Olá! Preparei o script completo de mineração com proteção server-side e prompt de tecla nativo do RedM. Veja em seu painel lateral.`,
    created_at: new Date().toISOString(),
    retrieved_context: [initialKnowledgeBase[0], initialKnowledgeBase[1]]
  });
}

export function isSupabaseConnected(): boolean {
  return supabase !== null;
}

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    active: supabase !== null
  };
}

// 1. KNOWLEDGE DOCUMENTS CONTROLLERS
export async function getDocuments(): Promise<KnowledgeDocument[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        supabaseError = null;
        return data as KnowledgeDocument[];
      }
      if (error) {
        supabaseError = error.message;
        console.log('Supabase getDocuments: local memory store active');
      }
    } catch (err: any) {
      supabaseError = err?.message || "Exceção ao ler do Supabase";
      console.log('Supabase getDocuments retry: local memory store active');
    }
  }
  return localStore.documents;
}

export async function addDocument(doc: Omit<KnowledgeDocument, 'id' | 'created_at' | 'updated_at'>): Promise<KnowledgeDocument> {
  const newDoc: KnowledgeDocument = {
    ...doc,
    id: generateUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .insert([newDoc])
        .select();
      if (!error && data && data[0]) {
        return data[0] as KnowledgeDocument;
      }
      console.log('Supabase addDocument: synced locally');
    } catch (err) {
      console.log('Supabase addDocument retry: synced locally');
    }
  }

  localStore.documents.unshift(newDoc);
  return newDoc;
}

export async function updateDocument(id: string, doc: Partial<Omit<KnowledgeDocument, 'id' | 'created_at' | 'updated_at'>>): Promise<KnowledgeDocument | null> {
  const updated_at = new Date().toISOString();
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .update({ ...doc, updated_at })
        .eq('id', id)
        .select();
      if (!error && data && data[0]) {
        // Also update locally just in case they both run
        const idx = localStore.documents.findIndex(d => d.id === id);
        if (idx !== -1) {
          localStore.documents[idx] = { ...localStore.documents[idx], ...doc, updated_at };
        }
        return data[0] as KnowledgeDocument;
      }
      console.log('Supabase updateDocument: updated locally');
    } catch (err) {
      console.log('Supabase updateDocument retry: updated locally');
    }
  }

  const idx = localStore.documents.findIndex(d => d.id === id);
  if (idx !== -1) {
    const updatedDoc = { ...localStore.documents[idx], ...doc, updated_at };
    localStore.documents[idx] = updatedDoc;
    return updatedDoc;
  }
  return null;
}

export async function deleteDocument(id: string): Promise<boolean> {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', id);
      if (!error) {
        const idx = localStore.documents.findIndex(d => d.id === id);
        if (idx !== -1) {
          localStore.documents.splice(idx, 1);
        }
        return true;
      }
      console.log('Supabase deleteDocument: deleted locally');
    } catch (err) {
      console.log('Supabase deleteDocument retry: deleted locally');
    }
  }

  const idx = localStore.documents.findIndex(d => d.id === id);
  if (idx !== -1) {
    localStore.documents.splice(idx, 1);
    return true;
  }
  return false;
}

export async function searchDocuments(query: string, category?: string): Promise<KnowledgeDocument[]> {
  let docs = await getDocuments();

  if (category && category !== 'all' && category !== '') {
    docs = docs.filter(d => d.category.toLowerCase() === category.toLowerCase());
  }

  if (!query || query.trim() === '') {
    return docs;
  }

  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  if (searchTerms.length === 0) return docs;

  // Keyword score calculation matching fallback requested
  const scoredDocs = docs.map(doc => {
    let score = 0;
    const title = doc.title.toLowerCase();
    const cat = doc.category.toLowerCase();
    const sub = (doc.subcategory || '').toLowerCase();
    const content = doc.content.toLowerCase();
    const tags = doc.tags.map(t => t.toLowerCase());

    for (const term of searchTerms) {
      if (title.includes(term)) score += 10;
      if (cat.includes(term)) score += 5;
      if (sub.includes(term)) score += 4;
      if (content.includes(term)) score += 2;
      if (tags.some(t => t.includes(term))) score += 7;
    }

    return { doc, score };
  });

  return scoredDocs
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.doc);
}

// 2. CHATS CONTROLLERS
export async function getChats(): Promise<AIChat[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ai_chats')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as AIChat[];
      console.log('Supabase getChats: local memory store active');
    } catch (err) {
      console.log('Supabase getChats retry: local memory store active');
    }
  }
  return localStore.chats;
}

export async function createChat(title?: string): Promise<AIChat> {
  const newChat: AIChat = {
    id: generateUUID(),
    title: title || 'Novo Script Forge Chat',
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ai_chats')
        .insert([newChat])
        .select();
      if (!error && data && data[0]) {
        return data[0] as AIChat;
      }
      console.log('Supabase createChat: registered locally');
    } catch (err) {
      console.log('Supabase createChat retry: registered locally');
    }
  }

  localStore.chats.unshift(newChat);
  return newChat;
}

// 3. MESSAGES CONTROLLERS
export async function getChatMessages(chatId: string): Promise<AIMessage[]> {
  if (!chatId || chatId === 'null' || chatId === 'undefined') {
    return [];
  }
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (!error && data) return data as AIMessage[];
      console.log('Supabase getMessages: loaded local history');
    } catch (err) {
      console.log('Supabase getMessages retry: loaded local history');
    }
  }
  return localStore.messages.filter(m => m.chat_id === chatId);
}

export async function addChatMessage(msg: Omit<AIMessage, 'id' | 'created_at'>): Promise<AIMessage> {
  const newMsg: AIMessage = {
    ...msg,
    id: generateUUID(),
    created_at: new Date().toISOString()
  };

  if (!msg.chat_id || msg.chat_id === 'null' || msg.chat_id === 'undefined') {
    localStore.messages.push(newMsg);
    return newMsg;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .insert([newMsg])
        .select();
      if (!error && data && data[0]) {
        return data[0] as AIMessage;
      }
      console.log('Supabase addChatMessage: added locally');
    } catch (err) {
      console.log('Supabase addChatMessage retry: added locally');
    }
  }

  localStore.messages.push(newMsg);
  return newMsg;
}

// 4. GENERATED SCRIPTS CONTROLLERS
export async function getGeneratedScripts(): Promise<GeneratedScript[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('generated_scripts')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as GeneratedScript[];
      console.log('Supabase getScripts: local listing loaded');
    } catch (err) {
      console.log('Supabase getScripts retry: local listing loaded');
    }
  }
  return localStore.scripts;
}

export async function saveGeneratedScript(script: Omit<GeneratedScript, 'id' | 'created_at'>): Promise<GeneratedScript> {
  const newScript: GeneratedScript = {
    ...script,
    id: generateUUID(),
    generated_by: script.generated_by || 'gemini',
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('generated_scripts')
        .insert([newScript])
        .select();
      if (!error && data && data[0]) {
        return data[0] as GeneratedScript;
      }
      console.log('Supabase saveGeneratedScript: registered locally');
    } catch (err) {
      console.log('Supabase saveGeneratedScript retry: registered locally');
    }
  }

  localStore.scripts.unshift(newScript);
  return newScript;
}

// 5. PROJETO VIVO & VERSION CONTROL CONTROLLERS
export async function getChatWithMessages(chatId: string): Promise<{ chat: AIChat; messages: AIMessage[] } | null> {
  let chat: AIChat | null = null;
  let messages: AIMessage[] = [];

  if (supabase) {
    try {
      const { data: chatData, error: chatError } = await supabase
        .from('ai_chats')
        .select('*')
        .eq('id', chatId)
        .single();
      if (!chatError && chatData) {
        chat = chatData as AIChat;
        const { data: msgData, error: msgError } = await supabase
          .from('ai_messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });
        if (!msgError && msgData) {
          messages = msgData as AIMessage[];
        }
        return { chat, messages };
      }
    } catch (err) {
      console.log('Supabase getChatWithMessages: local memory store');
    }
  }

  // Fallback
  const localChat = localStore.chats.find(c => c.id === chatId);
  if (localChat) {
    const localMsgs = localStore.messages.filter(m => m.chat_id === chatId);
    return { chat: localChat, messages: localMsgs };
  }
  return null;
}

export async function getCurrentScriptByChat(chatId: string): Promise<GeneratedScript | null> {
  if (!chatId || chatId === 'null' || chatId === 'undefined') {
    return null;
  }
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('generated_scripts')
        .select('*')
        .eq('chat_id', chatId)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        return data[0] as GeneratedScript;
      }
    } catch (err) {
      console.log('Supabase getCurrentScriptByChat: local memory store');
    }
  }
  const local = localStore.scripts.filter(s => s.chat_id === chatId);
  if (local.length > 0) {
    const sorted = [...local].sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
    return sorted[0];
  }
  return null;
}

export async function createScriptVersion(
  scriptId: string, 
  chatId: string, 
  versionData: Omit<ScriptVersion, 'id' | 'script_id' | 'chat_id' | 'created_at'>
): Promise<ScriptVersion> {
  let nextVersionNumber = versionData.version_number;
  
  if (!nextVersionNumber) {
    // calculate dynamically
    const existing = await getScriptVersions(scriptId);
    nextVersionNumber = existing.length > 0 ? Math.max(...existing.map(v => v.version_number)) + 1 : 1;
  }

  const newVersion: ScriptVersion = {
    id: generateUUID(),
    script_id: scriptId,
    chat_id: chatId,
    version_number: nextVersionNumber,
    change_summary: versionData.change_summary || '',
    user_request: versionData.user_request || '',
    files: versionData.files,
    dependencies: versionData.dependencies || [],
    install_steps: versionData.install_steps || [],
    warnings: versionData.warnings || [],
    generated_by: versionData.generated_by || 'gemini',
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { error: vError } = await supabase
        .from('script_versions')
        .insert([newVersion]);
        
      if (!vError) {
        await supabase
          .from('generated_scripts')
          .update({
            files: newVersion.files,
            current_version_id: newVersion.id,
            version_count: nextVersionNumber,
            last_user_request: newVersion.user_request,
            last_change_summary: newVersion.change_summary,
            warnings: newVersion.warnings,
            dependencies: newVersion.dependencies,
            install_steps: newVersion.install_steps,
            updated_at: new Date().toISOString()
          })
          .eq('id', scriptId);

        return newVersion;
      }
      console.log('Supabase createScriptVersion: fallback loaded');
    } catch (err) {
      console.log('Supabase createScriptVersion retry: fallback loaded');
    }
  }

  // Fallback locally
  localStore.versions.push(newVersion);
  
  const scriptIdx = localStore.scripts.findIndex(s => s.id === scriptId);
  if (scriptIdx !== -1) {
    localStore.scripts[scriptIdx] = {
      ...localStore.scripts[scriptIdx],
      files: newVersion.files,
      current_version_id: newVersion.id,
      version_count: nextVersionNumber,
      last_user_request: newVersion.user_request,
      last_change_summary: newVersion.change_summary,
      dependencies: newVersion.dependencies,
      install_steps: newVersion.install_steps,
      warnings: newVersion.warnings,
      updated_at: new Date().toISOString()
    };
  }
  
  return newVersion;
}

export async function updateCurrentScriptVersion(
  scriptId: string, 
  versionId: string, 
  files: Record<string, string>, 
  summary: string
): Promise<void> {
  if (supabase) {
    try {
      await supabase
        .from('script_versions')
        .update({ files, change_summary: summary })
        .eq('id', versionId);

      await supabase
        .from('generated_scripts')
        .update({ 
          files, 
          last_change_summary: summary,
          updated_at: new Date().toISOString()
        })
        .eq('id', scriptId);
      return;
    } catch (err) {
      console.log('Supabase updateCurrentScriptVersion: local fallback');
    }
  }

  // Local updates
  const vIdx = localStore.versions.findIndex(v => v.id === versionId);
  if (vIdx !== -1) {
    localStore.versions[vIdx].files = files;
    localStore.versions[vIdx].change_summary = summary;
  }
  const scriptIdx = localStore.scripts.findIndex(s => s.id === scriptId);
  if (scriptIdx !== -1) {
    localStore.scripts[scriptIdx].files = files;
    localStore.scripts[scriptIdx].last_change_summary = summary;
    localStore.scripts[scriptIdx].updated_at = new Date().toISOString();
  }
}

export async function getScriptVersions(scriptId: string): Promise<ScriptVersion[]> {
  if (!scriptId || scriptId === 'null' || scriptId === 'undefined') {
    return [];
  }
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('script_versions')
        .select('*')
        .eq('script_id', scriptId)
        .order('version_number', { ascending: false });
      if (!error && data) return data as ScriptVersion[];
      console.log('Supabase getScriptVersions: using offline log');
    } catch (err) {
      console.log('Supabase getScriptVersions retry: using offline log');
    }
  }
  return localStore.versions
    .filter(v => v.script_id === scriptId)
    .sort((a, b) => b.version_number - a.version_number);
}

export async function rollbackScriptVersion(scriptId: string, versionId: string): Promise<{ rolledBackVersion: ScriptVersion; oldVersionNumber: number } | null> {
  let selectedVersion: ScriptVersion | null = null;
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('script_versions')
        .select('*')
        .eq('id', versionId)
        .single();
      if (!error && data) {
        selectedVersion = data as ScriptVersion;
      }
    } catch (err) {
      console.log('Supabase rollbackScriptVersion: offline execution');
    }
  }
  
  if (!selectedVersion) {
    selectedVersion = localStore.versions.find(v => v.id === versionId) || null;
  }
  
  if (!selectedVersion) {
    return null;
  }
  
  const existingVersions = await getScriptVersions(scriptId);
  const maxNum = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.version_number)) : 1;
  const nextNum = maxNum + 1;
  
  const rolledBackVersion = await createScriptVersion(scriptId, selectedVersion.chat_id, {
    version_number: nextNum,
    change_summary: `Restauração automática para o estado da Versão v${selectedVersion.version_number}`,
    user_request: `Reversão/Rollback para v${selectedVersion.version_number}`,
    files: selectedVersion.files,
    dependencies: selectedVersion.dependencies || [],
    install_steps: selectedVersion.install_steps || [],
    warnings: selectedVersion.warnings || [],
    generated_by: selectedVersion.generated_by
  });
  
  return { rolledBackVersion, oldVersionNumber: selectedVersion.version_number };
}

