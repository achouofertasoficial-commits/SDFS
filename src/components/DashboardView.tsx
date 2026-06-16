import React from 'react';
import { Database, Cpu, HelpCircle, Code, ShieldCheck, Terminal, Disc, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { DatabaseMetadata } from '../types';

interface DashboardViewProps {
  stats: DatabaseMetadata;
  supabaseConnected: boolean;
  geminiConfigured: boolean;
  scriptsCount: number;
  onNavigate: (tab: string) => void;
}

export default function DashboardView({
  stats,
  supabaseConnected,
  geminiConfigured,
  scriptsCount,
  onNavigate
}: DashboardViewProps) {
  
  const statsList = [
    {
      title: 'Total de Documentação RSG',
      value: stats.totalDocs,
      description: 'Guias de arquitetura, eventos e callbacks registados.',
      icon: Database,
      color: 'text-red-500',
      bgColor: 'bg-red-950/20 border-red-900/30'
    },
    {
      title: 'Total de Natives Cadastradas',
      value: stats.totalNatives,
      description: 'Natives RedM otimizadas e testadas para compatibilidade.',
      icon: Terminal,
      color: 'text-amber-500',
      bgColor: 'bg-amber-950/20 border-amber-900/30'
    },
    {
      title: 'Total de Scripts Exemplo',
      value: stats.totalExamples,
      description: 'Recursos modelo (Mining, Robberies, Jobs) de base.',
      icon: Code,
      color: 'text-blue-500',
      bgColor: 'bg-blue-950/20 border-blue-900/30'
    },
    {
      title: 'Total de Snippets Validados',
      value: stats.totalSnippets,
      description: 'Trechos de código protegidos contra manipulação remota.',
      icon: ShieldCheck,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-950/20 border-emerald-900/30'
    }
  ];

  return (
    <motion.div
      id="dashboard-view"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="p-8 flex flex-col gap-8 text-neutral-100 max-w-6xl mx-auto"
    >
      {/* HERO BANNER */}
      <div id="hero-banner" className="relative overflow-hidden rounded-2xl border border-red-950/40 bg-radial from-neutral-900 via-neutral-950 to-black p-8 md:p-10 flex flex-col justify-between gap-6 shadow-2xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-96 h-96 bg-red-900/10 rounded-full blur-3xl" />
        
        <div className="flex flex-col gap-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/30 border border-red-800/40 text-red-400 text-xs font-mono tracking-wider w-fit uppercase">
            <Disc className="w-3 h-3 animate-spin" /> RSG Framework RedM Outlaw Tech
          </div>
          <h2 id="hero-title" className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-white mt-1">
            RSG Script Forge AI
          </h2>
          <p id="hero-desc" className="text-neutral-400 text-sm md:text-base leading-relaxed">
            A primeira inteligência artificial brasileira calibrada para engenharia de scripts Red Dead Redemption Multi-Player (RedM) especificamente no framework <span className="text-red-400 font-semibold">RSG Framework</span>. Forge scripts automatizados livres de duplicações, com interação fluida de UI prompts e verificação criptográfica server-side.
          </p>
        </div>

        {/* BUTTON ACTION BUTTONS */}
        <div id="hero-actions" className="flex flex-wrap gap-4 mt-2">
          <button
            id="btn-open-chat"
            onClick={() => onNavigate('chat')}
            className="px-6 py-3 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white text-sm font-sans font-semibold rounded-lg shadow-lg hover:shadow-red-900/30 transition-all flex items-center gap-2"
          >
            Abrir Chat IA <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            id="btn-manage-kb"
            onClick={() => onNavigate('knowledge')}
            className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-sm font-sans font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            Gerenciar Base de Conhecimento
          </button>
        </div>
      </div>

      {/* STATISTICS CARDS */}
      <div id="stats-section">
        <h3 className="text-xs font-mono font-bold tracking-widest text-neutral-500 uppercase mb-4">
          Status da Base de Conhecimento Local / Supabase
        </h3>
        
        <div id="stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsList.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className={`p-5 rounded-xl border ${stat.bgColor} flex flex-col justify-between gap-4 transition-all hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 text-xs font-sans font-medium max-w-[150px]">
                    {stat.title}
                  </span>
                  <div className={`p-2 rounded-lg bg-neutral-900 ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                
                <div>
                  <span className="text-3xl font-mono font-bold tracking-tight text-white block">
                    {stat.value}
                  </span>
                  <span className="text-[10px] font-sans text-neutral-500 mt-1 block">
                    {stat.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STATUS OVERVIEW & DIAGNOSTICS */}
      <div id="diagnostics-grid" className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* ENVIROMENT STATUS DIAGNOSTIC */}
        <div id="status-card" className="col-span-1 md:col-span-5 p-6 rounded-xl bg-neutral-950 border border-neutral-900/80 flex flex-col gap-4">
          <h4 className="text-xs font-mono font-bold tracking-widest text-red-500 uppercase">
            Status do Ambiente (Servidor)
          </h4>

          <div className="flex flex-col gap-3 mt-1">
            <div className="flex items-center justify-between text-xs font-mono p-3 rounded-lg bg-neutral-900/40 border border-neutral-900">
              <span className="text-neutral-400">Banco de Dados Supabase</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${supabaseConnected ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/60' : 'text-amber-500 bg-amber-950/40 border border-amber-900/60'}`}>
                {supabaseConnected ? 'CONECTADO REAL' : 'SANDBOX SIMULADO'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono p-3 rounded-lg bg-neutral-900/40 border border-neutral-900">
              <span className="text-neutral-400">Gemini Engine (3.5 Flash)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${geminiConfigured ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/60' : 'text-amber-500 bg-amber-950/40 border border-amber-900/60'}`}>
                {geminiConfigured ? 'PRONTA' : 'NÃO CONFIGURADA'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono p-3 rounded-lg bg-neutral-900/40 border border-neutral-900">
              <span className="text-neutral-400">Histórico de Scripts Gerados</span>
              <span className="text-red-400 font-bold bg-red-950/20 px-2 py-0.5 border border-red-900/30 rounded text-[10px]">
                {scriptsCount} NO REPOSITÓRIO
              </span>
            </div>
          </div>

          <div className="text-xs text-neutral-500 leading-relaxed font-sans bg-neutral-900/20 p-3 rounded border border-neutral-900/40">
            📌 Se estiver rodando sem chaves, tudo bem! O Script Forge possui uma base local robusta estruturada em memória para que você explore os recursos visuais de geração e gerenciamento de arquivos livremente.
          </div>
        </div>

        {/* GUIDES AND ARCHITECTURE TIPS */}
        <div className="col-span-1 md:col-span-7 p-6 rounded-xl bg-neutral-950 border border-neutral-900/80 flex flex-col gap-4">
          <h4 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase">
            Mandamentos do RSG Forge
          </h4>

          <div className="flex flex-col gap-3 font-sans text-xs">
            <div className="flex items-start gap-3 p-3 bg-neutral-900/30 rounded-lg hover:bg-neutral-900/50 transition-colors">
              <div className="w-5 h-5 rounded bg-red-950/40 border border-red-900/40 text-red-400 font-mono flex items-center justify-center font-bold">1</div>
              <div>
                <strong className="text-white block mb-0.5">Segurança Server-Side</strong>
                <span className="text-neutral-400">Todo o acréscimo de dinheiro ou inventário deve ocorrer no server.lua com verificação de distâncias contra hackers.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-neutral-900/30 rounded-lg hover:bg-neutral-900/50 transition-colors">
              <div className="w-5 h-5 rounded bg-red-950/40 border border-red-900/40 text-red-400 font-mono flex items-center justify-center font-bold">2</div>
              <div>
                <strong className="text-white block mb-0.5">Nativas Exclusivas RedM</strong>
                <span className="text-neutral-400">Uso obrigatório de prompts de UI oficiais do RedM (UiPromptRegisterBegin e Wait otimizados para evitar lag em threads).</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-neutral-900/30 rounded-lg hover:bg-neutral-900/50 transition-colors">
              <div className="w-5 h-5 rounded bg-red-950/40 border border-red-900/40 text-red-400 font-mono flex items-center justify-center font-bold">3</div>
              <div>
                <strong className="text-white block mb-0.5">Separabilidade Absoluta de Frameworks</strong>
                <span className="text-neutral-400">Este Forge gera scripts puros para RSG Framework. Interfaces ou tags de Vorp, QBCore ou ESX são proibidas e banidas para preservar a sanidade da arquitetura.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
