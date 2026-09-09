import { useEffect, useState } from 'react';
import { BRDView } from './components/BRDView';
import { GapView } from './components/GapView';
import { DataModelView } from './components/DataModelView';
import { ComplianceView } from './components/ComplianceView';
import { ArchitectureView } from './components/ArchitectureView';
import { ConflictView } from './components/ConflictView';
import { StakeholderView } from './components/StakeholderView';
import { ProjectsList } from './components/ProjectsList';
import { PDFExportButton } from './components/PDFExportButton';
import { Settings } from './components/Settings';
import { BRDDetailView } from './components/BRDDetailView';
import { Sidebar } from './components/Sidebar';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import {
  Loader2, Sparkles, CheckCircle2,
  FolderGit2, Bell,
  Share2, ChevronRight, BrainCircuit, Server,
  FileText, Database, ShieldAlert, UploadCloud, AlertTriangle, Link2, Download, Users, Save,
} from 'lucide-react';
import type { GenerateResponse, ProjectVersion, ProjectDetail, NoiseStats } from './types';
import { generateBRD, fetchProjects, type ProjectSummary, type GenerateRequestPayload, fetchProjectById, setAuthTokenGetter, fetchCurrentUser, verify2FA, updateProjectTitle } from './api/client';
import { SearchBRDPopup } from './components/SearchBRDPopup';
import type { BRDListItem } from './components/SearchBRDPopup';
import { useAuth } from './auth';
import { AuthModal } from './components/auth/AuthModal';



// --- Transparency Footer ---
const TransparencyFooter = ({ metadata }: { metadata?: GenerateResponse['metadata'] & { used_dataset_sample?: boolean; dataset_file_name?: string } }) => {
  if (!metadata) return null;
  const primaryModel = metadata.models_consulted?.[0] ?? '—';
  const healthScore = metadata.health_score;
  const healthColor = healthScore != null
    ? healthScore >= 75 ? 'text-emerald-600 font-semibold' : healthScore >= 50 ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold'
    : '';
  const usedDataset = (metadata as { used_dataset_sample?: boolean })?.used_dataset_sample;
  return (
    <div className="bg-white border-t border-slate-200 px-6 py-2 text-[10px] text-slate-500 flex justify-between items-center shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5"><BrainCircuit className="w-3 h-3 text-indigo-500" /> Model: {primaryModel}</span>
        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Confidence: {((metadata.confidence_score ?? 0) * 100).toFixed(0)}%</span>
        {usedDataset && (
          <span className="flex items-center gap-1 text-indigo-600 font-medium" title="Analysis used Enron Email Dataset">
            <Database className="w-3 h-3" /> Dataset: Enron emails
          </span>
        )}
        {metadata.channel_count === 2 && (
          <span className="flex items-center gap-1 text-purple-600"><Link2 className="w-3 h-3" /> 2-Channel Mode</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {healthScore != null && (
          <span className={healthColor}>Health: {healthScore}/100</span>
        )}
        <span>Latency: {metadata.processing_time_ms}ms</span>
      </div>
    </div>
  )
}

// --- Save project name (updates header to generated BRD title) ---
function SaveProjectButton({
  projectId,
  generatedName,
  currentTitle,
  onTitleSaved,
}: {
  projectId: string | null;
  generatedName?: string;
  currentTitle: string;
  onTitleSaved: (title: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const newName = (generatedName || currentTitle).trim() || 'Untitled project';

  const handleSave = async () => {
    setSaving(true);
    try {
      onTitleSaved(newName);
      if (projectId) {
        await updateProjectTitle(projectId, newName);
      }
    } catch {
      // Revert on failure
      onTitleSaved(currentTitle);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-2"
      onClick={handleSave}
      disabled={saving}
      title={generatedName ? `Save and set project name to "${generatedName}"` : 'Save project name'}
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
      Save
    </Button>
  );
}

// --- 2FA Gate ---
export const TwoFactorGate = ({ onVerify, onCancel }: { onVerify: (code: string) => Promise<void>, onCancel: () => void }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans antialiased text-slate-900">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Two-Step Verification</h2>
            <p className="text-sm text-slate-500 font-medium">Enter the 6-digit code from your authenticator app.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl font-medium tracking-wide">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            placeholder="000000"
            className="w-full h-12 text-center text-2xl font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
            autoFocus
          />
          <div className="space-y-3">
            <button
              type="submit"
              disabled={code.length < 6 || loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center tracking-wide"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full h-11 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-medium rounded-xl transition-colors"
            >
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function App() {
  const { user, loading: authLoading, signOutUser } = useAuth();
  const isLoggedIn = !!(user && (user.providerData[0]?.providerId !== 'password' || user.emailVerified));
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState('new_project');
  const [idea, setIdea] = useState('');
  const [contextData, setContextData] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [datasetSampleChars, setDatasetSampleChars] = useState(0);
  const [useDatasetFile, setUseDatasetFile] = useState(false);
  const [contextData2, setContextData2] = useState<string>('');
  const [fileName2, setFileName2] = useState<string | null>(null);
  const [noiseStats, setNoiseStats] = useState<NoiseStats | undefined>(undefined);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("New Architecture Request");
  const [versions, setVersions] = useState<ProjectVersion[]>([]);

  // Custom 2FA API State
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [is2faVerified, setIs2faVerified] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number>(1);

  // Show login modal if not authenticated and auth has finished loading
  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn) {
      setShowLoginModal(false);
    } else {
      setShowLoginModal(true);
    }
  }, [authLoading, isLoggedIn]);

  useEffect(() => {
    if (!user) {
      // Clear the getter on logout — no requests should carry a stale token
      setAuthTokenGetter(null);
      return;
    }
    // Register the getter with the current Firebase user.
    // Use forceRefresh=false for speed; the 401 retry interceptor handles
    // expired tokens by calling this again automatically.
    setAuthTokenGetter(async () => {
      try {
        return await user.getIdToken(false);
      } catch (e) {
        console.error('[Auth] getIdToken failed:', e);
        return null;
      }
    });
  }, [user]);

  // Initialize user record in database after successful authentication
  useEffect(() => {
    if (authLoading || !isLoggedIn || !user) {
      return;
    }

    const initializeUser = async () => {
      try {
        const res = await fetchCurrentUser();
        setIs2faEnabled(res.settings?.is2faEnabled || false);
      } catch (e: unknown) {
        const err = e as { response?: { status?: number }; message?: string };
        if (err.response?.status === 401) {
          setError('Failed to authenticate with backend. Please try signing in again.');
        } else if (err.response?.status === 404) {
          // Backend may not have /users/me deployed yet - ignore
        } else if (err.response?.status && err.response.status >= 500) {
          setError('Backend server error. Please try again later.');
        } else if (!err.message?.includes('Network Error')) {
          setError(`Failed to initialize user: ${err.message || 'Unknown error'}`);
        }
      }
    };

    initializeUser();
  }, [isLoggedIn, authLoading, user]);

  useEffect(() => {
    // Don't load projects if auth is still loading or user is not logged in
    if (authLoading || !isLoggedIn || !user) {
      if (!isLoggedIn) {
        setProjects([]);
      }
      return;
    }

    const load = async () => {
      try {
        const list = await fetchProjects();
        setProjects(list);
      } catch (e: unknown) {
        const err = e as { response?: { status?: number }; message?: string };
        if (err.response?.status === 401) {
          setError('Authentication failed. Please try signing in again.');
        } else if (err.response?.status === 404) {
          // Backend may not have /projects endpoint deployed yet - just use empty list
          setProjects([]);
        } else if (err.response?.status && err.response.status >= 500) {
          setError('Backend server error. Please try again later.');
        }
      }
    };
    load();
  }, [isLoggedIn, authLoading, user]);

  const handleSubmit = async (e?: React.FormEvent, overrides?: { context_data?: string; context_data_2?: string; useDataset?: boolean }) => {
    e?.preventDefault?.();
    if (!idea.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const useDataset = overrides?.useDataset ?? useDatasetFile;
      const payload: GenerateRequestPayload = {
        idea,
        ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
      };
      if (!useDataset) {
        if (overrides?.context_data != null) payload.context_data = overrides.context_data;
        else if (contextData && !contextData.startsWith('(Dataset')) payload.context_data = contextData;
      }
      if (overrides?.context_data_2 != null) payload.context_data_2 = overrides.context_data_2;
      else if (contextData2) payload.context_data_2 = contextData2;

      const { project_id, artifacts, project_title } = await generateBRD(payload);

      // Update local state temporarily
      setNoiseStats(artifacts.metadata?.noise_stats);
      setResult(artifacts);
      if (artifacts.metadata?.used_dataset_sample) {
        setFileName(artifacts.metadata.dataset_file_name || 'emails.csv');
        setContextData('\n');
        setDatasetSampleChars(artifacts.metadata.dataset_sample_chars || 0);
      }
      setSelectedProjectId(project_id);
      if (project_title) setProjectTitle(project_title);

      // Force fetch full project to get the newly appended version array
      const full = await fetchProjectById(project_id) as ProjectDetail;
      setVersions(full.versions || []);
      setCurrentVersion(full.currentVersion || 1);

      const list = await fetchProjects();
      setProjects(list);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      let errorMessage = 'An unexpected error occurred.';

      if (e.response?.status === 500) {
        errorMessage = e.response?.data?.detail || 'Backend server error. Please check server logs.';
      } else if (e.response?.status === 401) {
        errorMessage = 'Authentication failed. Please try signing in again.';
      } else if (e.response?.status === 404) {
        errorMessage = 'API endpoint not found. Please check backend configuration.';
      } else if (e.response?.data?.detail) {
        errorMessage = e.response.data.detail;
      } else if (e.message) {
        errorMessage = e.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const handleNewProject = () => {
    setActiveTab('new_project');
    setResult(null);
    setIdea('');
    setContextData('');
    setFileName(null);
    setDatasetSampleChars(0);
    setUseDatasetFile(false);
    setContextData2('');
    setFileName2(null);
    setNoiseStats(undefined);
    setSelectedProjectId(null);
    setProjectTitle("New Architecture Request");
    setVersions([]);
    setCurrentVersion(1);
  };

  const handleCloseModal = () => {
    setShowLoginModal(false);
  };

  const handleSelectProject = async (id: string) => {
    setActiveTab('new_project');
    setSelectedProjectId(id);
    try {
      const full = await fetchProjectById(id) as ProjectDetail;
      setIdea(full.idea || '');
      setContextData('');
      setFileName(null);
      setContextData2('');
      setFileName2(null);
      setNoiseStats(undefined);
      setResult(full.artifacts);
      setProjectTitle(full.title || full.artifacts.brd?.project_title || "Untitled project");
      setVersions(full.versions || []);
      setCurrentVersion(full.currentVersion || 1);
    } catch {
      setError('Failed to load project.');
    }
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetVer = parseInt(e.target.value, 10);
    const versionObj = versions.find(v => v.version === targetVer);
    if (versionObj) {
      setCurrentVersion(versionObj.version);
      setIdea(versionObj.idea);
      setContextData('');
      setFileName(null);
      setContextData2('');
      setFileName2(null);
      setNoiseStats(undefined);
      setResult(versionObj.artifacts);
    }
  };

  const renderContent = () => {
    if (activeTab === 'projects') {
      return (
        <ProjectsList
          projects={projects}
          onNewProject={handleNewProject}
          onOpenProject={handleSelectProject}
        />
      );
    }
    if (activeTab === 'settings') {
      return <Settings />;
    }
    if (activeTab !== 'new_project') {
      // Viewing a specific project/BRD from sidebar
      const matchingProject = projects.find(p => p.id === activeTab);
      const spec = matchingProject ? {
        id: matchingProject.id,
        name: matchingProject.name,
        updated: matchingProject.updatedAt,
        description: matchingProject.description,
      } : null;
      return (
        <BRDDetailView
          spec={spec}
          onNewProject={handleNewProject}
        />
      );
    }

    // Default: new_project generator view
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">

            {/* Ambient Background for entire app */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 bg-slate-50/50">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/10 blur-[120px]" />
              <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-blue-400/10 blur-[120px]" />
              <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-violet-400/10 blur-[100px]" />
            </div>

            {/* Top Header */}
            <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Projects</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
                <span className="font-medium text-slate-900 truncate max-w-[300px]" title={projectTitle}>{projectTitle}</span>
                {result && versions.length > 0 && (
                  <>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                    <select
                      value={currentVersion}
                      onChange={handleVersionChange}
                      className="bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 transition-colors px-2.5 py-1 rounded-md text-[13px] font-mono border border-indigo-100 focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none shadow-sm"
                    >
                      {versions.map(v => (
                        <option key={v.version} value={v.version}>v{v.version}.0</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={async () => {
                    setIdea('Extract project requirements, stakeholders, and decisions from the communication data. Ignore casual chat and off-topic content.');
                    setError(null);
                    setUseDatasetFile(true);
                    setFileName('emails.csv');
                    setContextData('(Dataset emails.csv will be used when you generate)');
                    setDatasetSampleChars(0);
                    await handleSubmit(undefined, { useDataset: true });
                  }}
                  disabled={loading}
                  title="Run with dataset/emails/emails.csv as context"
                >
                  <Database className="w-3.5 h-3.5" /> Load Dataset
                </Button>
                <div className="h-4 w-px bg-slate-200 mx-1"></div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500">
                  <Bell className="w-4 h-4" />
                </Button>
                {result && (
                  <PDFExportButton
                    result={result}
                    projectTitle={projectTitle}
                  />
                )}
                {result && (
                  <SaveProjectButton
                    projectId={selectedProjectId}
                    generatedName={result.brd?.project_title}
                    currentTitle={projectTitle}
                    onTitleSaved={setProjectTitle}
                  />
                )}
                <Button variant="default" size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 gap-2">
                  <Share2 className="w-3.5 h-3.5" /> Share
                </Button>
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex overflow-hidden">

              {/* Context Panel (Input) */}
              <div className={`border-r border-slate-200 bg-white flex flex-col overflow-hidden transition-all duration-300 ${result ? 'w-[320px]' : 'w-[500px]'}`}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0 gap-2">
                  <h2 className="font-semibold text-slate-800 shrink-0">Project Context</h2>
                  <div className="flex items-center gap-2">

                    {result && (
                      <>
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </span>
                        <button
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${result.brd?.project_title?.replace(/\s+/g, '_') ?? 'brd'}_export.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="text-xs bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 rounded-lg px-2 py-1.5 flex items-center gap-1 transition-colors"
                          title="Download full BRD as JSON"
                        >
                          <Download className="w-3 h-3" /> JSON
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 overflow-y-auto">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Guiding Directions</label>
                  <Textarea
                    placeholder="E.g. Extract all project requirements, timelines, and stakeholder decisions. Ignore scheduling and unrelated chatter."
                    className="min-h-[100px] text-sm leading-relaxed resize-none bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                  />

                  {/* File Upload Zone */}
                  <div className="mt-4">
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Upload Communication Data <span className="text-slate-400 font-normal">(emails, transcripts, .txt/.csv/.md)</span></label>
                    <p className="text-[11px] text-slate-400 mb-2">Or use the <strong className="text-slate-600">Enron Email Dataset</strong>: click <strong>Load Dataset</strong> in the header to run with <code className="bg-slate-100 px-1 rounded">dataset/emails/emails.csv</code>.</p>
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${contextData ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30'
                        }`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          setError('File is too large. Please upload a file under 2MB.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setContextData(ev.target?.result as string || '');
                          setFileName(file.name);
                          setUseDatasetFile(false);
                          setError(null);
                        };
                        reader.readAsText(file);
                      }}
                      onClick={() => document.getElementById('file-upload-input')?.click()}
                    >
                      <input
                        id="file-upload-input"
                        type="file"
                        accept=".txt,.csv,.md"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            setError('File is too large. Please upload a file under 2MB.');
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setContextData(ev.target?.result as string || '');
                            setFileName(file.name);
                            setUseDatasetFile(false);
                            setError(null);
                          };
                          reader.readAsText(file);
                        }}
                      />
                      {contextData ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <FileText className="w-6 h-6 text-indigo-500" />
                          <p className="text-xs font-medium text-indigo-700">{fileName}</p>
                          <p className="text-xs text-slate-500">
                            {useDatasetFile && !datasetSampleChars ? 'From dataset — will load on generate' : `${((datasetSampleChars || contextData.length) / 1024).toFixed(1)} KB of text loaded`}
                          </p>
                          <button onClick={(e) => { e.stopPropagation(); setContextData(''); setFileName(null); setDatasetSampleChars(0); setUseDatasetFile(false); }} className="mt-1 text-xs text-red-500 hover:underline">Remove</button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <UploadCloud className="w-8 h-8 text-slate-300" />
                          <p className="text-xs text-slate-500">Drag & drop a file here, or <span className="text-indigo-500 font-medium">click to browse</span></p>
                          <p className="text-xs text-slate-400">.txt, .csv, .md supported</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Second Channel Upload — appears after first file is loaded */}
                  {contextData && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Second Channel <span className="text-slate-400 font-normal">(Meeting / Slack / Transcript)</span>
                      </label>
                      <div
                        className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${contextData2 ? 'border-purple-300 bg-purple-50/50' : 'border-slate-200 bg-slate-50 hover:border-purple-300 hover:bg-purple-50/30'
                          }`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { setError('File is too large. Max 2MB.'); return; }
                          const reader = new FileReader();
                          reader.onload = (ev) => { setContextData2(ev.target?.result as string || ''); setFileName2(file.name); setError(null); };
                          reader.readAsText(file);
                        }}
                        onClick={() => document.getElementById('file-upload-input-2')?.click()}
                      >
                        <input
                          id="file-upload-input-2"
                          type="file"
                          accept=".txt,.csv,.md"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) { setError('Too large. Max 2MB.'); e.target.value = ''; return; }
                            const reader = new FileReader();
                            reader.onload = (ev) => { setContextData2(ev.target?.result as string || ''); setFileName2(file.name); setError(null); };
                            reader.readAsText(file);
                          }}
                        />
                        {contextData2 ? (
                          <div className="flex flex-col items-center gap-1">
                            <FileText className="w-5 h-5 text-purple-500" />
                            <p className="text-xs font-medium text-purple-700">{fileName2}</p>
                            <p className="text-xs text-slate-500">{(contextData2.length / 1024).toFixed(1)} KB</p>
                            <button onClick={(e) => { e.stopPropagation(); setContextData2(''); setFileName2(null); }} className="mt-1 text-xs text-red-500 hover:underline">Remove</button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <UploadCloud className="w-6 h-6 text-slate-300" />
                            <p className="text-xs text-slate-500">Drop 2nd channel or <span className="text-purple-500 font-medium">browse</span></p>
                            <p className="text-xs text-slate-400">.txt, .csv, .md</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-5">
                    <Button
                      className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                      disabled={loading || !idea.trim()}
                      onClick={handleSubmit}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      {loading ? 'Consulting Agents...' : 'Generate Artifacts'}
                    </Button>
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-100">
                      <strong>Error:</strong> {error}
                    </div>
                  )}

                  {/* Noise Stats Badge */}
                  {result && noiseStats && noiseStats.words_analyzed > 0 && (
                    <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">🔇</span>
                      <span>
                        <strong>{noiseStats.words_analyzed.toLocaleString()}</strong> words analyzed &middot; &nbsp;
                        <strong>{noiseStats.estimated_relevant_pct}%</strong> signal retained &middot; &nbsp;
                        <strong>{noiseStats.relevant_sentences}</strong> relevant segments extracted
                      </span>
                    </div>
                  )}

                  {/* Sources Panel */}
                  {result && (contextData || contextData2 || (result.metadata as { used_dataset_sample?: boolean })?.used_dataset_sample) && (
                    <div className="mt-4 p-3 border border-slate-200 rounded-xl bg-white">
                      <p className="text-xs font-semibold text-slate-700 mb-2">📎 Analysis Sources</p>
                      {(contextData || (result.metadata as { used_dataset_sample?: boolean })?.used_dataset_sample && fileName) && (
                        <div className="flex items-center justify-between text-xs mb-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-blue-700 font-medium truncate max-w-[150px]">{fileName || 'Channel 1'}</span>
                          <span className="text-slate-500 shrink-0 ml-2">
                            {(fileName === 'emails.csv' && (useDatasetFile || (result.metadata as { used_dataset_sample?: boolean })?.used_dataset_sample) && !datasetSampleChars)
                              ? 'From dataset'
                              : `${((datasetSampleChars || contextData.length) / 1024).toFixed(1)} KB`}
                          </span>
                        </div>
                      )}
                      {contextData2 && (
                        <div className="flex items-center justify-between text-xs bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-purple-700 font-medium truncate max-w-[150px]">{fileName2 || 'Channel 2'}</span>
                          <span className="text-slate-500 shrink-0 ml-2">{(contextData2.length / 1024).toFixed(1)} KB</span>
                        </div>
                      )}
                      {idea && (
                        <p className="text-[10px] text-slate-400 mt-1.5 italic truncate">
                          Directions: "{idea.slice(0, 80)}{idea.length > 80 ? '...' : ''}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Project Meta */}
                  <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Owner</span>
                      <span className="font-medium truncate max-w-[160px]">{user?.displayName || user?.email || '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Project</span>
                      <span className="font-medium truncate max-w-[160px]">{selectedProjectId ? projectTitle : 'Not saved yet'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Visibility</span>
                      <span className="font-medium">Private</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Artifacts Canvas */}
              {result ? (
                <div className="flex-1 bg-slate-50/50 flex flex-col overflow-hidden min-h-0">
                  <Tabs
                    defaultValue={result.architecture ? 'architecture' : 'brd'}
                    className="flex-1 flex flex-col overflow-hidden min-h-0"
                  >
                    {/* Fixed Tab Headers */}
                    <div className="px-6 pt-4 pb-0 border-b border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] shrink-0">
                      <TabsList className="bg-transparent h-auto p-0 gap-6 w-full justify-start rounded-none">
                        {result.architecture && (
                          <TabsTrigger
                            value="architecture"
                            className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none pb-3 pt-2 px-1 text-slate-500 font-medium hover:text-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4" /> Architecture
                            </div>
                          </TabsTrigger>
                        )}
                        <TabsTrigger
                          value="brd"
                          className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none pb-3 pt-2 px-1 text-slate-500 font-medium hover:text-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Requirements
                          </div>
                        </TabsTrigger>
                        <TabsTrigger
                          value="data"
                          className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none pb-3 pt-2 px-1 text-slate-500 font-medium hover:text-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4" /> Data Model
                          </div>
                        </TabsTrigger>
                        <TabsTrigger
                          value="gap"
                          className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none pb-3 pt-2 px-1 text-slate-500 font-medium hover:text-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" /> Risks & Gaps
                          </div>
                        </TabsTrigger>
                        <TabsTrigger
                          value="compliance"
                          className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none pb-3 pt-2 px-1 text-slate-500 font-medium hover:text-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FolderGit2 className="w-4 h-4" /> Compliance
                          </div>
                        </TabsTrigger>
                        <TabsTrigger
                          value="stakeholders"
                          className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none pb-3 pt-2 px-1 text-slate-500 font-medium hover:text-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" /> Stakeholders
                          </div>
                        </TabsTrigger>
                        {result.conflicts && (
                          <TabsTrigger
                            value="conflicts"
                            className="data-[state=active]:bg-transparent data-[state=active]:text-red-600 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none pb-3 pt-2 px-1 text-slate-500 font-medium hover:text-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              Conflicts
                              {result.conflicts.critical_count > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                                  {result.conflicts.critical_count}
                                </span>
                              )}
                            </div>
                          </TabsTrigger>
                        )}
                      </TabsList>
                    </div>

                    {/* Scrollable Content Area — each view manages its own padding/max-width */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <TabsContent value="brd" className="m-0 focus-visible:ring-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="p-8"><BRDView data={result.brd} /></div>
                      </TabsContent>
                      {result.architecture && (
                        <TabsContent value="architecture" className="m-0 focus-visible:ring-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <div className="p-8"><ArchitectureView data={result.architecture} /></div>
                        </TabsContent>
                      )}
                      <TabsContent value="data" className="m-0 focus-visible:ring-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="p-8"><DataModelView data={result.data_model} /></div>
                      </TabsContent>
                      <TabsContent value="gap" className="m-0 focus-visible:ring-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="p-8"><GapView data={result.gaps} /></div>
                      </TabsContent>
                      <TabsContent value="compliance" className="m-0 focus-visible:ring-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="p-8"><ComplianceView data={result.compliance} /></div>
                      </TabsContent>
                      <TabsContent value="stakeholders" className="m-0 focus-visible:ring-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <StakeholderView data={result.brd} />
                      </TabsContent>
                      {result.conflicts && (
                        <TabsContent value="conflicts" className="m-0 focus-visible:ring-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <div className="p-8"><ConflictView
                            conflicts={result.conflicts}
                            fileName1={fileName}
                            fileName2={fileName2}
                          /></div>
                        </TabsContent>
                      )}
                    </div>
                  </Tabs>
                </div>
              ) : (
                <div className="flex-1 bg-slate-50 flex items-center justify-center p-10">
                  <div className="text-center max-w-md">
                    {loading ? (
                      <div className="space-y-6">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto relative overflow-hidden">
                          <div className="absolute inset-0 bg-indigo-50/50 animate-pulse"></div>
                          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin relative z-10" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Orchestrating Agents</h3>
                          <p className="text-slate-500 text-sm mt-1">Consulting expert models for architecture, security, and data...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 opacity-40 hover:opacity-100 transition-opacity">
                        <div className="w-20 h-20 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center">
                          <BrainCircuit className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-300 pointer-events-none select-none">Waiting for Input</h3>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </main>

            {/* Transparency Layer - only show in generator */}
            <TransparencyFooter metadata={result?.metadata} />
          </div>
    );
  };

  // Application-level 2FA Gate
  if (isLoggedIn && is2faEnabled && !is2faVerified) {
    return (
      <TwoFactorGate
        onVerify={async (code) => {
          await verify2FA(code);
          setIs2faVerified(true);
        }}
        onCancel={() => signOutUser().then(() => setIs2faVerified(false))}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {!authLoading && showLoginModal && (
        <AuthModal
          onClose={handleCloseModal}
          error={error}
        />
      )}

      <SearchBRDPopup
        open={searchPopupOpen}
        onClose={() => setSearchPopupOpen(false)}
        items={projects.map<BRDListItem>((p) => ({
          id: p.id,
          name: p.name,
          updated: p.updatedAt,
          description: p.description,
        }))}
        onSelectItem={(id) => {
          handleSelectProject(id);
          setSearchPopupOpen(false);
        }}
      />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewProject={handleNewProject}
        isLoggedIn={isLoggedIn}
        user={user}
        onLoginClick={() => setShowLoginModal(true)}
        onOpenSearch={() => setSearchPopupOpen(true)}
        onLogout={signOutUser}
        result={result}
        projectTitle={projectTitle}
        brds={projects.map((p) => ({
          id: p.id,
          name: p.name,
          updated: p.updatedAt,
          description: p.description,
        }))}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Guest Mode Warning Banner */}
        {!isLoggedIn && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-sm shrink-0">
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldAlert className="w-4 h-4" />
              <span><strong>Guest Mode:</strong> Your work won't be saved. <button onClick={() => setShowLoginModal(true)} className="underline font-semibold hover:text-amber-900">Log in</button> to save and access history.</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative leading-normal">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default App;
