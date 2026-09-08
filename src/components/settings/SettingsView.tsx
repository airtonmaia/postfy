import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { 
  Building2, Users, Paintbrush, Globe, Check, Lock, Plus, Link, Settings2, Bell, Shield, MessageSquare
} from 'lucide-react';
import { SettingsOverview } from './tabs/SettingsOverview';
import { SettingsWhitelabel } from './tabs/SettingsWhitelabel';
import { SettingsIntegrations } from './tabs/SettingsIntegrations';
import { SettingsPreferences } from './tabs/SettingsPreferences';
import { SettingsCommunication } from './tabs/SettingsCommunication';
import { SettingsUsers } from './tabs/SettingsUsers';
import { SettingsTeams } from './tabs/SettingsTeams';


export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'whitelabel', label: 'Whitelabel', icon: Paintbrush },
    { id: 'integrations', label: 'Integrações', icon: Link },
    { id: 'preferences', label: 'Preferências', icon: Settings2 },
    { id: 'communication', label: 'Comunicação', icon: MessageSquare },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'teams', label: 'Equipes', icon: Shield },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-6 pb-0">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Sistema</span>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Configurações</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie as preferências da sua agência e do seu workspace.
          </p>
        </div>
        
        <div className="flex items-center gap-6 mt-6 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto w-full">
        {activeTab === 'overview' && <SettingsOverview />}
        {activeTab === 'whitelabel' && <SettingsWhitelabel />}
        {activeTab === 'integrations' && <SettingsIntegrations />}
        {activeTab === 'preferences' && <SettingsPreferences />}
        {activeTab === 'communication' && <SettingsCommunication />}
        {activeTab === 'users' && <SettingsUsers />}
        {activeTab === 'teams' && <SettingsTeams />}
      </div>
    </div>
  );
};
