import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, MessageSquare, Terminal, Eye, Copy, Check, FileCode, AlertTriangle, 
  HelpCircle, ChevronDown, ChevronRight, Server, BookOpen, Layers, RefreshCw, History, GitCommit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AIChat, AIMessage, GeneratedScript, KnowledgeDocument, ScriptVersion } from '../types';

interface ChatViewProps {
  currentTab: string;
}

export default function ChatView({ currentTab }: ChatViewProps) {
  const [chats, setChats] = useState<AIChat[]>([]);
  const [activeChat, setActiveChat] = useState<AIChat | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Active Code viewer panel states
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [activeScript, setActiveScript] = useState<GeneratedScript | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [scriptExpanded, setScriptExpanded] = useState(true);

  // PROJETO VIVO - continuous history states
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [codeSubTab, setCodeSubTab] = useState<'source' | 'versions'>('source');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorationAlert, setRestorationAlert] = useState<string | null>(null);

  // Track expanded context documents accordion for each message
  const [expandedContexts, setExpandedContexts] = useState<Record<string, boolean>>({});

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load Chats on Mount
  useEffect(() => {
    fetchChats();
  }, [refreshKey]);

  // Load messages whenever activeChat changes
  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat.id);
      fetchChatScript(activeChat.id);
    } else {
      setMessages([]);
      setActiveScript(null);
      setVersions([]);
    }
  }, [activeChat]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data);
        if (data.length > 0 && !activeChat) {
          setActiveChat(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const fetchChatScript = async (chatId: string) => {
    try {
      const res = await fetch('/api/scripts');
      if (res.ok) {
        const data: GeneratedScript[] = await res.json();
        const chatScript = data.find(s => s.chat_id === chatId);
        if (chatScript) {
          setActiveScript(chatScript);
          
          // Auto-select first file if not set or invalid for selected script
          const files = Object.keys(chatScript.files);
          if (files.length > 0 && (!selectedFile || !chatScript.files[selectedFile])) {
            setSelectedFile(files[0]);
          }

          // Fetch script versions history for the current script
          const vRes = await fetch(`/api/scripts/${chatScript.id}/versions`);
          if (vRes.ok) {
            const vData = await vRes.json();
            setVersions(vData);
          }
        } else {
          setActiveScript(null);
          setVersions([]);
        }
      }
    } catch (err) {
      console.error('Error fetching scripts:', err);
    }
  };

  const handleCreateChat = async () => {
    const title = prompt('Insira o título da nova sessão do RedM Forge:');
    if (!title) return;
    
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const newChat = await res.json();
        setChats(prev => [newChat, ...prev]);
        setActiveChat(newChat);
      }
    } catch (err) {
      console.error('Error creating chat:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat || isLoading) return;

    const textToSend = inputText;
    setInputText('');
    setIsLoading(true);

    // Optimistically push user message
    const tempUserMsg: AIMessage = {
      id: 'temp-user-' + Date.now(),
      chat_id: activeChat.id,
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/chats/${activeChat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textToSend })
      });

      if (res.ok) {
        const data = await res.json();
        // Replace temp and add model message
        setMessages(prev => prev.filter(m => !m.id.startsWith('temp-user-')).concat([data.userMessage, data.modelMessage]));
        
        // Refresh scripts if a script was generated
        if (data.hasScript && data.scriptDetail) {
          fetchChatScript(activeChat.id);
        }
      } else {
        // Handle failure by pushing an error block
        const tempErrorMsg: AIMessage = {
          id: 'temp-err-' + Date.now(),
          chat_id: activeChat.id,
          role: 'model',
          content: '❌ Ocorreu um erro ao chamar a Gemini API no servidor. Verifique as configurações de API Key nas credenciais e tente novamente.',
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempErrorMsg]);
      }
    } catch (err: any) {
      console.error('Error posting message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = (filename: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const toggleContextAccordion = (msgId: string) => {
    setExpandedContexts(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!activeScript) return;
    setIsRestoring(true);
    setRestorationAlert(null);
    try {
      const res = await fetch(`/api/scripts/${activeScript.id}/rollback/${versionId}`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setRestorationAlert(`Versão restaurada com sucesso como nova versão atual (v${data.version.version_number}).`);
        
        // Refresh scripts/versions list and message logs
        await fetchChatScript(activeScript.chat_id);
        await fetchMessages(activeScript.chat_id);
        
        // Automatically pivot back to showing active source files
        setCodeSubTab('source');
        
        // Auto-dismiss alert after 5s
        setTimeout(() => setRestorationAlert(null), 5000);
      } else {
        const data = await res.json();
        alert(`Erro ao restaurar versão: ${data.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      console.error('Exception performing continuous script restoration:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div id="chat-workspace" className="h-[90vh] flex overflow-hidden border border-red-950/20 rounded-xl bg-neutral-950 text-neutral-200">

      
      {/* SESSIONS LEFT COLUMN */}
      <div id="chat-sessions" className="w-64 border-r border-red-950/20 bg-neutral-950/60 flex flex-col justify-between max-h-full">
        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-widest text-neutral-500 uppercase">Sessões Forge</span>
            <button
              onClick={handleCreateChat}
              className="p-1.5 bg-red-950/30 hover:bg-red-950/60 border border-red-800/40 rounded text-red-400 hover:text-white transition-colors"
              title="Nova Sessão de RedM"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {chats.map(chat => {
              const isActive = activeChat?.id === chat.id;
              return (
                <button
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-sans transition-all flex items-center gap-2 border ${
                    isActive 
                      ? 'bg-red-950/25 border-red-900/40 text-red-300 font-semibold' 
                      : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                  }`}
                >
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-red-400' : 'text-neutral-500'}`} />
                  <span className="truncate max-w-[170px]">{chat.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-red-950/10 text-center font-mono text-[10px] text-neutral-500">
          Suporte: rsg-core v1.9+
        </div>
      </div>

      {/* CORE ACTIVE WORKSPACE */}
      <div id="chat-core-workspace" className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* MESSAGE DISCUSSION HISTORY AREA */}
        <div className="flex-1 flex flex-col justify-between h-full bg-neutral-950">
          
          {/* HEADER CHAT INFO */}
          <div className="p-4 border-b border-red-950/20 bg-neutral-950 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-sans font-bold text-white uppercase tracking-wider">
                  {activeChat ? activeChat.title : 'Nenhum Chat Selecionado'}
                </h3>
                {activeScript && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 text-[9px] font-mono font-medium tracking-tight">
                    v{activeScript.version_count || 1} (versão atual)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                {activeScript ? `PROJETO: ${activeScript.title.toUpperCase()} • EVOLUÇÃO CONTÍNUA` : 'RAG PIPELINE ATIVO • CRIAÇÃO DE SCRIPTS REDM'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeScript && (
                <button
                  type="button"
                  onClick={() => {
                    setCodeSubTab(codeSubTab === 'versions' ? 'source' : 'versions');
                    setScriptExpanded(true);
                  }}
                  className={`p-1 px-2 border rounded text-[10px] font-mono flex items-center gap-1 transition-all ${
                    codeSubTab === 'versions'
                      ? 'border-red-900 bg-red-950/30 text-red-300'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                  title="Histórico de Versões do Script"
                >
                  <History className="w-3 h-3 text-red-500" />
                  <span>Histórico ({versions.length})</span>
                </button>
              )}
              {activeChat && (
                <button 
                  onClick={() => { fetchMessages(activeChat.id); fetchChatScript(activeChat.id); }} 
                  className="p-1 px-2 border border-neutral-800 rounded bg-neutral-900 text-[10px] font-mono text-neutral-400 hover:text-white flex items-center gap-1 hover:border-neutral-700 transition"
                  title="Recarregar esta conversa"
                >
                  <RefreshCw className="w-3 h-3" /> Sincronizar
                </button>
              )}
            </div>
          </div>

          {/* CHAT MESSAGES PANEL */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto gap-3 py-12">
                <Terminal className="w-8 h-8 text-red-700 animate-pulse" />
                <h4 className="text-sm font-sans font-semibold text-neutral-300">Comece a Forjar Scripts RedM</h4>
                <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                  Insira uma solicitação de recurso, como por exemplo:<br />
                  <span className="text-red-400/80 font-mono italic">"Criar um script de roubo a saloons com lockpick"</span> ou <span className="text-red-400/80 font-mono italic">"Preciso de uma HUD de necessidades customizada para RSG"</span>.
                </p>
              </div>
            )}

            {messages.map((msg, index) => {
              const isAI = msg.role === 'model' || msg.role === 'system';
              return (
                <div key={msg.id || index} className={`flex flex-col gap-2 ${isAI ? 'items-start' : 'items-end'}`}>
                  {/* MESSAGE BLOCK */}
                  <div className={`max-w-[85%] rounded-xl p-4 text-xs font-sans border ${
                    isAI 
                      ? 'bg-neutral-900/60 border-neutral-900 text-neutral-200' 
                      : 'bg-red-950/20 border-red-900/30 text-neutral-100'
                  }`}>
                    
                    {/* ROLE BADGE */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        isAI ? 'bg-red-950 text-red-400' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {isAI ? 'AI Forge Agent' : 'Você (Dev)'}
                      </span>
                      <span className="text-[9px] font-mono text-neutral-500">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    {/* CONTENT BODY */}
                    <div className="whitespace-pre-line leading-relaxed font-sans text-xs">
                      {msg.content}
                    </div>

                    {/* RAG METADATA TRANSPARENCY ACCORDION (AI MESSAGES ONLY) */}
                    {isAI && msg.retrieved_context && msg.retrieved_context.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-neutral-800/60">
                        <button
                          onClick={() => toggleContextAccordion(msg.id)}
                          className="flex items-center gap-1 text-[10px] font-mono text-red-400 hover:text-red-300 transition-colors"
                        >
                          {expandedContexts[msg.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          📚 Base Consultada ({msg.retrieved_context.length} documentos injetados no RAG)
                        </button>

                        <AnimatePresence>
                          {expandedContexts[msg.id] && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mt-2 bg-neutral-950/80 rounded border border-neutral-900 p-2.5 flex flex-col gap-2"
                            >
                              {msg.retrieved_context.map((doc, dIdx) => (
                                <div key={doc.id || dIdx} className="text-[10px] border-b border-neutral-900/60 last:border-0 pb-1.5 last:pb-0 font-sans">
                                  <div className="flex items-center justify-between text-neutral-300 font-semibold">
                                    <span>{doc.title}</span>
                                    <span className="font-mono text-[9px] bg-red-950/20 text-red-500 px-1 rounded-sm uppercase tracking-wider">{doc.category}</span>
                                  </div>
                                  <p className="text-neutral-500 text-[9px] mt-0.5 line-clamp-2 italic">
                                    {doc.content.substring(0, 150)}...
                                  </p>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* AI LOADING SKELETON */}
            {isLoading && (
              <div className="flex flex-col gap-2 items-start">
                <div className="max-w-[70%] rounded-xl p-4 bg-neutral-900/60 border border-neutral-900 text-neutral-400 flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-950 text-red-400 animate-pulse">
                      Consultando RSG Base...
                    </span>
                  </div>
                  <div className="space-y-2 mt-1">
                    <div className="h-2 bg-neutral-800 rounded animate-pulse w-full"></div>
                    <div className="h-2 bg-neutral-800 rounded animate-pulse w-5/6"></div>
                    <div className="h-2 bg-neutral-800 rounded animate-pulse w-2/3"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* MESSAGE INPUT CONSOLE */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-red-950/20 bg-neutral-950 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!activeChat || isLoading}
              placeholder={activeChat ? "Digite o recurso ou alteração que deseja forjar no REDM/RSG..." : "Selecione ou crie um chat abaixo para iniciar"}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-xs placeholder-neutral-500 text-neutral-100 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!activeChat || isLoading || !inputText.trim()}
              className="p-3 bg-red-700 hover:bg-red-600 active:bg-red-800 disabled:opacity-40 disabled:hover:bg-red-700 rounded-lg text-white transition-colors flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* CODE WORKSPACE RIGHT PANELS (SHOWS WHEN SCRIPT IS LOADED) */}
        <AnimatePresence>
          {activeScript && (
            <motion.div
              initial={{ opacity: 0, x: 200 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 200 }}
              className="w-full md:w-[480px] border-t md:border-t-0 md:border-l border-red-950/25 bg-neutral-950 flex flex-col h-[50vh] md:h-full relative overflow-hidden"
            >
              {/* CODE HEADER */}
              <div className="p-4 border-b border-red-950/20 bg-neutral-950/90 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-sans font-bold text-white tracking-wider flex items-center gap-1.5 uppercase">
                    <FileCode className="w-4 h-4 text-red-500" /> Script Forjado Ativo
                  </h4>
                  <span className="text-[10px] font-mono text-red-400 font-semibold">{activeScript.title}</span>
                </div>
                <button
                  onClick={() => setScriptExpanded(!scriptExpanded)}
                  className="text-xs font-mono text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded"
                >
                  {scriptExpanded ? 'Recolher Editor' : 'Expandir Editor'}
                </button>
              </div>

              {/* RESTORATION SUCCESS ALERT BANNER */}
              {restorationAlert && (
                <div className="bg-emerald-950/80 border-b border-emerald-900/40 p-3 mx-4 mt-3 rounded-lg flex items-center justify-between gap-2 text-emerald-400 text-xs leading-relaxed font-sans shadow-md">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{restorationAlert}</span>
                  </div>
                  <button onClick={() => setRestorationAlert(null)} className="text-[10px] uppercase font-mono tracking-tight text-neutral-400 hover:text-white">Fechar</button>
                </div>
              )}

              {/* WARNING BOX FOR SIMULATED SCRIPT */}
              {activeScript.generated_by === 'mock' && (
                <div className="bg-yellow-950/30 border-b border-yellow-900/40 p-3.5 mx-4 mt-3 rounded-lg flex items-start gap-2.5 text-yellow-500 text-[11px] leading-relaxed font-sans shadow-md">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-yellow-400 font-bold uppercase block mb-1">Aviso de Simulação</strong>
                    Este script foi gerado em modo simulado. Não representa resposta real da IA. Configure sua chave Gemini nas Configurações do app.
                  </div>
                </div>
              )}

              {scriptExpanded ? (
                <>
                  {/* SUB TAB BAR: CODE vs VERSIONS */}
                  <div className="flex border-b border-red-950/20 bg-neutral-950 select-none">
                    <button
                      type="button"
                      onClick={() => setCodeSubTab('source')}
                      className={`flex-1 text-center py-2.5 text-xs font-mono transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                        codeSubTab === 'source'
                          ? 'border-b-red-600 text-red-00 bg-neutral-900/40 font-bold text-red-400'
                          : 'border-b-transparent text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>📁 Código-Fonte</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodeSubTab('versions')}
                      className={`flex-1 text-center py-2.5 text-xs font-mono transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                        codeSubTab === 'versions'
                          ? 'border-b-red-600 text-red-100 bg-neutral-900/40 font-bold text-red-400'
                          : 'border-b-transparent text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>📜 Versões ({versions.length})</span>
                    </button>
                  </div>

                  {codeSubTab === 'source' ? (
                    <>
                      {/* FILE SELECTOR TABS */}
                      <div className="flex border-b border-neutral-900/60 bg-neutral-950/40 overflow-x-auto text-[10px] font-mono select-none">
                        {Object.keys(activeScript.files).map(filename => {
                          const isModified = activeScript.last_change_summary?.toLowerCase().includes(filename.toLowerCase());
                          return (
                            <button
                              key={filename}
                              onClick={() => setSelectedFile(filename)}
                              className={`px-3.5 py-2.5 border-r border-neutral-900/60 transition-all flex items-center gap-1.5 shrink-0 ${
                                selectedFile === filename 
                                  ? 'bg-neutral-900 text-red-400 border-b-2 border-b-red-700 font-bold' 
                                  : 'text-neutral-500 hover:text-neutral-300 bg-neutral-950'
                              }`}
                            >
                              <span>{filename}</span>
                              {isModified && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Modificado recentemente" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* ACTIVE CODE CONTENT CONTAINER */}
                      <div className="flex-1 overflow-y-auto p-4 bg-neutral-900/40 font-mono text-xs relative">
                        {selectedFile && activeScript.files[selectedFile] ? (
                          <>
                            {/* COPY FLOATING BUTTON */}
                            <div className="absolute right-4 top-4 z-10 flex gap-2">
                              <button
                                onClick={() => handleCopyCode(selectedFile, activeScript.files[selectedFile])}
                                className="p-1.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded transition flex items-center gap-1 text-[10px]"
                              >
                                {copiedFile === selectedFile ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copiador!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* RENDER CODE TEXT */}
                            <pre className="text-emerald-400/90 whitespace-pre leading-relaxed select-text pr-12 pb-16 font-mono text-[11px]">
                              <code>{activeScript.files[selectedFile]}</code>
                            </pre>
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full text-neutral-500 italic text-[11px]">
                            Nenhum arquivo ativo selecionado.
                          </div>
                        )}
                      </div>

                      {/* SCRIPT ACCORDION EXPANSION (WARNINGS & DEPENDENCIES) */}
                      <div className="p-3 bg-neutral-950 border-t border-red-950/20 text-[10px] font-mono flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-amber-500 font-semibold mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Avisos Técnicos de Instalação:
                        </div>
                        {activeScript.warnings && activeScript.warnings.length > 0 ? (
                          activeScript.warnings.map((warn, wIdx) => (
                            <div key={wIdx} className="text-neutral-500 pl-3 border-l border-amber-900/50">
                              • {warn}
                            </div>
                          ))
                        ) : (
                          <div className="text-neutral-500 italic pl-3">Nenhum aviso emitido para este script.</div>
                        )}
                        
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-neutral-900/80 items-center">
                          <span className="text-neutral-500 font-bold uppercase text-[9px] tracking-wider">Dependências:</span>
                          {activeScript.dependencies.map(dep => (
                            <span key={dep} className="px-1.5 py-0.5 bg-red-950/40 text-red-500 border border-red-900/30 rounded text-[9px] font-bold">
                              {dep}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-4 bg-neutral-950 flex flex-col gap-3">
                      <div className="text-xs font-mono text-neutral-400 mb-1 font-bold uppercase tracking-wide flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-red-500" /> Histórico Evolutivo
                      </div>
                      
                      {versions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500 gap-2">
                          <GitCommit className="w-6 h-6 text-neutral-700 animate-pulse" />
                          <span className="text-[10px] font-mono">Nenhuma versão listada...</span>
                        </div>
                      ) : (
                        versions.map(v => {
                          const isCurrent = v.id === activeScript.current_version_id || v.version_number === activeScript.version_count;
                          return (
                            <div 
                              key={v.id} 
                              className={`p-3 rounded-lg border text-xs font-sans flex flex-col gap-2 transition-all ${
                                isCurrent 
                                  ? 'bg-red-950/15 border-red-900/40 text-neutral-100 shadow-lg' 
                                  : 'bg-neutral-900/40 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-red-400 text-xs">Versão v{v.version_number}</span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900/45 text-[8px] font-mono font-bold uppercase">
                                      ativa
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[9px] text-neutral-500">
                                  {v.created_at ? new Date(v.created_at).toLocaleString('pt-BR') : ''}
                                </span>
                              </div>

                              {v.user_request && (
                                <div className="bg-neutral-950/60 p-2 rounded text-[10px] border border-neutral-900">
                                  <span className="text-neutral-500 block font-mono text-[8px] uppercase font-bold tracking-wider mb-0.5">Solicitação do Usuário:</span>
                                  <p className="line-clamp-2 text-neutral-300 italic">"{v.user_request}"</p>
                                </div>
                              )}

                              <div>
                                <span className="text-neutral-500 font-mono text-[8px] uppercase font-bold tracking-wider block mb-0.5">Resumo das Alterações:</span>
                                <p className="text-neutral-200 leading-relaxed text-[11px]">{v.change_summary || "Melhoria incremental do script RedM."}</p>
                              </div>

                              <div className="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-neutral-900">
                                <span className="text-[9px] font-mono text-neutral-500 uppercase">
                                  {Object.keys(v.files).length} arquivos
                                </span>
                                
                                {!isCurrent && (
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreVersion(v.id)}
                                    disabled={isRestoring}
                                    className="px-2 py-0.5 bg-red-950 hover:bg-red-900 disabled:opacity-40 text-red-400 hover:text-red-200 border border-red-800/30 rounded text-[10px] font-mono transition-colors flex items-center gap-1"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${isRestoring ? 'animate-spin' : ''}`} />
                                    <span>Restaurar esta versão</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-2">
                  <Terminal className="w-5 h-5 text-neutral-600 animate-bounce" />
                  <span className="text-[10px] font-mono text-neutral-500">O editor de arquivos está recolhido para melhor leitura do chat. Clique em "Expandir" acima para visualizar e copiar os scripts forjados.</span>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
