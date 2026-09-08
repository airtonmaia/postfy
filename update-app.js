import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Restore Sidebar Header
const sidebarHeaderOld = `          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            {/* Workspace Switcher */}
            <div className="relative group">
              <button 
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center font-bold text-purple-700 dark:text-purple-400 shadow-sm border border-purple-100 dark:border-purple-800/50">
                    {currentWorkspace.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 text-left">
                    <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate w-32">
                      {currentWorkspace.name}
                    </h1>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      Workspace da agência
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              </button>

              {/* Dropdown Menu (Hidden by default, shown on hover/focus within group) */}
              <div className="absolute top-full left-0 mt-1 w-full opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Suas Contas
                  </div>
                  {workspaces.map(ws => (
                    <button
                      key={ws.id}
                      onClick={() => setCurrentWorkspace(ws)}
                      className={\`w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition cursor-pointer \${
                        ws.id === currentWorkspace.id ? 'bg-purple-50/50 dark:bg-purple-900/20' : ''
                      }\`}
                    >
                      <div className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-[10px] font-bold text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50">
                        {ws.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className={\`text-xs truncate flex-1 \${
                        ws.id === currentWorkspace.id ? 'font-bold text-purple-700 dark:text-purple-400' : 'font-medium text-slate-700 dark:text-slate-300'
                      }\`}>
                        {ws.name}
                      </span>
                      {ws.id === currentWorkspace.id && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      )}
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                    Criar novo workspace
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>`;

const sidebarHeaderNew = `          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white shadow-sm shadow-purple-600/20">
                P
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                  <span className="truncate">Postfy Ops</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                    PRO
                  </span>
                </h1>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">OS para Agências</span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>`;

content = content.replace(sidebarHeaderOld, sidebarHeaderNew);

// 2. Add WorkspaceSwitcher to Topbar and fix imports
if (!content.includes('import { WorkspaceSwitcher }')) {
  content = content.replace("import { TabType } from './types';", "import { TabType } from './types';\nimport { WorkspaceSwitcher } from './components/layout/WorkspaceSwitcher';");
}

const topbarLeftOld = `          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search shortcut button (Cmd + K) */}`;

const topbarLeftNew = `          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <WorkspaceSwitcher />

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block mx-1"></div>

            {/* Global Search shortcut button (Cmd + K) */}`;

content = content.replace(topbarLeftOld, topbarLeftNew);

fs.writeFileSync('src/App.tsx', content);

