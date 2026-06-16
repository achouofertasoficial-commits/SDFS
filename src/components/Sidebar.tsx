import React from 'react';
import { Terminal, Database, Code, Settings, MessageSquare, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  supabaseConnected: boolean;
}

export default function Sidebar({ currentTab, setCurrentTab, supabaseConnected }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Terminal },
    { id: 'chat', label: 'Chat IA', icon: MessageSquare },
    { id: 'knowledge', label: 'Base de Conhecimento', icon: Database },
    { id: 'scripts', label: 'Scripts Gerados', icon: Code },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside id="sidebar-container" className="w-64 bg-neutral-950 border-r border-red-950/40 flex flex-col justify-between h-screen sticky top-0 text-neutral-200">
      <div id="sidebar-upper" className="p-5 flex flex-col gap-6">
        {/* LOGO AREA */}
        <div id="logo-block" className="flex items-center gap-3">
          <div id="logo-icon-container" className="p-2 bg-red-950/50 border border-red-800/60 rounded-lg flex items-center justify-center">
            <Terminal className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
          <div>
            <h1 id="logo-title" className="font-sans font-bold text-sm tracking-widest text-red-500">
              RSG FORGE
            </h1>
            <span id="logo-subtitle" className="text-[10px] font-mono text-neutral-500 block uppercase tracking-wider">
              Script Forge AI
            </span>
          </div>
        </div>

        {/* NAVIGATION ITEMS */}
        <nav id="sidebar-nav" className="flex flex-col gap-1.5 mt-4">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-sans font-medium transition-all group ${
                  isActive
                    ? 'bg-red-950/30 text-white border border-red-800/40 shadow-inner'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <IconComponent className={`w-4 h-4 transition-colors ${isActive ? 'text-red-500' : 'text-neutral-500 group-hover:text-red-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="w-1.5 h-1.5 rounded-full bg-red-500"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* FOOTER CONNECTION STATUS */}
      <div id="sidebar-footer" className="p-4 border-t border-red-950/20 bg-neutral-950/60">
        <div id="status-card" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs">
          <div className="flex items-center gap-2">
            <div
              id="status-indicator-dot"
              className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`}
            />
            <span id="status-label" className="font-mono text-neutral-400">Database</span>
          </div>
          <span
            id="status-value"
            className={`font-mono font-semibold px-1.5 py-0.5 rounded text-[10px] ${
              supabaseConnected ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' : 'bg-amber-950 text-amber-400 border border-amber-900/60'
            }`}
          >
            {supabaseConnected ? 'SUPABASE' : 'SANDBOX'}
          </span>
        </div>
        <p id="creator-credits" className="text-[10px] font-mono text-neutral-600 text-center mt-3 tracking-wider">
          RSG FL_VERSION 'cerulean'
        </p>
      </div>
    </aside>
  );
}
