import React, { useState, useEffect } from 'react';
import { Database, Plus, Search, Tag, Filter, CheckCircle, ShieldAlert, Award, AlertCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KnowledgeDocument } from '../types';

interface KnowledgeViewProps {
  currentTab: string;
}

export default function KnowledgeView({ currentTab }: KnowledgeViewProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);

  // Form states
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [formStatus, setFormStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'RSG Core',
    subcategory: '',
    framework: 'RSG',
    content_type: 'documentação',
    source_url: '',
    trust_level: 'medio' as 'alto' | 'medio' | 'baixo',
    tagsString: '',
    content: '',
    technical_notes: ''
  });

  const categories = [
    'RSG Core', 'RSG Inventory', 'RSG Jobs', 'RSG Commands', 'RSG Callbacks',
    'RSG Events', 'RSG Exports', 'RSG Configs', 'RedM Natives', 'Scripts Exemplo',
    'Scripts Base', 'Snippets Validados', 'Erros Conhecidos', 'Padrões de Segurança'
  ];

  const contentTypes = [
    'documentação', 'native', 'evento', 'export', 'callback', 'comando',
    'exemplo', 'script_base', 'snippet', 'erro_conhecido', 'padrão_de_segurança'
  ];

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory]);

  const fetchDocuments = async () => {
    try {
      const url = selectedCategory === 'all' 
        ? '/api/kb/documents' 
        : `/api/kb/search?category=${encodeURIComponent(selectedCategory)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (data.length > 0 && !selectedDoc) {
          setSelectedDoc(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/kb/search?q=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(selectedCategory)}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Error querying search:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'RSG Core',
      subcategory: '',
      framework: 'RSG',
      content_type: 'documentação',
      source_url: '',
      trust_level: 'medio',
      tagsString: '',
      content: '',
      technical_notes: ''
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      setFormStatus({ success: false, message: 'Por favor, preencha o Título e o Conteúdo Técnico.' });
      return;
    }

    setIsSubmitLoading(true);
    setFormStatus(null);

    const tagsArray = formData.tagsString
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const payload = {
      ...formData,
      tags: tagsArray
    };

    try {
      const res = await fetch('/api/kb/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdDoc = await res.json();
        setDocuments(prev => [createdDoc, ...prev]);
        setSelectedDoc(createdDoc);
        setFormStatus({ success: true, message: 'Documento anexado com sucesso à base Supabase RAG!' });
        resetForm();
      } else {
        const errData = await res.json();
        setFormStatus({ success: false, message: `Erro ao salvar documento: ${errData.error || 'Erro no servidor'}` });
      }
    } catch (err) {
      console.error('Error submitting document:', err);
      setFormStatus({ success: false, message: 'Falha na comunicação de rede com o servidor Express.' });
    } finally {
      setIsSubmitLoading(false);
    }
  };

  return (
    <motion.div
      id="knowledge-view-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="p-6 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto h-[88vh]"
    >
      
      {/* 2/3 COLUMN: LEFT BROWSE DOCUMENTS AREA */}
      <div id="knowledge-explorer" className="flex-1 shrink-0 flex flex-col gap-4 bg-neutral-950/60 p-4 border border-red-950/20 rounded-xl max-h-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-red-950/15 pb-3">
          <div>
            <h3 className="font-sans font-bold text-sm text-neutral-100 flex items-center gap-2 uppercase tracking-wide">
              <Database className="w-4 h-4 text-red-500" /> Explorador RAG do Supabase
            </h3>
            <p className="text-[10px] text-neutral-500 font-mono">
              Consulte os tópicos catalogados indexados do RSG core
            </p>
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-[10px] font-mono bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-neutral-300 focus:outline-none"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* SEARCH FORM */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Pesquisar por título, tags ou conteúdo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800/80 rounded-lg pl-9 pr-4 py-2 text-xs placeholder-neutral-500 text-neutral-200 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
            />
          </div>
          <button type="submit" className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-mono rounded-lg transition-colors">
            Filtrar
          </button>
        </form>

        {/* DOCUMENTS LIST */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-neutral-500 text-xs italic">
              Nenhum documento encontrado para a busca acima.
            </div>
          ) : (
            documents.map(doc => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                    isSelected 
                      ? 'bg-red-950/20 border-red-800/40 shadow-inner' 
                      : 'bg-neutral-900/30 border-neutral-900/60 hover:bg-neutral-900/70 hover:border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-sans font-bold text-neutral-200 truncate pr-4 max-w-[280px]">
                      {doc.title}
                    </span>
                    <span className="shrink-0 text-[8px] font-mono font-bold bg-neutral-100/10 text-neutral-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {doc.content_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
                    <span className="text-red-400 font-semibold">{doc.category}</span>
                    <span>•</span>
                    <span className="capitalize">{doc.trust_level} Confiança</span>
                  </div>

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {doc.tags.map((tag, tIdx) => (
                        <span key={tIdx} className="text-[8px] font-mono bg-neutral-950 text-neutral-400 px-1 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* EXPANDED DOCUMENT VIEWER MODAL/DETAILS AREA AT BOTTOM IF SELECTED */}
        {selectedDoc && (
          <div className="border-t border-red-950/20 pt-3 flex flex-col gap-2 max-h-[45%] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xs font-sans font-extrabold text-white uppercase">{selectedDoc.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-mono bg-red-950/30 text-red-400 border border-red-900/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                    {selectedDoc.category} • {selectedDoc.subcategory || 'Boilerplate'}
                  </span>
                  {selectedDoc.source_url && (
                    <a href={selectedDoc.source_url} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-neutral-400 underline hover:text-neutral-200">
                      Ver Fonte URL
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 bg-neutral-900 px-2 py-1 rounded text-[9px] font-mono text-neutral-400">
                <Award className="w-3.5 h-3.5 text-amber-500" /> Confiança: <span className="text-white font-bold">{selectedDoc.trust_level.toUpperCase()}</span>
              </div>
            </div>

            <div className="bg-neutral-950/90 border border-neutral-900 p-3 rounded font-mono text-[10px] leading-relaxed text-emerald-400 whitespace-pre-wrap select-text max-h-56 overflow-y-auto">
              {selectedDoc.content}
            </div>

            {selectedDoc.technical_notes && (
              <div className="p-2.5 bg-neutral-900/30 border border-neutral-900 rounded text-[9px] text-neutral-500 font-sans flex items-start gap-1.5 leading-relaxed">
                <AlertCircle className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                <span><strong className="text-neutral-300 font-bold uppercase tracking-wider">Notas Técnicas:</strong> {selectedDoc.technical_notes}</span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 1/3 COLUMN: RIGHT HAND CADASTRO DIRECT FORM */}
      <div id="knowledge-uploader" className="w-full md:w-[380px] bg-neutral-950/60 p-5 border border-red-950/20 rounded-xl overflow-y-auto max-h-full">
        <h3 className="font-sans font-bold text-sm text-neutral-100 flex items-center gap-1.5 uppercase tracking-wide border-b border-red-950/15 pb-3">
          <Plus className="w-4 h-4 text-red-500" /> Cadastrar Conhecimento
        </h3>

        {/* FEEDBACK BANNER */}
        {formStatus && (
          <div className={`p-3 rounded-lg text-xs font-sans mb-4 flex items-start gap-2 border ${
            formStatus.success 
              ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' 
              : 'bg-red-950/20 border-red-900/40 text-red-400'
          }`}>
            <span>{formStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 mt-1">
          {/* TITLE */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Título do Conhecimento *</label>
            <input
              type="text"
              required
              placeholder="Ex: Callback de verificação de VIP"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* CATEGORY */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Categoria *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* SUBCATEGORY */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Subcategoria</label>
              <input
                type="text"
                placeholder="Ex: Geral, Comandos, etc."
                value={formData.subcategory}
                onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
                className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* FRAMEWORK */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Framework</label>
              <input
                type="text"
                disabled
                value="RSG"
                className="bg-neutral-950 border border-neutral-850 rounded px-2.5 py-1.5 text-xs text-neutral-500 cursor-not-allowed"
              />
            </div>

            {/* TYPE OF CONTENT */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Tipo Conteúdo *</label>
              <select
                value={formData.content_type}
                onChange={(e) => setFormData(prev => ({ ...prev, content_type: e.target.value }))}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none"
              >
                {contentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* TRUST LEVEL */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Confiança *</label>
              <select
                value={formData.trust_level}
                onChange={(e) => setFormData(prev => ({ ...prev, trust_level: e.target.value as any }))}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none"
              >
                <option value="alto">Alto</option>
                <option value="medio">Médio</option>
                <option value="baixo">Baixo</option>
              </select>
            </div>

            {/* SOURCE URL */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Url de Fonte/Doc</label>
              <input
                type="text"
                placeholder="Ex: docs.rsg-core.com"
                value={formData.source_url}
                onChange={(e) => setFormData(prev => ({ ...prev, source_url: e.target.value }))}
                className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-600"
              />
            </div>
          </div>

          {/* TAGS (COMMAS SPLIT) */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <Tag className="w-3 h-3 text-red-500" /> Tags (Separadas por vírgula)
            </label>
            <input
              type="text"
              placeholder="Ex: callbacks, gold, security"
              value={formData.tagsString}
              onChange={(e) => setFormData(prev => ({ ...prev, tagsString: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-600"
            />
          </div>

          {/* CONTENT FIELD */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Conteúdo Principal (Markdown ou Código) *</label>
            <textarea
              required
              rows={6}
              placeholder="Descreva o tutorial, coloque o código lua, a native correspondente, ou o script base..."
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-red-600 focus:ring-1"
            />
          </div>

          {/* TECHNICAL NOTES */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Observações Técnicas</label>
            <textarea
              rows={2}
              placeholder="Ex: Recomendo colocar Wait(100) para evitar descompasso em máquinas lentas..."
              value={formData.technical_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, technical_notes: e.target.value }))}
              className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-red-600"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitLoading}
            className="w-full mt-2 py-3 bg-red-700 hover:bg-red-600 active:bg-red-800 disabled:opacity-50 text-white font-sans font-semibold text-xs rounded-lg transition-colors shadow-lg hover:shadow-red-900/20"
          >
            {isSubmitLoading ? 'Indexando no Supabase...' : 'Indexar Tópico no RAG Base'}
          </button>
        </form>
      </div>

    </motion.div>
  );
}
