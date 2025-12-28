import React from 'react';
import { UserStats, VocabularyItem } from '../types';
import { BookOpen, Activity, Trash2, X, Trophy, MessageSquare, Brain } from 'lucide-react';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
  vocabulary: VocabularyItem[];
  onDeleteVocab: (id: string) => void;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({ 
  isOpen, onClose, stats, vocabulary, onDeleteVocab 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900">
           <h2 className="text-xl font-serif font-bold text-slate-100 flex items-center gap-2">
             <BookOpen className="w-5 h-5 text-emerald-400" /> Profil ve Kelime Defteri
           </h2>
           <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
             <X size={24} />
           </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-8">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                    <MessageSquare className="w-5 h-5 mx-auto mb-2 text-blue-400" />
                    <div className="text-2xl font-bold text-slate-100">{stats.totalMessages}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Mesaj</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                    <Activity className="w-5 h-5 mx-auto mb-2 text-red-400" />
                    <div className="text-2xl font-bold text-slate-100">{stats.totalErrorsFixed}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Düzeltme</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                    <Brain className="w-5 h-5 mx-auto mb-2 text-purple-400" />
                    <div className="text-2xl font-bold text-slate-100">{stats.vocabularyCount}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Kelime</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                    <Trophy className="w-5 h-5 mx-auto mb-2 text-amber-400" />
                    <div className="text-2xl font-bold text-slate-100">{stats.sessionsCompleted}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Ders</div>
                </div>
            </div>

            {/* Vocabulary Section */}
            <div>
                <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <BookOpen size={18} /> Kayıtlı Kelimeler
                </h3>
                
                {vocabulary.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-800/30 rounded-xl border border-slate-800 border-dashed">
                        Henüz hiç kelime kaydetmediniz. Mesajlardaki metinleri seçerek kaydedebilirsiniz.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {vocabulary.map((item) => (
                            <div key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-start group hover:border-slate-600 transition-all">
                                <div>
                                    <div className="font-bold text-emerald-300 text-lg">{item.word}</div>
                                    <div className="text-slate-400 text-sm italic mt-1">"{item.context}"</div>
                                    <div className="text-slate-600 text-xs mt-2">{new Date(item.timestamp).toLocaleDateString()}</div>
                                </div>
                                <button 
                                    onClick={() => onDeleteVocab(item.id)}
                                    className="text-slate-600 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Sil"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};