import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Cpu, Check, Server, Eye, EyeOff, AlertTriangle, Key, RefreshCw, Wifi, WifiOff, Database, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsViewProps {
  currentTab: string;
  supabaseConnected: boolean;
  geminiConfigured: boolean;
  onRefreshStats: () => void;
}

export default function SettingsView({
  currentTab,
  supabaseConnected: parentSupabaseConnected,
  geminiConfigured: parentGeminiConfigured,
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

  // Advanced system state loaded from backend API
  const [systemState, setSystemState] = useState({
    supabaseConnected: parentSupabaseConnected,
    supabaseConfigured: false,
    supabaseUsingFallback: !parentSupabaseConnected,
    supabaseError: null as string | null,
    geminiConfigured: parentGeminiConfigured,
    geminiError: null as string | null,
    config: {
      supabaseUrl: null as string | null,
      hasServiceRoleKey: false,
      hasAnonKey: false,
      geminiConfigured: false
    }
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      tempId: string;
      steps: string[];
    };
    error?: string;
  } | null>(null);

  // Fetch complete real backend variables and parameters on load
  const fetchBackendStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setSystemState({
          supabaseConnected: data.supabaseConnected,
          supabaseConfigured: data.supabaseConfigured,
          supabaseUsingFallback: data.supabaseUsingFallback,
          supabaseError: data.supabaseError || null,
          geminiConfigured: data.geminiConfigured,
          geminiError: data.geminiError || null,
          config: data.config || { supabaseUrl: null, hasServiceRoleKey: false, hasAnonKey: false, geminiConfigured: false }
        });
      }
    } catch (err) {
      console.error("Erro ao ler dados reais de ambiente do Express:", err);
    }
  };

  useEffect(() => {
    fetchBackendStatus();
  }, [parentSupabaseConnected, parentGeminiConfigured]);

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
        setStatusMessage({
          success: true,
          message: 'Parâmetros de credenciais sincronizados no backend Express com sucesso!'
        });
        
        // Clear fields representing secure active state
        setFormKeys(prev => ({
          ...prev,
          geminiApiKey: '',
          supabaseAnonKey: ''
        }));

        await fetchBackendStatus();
        onRefreshStats();

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

  const handleTestSupabaseConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    setStatusMessage(null);

    try {
      console.log("Chamando o endpoint /api/debug/supabase-test para ciclo CRUD...");
      const res = await fetch('/api/debug/supabase-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message,
          details: data.details
        });
        // Sincronize visual stats too
        await fetchBackendStatus();
        onRefreshStats();
      } else {
        setTestResult({
          success: false,
          message: data.message || "Erro durante o teste de persistência real.",
          error: data.error || "Erro misterioso reportado pelo driver Supabase."
        });
      }
    } catch (err: any) {
      console.error("Erro na requisição de diagnóstico:", err);
      setTestResult({
        success: false,
        message: "Falha de rede ao chamar a api de desenvolvimento /api/debug/supabase-test.",
        error: err.message || "Network Error"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <motion.div
      id="settings-pane"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="p-8 flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto text-neutral-200"
    >
      {/* LEFT COLUMN: PARAMETER CONFIGS FORM */}
      <div id="settings-form-block" className="flex-1 bg-neutral-950/60 p-6 border border-red-950/20 rounded-xl flex flex-col gap-6">
        <div>
          <h3 id="settings-title" className="font-sans font-bold text-sm text-neutral-100 flex items-center gap-2 uppercase tracking-wide">
            <Settings className="w-4 h-4 text-red-500 animate-spin-slow" /> Configurador de Infraestrutura DEV
          </h3>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
            Sincronize credenciais temporárias sandbox no runtime em memória do servidor local
          </p>
        </div>

        {/* SECURITY BULLETIN BOARD (EXPRESSIVE CAUTION AS MANDATED) */}
        <div className="bg-red-950/40 border border-red-900/50 p-4 rounded-xl flex flex-col gap-2.5 shadow-xl text-[11px] leading-relaxed">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <strong className="text-red-400 font-extrabold text-xs uppercase tracking-wider block mb-1">🚨 DIRETRIZ DE SEGURANÇA - PRODUÇÃO VS SANDBOX</strong>
              <p className="text-neutral-200">
                Em produção no Cloud Run, <strong>utilize exclusivamente o painel Secrets (Secrets Manager)</strong> do seu console para injetar as chaves sensíveis (<code className="text-red-400 bg-neutral-920 px-1 py-0.5 rounded font-mono text-[9px]">GEMINI_API_KEY</code> e <code className="text-red-400 bg-neutral-920 px-1 py-0.5 rounded font-mono text-[9px]">SUPABASE_SERVICE_ROLE_KEY</code>) com total inviolabilidade.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-red-900/30 text-neutral-400 mt-1">
            ⚠️ <span className="font-bold text-red-400 text-[10px] uppercase">Service Role Warning:</span> A chave <strong>Service Role Key</strong> possui privilégios de bypass sobre todas as regras RLS do seu banco de dados e <strong>nunca deve ser informada ou trafegada via formulários públicos</strong>. Os campos abaixo destinam-se unicamente ao runtime volátil sandbox de desenvolvimento local.
          </div>
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
                <Key className="w-3.5 h-3.5 text-red-500" /> Gemini API Key (Sandbox Local DEV)
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
              placeholder={systemState.geminiConfigured ? "•••••••••••••••••••• (Injetada no Ambiente / Ativa)" : "Cole sua API key secreta..."}
              value={formKeys.geminiApiKey}
              onChange={(e) => setFormKeys(prev => ({ ...prev, geminiApiKey: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs placeholder-neutral-500 text-neutral-200 focus:outline-none focus:border-red-600"
            />
            <span className="text-[10px] text-neutral-500 font-mono">
              Mantida temporariamente na memória segura do servidor Express.
            </span>
          </div>

          <hr className="border-neutral-900 my-1" />

          {/* SUPABASE PROJECT URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wilder flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-neutral-400" /> Supabase URL (Sandbox Local DEV)
            </label>
            <input
              type="text"
              placeholder={systemState.config.supabaseUrl ? `${systemState.config.supabaseUrl} (Já Configurada)` : "https://xxxxxxxxxxxxxxxxxxxx.supabase.co"}
              value={formKeys.supabaseUrl}
              onChange={(e) => setFormKeys(prev => ({ ...prev, supabaseUrl: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs placeholder-neutral-500 text-neutral-200 focus:outline-none focus:border-red-600"
            />
          </div>

          {/* SUPABASE ANON KEY */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wilder">
                Supabase Anon Key (Sandbox Local DEV)
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
              placeholder={systemState.supabaseConnected ? "•••••••••••••••••••• (Anon Key Ativa)" : "Cole sua chave ANON do Supabase..."}
              value={formKeys.supabaseAnonKey}
              onChange={(e) => setFormKeys(prev => ({ ...prev, supabaseAnonKey: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs placeholder-neutral-500 text-neutral-200 focus:outline-none focus:border-red-600"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-red-700 hover:bg-red-600 active:bg-red-800 disabled:opacity-50 text-white font-sans font-semibold text-xs rounded-lg transition-colors shadow-lg hover:shadow-red-900/20 cursor-pointer"
          >
            {isLoading ? 'Sincronizando Credenciais...' : 'Salvar Configurações e Atualizar Conexão'}
          </button>
        </form>

        {/* CONNECTION DIAGNOSTIC PANEL (REQUIRED) */}
        <div className="mt-4 p-5 bg-neutral-900/40 border border-neutral-900 rounded-lg flex flex-col gap-4">
          <div>
            <h4 className="text-xs font-sans font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-red-500" /> Diagnóstico Integrado de Conexão Supabase
            </h4>
            <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
              Execute um ciclo CRUD completo (Gravar, Ler, Deletar) no Supabase real para garantir que todas as permissões/tabelas estão calibradas de forma correta.
            </p>
          </div>

          <button
            onClick={handleTestSupabaseConnection}
            disabled={isTestingConnection}
            className="w-full md:w-auto self-start px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border border-neutral-700 hover:border-red-900/40 text-neutral-200 hover:text-white font-sans font-semibold text-xs rounded transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {isTestingConnection ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-500" />
                <span>Testando Escrita/Leitura/Exclusão...</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-neutral-400" />
                <span>Testar Conexão Supabase</span>
              </>
            )}
          </button>

          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded border text-xs leading-relaxed ${
                testResult.success
                  ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-300'
                  : 'bg-red-950/20 border-red-900/60 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1.5">
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span>{testResult.success ? 'Diagnóstico Bem Sucedido!' : 'Falha no Diagnóstico'}</span>
              </div>
              <p className="font-sans mb-3">{testResult.message}</p>
              
              {testResult.success && testResult.details && (
                <div className="bg-neutral-950/80 p-3 rounded font-mono text-[10px] border border-neutral-900 flex flex-col gap-1 text-emerald-400/80">
                  <span className="text-neutral-500 font-bold uppercase text-[9px] mb-1">Passos de Saneamento Executados:</span>
                  <div>1. <span className="text-white">INSERT</span> doc no banco efetuado com ID UUID real.</div>
                  <div>2. <span className="text-white">READ / SELECT</span> efetuado para carregar e inspecionar o documento de teste.</div>
                  <div>3. <span className="text-white">DELETE</span> efetuado para higienizar a base e limpar dados temporários.</div>
                  <div className="mt-2 text-[9px] text-neutral-500">
                    ID UUID Gerado: <span className="underline">{testResult.details.tempId}</span>
                  </div>
                </div>
              )}

              {!testResult.success && testResult.error && (
                <div className="bg-neutral-950/80 p-3 rounded font-mono text-[10px] border border-neutral-900 flex flex-col gap-1 text-red-400/90 leading-tight">
                  <span className="text-neutral-500 font-bold uppercase text-[9px] mb-1">Causa Raiz do Erro do PostgreSQL:</span>
                  <p className="text-red-400 bg-red-950/10 p-1.5 rounded font-mono border border-red-950/40 select-all">{testResult.error}</p>
                  <span className="mt-2 text-neutral-500 font-sans text-[9px] leading-normal">
                    Dica: Verifique se rodou o script <code className="text-red-400 font-mono font-bold">/supabase-blueprint.sql</code> no seu SQL Editor do Supabase para criar as tabelas obrigatórias do Script Forge.
                  </span>
                </div>
              )}
            </motion.div>
          )}

        </div>
      </div>

      {/* RIGHT COLUMN: SYSTEM STATES & INGRESS METRICS */}
      <div id="settings-bulletin-block" className="w-full lg:w-[350px] shrink-0 flex flex-col gap-5">
        
        {/* PARAMS METADATA INDICATORS (TASK 7 REQUIRED) */}
        <div id="diagnostic-box" className="p-5 rounded-xl bg-neutral-950 border border-neutral-900 flex flex-col gap-4">
          <h4 className="text-[10px] font-mono font-bold tracking-widest text-red-500 uppercase flex items-center gap-1.5 border-b border-neutral-900 pb-2">
            <Cpu className="w-3.5 h-3.5" /> Estado de Parâmetros
          </h4>

          <div className="flex flex-col gap-4 text-xs font-mono">
            
            {/* Supabase URL indicators */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400">URL do Supabase</span>
                <span className={`text-[10px] font-bold ${systemState.config.supabaseUrl ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {systemState.config.supabaseUrl ? 'CONFIGURADA' : 'NÃO CONFIGURADA'}
                </span>
              </div>
              <span className="text-[9px] text-neutral-500 font-sans leading-normal">
                {systemState.config.supabaseUrl ? `✓ Conectando em: ${systemState.config.supabaseUrl}` : '⚠ SUPABASE_URL não localizada no ambiente.'}
              </span>
            </div>

            {/* Service Role indicators */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400">Service Role Key</span>
                <span className={`text-[10px] font-bold ${systemState.config.hasServiceRoleKey ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {systemState.config.hasServiceRoleKey ? 'ATIVADA (SEGURA)' : 'AUSENTE'}
                </span>
              </div>
              <span className="text-[9px] text-neutral-500 font-sans leading-normal">
                {systemState.config.hasServiceRoleKey 
                  ? '✓ Carregada com segurança no servidor para livre bypass de RLS.' 
                  : '⚠ Chave ausente. Usando client ANON key no servidor (modo demo / desaconselhado em prod).'}
              </span>
            </div>

            {/* Anon Key indicators */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400">Public Anon Key</span>
                <span className={`text-[10px] font-bold ${systemState.config.hasAnonKey ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {systemState.config.hasAnonKey ? 'CONFIGURADA' : 'AUSENTE'}
                </span>
              </div>
              <span className="text-[9px] text-neutral-500 font-sans leading-normal">
                {systemState.config.hasAnonKey 
                  ? '✓ Anon key localizada para fallback.' 
                  : '⚠ Nenhuma anon key localizada no servidor.'}
              </span>
            </div>

            {/* Gemini settings indicators */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400">Generativa Gemini</span>
                <span className={`text-[10px] font-bold ${systemState.geminiConfigured ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {systemState.geminiConfigured ? 'INJETADA' : 'AUSENTE'}
                </span>
              </div>
              <span className="text-[9px] text-neutral-500 font-sans leading-normal">
                {systemState.geminiConfigured 
                  ? '✓ Credenciais GEMINI_API_KEY presentes e seguras.' 
                  : '⚠ Chave ausente. IA rodando no gerador do Simulador (Mock).'}
              </span>
            </div>

            <hr className="border-neutral-900" />

            {/* DB Fallback Check */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-300">Modo de Persistência</span>
                {systemState.supabaseConnected && !systemState.supabaseError ? (
                  <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-1.5 py-0.5 rounded text-[9px] font-bold">
                    CLOUD PERSISTÊNCIA Real
                  </span>
                ) : (
                  <span className="text-amber-500 bg-amber-950/40 border border-amber-900/60 px-1.5 py-0.5 rounded text-[9px] font-bold">
                    FALLBACK LOCAL Ativo
                  </span>
                )}
              </div>
              <span className="text-[9px] text-neutral-500 font-sans leading-normal mt-0.5">
                {systemState.supabaseConnected && !systemState.supabaseError
                  ? '✓ Usando banco Supabase real para guardar documentos, chats, mensagens e scripts.'
                  : '⚠ Atenção: Escrevendo no cache de dados local em memória (perderá os dados ao reiniciar o container).'}
              </span>
            </div>
            
          </div>
        </div>

        {/* SECURITY BULLETIN BOARD (MANDATED FOR FRONTEND CAUTIONS) */}
        <div id="security-box" className="p-5 rounded-xl bg-red-950/20 border border-red-900/30 flex flex-col gap-3">
          <h4 className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Directivas do Servidor Seguras
          </h4>
          
          <div className="text-[11px] text-neutral-400 font-sans leading-relaxed flex flex-col gap-3.5">
            <p>
              🔐 <strong className="text-white">Onde declarar as chaves no AI Studio?</strong> Chaves como <code className="text-red-400 bg-neutral-900 px-1 font-mono rounded text-[10px]">SUPABASE_SERVICE_ROLE_KEY</code> e <code className="text-red-400 bg-neutral-900 px-1 font-mono rounded text-[10px]">GEMINI_API_KEY</code> devem ser configuradas através das <strong>Configurações de Secrets (Secrets Manager)</strong> do Google AI Studio.
            </p>
            <p>
              O sistema sincroniza e faz bypass automático para que nenhuma chave atinja o cliente. O frontend comunica-se pura e exclusivamente com o barramento do backendExpress.
            </p>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
