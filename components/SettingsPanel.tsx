
import React, { useState } from 'react';
import { AppSettings, TargetLanguage, ProficiencyLevel, TutorPersona, LessonMode, NativeLanguage, EnglishDialect, SpeakingStyle } from '../types';
import { SUGGESTED_TOPICS, ROLEPLAY_SCENARIOS, VOICE_OPTIONS, AVAILABLE_TEXT_MODELS, AVAILABLE_AUDIO_MODELS } from '../constants';
import { Settings, GraduationCap, User, Globe, MessageCircle, Volume2, Mic2, Layout, Sliders, BookOpen, Music, Theater, Mic, Languages, Cloud, Key, Plus, Trash2, Cpu, Activity } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'general' | 'audio' | 'topics' | 'api'>('general');
  const [newApiKey, setNewApiKey] = useState('');

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleAddKey = () => {
      if (newApiKey.trim().length > 10) {
          const currentKeys = settings.apiKeys || [];
          if (!currentKeys.includes(newApiKey.trim())) {
              handleChange('apiKeys', [...currentKeys, newApiKey.trim()]);
              setNewApiKey('');
          }
      }
  };

  const handleRemoveKey = (keyToRemove: string) => {
      const currentKeys = settings.apiKeys || [];
      handleChange('apiKeys', currentKeys.filter(k => k !== keyToRemove));
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
      <div className="flex border-b border-slate-800 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-3 px-2 text-xs font-medium flex justify-center items-center gap-1 min-w-[70px] ${activeTab === 'general' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <Layout size={14} /> Genel
          </button>
          <button 
            onClick={() => setActiveTab('topics')}
            className={`flex-1 py-3 px-2 text-xs font-medium flex justify-center items-center gap-1 min-w-[70px] ${activeTab === 'topics' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <MessageCircle size={14} /> {settings.lessonMode === LessonMode.Roleplay ? 'Senaryo' : 'Konular'}
          </button>
          <button 
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-3 px-2 text-xs font-medium flex justify-center items-center gap-1 min-w-[70px] ${activeTab === 'audio' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <Sliders size={14} /> Ses
          </button>
          <button 
            onClick={() => setActiveTab('api')}
            className={`flex-1 py-3 px-2 text-xs font-medium flex justify-center items-center gap-1 min-w-[70px] ${activeTab === 'api' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <Cloud size={14} /> API
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
                </div>

                {/* Native Language */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <Languages className="w-3 h-3" /> Ana Diliniz
                    </label>
                    <div className="relative">
                        <select
                            value={settings.nativeLanguage}
                            onChange={(e) => handleChange('nativeLanguage', e.target.value as NativeLanguage)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none appearance-none"
                        >
                            {Object.values(NativeLanguage).map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                </div>

                {/* Target Language */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <Globe className="w-3 h-3" /> Hedef Dil (Öğrenilen)
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

                {/* English Dialect (Conditional) */}
                {settings.targetLanguage === 'English' && (
                    <div className="space-y-3 animate-in fade-in">
                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                            <Mic className="w-3 h-3" /> İngilizce Aksanı
                        </label>
                        <div className="relative">
                            <select
                                value={settings.englishDialect}
                                onChange={(e) => handleChange('englishDialect', e.target.value as EnglishDialect)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none appearance-none"
                            >
                                {Object.values(EnglishDialect).map(dialect => (
                                    <option key={dialect} value={dialect}>{dialect}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                        </div>
                    </div>
                )}

                {/* Speaking Style */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <MessageCircle className="w-3 h-3" /> Konuşma Tarzı
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleChange('speakingStyle', SpeakingStyle.Standard)}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${settings.speakingStyle === SpeakingStyle.Standard ? 'bg-indigo-900/50 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                        >
                            Standard (Düzgün)
                        </button>
                        <button
                            onClick={() => handleChange('speakingStyle', SpeakingStyle.Casual)}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${settings.speakingStyle === SpeakingStyle.Casual ? 'bg-indigo-900/50 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                        >
                            Casual (Günlük)
                        </button>
                        <button
                            onClick={() => handleChange('speakingStyle', SpeakingStyle.Formal)}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${settings.speakingStyle === SpeakingStyle.Formal ? 'bg-indigo-900/50 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                        >
                            Formal (Resmi)
                        </button>
                        <button
                            onClick={() => handleChange('speakingStyle', SpeakingStyle.StreetSlang)}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${settings.speakingStyle === SpeakingStyle.StreetSlang ? 'bg-rose-900/50 border-rose-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                        >
                            Street Slang (Sokak)
                        </button>
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
                        <User className="w-3 h-3" /> Öğretmen Kişiliği
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

        {/* --- API & CLOUD TAB (NEW) --- */}
        {activeTab === 'api' && (
            <div className="space-y-8 animate-in fade-in">
                
                {/* 1. API KEY MANAGEMENT */}
                <div className="space-y-4">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <Key className="w-3 h-3" /> Çoklu API Anahtarı
                    </label>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <input 
                                type="password" 
                                value={newApiKey}
                                onChange={(e) => setNewApiKey(e.target.value)}
                                placeholder="Yeni Gemini API Key ekle..."
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                            />
                            <button onClick={handleAddKey} disabled={!newApiKey} className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-lg text-white transition-colors">
                                <Plus size={18} />
                            </button>
                        </div>
                        
                        <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                            {(settings.apiKeys || []).length === 0 ? (
                                <p className="text-xs text-slate-500 italic text-center py-2">Ekli anahtar yok. Varsayılan (Env) anahtar kullanılacak.</p>
                            ) : (
                                (settings.apiKeys || []).map((key, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700">
                                        <span className="text-xs font-mono text-slate-300">...{key.slice(-6)}</span>
                                        <button onClick={() => handleRemoveKey(key)} className="text-slate-500 hover:text-red-400">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500">Anahtarlar limit aşımında otomatik olarak sırayla kullanılır.</p>
                    </div>
                </div>

                {/* 2. TEXT MODEL SELECTION */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <Cpu className="w-3 h-3" /> Yazı & Sohbet Modeli
                    </label>
                    <div className="space-y-2">
                        {AVAILABLE_TEXT_MODELS.map((model) => (
                            <button
                                key={model.id}
                                onClick={() => handleChange('textModel', model.id)}
                                className={`w-full flex flex-col items-start px-4 py-3 rounded-lg border text-sm transition-all ${
                                    settings.textModel === model.id
                                    ? 'bg-blue-900/30 border-blue-500 text-blue-100 shadow-lg' 
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex justify-between w-full mb-1">
                                    <span className="font-bold">{model.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-950 rounded border border-slate-700 text-slate-400 flex items-center gap-1">
                                        <Activity size={10} /> {model.limit}
                                    </span>
                                </div>
                                <span className="text-xs opacity-70">{model.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. AUDIO MODEL SELECTION */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <Cloud className="w-3 h-3" /> Canlı Ses Modeli (Live)
                    </label>
                    <div className="space-y-2">
                        {AVAILABLE_AUDIO_MODELS.map((model) => (
                            <button
                                key={model.id}
                                onClick={() => handleChange('audioModel', model.id)}
                                className={`w-full flex flex-col items-start px-4 py-3 rounded-lg border text-sm transition-all ${
                                    settings.audioModel === model.id
                                    ? 'bg-pink-900/30 border-pink-500 text-pink-100 shadow-lg' 
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex justify-between w-full mb-1">
                                    <span className="font-bold">{model.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-950 rounded border border-slate-700 text-slate-400 flex items-center gap-1">
                                        <Activity size={10} /> {model.limit}
                                    </span>
                                </div>
                                <span className="text-xs opacity-70">{model.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        )}

      </div>
    </div>
  );
};
