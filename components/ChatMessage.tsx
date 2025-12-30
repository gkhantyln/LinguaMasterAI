
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AppSettings, Message } from '../types';
import { Play, Pause, AlertCircle, Bot, User, Loader2, Eye, EyeOff, Lightbulb, LightbulbOff, BookmarkPlus, Check, Hammer, Book, MessageSquareQuote, Flame, RefreshCw, X } from 'lucide-react';
import { audioBufferToWavBlob } from '../utils/audioUtils';
import { regenerateExampleAnswers } from '../services/geminiService';

interface ChatMessageProps {
  message: Message;
  audioContext: AudioContext | null;
  settings: AppSettings;
  onSaveVocabulary?: (word: string, context: string) => void;
}

// --- HINTS PARSER COMPONENT ---
interface HintsDisplayProps {
    initialHintsText: string;
    tutorQuestion: string;
    settings: AppSettings;
}

const HintsDisplay: React.FC<HintsDisplayProps> = ({ initialHintsText, tutorQuestion, settings }) => {
    const [currentHintsText, setCurrentHintsText] = useState(initialHintsText);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try {
            const newExamples = await regenerateExampleAnswers(tutorQuestion, settings);
            if (newExamples) {
                const structureMatch = currentHintsText.match(/\*\*Structure:\*\*(.*?)(?=\*\*Vocabulary:|\*\*Examples:|\*\*Example:|$)/s);
                const vocabMatch = currentHintsText.match(/\*\*Vocabulary:\*\*(.*?)(?=\*\*Examples:|\*\*Example:|$)/s);
                
                let newFullText = "";
                
                if (structureMatch) newFullText += `**Structure:**${structureMatch[1]}\n\n`;
                if (vocabMatch) newFullText += `**Vocabulary:**${vocabMatch[1]}\n\n`;
                
                newFullText += newExamples;
                
                setCurrentHintsText(newFullText);
            }
        } catch (error) {
            console.error("Regeneration failed", error);
        } finally {
            setIsRegenerating(false);
        }
    };

    const structureMatch = currentHintsText.match(/\*\*Structure:\*\*(.*?)(?=\*\*Vocabulary:|\*\*Examples:|\*\*Example:|$)/s);
    const vocabMatch = currentHintsText.match(/\*\*Vocabulary:\*\*(.*?)(?=\*\*Examples:|\*\*Example:|$)/s);
    const exampleMatch = currentHintsText.match(/\*\*Examples?:\*\*(.*?)(?=$)/s);

    const structure = structureMatch ? structureMatch[1].trim() : null;
    const vocab = vocabMatch ? vocabMatch[1].trim() : null;
    const rawExamples = exampleMatch ? exampleMatch[1].trim() : null;

    if (!structure && !vocab && !rawExamples) {
        return (
             <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200 animate-in fade-in slide-in-from-top-2 duration-300">
                <ReactMarkdown>{currentHintsText}</ReactMarkdown>
             </div>
        );
    }

    const examplesList = rawExamples 
        ? rawExamples.split('\n').filter(line => line.trim().length > 0) 
        : [];

    return (
        <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-top-2 duration-300">
            {structure && (
                <div className="flex flex-col bg-blue-950/40 border-l-4 border-blue-500 rounded-r-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-wider mb-1">
                        <Hammer size={12} /> Cümle Yapısı
                    </div>
                    <div className="text-blue-100 text-sm font-medium font-mono">
                        {structure}
                    </div>
                </div>
            )}

            {vocab && (
                <div className="flex flex-col bg-emerald-950/40 border-l-4 border-emerald-500 rounded-r-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
                        <Book size={12} /> Önerilen Kelimeler
                    </div>
                    <div className="text-emerald-100 text-sm leading-relaxed">
                        {vocab}
                    </div>
                </div>
            )}

            {(examplesList.length > 0 || isRegenerating) && (
                <div className="flex flex-col bg-amber-950/40 border-l-4 border-amber-500 rounded-r-lg p-3 shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                            <MessageSquareQuote size={12} /> Örnek Cevaplar
                        </div>
                        <button 
                            onClick={handleRegenerate}
                            disabled={isRegenerating}
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-900/30 hover:bg-amber-800/50 text-[10px] text-amber-200 hover:text-white transition-colors border border-amber-500/20 disabled:opacity-50"
                            title="Tutor'un sorusuna uygun yeni cevaplar üret"
                        >
                            <RefreshCw size={10} className={isRegenerating ? "animate-spin" : ""} />
                            {isRegenerating ? "Üretiliyor..." : "Yeni Cevaplar"}
                        </button>
                    </div>

                    {isRegenerating ? (
                        <div className="flex flex-col items-center justify-center py-6 gap-2 text-amber-500/50">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="text-xs">Soruya uygun yeni yanıtlar hazırlanıyor...</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {examplesList.map((line, idx) => {
                                const cleanLine = line.replace(/^\d+\.\s*/, '');
                                const isSlang = cleanLine.toLowerCase().includes('(slang)') || cleanLine.toLowerCase().includes('sokak ağzı');
                                
                                return (
                                    <div key={idx} className={`p-2 rounded border text-sm animate-in fade-in slide-in-from-left-2 duration-300 ${
                                        isSlang 
                                        ? 'bg-red-900/30 border-red-500/30 text-red-100 italic' 
                                        : 'bg-amber-900/20 border-amber-500/20 text-amber-100'
                                    }`} style={{ animationDelay: `${idx * 50}ms` }}>
                                        {isSlang && <Flame size={12} className="inline mr-1 text-red-400" />}
                                        {cleanLine}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


export const ChatMessage: React.FC<ChatMessageProps> = ({ message, audioContext, settings, onSaveVocabulary }) => {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  
  // Toggle States
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  const [isHintsVisible, setIsHintsVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [message.audioData]);

  const playAudio = () => {
    if (!message.audioData) return;

    stopAudio();

    const wavBlob = audioBufferToWavBlob(message.audioData);
    const url = URL.createObjectURL(wavBlob);
    
    const audio = new Audio(url);
    audio.playbackRate = settings.speechSpeed || 1.0;
    audio.preservesPitch = true;
    
    audio.onended = () => {
      setIsPlaying(false);
      URL.revokeObjectURL(url);
    };

    audio.play().catch(e => console.error("Playback failed", e));
    audioRef.current = audio;
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleTextMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      // 50 karakterden uzun seçimleri (muhtemelen tüm paragraf) yoksayabilir veya uyarabiliriz.
      // Şimdilik serbest bırakıyoruz.
      setSelectedText(selection.toString().trim());
      setIsSaved(false); 
    } else {
      // Don't clear immediately to allow button click if user clicked slightly outside
    }
  };

  const clearSelection = () => {
      setSelectedText('');
      window.getSelection()?.removeAllRanges();
  };

  const handleSaveVocab = () => {
      if (selectedText && onSaveVocabulary) {
          onSaveVocabulary(selectedText, message.text);
          setIsSaved(true);
          setTimeout(() => {
              setIsSaved(false);
              clearSelection();
          }, 1500);
      }
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-indigo-600' : 'bg-purple-900'}`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} w-full`}>
          
          {/* Main Bubble */}
          <div 
            onMouseUp={!isUser ? handleTextMouseUp : undefined}
            className={`rounded-2xl px-5 py-4 shadow-sm text-sm leading-relaxed w-full ${
            isUser 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none selection:bg-emerald-500/50 selection:text-white'
          }`}>
             {message.isError ? (
               <div className="flex items-center gap-2 text-red-400">
                 <AlertCircle size={16} />
                 <span>{message.text}</span>
               </div>
             ) : (
               <ReactMarkdown 
                className="prose prose-invert prose-sm max-w-none"
                components={{
                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />
                }}
               >
                 {message.text}
               </ReactMarkdown>
             )}
          </div>

          {/* HIDDEN CONTENT SECTION (Translation & Hints) */}
          {!isUser && (
              <div className="flex flex-col gap-2 w-full pl-1">
                  
                  <div className="flex items-center gap-4">
                      {message.translation && (
                        <button 
                            onClick={() => setIsTranslationVisible(!isTranslationVisible)}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-400/80 hover:text-emerald-300 transition-colors"
                        >
                            {isTranslationVisible ? <EyeOff size={14}/> : <Eye size={14}/>}
                            {isTranslationVisible ? 'Gizle' : 'Türkçe'}
                        </button>
                      )}

                      {message.hints && (
                        <button 
                            onClick={() => setIsHintsVisible(!isHintsVisible)}
                            className="flex items-center gap-1.5 text-xs font-medium text-amber-400/80 hover:text-amber-300 transition-colors"
                        >
                            {isHintsVisible ? <LightbulbOff size={14}/> : <Lightbulb size={14}/>}
                            {isHintsVisible ? 'İpucunu Kapat' : 'Nasıl Cevaplarım?'}
                        </button>
                      )}
                  </div>

                  {isTranslationVisible && message.translation && (
                      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-200 italic animate-in fade-in slide-in-from-top-2 duration-300">
                          {message.translation}
                      </div>
                  )}

                  {isHintsVisible && message.hints && (
                      <HintsDisplay 
                        initialHintsText={message.hints} 
                        tutorQuestion={message.text}
                        settings={settings}
                      />
                  )}

              </div>
          )}

          {/* Controls Container */}
          {!isUser && (
            <div className="flex flex-wrap gap-2 items-center mt-1 w-full relative">
              
              {/* Main Audio Player */}
              {message.audioData && !selectedText && (
                 <button 
                   onClick={isPlaying ? stopAudio : playAudio}
                   className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-purple-500/50 transition-all text-xs font-medium text-purple-300 group"
                 >
                   {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current" />}
                   {isPlaying ? 'Duraklat' : 'Dinle'}
                   {isPlaying && (
                      <div className="flex gap-0.5 items-end h-3 ml-2">
                        <span className="w-0.5 bg-purple-400 animate-[bounce_1s_infinite] h-2"></span>
                        <span className="w-0.5 bg-purple-400 animate-[bounce_1.2s_infinite] h-3"></span>
                        <span className="w-0.5 bg-purple-400 animate-[bounce_0.8s_infinite] h-1.5"></span>
                      </div>
                   )}
                 </button>
              )}

              {/* Selection SAVE Controls - Only visible when text selected */}
              {selectedText && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200 bg-slate-800 border border-emerald-500/30 rounded-full p-1 pr-3 shadow-lg">
                    <button
                        onClick={clearSelection}
                        className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="İptal"
                    >
                        <X size={14} />
                    </button>

                    <div className="h-4 w-px bg-slate-700"></div>

                    <span className="text-xs text-slate-300 max-w-[150px] truncate px-1 italic">
                        "{selectedText}"
                    </span>

                    <button
                        onClick={handleSaveVocab}
                        disabled={isSaved}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all text-xs font-bold ${
                            isSaved 
                            ? 'bg-emerald-600 border-emerald-500 text-white' 
                            : 'bg-emerald-900/40 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/60'
                        }`}
                    >
                        {isSaved ? <Check size={12} /> : <BookmarkPlus size={12} />}
                        {isSaved ? 'Kaydedildi' : 'Kaydet'}
                    </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
