import React, { useState } from 'react';
import { AppSettings, TargetLanguage, ProficiencyLevel, TutorPersona, LessonMode } from '../types';
import { SUGGESTED_TOPICS, ROLEPLAY_SCENARIOS, VOICE_OPTIONS } from '../constants';
import { Settings, GraduationCap, User, Globe, MessageCircle, Volume2, Mic2, Layout, Sliders, BookOpen, Music, Theater } from 'lucide-react';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  isOpen,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'audio' | 'topics'>('general');

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 p-2 bg-slate-800/80 backdrop-blur text-slate-200 rounded-full hover:bg-slate-700 transition-all border border-slate-600 z-50 shadow-lg group"
        title="Ders Ayarları"
      >
        <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-50 overflow-hidden flex flex-col transform transition-transform duration-300">
      
      {/* HEADER */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-lg font-serif font-semibold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> Ayarlar
          </h2>
          <button onClick={onToggle} className="text-slate-400 hover:text-white transition-colors">✕</button>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-3 text-xs font-medium flex justify-center items-center gap-1 ${activeTab === 'general' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <Layout size={14} /> Genel
          </button>
          <button 
            onClick={() => setActiveTab('topics')}
            className={`flex-1 py-3 text-xs font-medium flex justify-center items-center gap-1 ${activeTab === 'topics' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <MessageCircle size={14} /> {settings.lessonMode === LessonMode.Roleplay ? 'Senaryolar' : 'Konular'}
          </button>
          <button 
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-3 text-xs font-medium flex justify-center items-center gap-1 ${activeTab === 'audio' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <Sliders size={14} /> Ses
          </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        
        {/* --- GENERAL TAB --- */}
        {activeTab === 'general' && (
            <>
                {/* Mode */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Ders Modu</label>
                    <div className="flex flex-col gap-2">
                        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                            <button 
                                onClick={() => handleChange('lessonMode', LessonMode.Conversation)}
                                className={`flex-1 py-2 rounded-md text-sm transition-all ${settings.lessonMode === LessonMode.Conversation ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Sohbet
                            </button>
                            <button 
                                onClick={() => handleChange('lessonMode', LessonMode.Drill)}
                                className={`flex-1 py-2 rounded-md text-sm transition-all ${settings.lessonMode === LessonMode.Drill ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Soru-Cevap
                            </button>
                        </div>
                        <button 
                            onClick={() => handleChange('lessonMode', LessonMode.Roleplay)}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition-all ${
                                settings.lessonMode === LessonMode.Roleplay
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                        >
                            <Theater size={16} /> Diyalog / Rol Yapma
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 px-1">
                        {settings.lessonMode === LessonMode.Conversation && "Rahat, doğal bir konuşma akışı."}
                        {settings.lessonMode === LessonMode.Drill && "Seri sorularla pratik yapma modu."}
                        {settings.lessonMode === LessonMode.Roleplay && "Belirli bir senaryoda (örn: Restoran, Havaalanı) AI ile karşılıklı rol yapın."}
                    </p>
                </div>

                {/* Language */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <Globe className="w-3 h-3" /> Hedef Dil
                    </label>
                    <div className="relative">
                        <select
                            value={settings.targetLanguage}
                            onChange={(e) => handleChange('targetLanguage', e.target.value as TargetLanguage)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none appearance-none"
                        >
                            {Object.values(TargetLanguage).map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                </div>

                {/* Level */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <GraduationCap className="w-3 h-3" /> Seviye
                    </label>
                    <div className="space-y-2">
                        {Object.values(ProficiencyLevel).map((level) => (
                            <button
                                key={level}
                                onClick={() => handleChange('proficiencyLevel', level)}
                                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                                    settings.proficiencyLevel === level 
                                    ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-900/20' 
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Persona */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <User className="w-3 h-3" /> Öğretmen Tarzı
                    </label>
                    <div className="relative">
                        <select
                            value={settings.tutorPersona}
                            onChange={(e) => handleChange('tutorPersona', e.target.value as TutorPersona)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none appearance-none"
                        >
                            <option value={TutorPersona.FriendlyLocal}>Friendly Local (Samimi)</option>
                            <option value={TutorPersona.StrictProfessor}>Strict Professor (Disiplinli)</option>
                            <option value={TutorPersona.BusinessCoach}>Business Coach (İş Odaklı)</option>
                            <option value={TutorPersona.EncouragingFriend}>Encouraging Friend (Destekleyici)</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                </div>
            </>
        )}

        {/* --- TOPICS TAB --- */}
        {activeTab === 'topics' && (
            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                        {settings.lessonMode === LessonMode.Roleplay ? 'Özel Senaryo Girişi' : 'Manuel Konu Girişi'}
                    </label>
                    <textarea
                        value={settings.focusTopic}
                        onChange={(e) => handleChange('focusTopic', e.target.value)}
                        placeholder={settings.lessonMode === LessonMode.Roleplay 
                            ? "Örn: Hastanede kayıt işlemleri. Sen Hemşiresin, Ben Hastayım." 
                            : "Örn: I want to practice IELTS Speaking Part 2..."}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 text-sm h-20 resize-none focus:border-emerald-500 outline-none"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                        {settings.lessonMode === LessonMode.Roleplay ? 'Hazır Diyalog Senaryoları' : 'Önerilen Konular'}
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                        {(settings.lessonMode === LessonMode.Roleplay ? ROLEPLAY_SCENARIOS : SUGGESTED_TOPICS).map((topic) => (
                            <button
                                key={topic}
                                onClick={() => handleChange('focusTopic', topic)}
                                className={`text-sm p-3 rounded-md border text-left transition-all flex items-center gap-2 ${
                                    settings.focusTopic === topic
                                    ? (settings.lessonMode === LessonMode.Roleplay ? 'bg-indigo-900/50 border-indigo-500 text-white' : 'bg-emerald-900/50 border-emerald-500 text-white')
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                {settings.lessonMode === LessonMode.Roleplay && <Theater size={14} className="opacity-70"/>}
                                {topic}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* --- AUDIO TAB --- */}
        {activeTab === 'audio' && (
            <div className="space-y-8">
                <div className="space-y-4">
                     <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center justify-between">
                         <span className="flex items-center gap-2"><Volume2 className="w-3 h-3" /> Ses Çıkışı</span>
                         <input 
                            type="checkbox" 
                            checked={settings.voiceOutput} 
                            onChange={(e) => handleChange('voiceOutput', e.target.checked)}
                            className="toggle-checkbox"
                         />
                     </label>
                     <p className="text-xs text-slate-500">Cevaplar otomatik olarak seslendirilir.</p>
                </div>

                {/* Voice Selection */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <Music className="w-3 h-3" /> Seslendirmen
                    </label>
                    <div className="space-y-2">
                        {VOICE_OPTIONS.map((voice) => (
                            <button
                                key={voice.id}
                                onClick={() => handleChange('voiceName', voice.id)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all ${
                                    settings.voiceName === voice.id
                                    ? 'bg-indigo-900/40 border-indigo-500 text-indigo-200 shadow-lg' 
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <span>{voice.label}</span>
                                {settings.voiceName === voice.id && <div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800">
                     <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center justify-between">
                         <span className="flex items-center gap-2"><Mic2 className="w-3 h-3" /> Konuşma Hızı</span>
                         <span className="text-emerald-400 font-mono">{settings.speechSpeed}x</span>
                     </label>
                     <input 
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={settings.speechSpeed}
                        onChange={(e) => handleChange('speechSpeed', parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                     />
                     <div className="flex justify-between text-[10px] text-slate-500">
                         <span>Yavaş (Tane Tane)</span>
                         <span>Normal</span>
                         <span>Hızlı</span>
                     </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};