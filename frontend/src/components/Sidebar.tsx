import React, { useState } from 'react';
import {
  Sparkles, LayoutGrid, ChevronDown,
  Search, Plus, Settings as SettingsIcon, LogOut,
  FileText, Server, Database, ShieldAlert, FolderGit2,
  AlertTriangle, Users, BookOpen, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import type { BRDListItem } from './SearchBRDPopup';
import type { GenerateResponse } from '../types';
import type { User } from 'firebase/auth';

// ──────────────────────────────────────────────────
// Shared tooltip for icon-only (collapsed) mode
// ──────────────────────────────────────────────────
const Tip = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="relative group/tip flex items-center justify-center">
    {children}
    <div className="pointer-events-none absolute left-full ml-2 z-50 hidden group-hover/tip:flex
      items-center bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl
      whitespace-nowrap border border-slate-700">
      {label}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
    </div>
  </div>
);

// ──────────────────────────────────────────────────
// NavItem — two variants: collapsed (icon only) / expanded
// ──────────────────────────────────────────────────
interface NavItemProps {
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  badge?: React.ReactNode;
}

const NavItem = ({ isActive, onClick, disabled, icon: Icon, label, collapsed, badge }: NavItemProps) => {
  const baseStyle = `
    w-full flex items-center gap-3 text-left text-sm font-medium
    transition-all duration-200 ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60
    disabled:opacity-50 disabled:cursor-not-allowed
    ${isActive
      ? 'bg-indigo-600/10 text-indigo-400'
      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
    }
  `;

  if (collapsed) {
    return (
      <Tip label={label}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`${baseStyle} justify-center w-10 h-10 rounded-xl p-0`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {badge}
        </button>
      </Tip>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} px-3.5 py-2.5 rounded-xl`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1">{label}</span>
      {badge}
    </button>
  );
};

// ──────────────────────────────────────────────────
// LibraryDropdown
// ──────────────────────────────────────────────────
const LibraryDropdown = ({
  activeTab, setActiveTab, onOpenProject, isLoggedIn, brds, collapsed,
}: { activeTab: string; setActiveTab: (t: string) => void; onOpenProject?: (id: string) => void; isLoggedIn: boolean; brds: BRDListItem[]; collapsed: boolean }) => {
  const [isOpen, setIsOpen] = useState(true);
  const isActive = activeTab === 'projects';

  if (collapsed) {
    return (
      <Tip label="Dashboard">
        <button
          type="button"
          onClick={() => isLoggedIn && setActiveTab('projects')}
          disabled={!isLoggedIn}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
            ${isActive ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </Tip>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className={`flex items-center gap-1 rounded-lg ${isActive ? 'bg-slate-700/80' : ''}`}>
        <button
          type="button"
          onClick={() => isLoggedIn && setActiveTab('projects')}
          disabled={!isLoggedIn}
          className={`flex-1 flex items-center gap-3 min-w-0 px-3 py-2.5 rounded-lg text-left text-sm font-medium
            transition-colors duration-150
            ${isActive ? 'text-white' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <LayoutGrid className="w-4 h-4 shrink-0 opacity-90" />
          <span className="truncate">Dashboard</span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsOpen(o => !o); }}
          className={`shrink-0 p-2 rounded-md transition-colors
            ${isActive ? 'text-white hover:bg-slate-600/80' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {isOpen && (
        <div className="ml-3 pl-3 py-1 border-l-2 border-slate-800 space-y-0.5">
          {brds.map((brd) => {
            const active = activeTab === brd.id;
            return (
              <button
                key={brd.id}
                type="button"
                onClick={() => {
                  if (!isLoggedIn) return;
                  if (onOpenProject) {
                    onOpenProject(brd.id);
                  } else {
                    setActiveTab(brd.id);
                  }
                }}
                disabled={!isLoggedIn}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px]
                  transition-all duration-200 ease-out
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${active ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-slate-600'}`} />
                <span className="truncate flex-1">{brd.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────
// Document TOC
// ──────────────────────────────────────────────────
interface TocSection {
  id: string; label: string; icon: React.ElementType;
  available: boolean; critical?: number;
}

const DocumentTOC = ({
  result, projectTitle, onBackToNav, collapsed,
}: { result: GenerateResponse; projectTitle: string; onBackToNav: () => void; collapsed: boolean }) => {
  const sections: TocSection[] = [
    { id: 'brd-overview', label: 'Overview', icon: BookOpen, available: true },
    { id: 'brd-objectives', label: 'Objectives', icon: FileText, available: !!result.brd?.business_objectives?.length },
    { id: 'brd-requirements', label: 'Requirements', icon: FileText, available: !!result.brd?.functional_requirements?.length },
    { id: 'brd-scope', label: 'Scope', icon: FileText, available: !!result.brd?.project_scope_in_scope?.length },
    { id: 'brd-stakeholders', label: 'Stakeholders', icon: Users, available: true },
    { id: 'architecture', label: 'Architecture', icon: Server, available: !!result.architecture },
    { id: 'data-model', label: 'Data Model', icon: Database, available: !!result.data_model },
    { id: 'gap-analysis', label: 'Risks & Gaps', icon: ShieldAlert, available: !!result.gaps },
    { id: 'compliance', label: 'Compliance', icon: FolderGit2, available: !!result.compliance },
    { id: 'conflicts', label: 'Conflicts', icon: AlertTriangle, available: !!result.conflicts, critical: result.conflicts?.critical_count },
  ].filter(s => s.available);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (collapsed) {
    return (
      <nav className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <Tip key={s.id} label={s.label}>
              <button
                onClick={() => scrollTo(s.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors relative
                  ${s.id === 'conflicts' && (s.critical ?? 0) > 0
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
              >
                <Icon className="w-4 h-4" />
                {s.id === 'conflicts' && (s.critical ?? 0) > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </button>
            </Tip>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <button
        type="button"
        onClick={onBackToNav}
        className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500 hover:text-slate-300 transition-colors border-b border-slate-800/90"
      >
        <ChevronRight className="w-3 h-3 rotate-180" /> Back to nav
      </button>
      <div className="px-4 py-3 border-b border-slate-800/90 shrink-0">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-1">Document TOC</p>
        <p className="text-sm font-semibold text-white truncate" title={projectTitle}>{projectTitle}</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150
                ${s.id === 'conflicts' && (s.critical ?? 0) > 0
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1">{s.label}</span>
              {s.id === 'conflicts' && (s.critical ?? 0) > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{s.critical}</span>
              )}
            </button>
          );
        })}
      </nav>
      {result.metadata?.health_score != null && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800/90 shrink-0">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">Health</span>
            <span className={result.metadata.health_score >= 75 ? 'text-emerald-400 font-semibold' : result.metadata.health_score >= 50 ? 'text-amber-400 font-semibold' : 'text-red-400 font-semibold'}>
              {result.metadata.health_score}/100
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${result.metadata.health_score >= 75 ? 'bg-emerald-500' : result.metadata.health_score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${result.metadata.health_score}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────────
export interface SidebarProps {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onNewProject: () => void;
  onOpenProject?: (id: string) => void;
  isLoggedIn: boolean;
  user: User | null;
  onLoginClick: () => void;
  onOpenSearch: () => void;
  onLogout: () => void;
  brds: BRDListItem[];
  result?: GenerateResponse | null;
  projectTitle?: string;
}

export function Sidebar({
  activeTab, setActiveTab, onNewProject, onOpenProject,
  isLoggedIn, user, onLoginClick, onOpenSearch, onLogout,
  brds, result, projectTitle = 'Project',
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tocMode, setTocMode] = useState(false);

  const showTOC = tocMode && !!result;

  return (
    <aside
      className={`
        flex flex-col h-screen bg-[#0f172a] border-r border-slate-800/90 shrink-0 select-none
        transition-all duration-300 ease-in-out overflow-hidden
        ${collapsed ? 'w-[60px]' : 'w-64'}
      `}
    >
      {/* ── Logo row ──────────────────────────────── */}
      <div className={`h-14 shrink-0 flex items-center border-b border-slate-800/90 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg text-white tracking-tight whitespace-nowrap">
              Samvad<span className="text-indigo-400">.ai</span>
            </span>
          </div>
        )}
        {collapsed && (
          <Tip label="Samvad.ai">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
          </Tip>
        )}
        {/* Collapse toggle */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => { setCollapsed(true); setTocMode(false); }}
            title="Collapse sidebar"
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Expand button when collapsed ─────────────── */}
      {collapsed && (
        <div className="flex justify-center py-2 border-b border-slate-800/90">
          <Tip label="Expand sidebar">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </Tip>
        </div>
      )}

      {/* ── TOC or Normal nav ─────────────────────────── */}
      {showTOC ? (
        <DocumentTOC
          result={result!}
          projectTitle={projectTitle}
          onBackToNav={() => setTocMode(false)}
          collapsed={collapsed}
        />
      ) : (
        <>
          {/* Guest banner (expanded only) */}
          {!collapsed && !isLoggedIn && (
            <div className="mx-3 mt-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/80">
              <p className="text-xs text-slate-400 mb-2">
                You're in <span className="text-slate-200 font-medium">Guest Mode</span>.
              </p>
              <button
                type="button"
                onClick={onLoginClick}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                Log in to save
              </button>
            </div>
          )}

          {/* Doc outline shortcut (expanded only) */}
          {result && !collapsed && (
            <button
              type="button"
              onClick={() => setTocMode(true)}
              className="mx-2 mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-indigo-400 bg-indigo-600/10 hover:bg-indigo-600/15 transition-colors"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="truncate">View Doc Outline</span>
            </button>
          )}

          {/* Doc outline icon (collapsed only) */}
          {result && collapsed && (
            <div className={`flex justify-center py-2 ${!collapsed ? '' : ''}`}>
              <Tip label="View Doc Outline">
                <button
                  type="button"
                  onClick={() => { setCollapsed(false); setTocMode(true); }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-400 bg-indigo-600/10 hover:bg-indigo-600/20 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
              </Tip>
            </div>
          )}

          {/* Main nav */}
          <nav className={`flex-1 overflow-y-auto py-3 space-y-0.5 ${collapsed ? 'flex flex-col items-center px-1' : 'px-2'}`}>
            <LibraryDropdown
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onOpenProject={onOpenProject}
              isLoggedIn={isLoggedIn}
              brds={brds}
              collapsed={collapsed}
            />
            <NavItem
              isActive={false}
              onClick={() => isLoggedIn && onOpenSearch()}
              disabled={!isLoggedIn}
              icon={Search}
              label="Search BRDs"
              collapsed={collapsed}
            />
            <NavItem
              isActive={activeTab === 'new_project'}
              onClick={onNewProject}
              icon={Plus}
              label="New Project"
              collapsed={collapsed}
            />
          </nav>

          {/* Bottom — Settings + Profile */}
          <div className={`shrink-0 border-t border-slate-800/90 ${collapsed ? 'flex flex-col items-center pb-2' : ''}`}>
            <div className={collapsed ? 'py-2' : 'p-2'}>
              <NavItem
                isActive={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
                icon={SettingsIcon}
                label="Settings"
                collapsed={collapsed}
              />
            </div>

            {/* Profile */}
            <div className={collapsed ? 'py-1' : 'p-3 pt-0'}>
              {isLoggedIn && user ? (
                <div className="relative">
                  {collapsed ? (
                    <Tip label={user.displayName || user.email || 'Account'}>
                      <button
                        type="button"
                        onClick={() => { setCollapsed(false); setProfileOpen(true); }}
                        className="w-10 h-10 rounded-full overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all"
                      >
                        {user.photoURL
                          ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-white text-sm font-semibold">{user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}</div>
                        }
                      </button>
                    </Tip>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setProfileOpen(o => !o)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/60 transition-all text-left group"
                      >
                        {user.photoURL
                          ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full shrink-0 ring-2 ring-transparent group-hover:ring-indigo-500/40 transition-all" />
                          : <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">{user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}</div>
                        }
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">{user.displayName || user.email || 'User'}</div>
                          <div className="text-xs text-slate-500 truncate">{user.email || 'Signed in'}</div>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {profileOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-slate-800 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-20">
                          <div className="p-2 border-b border-slate-700/60">
                            <p className="text-xs text-slate-500 px-2 py-1 truncate">{user.email}</p>
                          </div>
                          <div className="p-1.5">
                            <button
                              type="button"
                              onClick={() => { setProfileOpen(false); onLogout(); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors font-medium"
                            >
                              <LogOut className="w-4 h-4" /> Sign out
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                !collapsed && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 text-sm font-medium shrink-0">?</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-400 truncate">Guest</div>
                      <div className="text-xs text-slate-500 truncate">Limited access</div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
