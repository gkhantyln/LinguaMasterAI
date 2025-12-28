import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, DEFAULT_SETTINGS, Message, VocabularyItem, UserStats, DEFAULT_STATS } from './types';
import { SettingsPanel } from './components/SettingsPanel';
import { ChatMessage } from './components/ChatMessage';
import { InputArea } from './components/InputArea';
import { LiveSession } from './components/LiveSession';
import { DashboardModal } from './components/DashboardModal';
import { sendMessageToGemini, generateSpeechFromText } from './services/geminiService';
import { GraduationCap, Activity, Key, Headset, Loader2, BookOpen, Github, Linkedin, Mail } from 'lucide-react';

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

  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('lingua_stats');
    return saved ? JSON.parse(saved) : DEFAULT_STATS;
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
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
    localStorage.setItem('lingua_stats', JSON.stringify(stats));
  }, [stats]);

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

  const handleSaveVocabulary = (word: string, context: string) => {
      const newItem: VocabularyItem = {
          id: Date.now().toString(),
          word,
          translation: '', // Kullanıcı sonradan ekleyebilir veya AI ile bulabiliriz
          context,
          timestamp: Date.now()
      };
      setVocabulary(prev => [newItem, ...prev]);
      setStats(prev => ({ ...prev, vocabularyCount: prev.vocabularyCount + 1 }));
  };

  const handleDeleteVocabulary = (id: string) => {
      setVocabulary(prev => prev.filter(item => item.id !== id));
      setStats(prev => ({ ...prev, vocabularyCount: Math.max(0, prev.vocabularyCount - 1) }));
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
      setStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
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

        // İstatistik güncelleme (Hata düzeltme yapıldıysa varsayım)
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
          // data:audio/webm;base64,.... kısmını temizle
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
                 Language Tutor
               </span>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex gap-2">
             {hasApiKey && (
                 <>
                    <button 
                        onClick={() => setIsLiveSessionOpen(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/30 transition-all font-medium text-sm border border-emerald-400/20 hover:scale-105 active:scale-95 group"
                    >
                        <Headset className="w-4 h-4 group-hover:animate-bounce" />
                        <span className="hidden md:inline">Canlı Ders</span>
                    </button>
                    
                    <button 
                        onClick={() => setIsDashboardOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full border border-slate-700 transition-all font-medium text-sm hover:scale-105 active:scale-95"
                    >
                        <BookOpen className="w-4 h-4" />
                        <span className="hidden md:inline">Profil</span>
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
         onDeleteVocab={handleDeleteVocabulary}
      />

      {isLiveSessionOpen && (
          <LiveSession 
            settings={settings}
            onClose={() => {
                setIsLiveSessionOpen(false);
                setStats(prev => ({...prev, sessionsCompleted: prev.sessionsCompleted + 1}));
            }}
          />
      )}
    </div>
  );
};

export default App;