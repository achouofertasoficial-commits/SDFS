export interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  framework: string;
  content_type: string;
  source_url?: string;
  trust_level: 'alto' | 'medio' | 'baixo';
  tags: string[];
  content: string;
  technical_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AIChat {
  id: string;
  title: string;
  created_at?: string;
}

export interface AIMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  retrieved_context?: KnowledgeDocument[];
  created_at?: string;
}

export interface GeneratedScript {
  id: string;
  chat_id: string;
  title: string;
  description: string;
  framework: string;
  files: Record<string, string>; // e.g. { "fxmanifest.lua": "...", "client.lua": "..." }
  dependencies: string[];
  install_steps: string[];
  warnings: string[];
  generated_by?: 'gemini' | 'mock' | 'manual';
  current_version_id?: string | null;
  version_count?: number;
  last_user_request?: string;
  last_change_summary?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScriptVersion {
  id: string;
  script_id: string;
  chat_id: string;
  version_number: number;
  change_summary: string;
  user_request: string;
  files: Record<string, string>;
  dependencies: string[];
  install_steps: string[];
  warnings: string[];
  generated_by: string;
  created_at?: string;
}


export interface DatabaseMetadata {
  totalDocs: number;
  totalNatives: number;
  totalExamples: number;
  totalSnippets: number;
}
