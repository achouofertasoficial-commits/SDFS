import React, { useState, useEffect } from 'react';
import { Code, Terminal, FileCode, Check, Copy, AlertTriangle, Cpu, Layers, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GeneratedScript } from '../types';

interface ScriptsViewProps {
  currentTab: string;
}

export default function ScriptsView({ currentTab }: ScriptsViewProps) {
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<GeneratedScript | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    try {
      const res = await fetch('/api/scripts');
      if (res.ok) {
        const data = await res.json();
        setScripts(data);
        if (data.length > 0) {
          setSelectedScript(data[0]);
          const files = Object.keys(data[0].files);
          if (files.length > 0) {
            setSelectedFile(files[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching scripts:', err);
    }
  };

  const handleSelectScript = (script: GeneratedScript) => {
    setSelectedScript(script);
    const files = Object.keys(script.files);
    if (files.length > 0) {
      setSelectedFile(files[0]);
    } else {
      setSelectedFile('');
    }
  };

  const handleCopyCode = (filename: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  return (
    <motion.div
      id="scripts-view"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto h-[88vh]"
    >
      {/* LEFT COLUMN: LIST GENERATED RESOURCES */}
      <div id="scripts-list-container" className="w-full lg:w-[420px] shrink-0 bg-neutral-950/60 p-4 border border-red-950/20 rounded-xl flex flex-col gap-4 max-h-full overflow-hidden">
        <div>
          <h3 className="font-sans font-bold text-sm text-neutral-100 flex items-center gap-2 uppercase tracking-wide">
            <Code className="w-4 h-4 text-red-500 animate-pulse" /> Repositório de Recursos Forjados
          </h3>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
            Listagem histórica de recursos gerados e salvos localmente
          </p>
        </div>

        {/* SCRIPTS COLLECTION CARDS */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
          {scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-neutral-500 text-xs italic">
              Nenhum script foi gerado ou cadastrado ainda. Vá até o "Chat IA" para criar o seu primeiro script!
            </div>
          ) : (
            scripts.map(script => {
              const isSelected = selectedScript?.id === script.id;
              const filesCount = Object.keys(script.files || {}).length;
              
              return (
                <button
                  key={script.id}
                  onClick={() => handleSelectScript(script)}
                  className={`w-full text-left p-4 rounded-xl border text-xs transition-all ${
                    isSelected 
                      ? 'bg-red-950/25 border-red-800/40 shadow-inner ring-1 ring-red-900/10' 
                      : 'bg-neutral-900/30 border-neutral-900 hover:bg-neutral-900/50 hover:border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <span className="font-sans font-bold text-sm text-neutral-100 truncate">
                      {script.title}
                    </span>
                    <span className="shrink-0 text-[9px] font-mono font-bold bg-neutral-800 text-neutral-400 px-1.5 py-0.5 border border-neutral-700/60 rounded">
                      {filesCount} {filesCount === 1 ? 'arquivo' : 'arquivos'}
                    </span>
                  </div>

                  <p className="text-neutral-400 text-xs line-clamp-2 leading-relaxed mb-3 font-sans">
                    {script.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-3.5">
                    {script.dependencies && script.dependencies.map(dep => (
                      <span key={dep} className="text-[8px] font-mono bg-neutral-950 border border-neutral-900/60 text-neutral-500 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">
                        {dep}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 border-t border-neutral-900/40 pt-2.5">
                    <span>
                      {script.created_at ? new Date(script.created_at).toLocaleDateString() : ''}
                    </span>
                    <span className="text-red-500 font-semibold flex items-center gap-1 hover:text-red-400 transition-colors">
                      Visualizar Arquivos →
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: RICH CODE PREVIEW AND INSTALL STEPS */}
      <div id="script-previewer" className="flex-1 bg-neutral-950/60 border border-red-950/20 rounded-xl overflow-hidden flex flex-col max-h-full">
        {selectedScript ? (
          <div className="flex-1 flex flex-col max-h-full overflow-hidden">
            {/* META INFO HEADER */}
            <div className="p-5 border-b border-red-950/20 bg-neutral-950/90 flex flex-col gap-2">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="font-sans font-extrabold text-base text-neutral-100 uppercase tracking-wide">
                    {selectedScript.title}
                  </h4>
                  <p className="text-xs text-neutral-400 font-sans mt-0.5">
                    {selectedScript.description}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-mono bg-red-950/40 text-red-400 font-semibold border border-red-900/40 px-2 py-0.5 rounded tracking-widest uppercase">
                  {selectedScript.framework} Framework
                </span>
              </div>

              {/* CHAT ID OR SOURCE */}
              <div className="text-[10px] font-mono text-neutral-500 mt-1 uppercase flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-neutral-500" /> ID Recurso: <span className="text-neutral-300">{selectedScript.id}</span>
              </div>
            </div>

            {/* TWO PANELS: FILE CODE VIEWER (TOP), STEP/WARNING BANNER (BOTTOM) */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-h-full">
              
              {/* INTERACTIVE MULTI-FILE VIEWER (LEFT SIDE OF DETAILS) */}
              <div className="flex-1 flex flex-col border-r border-red-950/10 max-h-full overflow-hidden">
                {/* FILE SELECTOR BAR */}
                <div className="flex border-b border-neutral-900 bg-neutral-950/40 select-none overflow-x-auto text-[10px] font-mono">
                  {Object.keys(selectedScript.files).map(filename => (
                    <button
                      key={filename}
                      onClick={() => setSelectedFile(filename)}
                      className={`px-3.5 py-2.5 border-r border-neutral-900 transition-all ${
                        selectedFile === filename 
                          ? 'bg-neutral-900 text-red-400 border-b-2 border-b-red-700 font-bold' 
                          : 'text-neutral-500 hover:text-neutral-300 bg-neutral-950/40'
                      }`}
                    >
                      {filename}
                    </button>
                  ))}
                </div>

                {/* FILE SOURCE */}
                <div className="flex-1 overflow-y-auto p-4 bg-neutral-900/30 text-xs font-mono relative">
                  {selectedFile && selectedScript.files[selectedFile] ? (
                    <>
                      {/* FILE CHANGER FLOATING ACTIONS */}
                      <div className="absolute right-4 top-4 z-10 flex gap-2">
                        <button
                          onClick={() => handleCopyCode(selectedFile, selectedScript.files[selectedFile])}
                          className="p-1 px-2.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded transition flex items-center gap-1.5 text-[10px]"
                        >
                          {copiedFile === selectedFile ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copiado para Clipboard</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Código</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* LUA SYNTAX RENDER TEXT */}
                      <pre className="text-emerald-400/90 whitespace-pre font-mono text-[11px] leading-relaxed select-text pr-12 pb-16">
                        <code>{selectedScript.files[selectedFile]}</code>
                      </pre>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-neutral-500 italic text-[11px]">
                      Selecione um arquivo de código acima para visualizar.
                    </div>
                  )}
                </div>
              </div>

              {/* INSTALLATION STEPS & WARNING BAR (RIGHT/BOTTOM DETAIL PANEL) */}
              <div className="w-full md:w-[280px] p-4 bg-neutral-950 border-t md:border-t-0 flex flex-col gap-5 overflow-y-auto max-h-full">
                
                {/* STEP DETAILS */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5 text-white font-sans font-extrabold text-[10px] tracking-widest uppercase pb-2 border-b border-red-950/15">
                    <ListChecks className="w-4 h-4 text-red-500" /> Como Instalar (Passos)
                  </div>
                  {selectedScript.install_steps && selectedScript.install_steps.length > 0 ? (
                    <ol className="flex flex-col gap-2 list-decimal list-inside text-[11px] text-neutral-400 font-sans leading-relaxed">
                      {selectedScript.install_steps.map((step, sIdx) => (
                        <li key={sIdx} className="pl-1">
                          {step}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-[10px] text-neutral-500 italic pl-1">Sem instruções cadastradas.</p>
                  )}
                </div>

                {/* WARNING DETAIL */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5 text-amber-500 font-sans font-extrabold text-[10px] tracking-widest uppercase pb-1.5 border-b border-red-950/15">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Avisos e Alertas
                  </div>
                  {selectedScript.warnings && selectedScript.warnings.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {selectedScript.warnings.map((warn, wIdx) => (
                        <div key={wIdx} className="text-[10px] leading-relaxed text-neutral-500 p-2 border-l-2 border-amber-800 bg-amber-950/10">
                          {warn}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-neutral-500 italic pl-1">Nenhum alerta registrado.</p>
                  )}
                </div>

              </div>

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-500 italic text-xs">
            Nenhum recurso gerado selecionado. Selecione um recurso no menu lateral para visualizar arquivos e instruções.
          </div>
        )}
      </div>

    </motion.div>
  );
}
