import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AppSettings, Message } from '../types';
import { Play, Pause, AlertCircle, Bot, User, TextSelect, Loader2, Eye, EyeOff, Lightbulb, LightbulbOff, BookmarkPlus, Check } from 'lucide-react';
import { generateSpeechFromText } from '../services/geminiService';
import { audioBufferToWavBlob } from '../utils/audioUtils';

interface ChatMessageProps {
  message: Message;
  audioContext: AudioContext | null;
  settings: AppSettings;
  onSaveVocabulary?: (word: string, context: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, audioContext, settings, onSaveVocabulary }) => {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingSelection, setIsPlayingSelection] = useState(false);
  const [isGeneratingSelection, setIsGeneratingSelection] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  
  // Toggle States
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  const [isHintsVisible, setIsHintsVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  // Use HTMLAudioElement for better pitch preservation during speed changes
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectionAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Cleanup audios on unmount or message change
    return () => {
      stopAudio();
      stopSelectionAudio();
    };
  }, [message.audioData]);

  // Main Message Audio Logic
  const playAudio = () => {
    if (!message.audioData) return;

    stopAudio();
    stopSelectionAudio();

    // Convert AudioBuffer to WAV Blob URL to use with HTMLAudioElement
    // This allows using 'preservesPitch' which is true by default on elements
    const wavBlob = audioBufferToWavBlob(message.audioData);
    const url = URL.createObjectURL(wavBlob);
    
    const audio = new Audio(url);
    audio.playbackRate = settings.speechSpeed || 1.0;
    // Explicitly set pitch preservation (though true is default)
    audio.preservesPitch = true;
    
    audio.onended = () => {
      setIsPlaying(false);
      URL.revokeObjectURL(url); // Cleanup
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

  // Selection Audio Logic
  const handleTextMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
      setIsSaved(false); 
    } else {
      setSelectedText('');
    }
  };

  const playSelectedText = async () => {
    if (!selectedText || !audioContext) return;
    
    setIsGeneratingSelection(true);
    stopAudio(); 
    stopSelectionAudio(); 

    try {
      const audioBuffer = await generateSpeechFromText(selectedText, settings, audioContext);
      
      if (audioBuffer) {
        const wavBlob = audioBufferToWavBlob(audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        
        const audio = new Audio(url);
        audio.playbackRate = settings.speechSpeed || 1.0;
        audio.preservesPitch = true;
        
        audio.onended = () => {
          setIsPlayingSelection(false);
          URL.revokeObjectURL(url);
        };

        audio.play();
        selectionAudioRef.current = audio;
        setIsPlayingSelection(true);
      }
    } catch (e) {
      console.error("Selection audio failed", e);
    } finally {
      setIsGeneratingSelection(false);
    }
  };

  const stopSelectionAudio = () => {
    if (selectionAudioRef.current) {
      selectionAudioRef.current.pause();
      selectionAudioRef.current = null;
    }
    setIsPlayingSelection(false);
  };

  const handleSaveVocab = () => {
      if (selectedText && onSaveVocabulary) {
          onSaveVocabulary(selectedText, message.text);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 2000);
      }
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-indigo-600' : 'bg-purple-900'}`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Message Bubble Container */}
        <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} w-full`}>
          
          {/* Main Bubble */}
          <div 
            onMouseUp={!isUser ? handleTextMouseUp : undefined}
            className={`rounded-2xl px-5 py-4 shadow-sm text-sm leading-relaxed w-full ${
            isUser 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none selection:bg-purple-500/50 selection:text-white'
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
                  
                  {/* Buttons Row */}
                  <div className="flex items-center gap-4">
                      {/* Translation Button */}
                      {message.translation && (
                        <button 
                            onClick={() => setIsTranslationVisible(!isTranslationVisible)}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-400/80 hover:text-emerald-300 transition-colors"
                        >
                            {isTranslationVisible ? <EyeOff size={14}/> : <Eye size={14}/>}
                            {isTranslationVisible ? 'Gizle' : 'Türkçe'}
                        </button>
                      )}

                      {/* Hints Button */}
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

                  {/* Content Areas */}
                  {isTranslationVisible && message.translation && (
                      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-200 italic animate-in fade-in slide-in-from-top-2 duration-300">
                          {message.translation}
                      </div>
                  )}

                  {isHintsVisible && message.hints && (
                      <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2 mb-1 text-amber-400 text-xs font-bold uppercase tracking-wider">
                              <Lightbulb size={12} /> İpuçları
                          </div>
                          <ReactMarkdown 
                            className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"
                           >
                              {message.hints}
                           </ReactMarkdown>
                      </div>
                  )}

              </div>
          )}

          {/* Controls Container */}
          {!isUser && (
            <div className="flex flex-wrap gap-2 items-center mt-1">
              {/* Main Audio Player */}
              {message.audioData && (
                 <button 
                   onClick={isPlaying ? stopAudio : playAudio}
                   disabled={isPlayingSelection}
                   className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-purple-500/50 transition-all text-xs font-medium text-purple-300 group disabled:opacity-50"
                 >
                   {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current" />}
                   {isPlaying ? 'Sesi Durdur' : 'Tamamını Oku'}
                   {isPlaying && (
                      <div className="flex gap-0.5 items-end h-3 ml-2">
                        <span className="w-0.5 bg-purple-400 animate-[bounce_1s_infinite] h-2"></span>
                        <span className="w-0.5 bg-purple-400 animate-[bounce_1.2s_infinite] h-3"></span>
                        <span className="w-0.5 bg-purple-400 animate-[bounce_0.8s_infinite] h-1.5"></span>
                      </div>
                   )}
                 </button>
              )}

              {/* Selection Controls */}
              {selectedText && (
                <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <button
                    onClick={isPlayingSelection ? stopSelectionAudio : playSelectedText}
                    disabled={isGeneratingSelection || isPlaying}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-pink-500/50 transition-all text-xs font-medium text-pink-300 group disabled:opacity-50"
                    >
                    {isGeneratingSelection ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : isPlayingSelection ? (
                        <Pause size={14} className="fill-current" />
                    ) : (
                        <TextSelect size={14} />
                    )}
                    {isGeneratingSelection ? '...' : isPlayingSelection ? 'Durdur' : 'Seçimi Oku'}
                    </button>

                    <button
                        onClick={handleSaveVocab}
                        disabled={isSaved}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs font-medium ${
                            isSaved 
                            ? 'bg-emerald-900/30 border-emerald-500 text-emerald-300' 
                            : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-blue-500/50 text-blue-300'
                        }`}
                    >
                        {isSaved ? <Check size={14} /> : <BookmarkPlus size={14} />}
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