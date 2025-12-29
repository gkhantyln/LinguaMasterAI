import React, { useState, useRef, useMemo } from 'react';
import { UserStats, VocabularyItem, CustomWord, CEFR_MAP } from '../types';
import { BookOpen, Activity, Trash2, X, Trophy, MessageSquare, Brain, Upload, FileText, PlayCircle, Filter, Trash, Sparkles, Loader2, Layers, Zap, PauseCircle, StopCircle, RefreshCw, Download } from 'lucide-react';
import { categorizeWordsBatch } from '../services/geminiService';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
  vocabulary: VocabularyItem[];
  customWords: CustomWord[];
  onDeleteVocab: (id: string) => void;
  onUploadWords: (words: CustomWord[]) => void;
  onUpdateWordList: (words: CustomWord[]) => void; // New prop for updating existing list
  onStartPractice: (words: CustomWord[]) => void;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({ 
  isOpen, onClose, stats, vocabulary, customWords, onDeleteVocab, onUploadWords, onUpdateWordList, onStartPractice
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'vocab' | 'bank'>('profile');
  const [uploadLevel, setUploadLevel] = useState<string>('AUTO');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  
  // Categorization Logic States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const stopProcessingRef = useRef(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Helper: Handle File Upload (Parsing with Category Support)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          const text = event.target?.result as string;
          if (!text) return;

          const lines = text.split('\n');
          const parsedWords: CustomWord[] = [];
          let ignoredCount = 0;

          lines.forEach(line => {
              const cleanLine = line.trim();
              if (cleanLine.length === 0) return;

              if (cleanLine.includes('©') || cleanLine.includes('Oxford') || cleanLine.match(/^\d+\s*\/\s*\d+$/)) {
                  ignoredCount++;
                  return;
              }

              // Check for "Word | Category | Level" format (Export/Import format)
              if (cleanLine.includes('|')) {
                  const parts = cleanLine.split('|').map(p => p.trim());
                  // Expecting at least: Word | Category
                  if (parts.length >= 2) {
                      const word = parts[0];
                      const category = parts[1];
                      const level = parts[2] || (uploadLevel === 'AUTO' ? undefined : uploadLevel);

                      if (word && word.length > 1) {
                          parsedWords.push({
                              id: Date.now() + Math.random().toString(),
                              word: word,
                              level: level,
                              category: category,
                              source: 'Imported List'
                          });
                      }
                      return; // Skip standard parsing for this line
                  }
              }

              // Standard Logic (If not pipe separated)
              let word = cleanLine;
              let level = undefined;

              if (uploadLevel === 'AUTO') {
                  const levelMatch = cleanLine.match(/\b(A1|A2|B1|B2|C1|C2)\b/g); 
                  if (levelMatch) {
                      level = levelMatch[0].toUpperCase();
                      const wordMatch = cleanLine.match(/^([a-zA-Z\-\s]+?)\s+(v\.|n\.|adj\.|adv\.|prep\.|conj\.|pron\.|num\.|det\.|exclam\.)/);
                      if (wordMatch) word = wordMatch[1].trim();
                      else word = cleanLine.split(' ')[0].trim();
                      word = word.replace(/\d+$/, '');
                  }
              } else {
                  level = uploadLevel;
                  word = cleanLine.split(' ')[0].replace(/[.,;]/g, '').trim();
              }

              if (word && word.length > 1) {
                  parsedWords.push({
                      id: Date.now() + Math.random().toString(),
                      word: word,
                      level: level,
                      source: file.name.replace('.txt', ''),
                      category: 'Uncategorized' // Default to uncategorized for standard files
                  });
              }
          });

          onUploadWords(parsedWords);
          alert(`${parsedWords.length} kelime başarıyla yüklendi!`);
          
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

  // 2. Helper: Export Word List
  const handleExportWordList = () => {
      if (customWords.length === 0) {
          alert("Dışa aktarılacak kelime bulunamadı.");
          return;
      }

      // Format: Word | Category | Level
      const content = customWords.map(w => {
          return `${w.word} | ${w.category || 'Uncategorized'} | ${w.level || ''}`;
      }).join('\n');

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `linguamaster_kelimeler_${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // 3. Helper: Start Categorization Process
  const handleStartCategorization = async () => {
    // Find candidate words based on current filter AND 'Uncategorized' status
    const candidateWords = customWords.filter(cw => {
        // Filter logic same as view
        const levelMatch = filterLevel === 'ALL' || cw.level === filterLevel;
        // MUST be uncategorized or missing category
        const needsCat = !cw.category || cw.category === 'Uncategorized';
        return levelMatch && needsCat;
    });

    if (candidateWords.length === 0) {
        alert("Seçili filtrede kategorize edilecek yeni kelime bulunamadı.");
        return;
    }

    setIsProcessing(true);
    stopProcessingRef.current = false;
    setProcessingProgress({ current: 0, total: candidateWords.length });

    // We need a working copy of the *full* list to update efficiently
    let currentGlobalList = [...customWords]; 

    const batchSize = 20;
    
    for (let i = 0; i < candidateWords.length; i += batchSize) {
        if (stopProcessingRef.current) break;

        const chunk = candidateWords.slice(i, i + batchSize);
        const wordList = chunk.map(cw => cw.word);

        try {
            const categoriesMap = await categorizeWordsBatch(wordList, 'English'); // Or determine language dynamically

            // Update the global list copy
            currentGlobalList = currentGlobalList.map(cw => {
                const foundInChunk = chunk.find(c => c.id === cw.id);
                if (foundInChunk) {
                    return { ...cw, category: categoriesMap[cw.word] || 'General' };
                }
                return cw;
            });

            // Update Parent State (Progressive Update)
            onUpdateWordList(currentGlobalList);
            setProcessingProgress({ current: Math.min(candidateWords.length, i + batchSize), total: candidateWords.length });

        } catch (e) {
            console.error("Batch processing error", e);
        }
    }

    setIsProcessing(false);
  };

  const handleStopCategorization = () => {
      stopProcessingRef.current = true;
  };

  // 4. Hooks (useMemo)
  const uniqueCategories = useMemo(() => {
      const cats = new Set<string>();
      customWords.forEach(cw => {
          if (cw.category) cats.add(cw.category);
      });
      return Array.from(cats).sort();
  }, [customWords]);

  const filteredWords = customWords.filter(cw => {
      const levelMatch = filterLevel === 'ALL' || cw.level === filterLevel;
      const catMatch = filterCategory === 'ALL' || cw.category === filterCategory;
      return levelMatch && catMatch;
  });

  const uncategorizedCountInView = customWords.filter(cw => {
      const levelMatch = filterLevel === 'ALL' || cw.level === filterLevel;
      return levelMatch && (!cw.category || cw.category === 'Uncategorized');
  }).length;

  // 5. Early Return
  if (!isOpen) return null;

  // 6. Styles
  const getLevelColor = (level?: string) => {
      switch(level) {
          case 'A1': return 'bg-green-500/20 text-green-300 border-green-500/30';
          case 'A2': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
          case 'B1': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
          case 'B2': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
          case 'C1': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
          case 'C2': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
          default: return 'bg-slate-700 text-slate-400';
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900">
           <div className="flex flex-wrap gap-4 md:gap-6">
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`text-lg font-serif font-bold flex items-center gap-2 transition-colors ${activeTab === 'profile' ? 'text-white' : 'text-slate-500'}`}
                >
                    <Activity className={`w-5 h-5 ${activeTab === 'profile' ? 'text-emerald-400' : 'text-slate-600'}`} /> Profil
                </button>
                <button 
                    onClick={() => setActiveTab('vocab')}
                    className={`text-lg font-serif font-bold flex items-center gap-2 transition-colors ${activeTab === 'vocab' ? 'text-white' : 'text-slate-500'}`}
                >
                    <BookOpen className={`w-5 h-5 ${activeTab === 'vocab' ? 'text-purple-400' : 'text-slate-600'}`} /> Kelime Defteri
                </button>
                <button 
                    onClick={() => setActiveTab('bank')}
                    className={`text-lg font-serif font-bold flex items-center gap-2 transition-colors ${activeTab === 'bank' ? 'text-white' : 'text-slate-500'}`}
                >
                    <FileText className={`w-5 h-5 ${activeTab === 'bank' ? 'text-amber-400' : 'text-slate-600'}`} /> Kelime Bankası
                </button>
           </div>
           <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
             <X size={24} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in">
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
            )}

            {/* SAVED VOCABULARY TAB */}
            {activeTab === 'vocab' && (
                <div className="animate-in fade-in">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Sohbetten Kaydedilenler</h3>
                    
                    {vocabulary.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-800/30 rounded-xl border border-slate-800 border-dashed">
                            Henüz sohbet sırasında hiç kelime kaydetmediniz.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {vocabulary.map((item) => (
                                <div key={item.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-start group hover:border-slate-600 transition-all">
                                    <div>
                                        <div className="font-bold text-purple-300 text-lg">{item.word}</div>
                                        <div className="text-slate-400 text-sm italic mt-1">"{item.context}"</div>
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
            )}

            {/* WORD BANK TAB */}
            {activeTab === 'bank' && (
                 <div className="animate-in fade-in flex flex-col gap-6">
                     
                     {/* Upload Area */}
                     <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700 border-dashed">
                         <input 
                             type="file" 
                             ref={fileInputRef} 
                             accept=".txt" 
                             onChange={handleFileUpload} 
                             className="hidden" 
                         />
                         <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                             <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-full">
                                    <Upload className="w-6 h-6 text-amber-500" />
                                </div>
                                <div>
                                    <h4 className="text-slate-200 font-bold flex items-center gap-2">
                                        Yeni Kelime Listesi Yükle
                                    </h4>
                                    <p className="text-slate-500 text-xs mt-1">Hızlı yükleme. Standart veya 'Kelime | Kategori | Seviye' formatı.</p>
                                </div>
                             </div>

                             <div className="flex items-center gap-2 w-full md:w-auto">
                                <select 
                                    value={uploadLevel}
                                    onChange={(e) => setUploadLevel(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 outline-none focus:border-amber-500"
                                >
                                    <option value="AUTO">Otomatik / Karışık</option>
                                    <option disabled>--- Seviye Seç ---</option>
                                    <option value="A1">A1 - Başlangıç</option>
                                    <option value="A2">A2 - Temel</option>
                                    <option value="B1">B1 - Orta</option>
                                    <option value="B2">B2 - İyi Orta</option>
                                    <option value="C1">C1 - İleri</option>
                                    <option value="C2">C2 - Uzman</option>
                                </select>

                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="whitespace-nowrap px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-amber-900/20"
                                >
                                    Dosya Seç
                                </button>
                             </div>
                         </div>
                     </div>

                     {/* AI Processing Control Panel */}
                     {customWords.length > 0 && (
                        <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 p-4 rounded-xl border border-indigo-500/30">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isProcessing ? 'bg-amber-500/20 animate-pulse' : 'bg-indigo-500/20'}`}>
                                        <Zap className={`w-5 h-5 ${isProcessing ? 'text-amber-400' : 'text-indigo-400'}`} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm">Yapay Zeka Kategorizasyonu</h4>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {isProcessing 
                                             ? `İşleniyor: ${processingProgress.current} / ${processingProgress.total}`
                                             : `Filtredeki kategorisiz kelime sayısı: ${uncategorizedCountInView}`
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isProcessing ? (
                                        <button 
                                            onClick={handleStopCategorization}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-red-900/20"
                                        >
                                            <StopCircle size={16} /> Durdur
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={handleStartCategorization}
                                            disabled={uncategorizedCountInView === 0}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-indigo-900/20"
                                            title="Şu an seçili olan filtrelere uyan, kategorisiz kelimeleri işlemeye başlar."
                                        >
                                            <Sparkles size={16} /> 
                                            {uncategorizedCountInView > 0 ? "Filtrelenenleri Kategorize Et" : "Kategorize Edilecek Yok"}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Progress Bar */}
                            {isProcessing && processingProgress.total > 0 && (
                                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                                    <div 
                                        className="h-full bg-amber-500 transition-all duration-300 ease-out"
                                        style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>
                     )}

                     {/* Main List Area */}
                     <div className="flex flex-col gap-4">
                         
                         {/* Controls Bar */}
                         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 gap-3">
                             
                             <div className="flex items-center gap-4 w-full sm:w-auto">
                                 {/* Level Filter */}
                                 <div className="flex items-center gap-2">
                                     <Filter size={16} className="text-slate-500" />
                                     <select 
                                        value={filterLevel}
                                        onChange={(e) => setFilterLevel(e.target.value)}
                                        className="bg-slate-900 text-sm text-slate-300 border border-slate-700 rounded-md py-1 px-2 outline-none cursor-pointer hover:text-white"
                                     >
                                         <option value="ALL">Tüm Seviyeler</option>
                                         <option value="A1">A1</option>
                                         <option value="A2">A2</option>
                                         <option value="B1">B1</option>
                                         <option value="B2">B2</option>
                                         <option value="C1">C1</option>
                                         <option value="C2">C2</option>
                                     </select>
                                 </div>

                                 {/* Category Filter */}
                                 <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                                     <Layers size={16} className="text-slate-500" />
                                     <select 
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="bg-slate-900 text-sm text-slate-300 border border-slate-700 rounded-md py-1 px-2 outline-none cursor-pointer hover:text-white max-w-[150px]"
                                     >
                                         <option value="ALL">Tüm Kategoriler</option>
                                         <option value="Uncategorized">Uncategorized (Kategorisiz)</option>
                                         {uniqueCategories.filter(c => c !== 'Uncategorized').map(cat => (
                                             <option key={cat} value={cat}>{cat}</option>
                                         ))}
                                     </select>
                                 </div>
                             </div>

                             <div className="flex items-center gap-2 ml-auto">
                                 {/* Export Button */}
                                 {customWords.length > 0 && (
                                     <button
                                         onClick={handleExportWordList}
                                         className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                         title="Listeyi kategorilerle birlikte indir (Export)"
                                     >
                                         <Download size={16} />
                                     </button>
                                 )}

                                 {filteredWords.length > 0 && (
                                    <button 
                                        onClick={() => onStartPractice(filteredWords)}
                                        className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition-colors shadow-lg shadow-emerald-900/20 whitespace-nowrap"
                                    >
                                        <PlayCircle size={14} /> 
                                        Seçimi Çalış ({filteredWords.length})
                                    </button>
                                 )}
                             </div>
                         </div>

                         {/* Words List Grid */}
                         {customWords.length > 0 ? (
                             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                 {filteredWords.map((cw) => (
                                     <div key={cw.id} className="group bg-slate-800/80 px-3 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm flex flex-col gap-1 hover:border-slate-500 transition-colors">
                                         <div className="flex items-center justify-between">
                                            <span className="font-medium truncate mr-2 text-white" title={cw.word}>{cw.word}</span>
                                            {cw.level && (
                                                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${getLevelColor(cw.level)} font-bold tracking-wide`}>
                                                    {cw.level}
                                                </span>
                                            )}
                                         </div>
                                         {cw.category && (
                                             <span className={`text-[10px] uppercase tracking-wider flex items-center gap-1 ${cw.category === 'Uncategorized' ? 'text-slate-600 italic' : 'text-slate-500'}`}>
                                                 <span className={`w-1 h-1 rounded-full ${cw.category === 'Uncategorized' ? 'bg-slate-700' : 'bg-slate-500'}`}></span> {cw.category}
                                             </span>
                                         )}
                                     </div>
                                 ))}
                                 {filteredWords.length === 0 && (
                                     <div className="col-span-full py-8 text-center text-slate-500 italic">
                                         Bu filtreye uygun kelime bulunamadı.
                                     </div>
                                 )}
                             </div>
                         ) : (
                             <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                                 <BookOpen className="w-12 h-12 text-slate-700 mb-3" />
                                 <p>Henüz kelime bankasına dosya yüklenmedi.</p>
                             </div>
                         )}

                     </div>
                 </div>
            )}

        </div>
      </div>
    </div>
  );
};