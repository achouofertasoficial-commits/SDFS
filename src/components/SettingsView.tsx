import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Cpu, Check, Server, Eye, EyeOff, AlertTriangle, Key } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsViewProps {
  currentTab: string;
  supabaseConnected: boolean;
  geminiConfigured: boolean;
  onRefreshStats: () => void;
}

export default function SettingsView({
  currentTab,
  supabaseConnected,
  geminiConfigured,
  onRefreshStats
}: SettingsViewProps) {
  
  const [formKeys, setFormKeys] = useState({
    geminiApiKey: '',
    supabaseUrl: '',
    supabaseAnonKey: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showSupaKey, setShowSupaKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/configs/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: formKeys.geminiApiKey || undefined,
          supabaseUrl: formKeys.supabaseUrl || undefined,
          supabaseAnonKey: formKeys.supabaseAnonKey || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        onRefreshStats();
        setStatusMessage({
          success: true,
          message: 'Configurações de credenciais sincronizadas no backend Express com sucesso!'
        });
        
        // Blank key prompts after successful save to represent active state safely
        setFormKeys(prev => ({
          ...prev,
          geminiApiKey: '',
          supabaseAnonKey: ''
        }));

      } else {
        setStatusMessage({
          success: false,
          message: 'Ocorreu um erro ao atualizar os parâmetros no servidor.'
        });
      }
    } catch (err: any) {
      console.error('Error updating configurations:', err);
      setStatusMessage({
        success: false,
        message: 'Falha de comunicação com as rotas de API do servidor.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      id="settings-pane"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="p-8 flex flex-col md:flex-row gap-8 max-w-5xl mx-auto text-neutral-200"
    >
      {/* LEFT COLUMN: PARAMETER CONFIGS FORM */}
      <div id="settings-form-block" className="flex-1 bg-neutral-950/60 p-6 border border-red-950/20 rounded-xl flex flex-col gap-6">
        <div>
          <h3 id="settings-title" className="font-sans font-bold text-sm text-neutral-100 flex items-center gap-2 uppercase tracking-wide">
            <Settings className="w-4 h-4 text-red-500" /> Sincronizador de Credenciais
          </h3>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
            Configure credenciais no servidor local para estender as capacidades do RAG
          </p>
        </div>

        {statusMessage && (
          <div className={`p-3 rounded-lg text-xs font-sans flex items-start gap-2 border ${
            statusMessage.success 
              ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' 
              : 'bg-red-950/20 border-red-900/40 text-red-400'
          }`}>
            <span>{statusMessage.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveKeys} className="flex flex-col gap-4">
          
          {/* GEMINI API KEY FIELD */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wilder flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-red-500" /> Gemini API Key (Backend Override)
              </label>
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="text-[10px] text-neutral-400 hover:text-white"
              >
                {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <input
              type={showGeminiKey ? "text" : "password"}
              placeholder={geminiConfigured ? "•••••••••••••••••••• (Já Configurada)" : "Cole sua chave API Gemini..."}
              value={formKeys.geminiApiKey}
              onChange={(e) => setFormKeys(prev => ({ ...prev, geminiApiKey: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs placeholder-neutral-500 text-neutral-200 focus:outline-none focus:border-red-600"
            />
            <span className="text-[10px] text-neutral-500 font-mono">
              Enviado e mantido estritamente na memória de runtime no backend do servidor container.
            </span>
          </div>

          <hr className="border-neutral-900 my-1" />

          {/* SUPABASE PROJECT URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wilder flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-neutral-400" /> Supabase Project URL
            </label>
            <input
              type="text"
              placeholder="https://ehygskjfdhlksjadgfl.supabase.co"
              value={formKeys.supabaseUrl}
              onChange={(e) => setFormKeys(prev => ({ ...prev, supabaseUrl: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs placeholder-neutral-500 text-neutral-200 focus:outline-none focus:border-red-600"
            />
          </div>

          {/* SUPABASE ANON KEY */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wilder">
                Supabase Anon / Public API Key
              </label>
              <button
                type="button"
                onClick={() => setShowSupaKey(!showSupaKey)}
                className="text-[10px] text-neutral-400 hover:text-white"
              >
                {showSupaKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <input
              type={showSupaKey ? "text" : "password"}
              placeholder={supabaseConnected ? "•••••••••••••••••••• (Sincronizado Ativo)" : "Cole a ANON_KEY do seu painel Supabase..."}
              value={formKeys.supabaseAnonKey}
              onChange={(e) => setFormKeys(prev => ({ ...prev, supabaseAnonKey: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs placeholder-neutral-500 text-neutral-200 focus:outline-none focus:border-red-600"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3 bg-red-700 hover:bg-red-600 active:bg-red-800 disabled:opacity-50 text-white font-sans font-semibold text-xs rounded-lg transition-colors shadow-lg hover:shadow-red-900/20"
          >
            {isLoading ? 'Sincronizando Credenciais...' : 'Salvar Configurações e Conexão'}
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: CRITICAL CONSTRAINTS AND SAFETY BULLETINS */}
      <div id="settings-bulletin-block" className="w-full md:w-[320px] shrink-0 flex flex-col gap-5">
        
        {/* NETWORK & DB DIAGNOSTIC PANELS */}
        <div id="diagnostic-box" className="p-5 rounded-xl bg-neutral-950 border border-neutral-900 flex flex-col gap-3">
          <h4 className="text-[10px] font-mono font-bold tracking-widest text-red-500 uppercase flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> Estado Ativo de Ingress
          </h4>

          <div className="flex flex-col gap-2.5 text-xs font-mono">
            <div className="flex justify-between items-center py-1 border-b border-neutral-900">
              <span className="text-neutral-500">Gemini 3.5 Ready</span>
              <span className={geminiConfigured ? 'text-emerald-400' : 'text-amber-500'}>
                {geminiConfigured ? 'SIM (ACTIVE)' : 'Pendente'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-neutral-900">
              <span className="text-neutral-500">Supabase DB Client</span>
              <span className={supabaseConnected ? 'text-emerald-400 font-bold' : 'text-amber-500'}>
                {supabaseConnected ? 'CONECTADO' : 'MOCK FALLBACK'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-neutral-900">
              <span className="text-neutral-500">Framework Target</span>
              <span className="text-red-400">RSG CORE v1.9+</span>
            </div>
          </div>
        </div>

        {/* SECURITY BULLETIN BOARD (MANDATED FOR FRONTEND CAUTIONS) */}
        <div id="security-box" className="p-5 rounded-xl bg-red-950/20 border border-red-900/30 flex flex-col gap-3">
          <h4 className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Alerta de Segurança (Produção)
          </h4>
          
          <div className="text-xs text-neutral-400 font-sans leading-relaxed flex flex-col gap-3.5">
            <p>
              ⚠️ <strong className="text-white">Isolamento de Chaves:</strong> A API Key do Gemini (e o token secreto do Supabase) **NUNCA** deve ser exposta diretamente no código cliente (Javascript do navegador) em produção.
            </p>
            <p>
              🛡️ No modelo full-stack deste MVP, implementamos a arquitetura ideal: todas as requisições à Gemini API e ao Supabase passam exclusivamente por rotas de proxy seguras (<code className="text-red-400 bg-neutral-900 px-1 font-mono rounded text-[10px]">/api/*</code>) dentro do nosso servidor Express rodando no container Cloud Run.
            </p>
            <p>
              🚀 Isto garante que em ambientes de produção de larga escala, suas chaves de faturamento e infraestrutura permaneçam 100% ocultas do usuário final e seguras contra engenharia reversa.
            </p>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
