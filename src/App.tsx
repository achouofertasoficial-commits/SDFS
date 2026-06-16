import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import ChatView from './components/ChatView';
import KnowledgeView from './components/KnowledgeView';
import ScriptsView from './components/ScriptsView';
import SettingsView from './components/SettingsView';
import { DatabaseMetadata } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [status, setStatus] = useState({
    supabaseConnected: false,
    geminiConfigured: false,
    scriptsCount: 0,
    stats: {
      totalDocs: 0,
      totalNatives: 0,
      totalExamples: 0,
      totalSnippets: 0
    } as DatabaseMetadata
  });

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/kb/status');
      if (res.ok) {
        const data = await res.json();
        setStatus({
          supabaseConnected: data.supabaseConnected,
          geminiConfigured: data.geminiConfigured,
          scriptsCount: data.scriptsCount,
          stats: data.stats
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh status occasionally so any additions are picked up
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="forge-layout-root" className="min-h-screen bg-neutral-900 text-neutral-100 flex font-sans antialiased select-none selection:bg-red-800 selection:text-white">
      {/* SIDEBAR NAVIGATION AREA */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        supabaseConnected={status.supabaseConnected}
      />

      {/* DETAILED CONTENT HUB */}
      <main id="main-scroll-pane" className="flex-1 overflow-y-auto max-h-screen bg-neutral-950 flex flex-col relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
        
        {/* VIEW CONDITIONAL DISPATCHER */}
        <div className="relative z-10">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={status.stats}
              supabaseConnected={status.supabaseConnected}
              geminiConfigured={status.geminiConfigured}
              scriptsCount={status.scriptsCount}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'chat' && (
            <ChatView
              currentTab={currentTab}
            />
          )}

          {currentTab === 'knowledge' && (
            <KnowledgeView
              currentTab={currentTab}
            />
          )}

          {currentTab === 'scripts' && (
            <ScriptsView
              currentTab={currentTab}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              currentTab={currentTab}
              supabaseConnected={status.supabaseConnected}
              geminiConfigured={status.geminiConfigured}
              onRefreshStats={fetchStatus}
            />
          )}
        </div>
      </main>
    </div>
  );
}
