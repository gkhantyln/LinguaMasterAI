import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, CustomWord, PracticeResult, CEFR_MAP } from '../types';
import { evaluateVocabularyPractice, generateSpeechFromText, getWordDetails } from '../services/geminiService';
import { audioBufferToWavBlob } from '../utils/audioUtils';
import { X, Mic, Volume2, ArrowRight, Check, Loader2, Square, Eye, EyeOff, Lightbulb, LightbulbOff, RefreshCw, Trophy } from 'lucide-react';

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  words: CustomWord[];
  settings: AppSettings;
  audioContext: AudioContext | null;
  onComplete: (score: number, wordsCount: number) => void;
}

export const PracticeModal: React.FC<PracticeModalProps> = ({
  isOpen, onClose, words, settings, audioContext, onComplete
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSentence, setUserSentence] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  
  // Hint & Translation States
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [wordDetails, setWordDetails] = useState<{translation: string, definition: string} | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
        setCurrentIndex(0);
        setTotalScore(0);
        resetStep();
    }
  }, [isOpen]);

  // Load details whenever word changes
  useEffect(() => {
      if (isOpen && words[currentIndex]) {
          const loadDetails = async () => {
              setIsLoadingDetails(true);
              setWordDetails(null);
              // Fetch translation and definition
              const details = await getWordDetails(words[currentIndex].word, settings.targetLanguage);
              setWordDetails(details);
              setIsLoadingDetails(false);
          };
          loadDetails();
      }
  }, [currentIndex, isOpen, words, settings.targetLanguage]);

  const resetStep = () => {
      setUserSentence('');
      setResult(null);
      setIsEvaluating(false);
      setIsTranslationVisible(false);
      setIsHintVisible(false);
  };

  if (!isOpen || words.length === 0) return null;

  const currentWord = words[currentIndex];

  const handlePlayWord = async () => {
      if (!audioContext) return;
      // Force slower speed for vocab pronunciation
      const tempSettings = { ...settings, speechSpeed: 0.8 };
      const buffer = await generateSpeechFromText(currentWord.word, tempSettings, audioContext);
      if (buffer) {
          const wavBlob = audioBufferToWavBlob(buffer);
          const audio = new Audio(URL.createObjectURL(wavBlob));
          audio.play();
      }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        alert("Ses tanıma bu modda henüz aktif değil. Lütfen cümlenizi yazın.");
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCheck = async () => {
      if (!userSentence.trim()) return;
      setIsEvaluating(true);
      
      const evalResult = await evaluateVocabularyPractice(
          currentWord.word, 
          userSentence, 
          settings.targetLanguage
      );
      
      setResult(evalResult);
      if (evalResult.isCorrect) {
          setTotalScore(prev => prev + evalResult.score);
      }
      setIsEvaluating(false);
  };

  const handleNext = () => {
      if (currentIndex < words.length - 1) {
          setCurrentIndex(prev => prev + 1);
          resetStep();
      } else {
          // Finish
          onComplete(Math.round(totalScore / words.length), words.length);
          onClose();
      }
  };

  const handleRetry = () => {
      setResult(null); // Sonucu temizle, tekrar denesin
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>

        <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900 z-20">
                <div className="flex items-center gap-3">
                    <Trophy className="text-amber-400 w-5 h-5" />
                    <div>
                        <h2 className="text-base font-bold text-white">Kelime Pratiği</h2>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                            Kelime {currentIndex + 1} / {words.length}
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                    <X size={18} />
                </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 flex flex-col p-6 items-center justify-start gap-6 relative overflow-y-auto custom-scrollbar">
                
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none z-0"></div>

                {/* --- TOP SECTION: WORD & HINTS --- */}
                <div className="flex flex-col items-center gap-4 z-10 w-full shrink-0">
                    
                    {/* Word Display */}
                    <div className="relative group cursor-pointer text-center" onClick={handlePlayWord}>
                        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300 drop-shadow-sm px-4">
                            {currentWord.word}
                        </h1>
                        <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Volume2 className="text-emerald-400 w-5 h-5" />
                        </div>
                    </div>
                    
                    {/* Level Badge */}
                    {currentWord.level && (
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-bold text-emerald-400 border border-slate-700">
                                {currentWord.level}
                            </span>
                            {CEFR_MAP[currentWord.level] && (
                                <span className="text-[10px] text-slate-500 font-medium border-l border-slate-700 pl-2">
                                    {CEFR_MAP[currentWord.level]}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Hint Buttons */}
                    <div className="flex gap-3 mt-1">
                        <button 
                            onClick={() => setIsTranslationVisible(!isTranslationVisible)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                                isTranslationVisible 
                                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                            disabled={isLoadingDetails}
                        >
                            {isTranslationVisible ? <EyeOff size={12}/> : <Eye size={12}/>}
                            Türkçe
                        </button>
                        <button 
                            onClick={() => setIsHintVisible(!isHintVisible)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                                isHintVisible 
                                ? 'bg-amber-900/40 border-amber-500 text-amber-300' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                            disabled={isLoadingDetails}
                        >
                            {isHintVisible ? <LightbulbOff size={12}/> : <Lightbulb size={12}/>}
                            Tanım
                        </button>
                    </div>

                    {/* Revealed Hints Area (Fixed Height or Auto) */}
                    <div className="w-full min-h-[1.5rem] flex flex-col items-center justify-center gap-1">
                        {isLoadingDetails && <Loader2 className="w-4 h-4 animate-spin text-slate-600"/>}
                        
                        {!isLoadingDetails && wordDetails && (
                            <>
                                {isTranslationVisible && (
                                    <div className="text-base font-bold text-emerald-300 animate-in fade-in slide-in-from-top-1">
                                        {wordDetails.translation}
                                    </div>
                                )}
                                {isHintVisible && (
                                    <div className="text-xs italic text-amber-200/80 text-center px-4 animate-in fade-in slide-in-from-top-1">
                                        "{wordDetails.definition}"
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* --- BOTTOM SECTION: INPUT OR RESULT --- */}
                <div className="w-full z-10 flex-1 flex flex-col justify-end">
                    
                    {!result ? (
                        /* INPUT MODE */
                        <div className="w-full space-y-3 animate-in fade-in duration-300">
                            <textarea 
                                value={userSentence}
                                onChange={(e) => setUserSentence(e.target.value)}
                                placeholder={`${currentWord.word} ile cümle kur...`}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none h-20 md:h-24"
                            />

                            <div className="flex gap-2">
                                <button 
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                                        isRecording 
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse w-12' 
                                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 w-12'
                                    }`}
                                >
                                    {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                                </button>

                                <button 
                                    onClick={handleCheck}
                                    disabled={!userSentence.trim() || isEvaluating}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold py-3 transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 text-sm"
                                >
                                    {isEvaluating ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
                                    {isEvaluating ? 'Kontrol Ediliyor...' : 'Kontrol Et'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* RESULT MODE (Replaces Input) */
                        <div className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-4 animate-in zoom-in-95 duration-300 flex flex-col gap-3">
                            {/* Score Header */}
                            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                <div className={`flex items-center gap-2 font-bold ${result.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {result.isCorrect ? <Check size={18} /> : <X size={18} />}
                                    {result.isCorrect ? 'Doğru!' : 'Geliştirilmeli'}
                                </div>
                                <div className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-slate-300">
                                    Puan: {result.score}
                                </div>
                            </div>

                            {/* User Sentence Recap */}
                            <div className="text-xs text-slate-400">
                                <span className="block opacity-50 mb-0.5">Senin Cümlen:</span>
                                <p className="text-slate-200 italic">"{userSentence}"</p>
                            </div>

                            {/* Feedback */}
                            <div className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                {result.feedback}
                            </div>

                            {/* Better Sentence */}
                            {result.betterSentence && (
                                <div className="text-xs">
                                    <span className="text-emerald-500 font-bold block mb-0.5">Örnek Doğrusu:</span>
                                    <p className="text-emerald-100/80 italic">{result.betterSentence}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 mt-2">
                                {!result.isCorrect && (
                                     <button 
                                        onClick={handleRetry}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <RefreshCw size={14} /> Tekrar Dene
                                    </button>
                                )}
                                <button 
                                    onClick={handleNext}
                                    className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
                                >
                                    {currentIndex < words.length - 1 ? "Sıradaki" : "Bitir"} <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    </div>
  );
};