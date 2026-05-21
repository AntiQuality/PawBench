export interface TaskRecord {
  t_id: string;
  filename: string;
  source_dataset: string | null;
  core_id: string | null;
  task_id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  grading_type?: 'automated' | 'llm_judge' | 'hybrid' | string | null;
  grading_weights?: { automated?: number; llm_judge?: number };
  timeout_seconds?: number | null;
  input_modality?: string | null;
  external_dependency?: string | null;
  labels: {
    complexity?: string | null;
    environment?: string | null;
    modality: { type: string; channels: string[] };
    capabilities: string[];
    scenario?: string | null;
  };
  workspace_files: Array<{ source: string; dest: string }>;
  sections: Record<string, string>;
  source_path: string;
}

export interface LeaderboardRow {
  model: string;
  harness: string;
  overall: number;
  automated: number;
  judge: number;
  tasks: number;
  tasks_errored?: number;
  run?: string | null;
  by_source?: Record<string, number>;
  by_capability?: Record<string, number>;
  by_complexity?: Record<string, number>;
  by_modality?: Record<string, number>;
  by_scenario?: Record<string, number>;
  by_scenario_top?: Record<string, number>;
  by_grading?: Record<string, number>;
  by_environment?: Record<string, number>;
  by_category?: Record<string, number>;
  by_subcategory?: Record<string, number>;
  by_channel?: Record<string, number>;
  updated: string;
}

export interface LeaderboardMatrix {
  models: string[];
  harnesses: string[];
  rows: Array<Record<string, string | number | null>>;
}

export interface HarnessMeta {
  display: string;
  version: string;
}

export interface LeaderboardData {
  is_mock: boolean;
  rows: LeaderboardRow[];
  matrix: LeaderboardMatrix;
  harnesses?: Record<string, HarnessMeta>;
  generated_at: string;
}

export interface StatsData {
  total: number;
  sources: Record<string, number>;
  complexity: Record<string, number>;
  capabilities: Record<string, number>;
  scenarios: Record<string, number>;
  scenario_top: Record<string, number>;
  modality: Record<string, number>;
  channels: Record<string, number>;
  grading_type: Record<string, number>;
  environment: Record<string, number>;
  category: Record<string, number>;
  subcategory: Record<string, number>;
}
