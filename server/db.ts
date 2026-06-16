import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { KnowledgeDocument, AIChat, AIMessage, GeneratedScript } from '../src/types';
import { initialKnowledgeBase, mockGeneratedScriptsList } from '../src/seedData';

// Dynamic server-side configuration variables
let supabaseUrl = process.env.SUPABASE_URL || '';
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;
let supabaseError: string | null = null;

export function getSupabaseError(): string | null {
  return supabaseError;
}

// Local in-memory store for fallback/graceful execution
const localStore = {
  documents: [...initialKnowledgeBase],
  chats: [
    { id: "chat-sample-1", title: "Mineração de Ouro RSG Core", created_at: new Date().toISOString() }
  ] as AIChat[],
  messages: [] as AIMessage[],
  scripts: [...mockGeneratedScriptsList] as GeneratedScript[]
};

export function updateSupabaseConfig(url: string, key: string) {
  supabaseUrl = url;
  supabaseAnonKey = key;
  if (url && key) {
    try {
      supabase = createClient(url, key);
      supabaseError = null;
      console.log('Supabase client successfully updated.');
      return true;
    } catch (err: any) {
      console.error('Error initializing Supabase client:', err);
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

// Check initial variables
if (supabaseUrl && supabaseAnonKey) {
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
        console.warn('Supabase getDocuments error, falling back to local store:', error);
      }
    } catch (err: any) {
      supabaseError = err?.message || "Exceção ao ler do Supabase";
      console.error('Exception fetching documents from Supabase:', err);
    }
  }
  return localStore.documents;
}

export async function addDocument(doc: Omit<KnowledgeDocument, 'id' | 'created_at' | 'updated_at'>): Promise<KnowledgeDocument> {
  const newDoc: KnowledgeDocument = {
    ...doc,
    id: crypto.randomUUID ? crypto.randomUUID() : 'doc_' + Math.random().toString(36).substring(2, 9),
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
      console.warn('Supabase addDocument error, adding locally:', error);
    } catch (err) {
      console.error('Exception adding document to Supabase:', err);
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
      console.warn('Supabase updateDocument error, performing locally:', error);
    } catch (err) {
      console.error('Exception updating document in Supabase:', err);
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
      console.warn('Supabase deleteDocument error, performing locally:', error);
    } catch (err) {
      console.error('Exception deleting document in Supabase:', err);
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
      console.warn('Supabase getChats error, falling back to local:', error);
    } catch (err) {
      console.error('Exception fetching chats from Supabase:', err);
    }
  }
  return localStore.chats;
}

export async function createChat(title?: string): Promise<AIChat> {
  const newChat: AIChat = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'chat_' + Math.random().toString(36).substring(2, 9),
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
      console.warn('Supabase createChat error, creating locally:', error);
    } catch (err) {
      console.error('Exception creating chat in Supabase:', err);
    }
  }

  localStore.chats.unshift(newChat);
  return newChat;
}

// 3. MESSAGES CONTROLLERS
export async function getChatMessages(chatId: string): Promise<AIMessage[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (!error && data) return data as AIMessage[];
      console.warn('Supabase getMessages error, loading locally:', error);
    } catch (err) {
      console.error('Exception fetching messages from Supabase:', err);
    }
  }
  return localStore.messages.filter(m => m.chat_id === chatId);
}

export async function addChatMessage(msg: Omit<AIMessage, 'id' | 'created_at'>): Promise<AIMessage> {
  const newMsg: AIMessage = {
    ...msg,
    id: crypto.randomUUID ? crypto.randomUUID() : 'msg_' + Math.random().toString(36).substring(2, 9),
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .insert([newMsg])
        .select();
      if (!error && data && data[0]) {
        return data[0] as AIMessage;
      }
      console.warn('Supabase addChatMessage error, adding locally:', error);
    } catch (err) {
      console.error('Exception writing message to Supabase:', err);
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
      console.warn('Supabase getScripts error, loading locally:', error);
    } catch (err) {
      console.error('Exception fetching scripts from Supabase:', err);
    }
  }
  return localStore.scripts;
}

export async function saveGeneratedScript(script: Omit<GeneratedScript, 'id' | 'created_at'>): Promise<GeneratedScript> {
  const newScript: GeneratedScript = {
    ...script,
    id: crypto.randomUUID ? crypto.randomUUID() : 'script_' + Math.random().toString(36).substring(2, 9),
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
      console.warn('Supabase saveGeneratedScript error, saving locally:', error);
    } catch (err) {
      console.error('Exception writing script to Supabase:', err);
    }
  }

  localStore.scripts.unshift(newScript);
  return newScript;
}
