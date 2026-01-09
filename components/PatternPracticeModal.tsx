
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, DailyPattern, Message } from '../types';
import { generateDailyPatterns, sendMessageToPatternPractice, resetPatternHistory, generateSpeechFromText } from '../services/geminiService';
import { X, Sparkles, RefreshCw, MessageCircle, ArrowRight, BookOpen, Send, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';

interface PatternPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  audioContext: AudioContext | null; // NEW
  onSaveVocabulary: (word: string, context: string) => void; // NEW
}

export const PatternPracticeModal: React.FC<PatternPracticeModalProps> = ({ 
    isOpen, onClose, settings, audioContext, onSaveVocabulary 
}) => {
  const [patterns, setPatterns] = useState<DailyPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePattern, setActivePattern] = useState<DailyPattern | null>(null);
  
  // Chat States - Now using full Message type
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && patterns.length === 0) {
        loadPatterns();
    }
  }, [isOpen]);

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadPatterns = async () => {
      setIsLoading(true);
      const newPatterns = await generateDailyPatterns(settings);
      setPatterns(newPatterns);
      setIsLoading(false);
  };

  const handleSelectPattern = async (pattern: DailyPattern) => {
      setActivePattern(pattern);
      setChatMessages([]);
      setIsChatLoading(true);
      
      const response = await sendMessageToPatternPractice("", pattern, settings, true);
      
      const startMsg: Message = {
          id: Date.now().toString(),
          role: 'model',
          text: response.text,
          translation: response.translation,
          hints: response.hints,
          timestamp: Date.now()
      };

      if (settings.voiceOutput && audioContext) {
          const audioBuffer = await generateSpeechFromText(response.text, settings, audioContext);
          if (audioBuffer) startMsg.audioData = audioBuffer;
      }

      setChatMessages([startMsg]);
      setIsChatLoading(false);
  };

  const handleSendMessage = async () => {
      if (!inputText.trim() || !activePattern) return;
      
      const userMsgText = inputText;
      setInputText(""); // Clear input immediately
      
      const userMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          text: userMsgText,
          timestamp: Date.now()
      };

      setChatMessages(prev => [...prev, userMsg]);
      setIsChatLoading(true);

      const response = await sendMessageToPatternPractice(userMsgText, activePattern, settings, false);
      
      const modelMsgId = (Date.now() + 1).toString();
      const modelMsg: Message = {
          id: modelMsgId,
          role: 'model',
          text: response.text,
          translation: response.translation,
          hints: response.hints,
          timestamp: Date.now()
      };

      setChatMessages(prev => [...prev, modelMsg]);

      // Generate Audio separately to not block UI rendering
      if (settings.voiceOutput && audioContext) {
          generateSpeechFromText(response.text, settings, audioContext).then(audioBuffer => {
              if (audioBuffer) {
                  setChatMessages(prev => prev.map(m => 
                      m.id === modelMsgId ? { ...m, audioData: audioBuffer } : m
                  ));
              }
          });
      }

      setIsChatLoading(false);
  };

  const handleBackToList = () => {
      setActivePattern(null);
      resetPatternHistory();
  };

  const handleRefreshPatterns = () => {
      setPatterns([]);
      loadPatterns();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 font-sans">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose}></div>

        <div className="relative w-full max-w-5xl h-[85vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg shadow-lg shadow-rose-500/20">
                        <Sparkles className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Cümle Kalıpları</h2>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                            {activePattern ? 'Diyalog Pratiği' : 'Günün Kalıpları'} • {settings.targetLanguage}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!activePattern && (
                        <button onClick={handleRefreshPatterns} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Yeni Kalıplar">
                            <RefreshCw size={20} />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
                        <p className="text-slate-400 animate-pulse">Seviyenize uygun kalıplar hazırlanıyor...</p>
                    </div>
                ) : !activePattern ? (
                    /* LIST VIEW */
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto h-full custom-scrollbar">
                        {patterns.map((p) => (
                            <div 
                                key={p.id} 
                                onClick={() => handleSelectPattern(p)}
                                className="group relative bg-slate-900 border border-slate-800 hover:border-pink-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-[0_0_20px_rgba(236,72,153,0.15)] hover:-translate-y-1 flex flex-col justify-between gap-4"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{p.level || 'General'}</span>
                                        <ArrowRight size={16} className="text-slate-600 group-hover:text-pink-400 transition-colors" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-pink-300 transition-colors">{p.pattern}</h3>
                                    <p className="text-sm text-slate-400 font-medium italic">{p.meaning}</p>
                                </div>
                                
                                <div className="space-y-3 pt-3 border-t border-slate-800/50">
                                    <p className="text-xs text-slate-500 leading-relaxed">{p.explanation}</p>
                                    <div className="bg-slate-800/50 p-2 rounded text-xs text-slate-300 border-l-2 border-pink-500">
                                        "{p.exampleSentence}"
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* PRACTICE VIEW */
                    <div className="flex h-full flex-col md:flex-row">
                        {/* Sidebar Info */}
                        <div className="w-full md:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
                            <button onClick={handleBackToList} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider mb-2">
                                <ArrowRight className="rotate-180" size={14} /> Listeye Dön
                            </button>
                            
                            <div>
                                <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2">{activePattern.pattern}</h3>
                                <p className="text-pink-400 font-medium text-lg">{activePattern.meaning}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><BookOpen size={12}/> Açıklama</h4>
                                    <p className="text-sm text-slate-300 leading-relaxed">{activePattern.explanation}</p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><MessageCircle size={12}/> Örnek</h4>
                                    <p className="text-sm text-white font-medium mb-1">"{activePattern.exampleSentence}"</p>
                                    <p className="text-xs text-slate-400 italic">{activePattern.exampleTranslation}</p>
                                </div>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col bg-slate-950 relative">
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
                                {chatMessages.map((msg) => (
                                    <ChatMessage 
                                        key={msg.id}
                                        message={msg}
                                        audioContext={audioContext}
                                        settings={settings}
                                        onSaveVocabulary={onSaveVocabulary}
                                    />
                                ))}
                                {isChatLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800/50 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-700/50 flex items-center gap-2">
                                            <Loader2 size={16} className="text-pink-500 animate-spin" />
                                            <span className="text-xs text-slate-400 font-medium">Yazıyor...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                                <div className="relative flex items-center">
                                    <input 
                                        type="text" 
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Kalıbı kullanarak cevap yaz..."
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                                        disabled={isChatLoading}
                                    />
                                    <button 
                                        onClick={handleSendMessage}
                                        disabled={!inputText.trim() || isChatLoading}
                                        className="absolute right-2 p-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors disabled:bg-slate-700 disabled:text-slate-500"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
