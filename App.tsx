
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, DEFAULT_SETTINGS, Message, VocabularyItem, UserStats, DEFAULT_STATS, CustomWord, Quest, DailyStat } from './types';
import { BADGE_DEFINITIONS, DAILY_QUEST_TEMPLATES } from './constants';
import { SettingsPanel } from './components/SettingsPanel';
import { ChatMessage } from './components/ChatMessage';
import { InputArea } from './components/InputArea';
import { LiveSession } from './components/LiveSession';
import { DashboardModal } from './components/DashboardModal';
import { PracticeModal } from './components/PracticeModal';
import { GameArenaModal } from './components/GameArenaModal';
import { StoryModeModal } from './components/StoryModeModal';
import { sendMessageToGemini, generateSpeechFromText } from './services/geminiService';
import { GraduationCap, Activity, Key, Headset, Loader2, BookOpen, Github, Linkedin, Mail, Gamepad2, Book } from 'lucide-react';

const App: React.FC = () => {
  // State initialization with LocalStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('lingua_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>(() => {
    const saved = localStorage.getItem('lingua_vocab');
    return saved ? JSON.parse(saved) : [];
  });

  const [customWords, setCustomWords] = useState<CustomWord[]>(() => {
    const saved = localStorage.getItem('lingua_custom_words');
    return saved ? JSON.parse(saved) : [];
  });

  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('lingua_stats');
    const loadedStats = saved ? JSON.parse(saved) : DEFAULT_STATS;
    // Merge with defaults to ensure new fields (streak, quests, dailyActivity) exist if loading old data
    return { 
        ...DEFAULT_STATS, 
        ...loadedStats, 
        dailyActivity: loadedStats.dailyActivity || [] 
    };
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);
  const [isGameArenaOpen, setIsGameArenaOpen] = useState(false);
  const [isStoryModeOpen, setIsStoryModeOpen] = useState(false);
  
  const [practiceWords, setPracticeWords] = useState<CustomWord[]>([]);

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('lingua_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('lingua_vocab', JSON.stringify(vocabulary));
  }, [vocabulary]);

  useEffect(() => {
    localStorage.setItem('lingua_custom_words', JSON.stringify(customWords));
  }, [customWords]);

  useEffect(() => {
    localStorage.setItem('lingua_stats', JSON.stringify(stats));
  }, [stats]);

  // --- STREAK & QUEST INITIALIZATION LOGIC ---
  useEffect(() => {
      const today = new Date().toISOString().split('T')[0];
      const lastDate = stats.lastLoginDate;

      let newStreak = stats.currentStreak;
      
      // Streak Check
      if (lastDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (lastDate === yesterdayStr) {
              newStreak += 1; // Consecutive day
          } else {
              newStreak = 1; // Streak broken or first time
          }
      }

      // Quest Reset Check
      let currentQuests = [...stats.dailyQuests];
      if (stats.lastQuestDate !== today) {
          // Generate 3 random quests
          const shuffled = [...DAILY_QUEST_TEMPLATES].sort(() => 0.5 - Math.random());
          currentQuests = shuffled.slice(0, 3).map(t => ({
              ...t,
              progress: 0,
              isCompleted: false
          }));
      }

      setStats(prev => ({
          ...prev,
          lastLoginDate: today,
          currentStreak: newStreak,
          maxStreak: Math.max(prev.maxStreak, newStreak),
          dailyQuests: currentQuests,
          lastQuestDate: today
      }));

  }, []); // Run once on mount

  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000, 
    });
    setAudioContext(ctx);

    const initialMessage: Message = {
      id: 'init-1',
      role: 'system',
      text: "**LinguaMaster'a Hoş Geldiniz.**\n\nBen yapay zeka destekli dil öğretmeninizim. Sağ üstteki menüden hedef dili ve seviyenizi seçebilirsiniz.\n\nPratik yapmak için ister yazın, isterseniz **Mikrofon** ikonuna basıp konuşun.",
      timestamp: Date.now()
    };
    setMessages([initialMessage]);

    return () => {
      ctx.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // --- ANALYTICS HELPER ---
  const updateDailyActivity = (updates: Partial<DailyStat>) => {
      setStats(prev => {
          const today = new Date().toISOString().split('T')[0];
          const newActivity = [...prev.dailyActivity];
          const todayIndex = newActivity.findIndex(a => a.date === today);

          if (todayIndex >= 0) {
              newActivity[todayIndex] = {
                  ...newActivity[todayIndex],
                  messageCount: newActivity[todayIndex].messageCount + (updates.messageCount || 0),
                  wordsLearned: newActivity[todayIndex].wordsLearned + (updates.wordsLearned || 0),
                  minutesSpent: newActivity[todayIndex].minutesSpent + (updates.minutesSpent || 0)
              };
          } else {
              newActivity.push({
                  date: today,
                  messageCount: updates.messageCount || 0,
                  wordsLearned: updates.wordsLearned || 0,
                  minutesSpent: updates.minutesSpent || 0
              });
          }

          // Keep last 30 days
          if (newActivity.length > 30) {
              newActivity.shift();
          }

          return { ...prev, dailyActivity: newActivity };
      });
  };


  // --- GAMIFICATION HELPERS ---
  const checkBadges = (currentStats: UserStats): string[] => {
      const newBadges: string[] = [];
      BADGE_DEFINITIONS.forEach(badge => {
          if (!currentStats.badges.includes(badge.id)) {
              if (currentStats[badge.conditionType] >= badge.threshold) {
                  newBadges.push(badge.id);
                  // Notify user
                  setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      role: 'system',
                      text: `🎉 **TEBRİKLER! YENİ ROZET KAZANDINIZ:** ${badge.name} ${badge.icon === 'Flame' ? '🔥' : '🏆'}\n\n${badge.description}`,
                      timestamp: Date.now()
                  }]);
              }
          }
      });
      return newBadges;
  };

  const updateProgress = (type: Quest['type'], amount: number = 1) => {
      setStats(prev => {
          // 1. Update Core Stats
          const newStats = { ...prev };
          
          // 2. Update Quests
          const updatedQuests = newStats.dailyQuests.map(q => {
              if (q.type === type && !q.isCompleted) {
                  const newProgress = Math.min(q.target, q.progress + amount);
                  const completed = newProgress >= q.target;
                  if (completed && !q.isCompleted) {
                      // Quest completed just now
                      newStats.currentXP += q.xpReward;
                       setMessages(prevMessages => [...prevMessages, {
                          id: Date.now().toString(),
                          role: 'system',
                          text: `✅ **GÜNLÜK GÖREV TAMAMLANDI:** ${q.description} (+${q.xpReward} XP)`,
                          timestamp: Date.now()
                      }]);
                  }
                  return { ...q, progress: newProgress, isCompleted: completed };
              }
              return q;
          });
          newStats.dailyQuests = updatedQuests;

          // 3. Level Up Check (Simple logic: Level = XP / 1000)
          const newLevel = Math.floor(newStats.currentXP / 1000) + 1;
          if (newLevel > newStats.level) {
               newStats.level = newLevel;
               setMessages(prevMessages => [...prevMessages, {
                  id: Date.now().toString(),
                  role: 'system',
                  text: `🚀 **SEVİYE ATLADIN!** Artık Seviye ${newLevel} oldun!`,
                  timestamp: Date.now()
              }]);
          }

          // 4. Check Badges
          const unlockedBadges = checkBadges(newStats);
          newStats.badges = [...newStats.badges, ...unlockedBadges];

          return newStats;
      });
  };

  const handleSaveVocabulary = (word: string, context: string) => {
      const newItem: VocabularyItem = {
          id: Date.now().toString(),
          word,
          translation: '', // Kullanıcı sonradan ekleyebilir veya AI ile bulabiliriz
          context,
          timestamp: Date.now()
      };
      setVocabulary(prev => [newItem, ...prev]);
      
      setStats(prev => {
          const next = { ...prev, vocabularyCount: prev.vocabularyCount + 1 };
          return next;
      });
      updateProgress('vocab', 1);
      updateDailyActivity({ wordsLearned: 1 });
  };

  const handleDeleteVocabulary = (id: string) => {
      setVocabulary(prev => prev.filter(item => item.id !== id));
      setStats(prev => ({ ...prev, vocabularyCount: Math.max(0, prev.vocabularyCount - 1) }));
  };

  // --- Practice Logic ---
  const handleUploadWords = (newWords: CustomWord[]) => {
      setCustomWords(prev => [...prev, ...newWords]);
  };

  const handleUpdateWordList = (updatedWords: CustomWord[]) => {
      setCustomWords(updatedWords);
  };

  const startPractice = (words: CustomWord[]) => {
      const shuffled = [...words].sort(() => 0.5 - Math.random());
      setPracticeWords(shuffled.slice(0, 10)); // Her seferinde 10 kelime
      setIsDashboardOpen(false);
      setIsPracticeOpen(true);
  };

  const handlePracticeComplete = (score: number, wordsCount: number) => {
      setStats(prev => ({
          ...prev,
          practiceScoreTotal: prev.practiceScoreTotal + score,
          wordsPracticed: prev.wordsPracticed + wordsCount
      }));
      // Practice counts as XP maybe? Let's give flat XP
      setStats(prev => ({ ...prev, currentXP: prev.currentXP + 20 }));
  };

  const handleGameStatsUpdate = (points: number) => {
      setStats(prev => ({
          ...prev,
          totalGamePoints: (prev.totalGamePoints || 0) + points
      }));
      updateProgress('game_points', points);
  };

  // New: Story Complete
  const handleStoryComplete = () => {
      setStats(prev => ({
          ...prev,
          storiesCompleted: (prev.storiesCompleted || 0) + 1
      }));
      updateProgress('session', 1);
      updateDailyActivity({ minutesSpent: 10 }); // Approx
  };

  const processResponse = async (input: string | { audioBase64: string, mimeType: string }) => {
     if (!process.env.API_KEY) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          text: 'API Anahtarı eksik.',
          timestamp: Date.now(),
          isError: true
        }]);
        return;
      }
  
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }
  
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: typeof input === 'string' ? input : "🎤 [Sesli Mesaj]",
        timestamp: Date.now()
      };
  
      setMessages(prev => [...prev, userMsg]);
      
      // Update Message Stats & Quests & Analytics
      setStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
      updateProgress('message', 1);
      updateDailyActivity({ messageCount: 1 });

      setIsLoading(true);
  
      try {
        const result = await sendMessageToGemini(input, settings);
        
        const modelMsgId = (Date.now() + 1).toString();
        const modelMsg: Message = {
          id: modelMsgId,
          role: 'model',
          text: result.text,
          translation: result.translation, 
          hints: result.hints, // İpuçları eklendi
          timestamp: Date.now()
        };

        if (result.text.includes("Did you mean") || result.text.includes("Correction:")) {
            setStats(prev => ({ ...prev, totalErrorsFixed: prev.totalErrorsFixed + 1 }));
        }
  
        setMessages(prev => [...prev, modelMsg]);
  
        if (settings.voiceOutput && audioContext) {
          const audioBuffer = await generateSpeechFromText(result.text, settings, audioContext);
          if (audioBuffer) {
            setMessages(prev => prev.map(m => 
              m.id === modelMsgId ? { ...m, audioData: audioBuffer } : m
            ));
          }
        }
  
      } catch (error) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          text: "Hata oluştu. Lütfen tekrar deneyin.",
          timestamp: Date.now(),
          isError: true
        }]);
      } finally {
        setIsLoading(false);
      }
  };

  const handleSendMessage = (text: string) => {
      processResponse(text);
  };

  const handleSendAudio = (audioBlob: Blob) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          const mimeType = audioBlob.type || 'audio/webm';
          
          processResponse({ audioBase64: base64Data, mimeType });
      };
      reader.readAsDataURL(audioBlob);
  };

  const hasApiKey = !!process.env.API_KEY;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-black pointer-events-none z-0"></div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md min-h-[72px]">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-500/20 shrink-0">
             <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-wide text-slate-100">LinguaMaster AI</h1>
            <div className="flex items-center gap-2">
               <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                 Language Tutor • Lvl {stats.level}
               </span>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex gap-2">
             {hasApiKey && (
                 <>
                    <button 
                        onClick={() => setIsLiveSessionOpen(true)}
                        className="flex items-center gap-2 px-4 md:px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/30 transition-all font-medium text-sm border border-emerald-400/20 hover:scale-105 active:scale-95 group"
                    >
                        <Headset className="w-4 h-4 group-hover:animate-bounce" />
                        <span className="hidden md:inline">Canlı Ders</span>
                    </button>

                    <button 
                        onClick={() => setIsGameArenaOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/30 transition-all font-medium text-sm border border-indigo-400/20 hover:scale-105 active:scale-95 group"
                        title="Oyun Arenası"
                    >
                        <Gamepad2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        <span className="hidden md:inline">Oyun</span>
                    </button>

                    <button 
                        onClick={() => setIsStoryModeOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-full shadow-lg shadow-amber-600/30 transition-all font-medium text-sm border border-amber-400/20 hover:scale-105 active:scale-95 group"
                        title="İnteraktif Hikaye Modu"
                    >
                        <Book className="w-4 h-4" />
                        <span className="hidden md:inline">Hikaye</span>
                    </button>
                    
                    <button 
                        onClick={() => setIsDashboardOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full border border-slate-700 transition-all font-medium text-sm hover:scale-105 active:scale-95 relative"
                    >
                        <BookOpen className="w-4 h-4" />
                        <span className="hidden md:inline">Profil</span>
                        {/* Notification Dot if quests available */}
                        {stats.dailyQuests.some(q => !q.isCompleted) && (
                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900"></span>
                        )}
                    </button>
                 </>
             )}
        </div>

        <div className="flex items-center gap-4 flex-1 justify-end">
            {!hasApiKey && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-900/30 border border-red-800 rounded text-xs text-red-200">
                <Key className="w-3 h-3" /> <span className="hidden sm:inline">API Eksik</span>
              </div>
            )}
            <div className="w-8"></div>
        </div>
      </header>

      {/* Main Chat */}
      <main className="relative z-10 flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
          <div className="max-w-4xl mx-auto w-full pb-8">
            {messages.map((msg) => (
              <ChatMessage 
                key={msg.id} 
                message={msg} 
                audioContext={audioContext}
                settings={settings}
                onSaveVocabulary={handleSaveVocabulary}
              />
            ))}
            {isLoading && (
               <div className="flex justify-start w-full">
                 <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 rounded-2xl rounded-tl-none border border-slate-700/50">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span className="text-xs text-slate-400 font-medium">Writing response...</span>
                 </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <InputArea 
          onSendMessage={handleSendMessage} 
          onSendAudio={handleSendAudio}
          isLoading={isLoading} 
          disabled={!hasApiKey}
        />
      </main>

      {/* Footer */}
      <footer className="relative z-20 bg-slate-950 border-t border-slate-800/50 py-3 px-6 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.5)]">
         <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
             <div className="flex items-center gap-2 text-slate-500">
                 <span className="text-slate-400 font-medium">Gökhan Taylan</span>
                 <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                 <span>LinguaMaster AI Developer</span>
             </div>

             <div className="flex items-center gap-5">
                 <a href="https://github.com/gkhantyln" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors group">
                     <Github size={14} className="group-hover:scale-110 transition-transform" />
                     <span>GitHub</span>
                 </a>
                 <a href="https://www.linkedin.com/in/gkhantyln/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-slate-500 hover:text-[#0077b5] transition-colors group">
                     <Linkedin size={14} className="group-hover:scale-110 transition-transform" />
                     <span>LinkedIn</span>
                 </a>
                 <a href="mailto:tylngkhn@gmail.com" className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 transition-colors group">
                     <Mail size={14} className="group-hover:scale-110 transition-transform" />
                     <span>Email</span>
                 </a>
             </div>
         </div>
      </footer>

      <SettingsPanel 
        settings={settings} 
        onSettingsChange={setSettings} 
        isOpen={isSettingsOpen} 
        onToggle={() => setIsSettingsOpen(!isSettingsOpen)} 
      />
    
      <DashboardModal
         isOpen={isDashboardOpen}
         onClose={() => setIsDashboardOpen(false)}
         stats={stats}
         vocabulary={vocabulary}
         customWords={customWords}
         onDeleteVocab={handleDeleteVocabulary}
         onUploadWords={handleUploadWords}
         onUpdateWordList={handleUpdateWordList}
         onStartPractice={startPractice}
      />

      {isLiveSessionOpen && (
          <LiveSession 
            settings={settings}
            onClose={() => {
                setIsLiveSessionOpen(false);
                setStats(prev => ({...prev, sessionsCompleted: prev.sessionsCompleted + 1}));
                updateProgress('session', 1);
                updateDailyActivity({ minutesSpent: 15 }); // Approx
            }}
            onSaveVocabulary={handleSaveVocabulary}
            onOpenGameArena={() => {
                setIsLiveSessionOpen(false);
                setIsGameArenaOpen(true);
            }}
          />
      )}

      {isPracticeOpen && (
          <PracticeModal 
            isOpen={isPracticeOpen}
            onClose={() => setIsPracticeOpen(false)}
            words={practiceWords}
            settings={settings}
            audioContext={audioContext}
            onComplete={handlePracticeComplete}
          />
      )}

      {isGameArenaOpen && (
          <GameArenaModal 
            isOpen={isGameArenaOpen}
            onClose={() => setIsGameArenaOpen(false)}
            vocabulary={vocabulary}
            settings={settings}
            onUpdateStats={handleGameStatsUpdate}
          />
      )}

      {/* STORY MODE MODAL */}
      {isStoryModeOpen && (
          <StoryModeModal
             isOpen={isStoryModeOpen}
             onClose={() => setIsStoryModeOpen(false)}
             settings={settings}
             onComplete={handleStoryComplete}
          />
      )}
    </div>
  );
};

export default App;
