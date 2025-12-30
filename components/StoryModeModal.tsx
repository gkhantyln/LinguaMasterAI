
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, StoryGenre, StoryState } from '../types';
import { STORY_GENRE_OPTIONS } from '../constants';
import { generateInteractiveStory, resetStoryHistory } from '../services/geminiService';
import { BookOpen, Map, ArrowRight, RefreshCw, X, Search, Rocket, Wand, Tent, Heart, Ghost, Scroll, ChevronRight, Eye, EyeOff, Book } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface StoryModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onComplete?: () => void;
}

// Icon mapper
const getIcon = (iconName: string) => {
    switch(iconName) {
        case 'Search': return <Search size={24} />;
        case 'Rocket': return <Rocket size={24} />;
        case 'Wand': return <Wand size={24} />;
        case 'Map': return <Map size={24} />;
        case 'Tent': return <Tent size={24} />;
        case 'Heart': return <Heart size={24} />;
        case 'Ghost': return <Ghost size={24} />;
        case 'Scroll': return <Scroll size={24} />;
        default: return <BookOpen size={24} />;
    }
};

export const StoryModeModal: React.FC<StoryModeModalProps> = ({ isOpen, onClose, settings, onComplete }) => {
  const [step, setStep] = useState<'genre' | 'story'>('genre');
  const [selectedGenre, setSelectedGenre] = useState<StoryGenre | null>(null);
  
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [historyLog, setHistoryLog] = useState<{narrative: string, choice?: string}[]>([]);
  
  const [showTranslation, setShowTranslation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        resetGame();
    }
  }, [isOpen]);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [historyLog, storyState]);

  const resetGame = () => {
      setStep('genre');
      setSelectedGenre(null);
      setStoryState(null);
      setHistoryLog([]);
      setIsLoading(false);
      setShowTranslation(false);
      resetStoryHistory();
  };

  const handleStartStory = async (genre: StoryGenre) => {
      setSelectedGenre(genre);
      setIsLoading(true);
      setStep('story');

      const initialState = await generateInteractiveStory(genre, settings, null, true);
      
      setStoryState(initialState);
      setHistoryLog([{ narrative: initialState.narrative }]);
      setIsLoading(false);
  };

  const handleChoice = async (choice: string) => {
      if (!selectedGenre) return;

      // Update log with user choice
      setHistoryLog(prev => {
          const newLog = [...prev];
          newLog[newLog.length - 1].choice = choice;
          return newLog;
      });

      setIsLoading(true);
      
      // Fetch next segment
      const nextState = await generateInteractiveStory(selectedGenre, settings, choice, false);
      
      setStoryState(nextState);
      setHistoryLog(prev => [...prev, { narrative: nextState.narrative }]);
      setIsLoading(false);
      setShowTranslation(false);
  };

  const handleEndStory = () => {
      if (onComplete) onComplete();
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 font-serif">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose}></div>
        
        {/* Main Book Container */}
        <div className="relative w-full max-w-5xl h-[85vh] bg-[#1a1614] border border-[#3c302a] rounded-[1rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
            
            {/* Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none z-0"></div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-[#3c302a] bg-[#130f0d]">
                <div className="flex items-center gap-3">
                    <Book className="text-[#c2a28b] w-6 h-6" />
                    <h2 className="text-2xl font-bold text-[#e8dcc5] tracking-wide">
                        {step === 'genre' ? 'Select Your Adventure' : storyState?.title || 'Interactive Story'}
                    </h2>
                </div>
                <button onClick={onClose} className="text-[#8a7a70] hover:text-[#c2a28b] transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative z-10 overflow-hidden flex flex-col">
                
                {/* 1. GENRE SELECTION */}
                {step === 'genre' && (
                    <div className="p-8 overflow-y-auto custom-scrollbar h-full">
                        <div className="text-center mb-10">
                             <h3 className="text-4xl text-[#e8dcc5] mb-4">Choose a Genre</h3>
                             <p className="text-[#8a7a70]">Select a world to immerse yourself in. The AI will guide your journey.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {STORY_GENRE_OPTIONS.map((genre) => (
                                <button
                                    key={genre.id}
                                    onClick={() => handleStartStory(genre.id)}
                                    className="group relative p-6 bg-[#26201c] border border-[#3c302a] rounded-xl text-left hover:border-[#c2a28b] hover:bg-[#2e2621] transition-all duration-300 hover:-translate-y-1 shadow-lg"
                                >
                                    <div className="mb-4 text-[#c2a28b] group-hover:text-[#e8dcc5] transition-colors">
                                        {getIcon(genre.icon)}
                                    </div>
                                    <h4 className="text-lg font-bold text-[#e8dcc5] mb-2">{genre.label}</h4>
                                    <p className="text-xs text-[#8a7a70] opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-4">
                                        Start Adventure →
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. STORY VIEW */}
                {step === 'story' && (
                    <div className="flex flex-col h-full">
                        
                        {/* Narrative Log */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar bg-[#1a1614]"
                        >
                            {historyLog.map((log, idx) => (
                                <div key={idx} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    {/* Narrator Text */}
                                    <div className="prose prose-invert prose-lg max-w-none">
                                        <p className="text-[#e8dcc5] leading-relaxed font-serif text-lg md:text-xl">
                                            {log.narrative}
                                        </p>
                                    </div>

                                    {/* User Previous Choice */}
                                    {log.choice && (
                                        <div className="mt-4 flex justify-end">
                                            <div className="inline-block px-4 py-2 rounded-lg bg-[#2e2621] border border-[#3c302a] text-[#c2a28b] italic text-sm">
                                                You decided: {log.choice}
                                            </div>
                                        </div>
                                    )}

                                    {/* Divider */}
                                    {idx < historyLog.length - 1 && (
                                        <div className="w-full flex justify-center my-8 opacity-20">
                                            <div className="w-24 h-px bg-[#e8dcc5]"></div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex justify-center py-8">
                                    <div className="flex items-center gap-2 text-[#8a7a70] animate-pulse">
                                        <RefreshCw className="animate-spin" size={20} />
                                        <span className="font-serif italic">Writing the next chapter...</span>
                                    </div>
                                </div>
                            )}
                            
                            {/* Invisible div for auto scroll */}
                            <div className="h-4"></div>
                        </div>

                        {/* Controls & Choices Area (Fixed at Bottom) */}
                        <div className="border-t border-[#3c302a] bg-[#130f0d] p-6 shrink-0">
                            
                            {/* Translation Toggle */}
                            <div className="flex justify-between items-center mb-4">
                                <button 
                                    onClick={() => setShowTranslation(!showTranslation)}
                                    disabled={!storyState?.narrativeTranslation}
                                    className="flex items-center gap-2 text-xs text-[#8a7a70] hover:text-[#c2a28b] transition-colors"
                                >
                                    {showTranslation ? <EyeOff size={14}/> : <Eye size={14}/>}
                                    {showTranslation ? 'Hide Translation' : 'Show Translation'}
                                </button>
                                
                                <span className="text-xs text-[#5c504a]">Genre: {selectedGenre}</span>
                            </div>

                            {/* Translation Panel */}
                            {showTranslation && storyState?.narrativeTranslation && (
                                <div className="mb-4 p-4 bg-[#1e1916] border-l-2 border-[#c2a28b] rounded-r-lg text-[#b8a79d] italic text-sm animate-in fade-in slide-in-from-bottom-2">
                                    {storyState.narrativeTranslation}
                                </div>
                            )}

                            {/* Choices Grid */}
                            {!isLoading && storyState && !storyState.isEnding && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {storyState.choices.map((choice, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleChoice(choice)}
                                            className="p-4 text-left border border-[#3c302a] bg-[#26201c] hover:bg-[#3c302a] hover:border-[#c2a28b] rounded-lg transition-all duration-200 group flex items-start gap-3"
                                        >
                                            <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full border border-[#5c504a] text-[#8a7a70] text-xs font-bold group-hover:border-[#c2a28b] group-hover:text-[#c2a28b] transition-colors">
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            <span className="text-[#e8dcc5] group-hover:text-white text-sm md:text-base">{choice}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Ending Screen Controls */}
                            {!isLoading && storyState?.isEnding && (
                                <div className="text-center py-4">
                                    <h4 className="text-[#e8dcc5] text-xl font-serif mb-4">The End.</h4>
                                    <div className="flex justify-center gap-4">
                                        <button 
                                            onClick={resetGame}
                                            className="px-6 py-2 border border-[#3c302a] text-[#c2a28b] rounded hover:bg-[#26201c] transition-colors"
                                        >
                                            Choose Another Story
                                        </button>
                                        <button 
                                            onClick={handleEndStory}
                                            className="px-6 py-2 bg-[#c2a28b] text-[#130f0d] rounded font-bold hover:bg-[#d6bca8] transition-colors"
                                        >
                                            Finish
                                        </button>
                                    </div>
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
