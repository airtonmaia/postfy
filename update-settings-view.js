import fs from 'fs';

let content = fs.readFileSync('src/components/settings/SettingsView.tsx', 'utf8');

const importsNew = `import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { 
  Building2, Users, Paintbrush, Globe, Check, Lock, Plus, Link, Settings2, Bell, Shield, MessageSquare
} from 'lucide-react';
import { SettingsOverview } from './tabs/SettingsOverview';
import { SettingsWhitelabel } from './tabs/SettingsWhitelabel';
import { SettingsIntegrations } from './tabs/SettingsIntegrations';
`;

content = content.replace(/import React, \{ useState \}.+?from 'lucide-react';/s, importsNew);

const renderLogicOld = `      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Dados da Conta</h4>
            <p className="text-xs text-slate-500">Módulo em construção...</p>
          </div>
        )}
        
        {activeTab === 'whitelabel' && (
           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Whitelabel</h4>
            <p className="text-xs text-slate-500">Módulo em construção...</p>
          </div>
        )}
      </div>`;

const renderLogicNew = `      <div className="p-6 max-w-5xl mx-auto w-full">
        {activeTab === 'overview' && <SettingsOverview />}
        {activeTab === 'whitelabel' && <SettingsWhitelabel />}
        {activeTab === 'integrations' && <SettingsIntegrations />}
        
        {['preferences', 'communication', 'users', 'teams'].includes(activeTab) && (
           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs text-center py-12">
            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Módulo em Desenvolvimento</h4>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              As configurações detalhadas de {activeTab} estão sendo migradas para a nova arquitetura componentezada do sistema.
            </p>
          </div>
        )}
      </div>`;

content = content.replace(renderLogicOld, renderLogicNew);
fs.writeFileSync('src/components/settings/SettingsView.tsx', content);

