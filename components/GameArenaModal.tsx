
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VocabularyItem, AppSettings, GameMode, GameQuestion, CustomWord, CEFR_MAP } from '../types';
import { generateGameContent, generateSpeechFromText } from '../services/geminiService';
import { audioBufferToWavBlob } from '../utils/audioUtils';
import { 
    Gamepad2, X, Check, ArrowRight, RefreshCw, Trophy, Loader2, 
    Target, Type, Move, Star, Lightbulb, List, Mic, Volume2, Ear, Play, ArrowLeft, Filter, BookOpen, FileText, GraduationCap
} from 'lucide-react';

interface GameArenaModalProps {
  isOpen: boolean;
  onClose: () => void;
  vocabulary: VocabularyItem[];
  customWords: CustomWord[]; // Added customWords support
  settings: AppSettings;
  onUpdateStats: (points: number) => void;
}

// Simple sound synthesis for UI effects (without external assets)
const playSound = (type: 'correct' | 'wrong' | 'click') => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'wrong') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.type = 'sawtooth';
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } else {
        // click
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    }
};

const getLevelColor = (level?: string) => {
    switch(level) {
        case 'A1': return 'bg-green-500/20 text-green-300 border-green-500/30';
        case 'A2': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        case 'B1': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        case 'B2': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
        case 'C1': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
        case 'C2': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
        default: return 'bg-slate-700/50 text-slate-400 border-slate-600';
    }
};

export const GameArenaModal: React.FC<GameArenaModalProps> = ({
  isOpen, onClose, vocabulary, customWords, settings, onUpdateStats
}) => {
  // Steps: 'selection' -> 'mode' -> 'loading' -> 'playing' -> 'result'
  const [step, setStep] = useState<'selection' | 'mode' | 'loading' | 'playing' | 'result'>('selection');
  
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>(GameMode.Matching);
  
  // Selection Filters
  const [filterSource, setFilterSource] = useState<'ALL' | 'SAVED' | 'BANK'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterLevel, setFilterLevel] = useState<string>('ALL'); // NEW LEVEL FILTER

  const [gameQuestions, setGameQuestions] = useState<GameQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  
  // Hint State
  const [hintRevealed, setHintRevealed] = useState(false);

  // -- Game Specific States --
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null); // For Matching Game
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  
  const [scrambleOrder, setScrambleOrder] = useState<string[]>([]); // For Scramble Game
  const [scrambleStatus, setScrambleStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');

  // Speaking Game States
  const [isListeningForSpeech, setIsListeningForSpeech] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const recognitionRef = useRef<any>(null);

  // Listening Game States
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Audio Context for TTS
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);

  useEffect(() => {
    if (isOpen) {
        setStep('selection');
        setSelectedWordIds(new Set());
        setScore(0);
        setStreak(0);
        setMatchedPairs(new Set());
        setHintRevealed(false);
        setAudioCtx(new (window.AudioContext || (window as any).webkitAudioContext)());
        
        // Reset filters
        setFilterSource('ALL');
        setFilterCategory('ALL');
        setFilterLevel('ALL');
    }
    return () => {
        if (audioCtx) audioCtx.close();
    }
  }, [isOpen]);

  // -- Data Merging Logic --
  // We merge chat vocabulary and bank words into a single list for selection
  const allDisplayWords = useMemo(() => {
      const savedItems = vocabulary.map(v => ({
          id: v.id,
          word: v.word,
          source: 'SAVED' as const,
          category: 'Chat Vocabulary',
          level: undefined // Saved words usually don't have level data unless we enrich them
      }));

      const bankItems = customWords.map(w => ({
          id: w.id,
          word: w.word,
          source: 'BANK' as const,
          category: w.category || 'Uncategorized',
          level: w.level // Include Level
      }));

      return [...savedItems, ...bankItems];
  }, [vocabulary, customWords]);

  // -- Filter Logic --
  const uniqueCategories = useMemo(() => {
      const cats = new Set<string>();
      allDisplayWords.forEach(w => {
          // Only show categories relevant to the selected source filter
          if (filterSource === 'ALL' || w.source === filterSource) {
              cats.add(w.category);
          }
      });
      return Array.from(cats).sort();
  }, [allDisplayWords, filterSource]);

  const filteredWords = useMemo(() => {
      return allDisplayWords.filter(w => {
          if (filterSource !== 'ALL' && w.source !== filterSource) return false;
          if (filterCategory !== 'ALL' && w.category !== filterCategory) return false;
          if (filterLevel !== 'ALL' && w.level !== filterLevel) return false; // Filter by Level
          return true;
      });
  }, [allDisplayWords, filterSource, filterCategory, filterLevel]);


  if (!isOpen) return null;

  // -- 1. Selection Logic --
  const toggleWordSelection = (id: string) => {
      const newSet = new Set(selectedWordIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedWordIds(newSet);
  };

  const selectAllFiltered = () => {
      const newSet = new Set(selectedWordIds);
      // Only add words that are currently visible/filtered
      filteredWords.forEach(w => newSet.add(w.id));
      setSelectedWordIds(newSet);
  }

  const clearSelection = () => {
      setSelectedWordIds(new Set());
  }

  // -- 2. Game Generation --
  const startGame = async (mode: GameMode) => {
      if (selectedWordIds.size < 3) {
          alert("Lütfen en az 3 kelime seçin.");
          return;
      }
      
      setSelectedGameMode(mode);
      setStep('loading');
      playSound('click');

      // Filter from ALL words (saved + bank) based on IDs
      const selectedWords = allDisplayWords
          .filter(v => selectedWordIds.has(v.id))
          .map(v => v.word);

      const questions = await generateGameContent(selectedWords, mode, settings.targetLanguage);
      
      if (questions.length > 0) {
          setGameQuestions(questions);
          setCurrentQuestionIndex(0);
          setScore(0);
          setStreak(0);
          setHintRevealed(false); // Reset Hint
          setStep('playing');

          // Init first question specific states
          if (mode === GameMode.Scramble && questions[0].scrambledParts) {
             setScrambleOrder([]);
             setScrambleStatus('idle');
          }
      } else {
          alert("Oyun oluşturulamadı. Lütfen tekrar deneyin.");
          setStep('mode');
      }
  };

  // -- Hint Logic --
  const handleUseHint = () => {
      if (hintRevealed) return;
      setScore(s => Math.max(0, s - 1)); // Deduct 1 point
      setHintRevealed(true);
      playSound('click');
  };

  // -- 3. Gameplay Logic (Unchanged) --
  // ... (Gameplay logic remains mostly the same, relying on gameQuestions)
  // A. Matching Game
  const handleMatchAttempt = (item: {id: string, text: string, type: 'word'|'trans'}) => {
      if (matchedPairs.has(item.id)) return;

      if (!selectedMatchId) {
          setSelectedMatchId(JSON.stringify(item));
          playSound('click');
      } else {
          const prevItem = JSON.parse(selectedMatchId);
          
          if (prevItem.type === item.type) {
              setSelectedMatchId(JSON.stringify(item));
              return;
          }

          if (prevItem.id === item.id) {
              // Match!
              const newMatched = new Set(matchedPairs);
              newMatched.add(item.id);
              setMatchedPairs(newMatched);
              setScore(s => s + 10 + (streak * 2));
              setStreak(s => s + 1);
              setSelectedMatchId(null);
              playSound('correct');

              if (newMatched.size === gameQuestions.length) {
                  setTimeout(() => setStep('result'), 1000);
              }
          } else {
              // Wrong
              setStreak(0);
              setScore(s => Math.max(0, s - 2));
              setSelectedMatchId(null);
              playSound('wrong');
          }
      }
  };

  // B. Cloze Game
  const handleClozeAnswer = (option: string) => {
      const currentQ = gameQuestions[currentQuestionIndex];
      if (option.toLowerCase() === currentQ.correctAnswer?.toLowerCase()) {
          handleCorrectAnswer();
      } else {
          handleWrongAnswer();
      }
  };

  // C. Scramble Game
  const handleScrambleClick = (word: string) => {
      if (scrambleStatus === 'correct') return;
      setScrambleOrder(prev => [...prev, word]);
      playSound('click');
  };

  const handleScrambleReset = () => {
      setScrambleOrder([]);
      setScrambleStatus('idle');
  };

  const checkScramble = () => {
      const currentQ = gameQuestions[currentQuestionIndex];
      const userSentence = scrambleOrder.join(' ');
      const normalize = (s: string) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase().trim();

      if (normalize(userSentence) === normalize(currentQ.correctSentence || '')) {
          setScore(s => s + 30 + (streak * 5));
          setStreak(s => s + 1);
          setScrambleStatus('correct');
          playSound('correct');
          setTimeout(() => nextQuestion(), 1500);
      } else {
          setScrambleStatus('wrong');
          setStreak(0);
          playSound('wrong');
          setTimeout(() => setScrambleStatus('idle'), 1000);
      }
  };

  // D. Quiz Game & Listening Game (Shared Answer Logic)
  const handleOptionAnswer = (option: string, correctOption: string) => {
      if (option === correctOption) {
          handleCorrectAnswer();
      } else {
          handleWrongAnswer();
      }
  };

  // E. Listening Game Specific
  const playListeningAudio = async () => {
     if (!audioCtx) return;
     const currentQ = gameQuestions[currentQuestionIndex];
     if (!currentQ.word) return;

     setIsPlayingAudio(true);
     try {
         const buffer = await generateSpeechFromText(currentQ.word, settings, audioCtx);
         if (buffer) {
             const source = audioCtx.createBufferSource();
             source.buffer = buffer;
             source.connect(audioCtx.destination);
             source.onended = () => setIsPlayingAudio(false);
             source.start();
         } else {
             setIsPlayingAudio(false);
         }
     } catch (e) {
         console.error(e);
         setIsPlayingAudio(false);
     }
  };

  // F. Speaking Game Logic
  const startListening = () => {
      if (!('webkitSpeechRecognition' in window)) {
          alert("Tarayıcınız ses tanıma özelliğini desteklemiyor. (Chrome kullanmayı deneyin)");
          return;
      }

      setIsListeningForSpeech(true);
      setSpokenText("");
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = settings.targetLanguage === 'English' ? 'en-US' : 'tr-TR'; // Adjust based on target
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setSpokenText(text);
          checkSpeakingResult(text);
      };

      recognition.onerror = () => {
          setIsListeningForSpeech(false);
      };

      recognition.onend = () => {
          setIsListeningForSpeech(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
  };

  const checkSpeakingResult = (text: string) => {
      const currentQ = gameQuestions[currentQuestionIndex];
      const target = currentQ.word?.toLowerCase().replace(/[.,!?]/g, '') || "";
      const input = text.toLowerCase().replace(/[.,!?]/g, '');

      if (input.includes(target) || target.includes(input)) {
          // Lenient match
          handleCorrectAnswer();
      } else {
          playSound('wrong');
          setStreak(0);
          setTimeout(() => setSpokenText(""), 2000);
      }
  };

  // -- Common Helpers --
  const handleCorrectAnswer = () => {
      setScore(s => s + 20 + (streak * 5));
      setStreak(s => s + 1);
      playSound('correct');
      nextQuestion();
  };

  const handleWrongAnswer = () => {
      setStreak(0);
      setScore(s => Math.max(0, s - 5));
      playSound('wrong');
  };

  const nextQuestion = () => {
      setHintRevealed(false); 
      setSpokenText("");
      if (currentQuestionIndex < gameQuestions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setScrambleOrder([]);
          setScrambleStatus('idle');
      } else {
          setStep('result');
          onUpdateStats(score);
          playSound('correct'); // Victory sound
      }
  };

  // --- RENDERERS ---

  const renderHintSection = () => {
      const q = gameQuestions[currentQuestionIndex];
      if (selectedGameMode === GameMode.Matching) return null;

      let hintContent = q.hintText || q.sentenceTranslation || "İpucu bulunamadı.";
      if (selectedGameMode === GameMode.Cloze && hintRevealed && q.correctAnswer) {
         hintContent += ` (Baş harf: ${q.correctAnswer.charAt(0).toUpperCase()})`;
      }

      return (
          <div className="w-full max-w-lg mx-auto mb-4 px-4 flex-shrink-0">
              {!hintRevealed ? (
                  <button 
                    onClick={handleUseHint}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 border border-white/10 rounded-lg text-indigo-200 hover:bg-white/10 hover:text-white transition-all text-xs font-bold backdrop-blur-md shadow-sm"
                  >
                      <Lightbulb size={14} /> İpucu Al (-1 Puan)
                  </button>
              ) : (
                  <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 animate-in fade-in slide-in-from-top-1 backdrop-blur-md shadow-sm text-center">
                      <div className="flex items-center justify-center gap-1.5 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                          <Lightbulb size={10} fill="currentColor" /> İpucu
                      </div>
                      <p className="text-amber-100 font-medium text-sm">{hintContent}</p>
                  </div>
              )}
          </div>
      );
  };

  const renderMatchingBoard = () => {
      const allCards: {id: string, text: string, type: 'word'|'trans'}[] = [];
      gameQuestions.forEach(q => {
          if (q.pair) {
              allCards.push({ id: q.id, text: q.pair.word, type: 'word' });
              allCards.push({ id: q.id, text: q.pair.translation, type: 'trans' });
          }
      });
      // Shuffle roughly or sort
      allCards.sort((a, b) => a.text.localeCompare(b.text));

      return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 max-w-4xl mx-auto w-full">
              {allCards.map((card, idx) => {
                  const isMatched = matchedPairs.has(card.id);
                  const isSelected = selectedMatchId && JSON.parse(selectedMatchId).text === card.text;
                  
                  if (isMatched) return <div key={idx} className="bg-white/5 border border-white/5 rounded-xl h-20 flex items-center justify-center opacity-30 backdrop-blur-sm"><Check className="text-emerald-400 w-6 h-6" /></div>;

                  return (
                      <button
                          key={idx}
                          onClick={() => handleMatchAttempt(card)}
                          className={`h-20 rounded-xl border flex items-center justify-center p-2 text-center text-xs md:text-sm font-bold transition-all transform hover:scale-105 shadow-md backdrop-blur-md ${
                              isSelected 
                              ? 'bg-indigo-600 border-indigo-300 text-white scale-105 ring-2 ring-indigo-500/30' 
                              : card.type === 'word' ? 'bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700' : 'bg-slate-700/80 border-slate-500 text-amber-100 hover:bg-slate-600'
                          }`}
                      >
                          <span className="line-clamp-3">{card.text}</span>
                      </button>
                  );
              })}
          </div>
      );
  };

  const renderClozeGame = () => {
      const q = gameQuestions[currentQuestionIndex];
      return (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-4 pt-0 w-full max-w-3xl mx-auto">
               <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl text-center">
                   <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3">Soru {currentQuestionIndex + 1}</h3>
                   <div className="text-xl md:text-2xl font-semibold text-white leading-relaxed">
                       {q.questionText}
                   </div>
               </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {q.options?.map((opt, i) => (
                      <button 
                        key={i}
                        onClick={() => handleClozeAnswer(opt)}
                        className="p-4 bg-slate-800/80 hover:bg-emerald-600 hover:text-white text-slate-100 border border-slate-600 hover:border-emerald-400 rounded-xl font-bold transition-all text-base shadow-md backdrop-blur-sm hover:scale-[1.02] active:scale-95"
                      >
                          {opt}
                      </button>
                  ))}
              </div>
          </div>
      );
  };

  const renderScrambleGame = () => {
      const q = gameQuestions[currentQuestionIndex];
      const availableParts = q.scrambledParts?.filter(p => 
          scrambleOrder.filter(x => x === p).length < q.scrambledParts!.filter(x => x === p).length
      ) || [];

      return (
          <div className="flex flex-col items-center justify-center h-full gap-5 p-4 pt-0 w-full max-w-3xl mx-auto">
               <div className="text-center">
                   <h3 className="text-indigo-300 font-bold uppercase tracking-widest text-xs">Cümleyi Düzenle</h3>
               </div>
               
               {/* Answer Area */}
               <div className={`w-full min-h-[80px] bg-white/10 backdrop-blur-md border rounded-2xl flex flex-wrap items-center justify-center gap-2 p-4 transition-all shadow-inner ${
                   scrambleStatus === 'correct' ? 'border-emerald-500 bg-emerald-500/20' : 
                   scrambleStatus === 'wrong' ? 'border-red-500 bg-red-500/20' : 'border-white/10'
               }`}>
                   {scrambleOrder.length === 0 && <span className="text-white/30 text-sm font-medium italic">Kelimeleri seç...</span>}
                   {scrambleOrder.map((word, i) => (
                       <span key={i} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-md animate-in zoom-in duration-200">
                           {word}
                       </span>
                   ))}
               </div>

               {/* Pool Area */}
               <div className="flex flex-wrap justify-center gap-2 py-2">
                   {availableParts.map((word, i) => (
                       <button
                           key={i}
                           onClick={() => handleScrambleClick(word)}
                           className="px-4 py-2 bg-slate-800/80 hover:bg-indigo-500 border border-slate-600 hover:border-indigo-400 rounded-xl text-white font-medium text-sm transition-all transform hover:-translate-y-1 shadow-md backdrop-blur-sm"
                       >
                           {word}
                       </button>
                   ))}
               </div>

               {/* Controls */}
               <div className="flex gap-3 mt-2">
                   <button onClick={handleScrambleReset} className="p-3 bg-slate-700/80 rounded-full hover:bg-slate-600 text-white shadow-lg transition-transform hover:rotate-180">
                       <RefreshCw size={20} />
                   </button>
                   <button 
                        onClick={checkScramble}
                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base rounded-full shadow-lg shadow-emerald-500/30 flex items-center gap-2 hover:scale-105 transition-all"
                   >
                       Kontrol Et <ArrowRight size={18} />
                   </button>
               </div>
          </div>
      );
  };

  const renderQuizGame = () => {
      const q = gameQuestions[currentQuestionIndex];
      const options = [q.correctMeaning!, ...(q.wrongMeanings || [])].sort(() => Math.random() - 0.5);

      return (
          <div className="flex flex-col items-center justify-center h-full gap-8 p-4 pt-0 w-full max-w-2xl mx-auto">
               <div className="text-center space-y-3">
                   <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest bg-indigo-900/30 px-2 py-1 rounded-full border border-indigo-500/30">
                       Bu kelimenin anlamı ne?
                   </span>
                   <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-200 to-indigo-400 drop-shadow-lg py-1">
                       {q.word}
                   </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {options.map((opt, i) => (
                      <button 
                        key={i}
                        onClick={() => handleOptionAnswer(opt, q.correctMeaning!)}
                        className="p-4 bg-slate-800/60 hover:bg-indigo-600 hover:text-white text-slate-100 border border-slate-600 hover:border-indigo-400 rounded-xl font-bold transition-all text-base shadow-md backdrop-blur-md hover:scale-[1.02] active:scale-95"
                      >
                          {opt}
                      </button>
                  ))}
               </div>
          </div>
      );
  };

  const renderListeningGame = () => {
      const q = gameQuestions[currentQuestionIndex];
      const options = q.options!.sort(() => Math.random() - 0.5);

      return (
          <div className="flex flex-col items-center justify-center h-full gap-8 p-4 pt-0 w-full max-w-2xl mx-auto">
               <div className="flex flex-col items-center gap-4">
                   <div className="text-center">
                       <span className="text-[10px] font-bold text-pink-300 uppercase tracking-widest bg-pink-900/30 px-2 py-1 rounded-full border border-pink-500/30">
                           Duyduğun kelimeyi seç
                       </span>
                   </div>

                   <button 
                       onClick={playListeningAudio}
                       className={`w-24 h-24 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.3)] border-4 transition-all hover:scale-105 active:scale-95 ${
                           isPlayingAudio 
                           ? 'bg-pink-600 border-pink-400 animate-pulse' 
                           : 'bg-slate-800 border-slate-600 hover:border-pink-500 text-white'
                       }`}
                   >
                       {isPlayingAudio ? <Volume2 size={36} className="text-white"/> : <Ear size={36} />}
                   </button>
                   <p className="text-slate-400 text-xs italic">Dinlemek için tıkla</p>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {options.map((opt, i) => (
                      <button 
                        key={i}
                        onClick={() => handleOptionAnswer(opt, q.word!)}
                        className="p-4 bg-slate-800/60 hover:bg-pink-600 hover:text-white text-slate-100 border border-slate-600 hover:border-pink-400 rounded-xl font-bold transition-all text-base shadow-md backdrop-blur-md hover:scale-[1.02] active:scale-95"
                      >
                          {opt}
                      </button>
                  ))}
               </div>
          </div>
      );
  };

  const renderSpeakingGame = () => {
      const q = gameQuestions[currentQuestionIndex];

      return (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-4 pt-0">
               <div className="text-center space-y-3">
                   <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest bg-cyan-900/30 px-2 py-1 rounded-full border border-cyan-500/30">
                       Bu kelimeyi sesli oku
                   </span>
                   <div className="text-4xl md:text-5xl font-black text-white drop-shadow-lg py-2">
                       {q.word}
                   </div>
               </div>

               <div className="relative">
                   <button 
                       onMouseDown={startListening}
                       className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 transition-all hover:scale-105 active:scale-95 ${
                           isListeningForSpeech 
                           ? 'bg-red-500 border-red-400 shadow-[0_0_40px_rgba(239,68,68,0.5)] animate-pulse' 
                           : 'bg-slate-800 border-slate-600 hover:border-cyan-400 text-white'
                       }`}
                   >
                       <Mic size={32} />
                   </button>
               </div>
               
               <div className="h-10 flex items-center justify-center">
                   {isListeningForSpeech && <p className="text-cyan-300 font-mono animate-pulse text-sm">Dinleniyor...</p>}
                   {spokenText && !isListeningForSpeech && (
                       <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 text-red-300 font-mono text-xs">
                           Algılanan: "{spokenText}" (Tekrar Dene)
                       </div>
                   )}
               </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 font-sans">
        {/* Modern Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-all" onClick={onClose}></div>

        {/* Main Card */}
        <div className="relative w-full max-w-5xl h-[90vh] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            
            {/* --- HEADER --- */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md shrink-0 z-20 h-20">
                <div className="flex items-center gap-3">
                    {step === 'playing' ? (
                        <button 
                            onClick={() => setStep('mode')}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all hover:-translate-x-1"
                            title="Oyun Modu Seçimine Dön"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    ) : (
                        <div className="p-2.5 bg-indigo-600 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.5)]">
                            <Gamepad2 className="text-white w-6 h-6" />
                        </div>
                    )}
                    
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight drop-shadow-md">GAME ARENA</h2>
                        <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Pro Training Mode</div>
                    </div>
                </div>
                
                {step === 'playing' && (
                    <div className="flex items-center gap-4 bg-black/40 px-4 py-1.5 rounded-full border border-white/10 shadow-inner">
                        <div className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 text-amber-400 fill-current drop-shadow-md" />
                            <span className="text-white font-black text-lg">{score}</span>
                        </div>
                        <div className="w-px h-4 bg-white/10"></div>
                        <div className="flex items-center gap-1.5">
                             <Trophy className="w-4 h-4 text-emerald-400 drop-shadow-md" />
                             <span className="text-emerald-100 font-mono font-bold text-sm">Streak: {streak}</span>
                        </div>
                    </div>
                )}

                <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-red-500 hover:text-white rounded-full text-slate-400 transition-all">
                    <X size={20} />
                </button>
            </div>

            {/* --- BODY --- */}
            <div className="flex-1 overflow-y-auto relative flex flex-col custom-scrollbar">
                
                {/* 1. SELECTION STEP */}
                {step === 'selection' && (
                    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 w-full z-10 flex flex-col items-center">
                        <div className="text-center space-y-2">
                            <h3 className="text-3xl font-black text-white drop-shadow-lg">Kelime Seçimi</h3>
                            <p className="text-indigo-200 text-base">Oynamak istediğin kelimeleri işaretle.</p>
                        </div>

                        {/* --- FILTERS BAR --- */}
                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 backdrop-blur-md">
                            
                            <div className="flex flex-wrap items-center gap-4 flex-1">
                                {/* Source Filter */}
                                <div className="flex items-center gap-2">
                                    <Filter size={16} className="text-indigo-400" />
                                    <select 
                                        value={filterSource}
                                        onChange={(e) => {
                                            setFilterSource(e.target.value as any);
                                            setFilterCategory('ALL'); // Reset category when source changes
                                        }}
                                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="ALL" className="bg-slate-900 text-white">Tüm Kaynaklar</option>
                                        <option value="SAVED" className="bg-slate-900 text-white">Defter (Sohbet)</option>
                                        <option value="BANK" className="bg-slate-900 text-white">Banka (Dosya)</option>
                                    </select>
                                </div>

                                {/* Category Filter */}
                                <div className="flex items-center gap-2">
                                    <List size={16} className="text-emerald-400" />
                                    <select 
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer max-w-[150px]"
                                    >
                                        <option value="ALL" className="bg-slate-900 text-white">Tüm Kategoriler</option>
                                        {uniqueCategories.map(cat => (
                                            <option key={cat} value={cat} className="bg-slate-900 text-white">{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Level Filter */}
                                <div className="flex items-center gap-2">
                                    <GraduationCap size={16} className="text-amber-400" />
                                    <select 
                                        value={filterLevel}
                                        onChange={(e) => setFilterLevel(e.target.value)}
                                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="ALL" className="bg-slate-900 text-white">Tüm Seviyeler</option>
                                        <option value="A1" className="bg-slate-900 text-white">A1</option>
                                        <option value="A2" className="bg-slate-900 text-white">A2</option>
                                        <option value="B1" className="bg-slate-900 text-white">B1</option>
                                        <option value="B2" className="bg-slate-900 text-white">B2</option>
                                        <option value="C1" className="bg-slate-900 text-white">C1</option>
                                        <option value="C2" className="bg-slate-900 text-white">C2</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                <button onClick={selectAllFiltered} className="text-xs font-bold px-3 py-1.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white transition-colors flex-1 md:flex-none">
                                    Seçimi İşaretle
                                </button>
                                <button onClick={clearSelection} className="text-xs font-bold px-3 py-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white transition-colors flex-1 md:flex-none">
                                    Temizle
                                </button>
                            </div>
                        </div>
                        
                        {filteredWords.length === 0 ? (
                            <div className="text-center p-12 bg-white/5 rounded-3xl border border-white/10 border-dashed backdrop-blur-sm w-full">
                                <p className="text-slate-400 text-base">Bu filtreye uygun kelime bulunamadı.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                                {filteredWords.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => toggleWordSelection(v.id)}
                                        className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group flex flex-col gap-1 ${
                                            selectedWordIds.has(v.id)
                                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] scale-105 z-10'
                                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/30'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <div className="font-bold text-sm truncate pr-6">{v.word}</div>
                                            {/* Level Badge */}
                                            {v.level && (
                                                <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold border ${getLevelColor(v.level)}`}>
                                                    {v.level}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 opacity-60">
                                            {v.source === 'SAVED' 
                                                ? <BookOpen size={10} className="text-emerald-400" />
                                                : <FileText size={10} className="text-amber-400" />
                                            }
                                            <div className="text-[10px] truncate uppercase tracking-wider">{v.category}</div>
                                        </div>
                                        
                                        {selectedWordIds.has(v.id) && (
                                            <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5">
                                                <Check size={10} className="text-indigo-600 font-bold"/>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-center pt-4 border-t border-white/10 w-full">
                            <button
                                onClick={() => setStep('mode')}
                                disabled={selectedWordIds.size < 3}
                                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-base transition-all shadow-xl hover:shadow-emerald-500/30 hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                                Mod Seçimine Geç ({selectedWordIds.size}) <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. MODE STEP */}
                {step === 'mode' && (
                    <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center min-h-full gap-8 animate-in fade-in zoom-in-95 w-full z-10">
                        <h3 className="text-3xl font-black text-white drop-shadow-lg">Oyun Modu Seç</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full px-4">
                            
                            <button onClick={() => startGame(GameMode.Matching)} className="group relative p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-indigo-900/40 hover:border-indigo-500/50 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(79,70,229,0.2)] text-left backdrop-blur-sm">
                                <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Target size={24} />
                                </div>
                                <h4 className="text-lg font-bold text-white mb-1">Eşleştirme</h4>
                                <p className="text-xs text-indigo-200 opacity-70">Kartları çevir, anlamları bul.</p>
                            </button>

                            <button onClick={() => startGame(GameMode.Cloze)} className="group relative p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-emerald-900/40 hover:border-emerald-500/50 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] text-left backdrop-blur-sm">
                                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Type size={24} />
                                </div>
                                <h4 className="text-lg font-bold text-white mb-1">Boşluk Doldurma</h4>
                                <p className="text-xs text-emerald-200 opacity-70">Cümleyi tamamla.</p>
                            </button>

                            <button onClick={() => startGame(GameMode.Scramble)} className="group relative p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-amber-900/40 hover:border-amber-500/50 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] text-left backdrop-blur-sm">
                                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Move size={24} />
                                </div>
                                <h4 className="text-lg font-bold text-white mb-1">Cümle Kurma</h4>
                                <p className="text-xs text-amber-200 opacity-70">Kelimeleri sıraya diz.</p>
                            </button>

                            <button onClick={() => startGame(GameMode.Listening)} className="group relative p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-pink-900/40 hover:border-pink-500/50 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(236,72,153,0.2)] text-left backdrop-blur-sm">
                                <div className="w-12 h-12 bg-pink-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Ear size={24} />
                                </div>
                                <h4 className="text-lg font-bold text-white mb-1">Dinleme</h4>
                                <p className="text-xs text-pink-200 opacity-70">Duyduğunu anla ve seç.</p>
                            </button>

                            <button onClick={() => startGame(GameMode.Speaking)} className="group relative p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-cyan-900/40 hover:border-cyan-500/50 transition-all hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] text-left backdrop-blur-sm">
                                <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Mic size={24} />
                                </div>
                                <h4 className="text-lg font-bold text-white mb-1">Konuşma</h4>
                                <p className="text-xs text-cyan-200 opacity-70">Sesli telaffuz çalışması.</p>
                            </button>

                        </div>
                    </div>
                )}

                {/* 3. LOADING STEP */}
                {step === 'loading' && (
                    <div className="flex flex-col items-center justify-center h-full gap-6">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Gamepad2 className="text-indigo-400 w-6 h-6 animate-pulse" />
                            </div>
                        </div>
                        <p className="text-indigo-200 font-bold text-lg animate-pulse">Arena Hazırlanıyor...</p>
                    </div>
                )}

                {/* 4. PLAYING STEP */}
                {step === 'playing' && (
                    <div className="h-full flex flex-col pt-4 z-10 justify-center">
                        {renderHintSection()}
                        {selectedGameMode === GameMode.Matching && renderMatchingBoard()}
                        {selectedGameMode === GameMode.Cloze && renderClozeGame()}
                        {selectedGameMode === GameMode.Scramble && renderScrambleGame()}
                        {selectedGameMode === GameMode.Quiz && renderQuizGame()}
                        {selectedGameMode === GameMode.Listening && renderListeningGame()}
                        {selectedGameMode === GameMode.Speaking && renderSpeakingGame()}
                    </div>
                )}

                {/* 5. RESULT STEP */}
                {step === 'result' && (
                    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-in zoom-in-95 z-10">
                        <div className="relative">
                            <div className="absolute inset-0 bg-amber-500 blur-[80px] opacity-40"></div>
                            <div className="w-32 h-32 bg-gradient-to-br from-amber-300 to-orange-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20 mb-4 relative z-10">
                                <Trophy size={64} className="text-white drop-shadow-lg" />
                            </div>
                        </div>
                        
                        <div className="text-center space-y-2">
                            <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-white drop-shadow-sm">Harika!</h2>
                            <p className="text-indigo-200 text-lg font-medium">Antrenmanı tamamladın.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-2">
                            <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center transform hover:scale-105 transition-transform">
                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Toplam Puan</div>
                                <div className="text-4xl font-black text-indigo-400">{score}</div>
                            </div>
                            <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center transform hover:scale-105 transition-transform">
                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">En Yüksek Streak</div>
                                <div className="text-4xl font-black text-emerald-400">{streak}</div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                             <button onClick={() => setStep('selection')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors">
                                 Farklı Kelimeler
                             </button>
                             <button onClick={() => startGame(selectedGameMode)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-xl shadow-indigo-600/30">
                                 Tekrar Oyna
                             </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};
