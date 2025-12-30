
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { AppSettings, SpeakingStyle } from '../types';
import { Mic, MicOff, Loader2, Globe, Eye, Lightbulb, X, Sparkles, Activity, Power, Ear, Move, ArrowRight, Gamepad2, BookmarkPlus, Check } from 'lucide-react';
import { decodeAudioData } from '../utils/audioUtils';
import { getTextTranslationForLive, getHintsForLive } from '../services/geminiService';

interface LiveSessionProps {
  settings: AppSettings;
  onClose: () => void;
  onSaveVocabulary: (word: string, context: string) => void;
  onOpenGameArena: () => void;
}

// --- CONTENT RENDERER FOR POPUPS ---
const PopupContentRenderer: React.FC<{ content: string; type: 'translation' | 'hints' }> = ({ content, type }) => {
    if (type === 'translation') {
        return (
            <div className="p-1">
                <p className="text-lg text-emerald-50 font-medium leading-relaxed drop-shadow-sm font-sans">
                    {content}
                </p>
            </div>
        );
    }

    // Hints Parser
    // Split by new lines, look for numbered lists or bullets
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    return (
        <div className="space-y-3">
            {lines.map((line, idx) => {
                // Remove numbering markers for cleaner look (optional, but cleaning "1. " looks better if we style it)
                const cleanLine = line.replace(/^[\d-]+\.\s*|^\*\s*/, '');
                
                // Try to split English and Turkish parts if parentheses exist
                // Example: "Use Past Tense (Geçmiş Zaman kullan)"
                const parts = cleanLine.split('(');
                const mainPart = parts[0];
                const subPart = parts.length > 1 ? '(' + parts.slice(1).join('(') : '';

                return (
                    <div key={idx} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-xl border border-white/5 hover:bg-slate-800 transition-colors">
                        <div className="mt-1 min-w-[20px] h-5 flex items-center justify-center bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                            {idx + 1}
                        </div>
                        <div className="text-sm leading-relaxed">
                            <span className="block text-amber-100 font-semibold mb-0.5">{mainPart.trim()}</span>
                            {subPart && (
                                <span className="block text-slate-400 text-xs italic">{subPart.trim()}</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// --- DRAGGABLE WINDOW COMPONENT ---
interface DraggableWindowProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  onClose: () => void;
  initialPosition: { x: number; y: number };
  colorClass: string; // "emerald" | "amber"
  type: 'translation' | 'hints';
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({ title, icon, content, onClose, initialPosition, colorClass, type }) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag if clicking the header
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && dragStartRef.current) {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragStartRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const borderColor = colorClass === 'emerald' ? 'border-emerald-500/40' : 'border-amber-500/40';
  const bgColor = colorClass === 'emerald' ? 'bg-slate-900/95 shadow-emerald-500/10' : 'bg-slate-900/95 shadow-amber-500/10';
  const headerColor = colorClass === 'emerald' ? 'text-emerald-400 bg-emerald-950/30' : 'text-amber-400 bg-amber-950/30';
  const glowShadow = colorClass === 'emerald' ? 'shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]' : 'shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)]';

  return (
    <div 
      className={`fixed z-50 w-80 md:w-96 rounded-2xl border ${borderColor} ${bgColor} ${glowShadow} backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in zoom-in-95`}
      style={{ left: position.x, top: position.y, touchAction: 'none' }}
    >
        {/* Header Bar (Drag Handle) */}
        <div 
           className={`flex items-center justify-between p-3 cursor-move select-none border-b border-white/10 ${headerColor}`}
           onPointerDown={handlePointerDown}
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
        >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                {icon} {title}
            </div>
            <div className="flex items-center gap-2">
                <Move size={12} className="opacity-50" />
                <button 
                    onPointerDown={(e) => e.stopPropagation()} // FIX: Stop drag propagation so click works
                    onClick={onClose} 
                    className="text-white/50 hover:text-white hover:bg-white/10 transition-colors p-1.5 rounded-lg"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
        
        {/* Content */}
        <div className="p-5 max-h-[300px] overflow-y-auto custom-scrollbar">
            <PopupContentRenderer content={content} type={type} />
        </div>
    </div>
  );
};

// --- HELPER UTILS ---
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64.split(',')[1] || base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// --- TEXT FORMATTER FOR TRANSCRIPT ---
const TranscriptRenderer: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;

    const parts = text.split(/(Did you mean:.*?\?|Correction:.*?\.)/gi);

    return (
        <span className="text-xl md:text-2xl font-medium leading-relaxed drop-shadow-lg tracking-tight cursor-text">
            {parts.map((part, index) => {
                // CORRECTION BLOCK
                if (part.match(/Did you mean:|Correction:/i)) {
                    const subParts = part.split(/("[^"]*")/g);
                    return (
                        <span key={index} className="block my-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-100 text-base md:text-lg font-normal shadow-lg backdrop-blur-md relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                            <span className="flex items-center gap-2 text-xs font-bold uppercase text-amber-400 mb-1 opacity-80 tracking-widest">
                                <Sparkles size={12} /> Teacher's Correction
                            </span>
                            {subParts.map((sub, i) => 
                                sub.startsWith('"') 
                                ? <span key={i} className="text-white font-semibold bg-amber-500/20 px-1.5 py-0.5 rounded mx-1">{sub.replace(/"/g, '')}</span> 
                                : <span key={i}>{sub}</span>
                            )}
                        </span>
                    );
                }
                
                // NORMAL TEXT
                const normalParts = part.split(/("[^"]*")/g);
                return (
                   <span key={index} className="text-white/90">
                       {normalParts.map((sub, i) => 
                           sub.startsWith('"') 
                           ? <span key={i} className="text-emerald-300 font-serif italic mx-1">{sub}</span> 
                           : <span key={i}>{sub}</span>
                       )}
                   </span>
                );
            })}
        </span>
    );
};


export const LiveSession: React.FC<LiveSessionProps> = ({ settings, onClose, onSaveVocabulary, onOpenGameArena }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [isMicOn, setIsMicOn] = useState(true);
  
  // Data States
  const [latestTranscript, setLatestTranscript] = useState<string>("");
  const [translation, setTranslation] = useState<string | null>(null);
  const [hints, setHints] = useState<string | null>(null);

  // Visibility Toggles
  const [showTranslation, setShowTranslation] = useState(false);
  const [showHints, setShowHints] = useState(false);

  // Selection Saving State
  const [selectedText, setSelectedText] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  
  // Audio Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null); 
  const nextStartTimeRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentTurnTranscriptRef = useRef("");

  const API_KEY = process.env.API_KEY;

  useEffect(() => {
    if (!API_KEY) {
      setStatus('error');
      return;
    }
    startSession();
    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      cleanup();
    };
  }, []);

  // --- Visualizer Logic ---
  const drawVisualizer = () => {
    if (!outputAnalyserRef.current || !canvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(drawVisualizer);
        return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = outputAnalyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Glow Effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#34d399"; // Emerald Glow

    // Gradient
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)'); 
    gradient.addColorStop(0.5, 'rgba(52, 211, 153, 0.8)'); 
    gradient.addColorStop(1, 'rgba(110, 231, 183, 1)'); 

    ctx.fillStyle = gradient;

    const centerX = width / 2;
    // Adjusted for smaller width/height
    const step = 4; // Skip more frequencies
    const barCount = 30; // Fewer bars
    const barWidth = 4; // Fixed width
    const gap = 4;

    for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step];
        const percent = value / 255;
        
        // Non-linear scaling for better visuals
        let barHeight = Math.pow(percent, 1.5) * height * 0.9; 
        barHeight = Math.max(barHeight, 2); // Min height dot

        const xOffset = i * (barWidth + gap); 

        // Rounded caps manually
        const y = (height - barHeight) / 2;
        
        // Right side
        ctx.beginPath();
        ctx.roundRect(centerX + xOffset, y, barWidth, barHeight, 4);
        ctx.fill();
        
        // Left side (mirrored)
        if (i > 0) {
            ctx.beginPath();
            ctx.roundRect(centerX - xOffset, y, barWidth, barHeight, 4);
            ctx.fill();
        }
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  };

  // --- Session Logic ---
  const startSession = async () => {
    try {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 512; 
      analyser.smoothingTimeConstant = 0.7; 
      outputAnalyserRef.current = analyser;
      
      outputNodeRef.current = outputCtx.createGain();
      outputNodeRef.current.connect(analyser); 
      analyser.connect(outputCtx.destination);

      drawVisualizer();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: API_KEY || '' });
      
      let voiceName = 'Aoede'; 
      if (settings.tutorPersona === 'strict_professor') voiceName = 'Fenrir';
      if (settings.tutorPersona === 'friendly_local') voiceName = 'Puck';
      if (settings.tutorPersona === 'encouraging_friend') voiceName = 'Kore';

      // -- NEW: Dialect and Style Injection --
      const dialectInstruction = settings.targetLanguage === 'English' 
        ? `Use ${settings.englishDialect} spelling, vocabulary, and idioms.` 
        : "";
      
      const styleInstruction = settings.speakingStyle === SpeakingStyle.StreetSlang
        ? "USE STREET SLANG (modern idioms, contractions like gonna/wanna, casual tone)."
        : settings.speakingStyle === SpeakingStyle.Formal
        ? "USE FORMAL LANGUAGE (no contractions, polite honorifics)."
        : "USE STANDARD LANGUAGE.";

      const correctionPrompt = `
      You are a live audio language tutor.
      Current Context: Target Language is ${settings.targetLanguage}, Level is ${settings.proficiencyLevel}.
      Instructions: ${dialectInstruction} ${styleInstruction}
      
      CRITICAL RULE:
      If the user speaks and makes a grammatical error or incorrect vocabulary choice:
      1. IMMEDIATELY start your response by saying: "Did you mean: [Correct Sentence]?" 
      2. Then briefly explain the correction in ${settings.nativeLanguage} (keep it very simple).
      3. Then continue the conversation.
      
      If the user speaks correctly, just continue the conversation naturally.
      Keep responses relatively short (2-3 sentences max) to allow turn-taking.
      `;

      const config = {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
        },
        systemInstruction: { parts: [{ text: correctionPrompt }] },
      };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: config,
        callbacks: {
          onopen: () => {
            if (mountedRef.current) setStatus('connected');
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              if (!isMicOn) return;
              const inputData = e.inputBuffer.getChannelData(0);
              
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const base64Data = arrayBufferToBase64(int16.buffer);
              
              sessionPromise.then(session => {
                  session.sendRealtimeInput({
                      media: { mimeType: 'audio/pcm;rate=16000', data: base64Data }
                  });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const serverContent = msg.serverContent;
            
            // Audio Playback
            const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputCtx) {
                const audioData = base64ToUint8Array(base64Audio);
                const currentTime = outputCtx.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }
                try {
                    const audioBuffer = await decodeAudioData(audioData, outputCtx, 24000, 1);
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputNodeRef.current!);
                    source.onended = () => { sourcesRef.current.delete(source); };
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);
                } catch (e) { console.error("Audio decode error", e); }
            }

            // Realtime Transcription Accumulation
            if (serverContent?.outputTranscription?.text) {
                currentTurnTranscriptRef.current += serverContent.outputTranscription.text;
                // Live update UI to show "typing" effect
                setLatestTranscript(currentTurnTranscriptRef.current);
            }

            // --- TURN COMPLETE: PRE-FETCH DATA ---
            if (serverContent?.turnComplete) {
                const fullText = currentTurnTranscriptRef.current;
                
                // 1. Reset UI States
                setTranslation(null);
                setHints(null);

                // 2. Background Fetch (Pre-calculation)
                if (fullText.trim().length > 0) {
                    // Fire and forget (updates state when done)
                    getTextTranslationForLive(fullText).then(text => {
                        if (mountedRef.current) setTranslation(text);
                    });
                    
                    getHintsForLive(fullText, settings.targetLanguage).then(hintText => {
                        if (mountedRef.current) setHints(hintText);
                    });
                }
                
                currentTurnTranscriptRef.current = ""; 
            }

            // --- INTERRUPTION HANDLING ---
            if (serverContent?.interrupted) {
                sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                currentTurnTranscriptRef.current = "";
                
                // User interrupted the model -> Clear old data immediately
                setLatestTranscript(""); 
            }
          },
          onclose: () => { if (mountedRef.current) setStatus('closed'); },
          onerror: (err) => { console.error("Live Error", err); if (mountedRef.current) setStatus('error'); }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e) {
      console.error("Connection failed", e);
      setStatus('error');
    }
  };

  const cleanup = () => {
    if (sessionRef.current) {
        sessionRef.current.then((s: any) => { try { s.close(); } catch(e) {} });
    }
    inputContextRef.current?.close();
    outputContextRef.current?.close();
    audioStreamRef.current?.getTracks().forEach(track => track.stop());
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
  };

  const toggleMic = () => { setIsMicOn(!isMicOn); };

  // --- SELECTION LOGIC ---
  const handleTextMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
          setSelectedText(selection.toString().trim());
          setIsSaved(false);
      }
  };

  const clearSelection = () => {
      setSelectedText('');
      window.getSelection()?.removeAllRanges();
  };

  const handleSaveVocab = () => {
      if (selectedText && onSaveVocabulary) {
          onSaveVocabulary(selectedText, latestTranscript); // Save with full transcript context
          setIsSaved(true);
          setTimeout(() => {
              setIsSaved(false);
              clearSelection();
          }, 1500);
      }
  };

  const handleOpenGame = () => {
      onClose(); // Close Live Session first
      onOpenGameArena(); // Open Game Arena
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 overflow-hidden font-sans">
      
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px] animate-[pulse_8s_infinite]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] bg-indigo-900/20 rounded-full blur-[120px] animate-[pulse_10s_infinite_reverse]"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      {/* --- HEADER --- */}
      <div className="relative z-30 p-4 md:p-6 flex items-center justify-between border-b border-slate-800/50 bg-slate-950/30 backdrop-blur-md">
            
            {/* Left: Branding & Status */}
            <div className="flex items-center gap-4">
                 <div className={`p-2 rounded-lg border backdrop-blur-md shadow-lg transition-all ${status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                    <Activity className={`w-5 h-5 ${status === 'connected' ? 'animate-pulse' : ''}`} />
                 </div>
                 <div>
                     <h2 className="text-sm font-bold text-slate-100 tracking-wide flex items-center gap-2">
                        LinguaMaster <span className="text-xs font-normal text-slate-400 bg-slate-800 px-1.5 rounded">Live</span>
                     </h2>
                     <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                         <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                         {status === 'connecting' ? 'Connecting...' : 'Secure Channel'}
                     </div>
                 </div>
            </div>

            {/* Right: Controls & Info */}
            <div className="flex items-center gap-3">
                 
                 {/* Game Button */}
                 <button
                    onClick={handleOpenGame}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all bg-indigo-600/80 hover:bg-indigo-500 text-white border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                    title="Oturumu kapat ve oyuna geç"
                 >
                    <Gamepad2 size={14} />
                    <span className="hidden sm:inline">Oyun</span>
                 </button>
                 
                 <div className="h-6 w-px bg-slate-800 mx-1"></div>

                 {/* Translation Button */}
                 <button
                    onClick={() => setShowTranslation(!showTranslation)}
                    disabled={!translation}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        showTranslation 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Çeviri penceresini aç/kapat"
                 >
                    {showTranslation ? <Eye size={14} /> : <Globe size={14} />}
                    <span className="hidden sm:inline">Türkçe</span>
                 </button>

                 {/* Hints Button */}
                 <button
                    onClick={() => setShowHints(!showHints)}
                    disabled={!hints}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        showHints
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="İpuçları penceresini aç/kapat"
                 >
                    <Sparkles size={14} />
                    <span className="hidden sm:inline">İpucu</span>
                 </button>

                 <div className="h-6 w-px bg-slate-800 mx-1 hidden md:block"></div>

                 {/* Language Badge */}
                 <div className="hidden md:flex flex-col items-end">
                     <span className="text-xs font-bold text-slate-200">{settings.targetLanguage}</span>
                     <span className="text-[10px] text-slate-500">{settings.proficiencyLevel.split(' ')[0]}</span>
                 </div>
            </div>
      </div>

      {/* --- MAIN CONTENT CENTER --- */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-start pt-4 md:pt-6 p-4 w-full max-w-5xl mx-auto">
        
             {/* Main Visualizer - Top & Smaller & Less Distracting */}
             <div className="w-full max-w-[400px] h-[60px] flex items-center justify-center mb-2 shrink-0 opacity-40 transition-all duration-500">
                <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={60}
                    className="w-full h-full"
                />
             </div>

             {/* Transcript Display Container */}
             <div 
                className="relative z-10 text-center max-w-3xl px-4 w-full min-h-[100px]"
                onMouseUp={handleTextMouseUp} // ENABLE SELECTION
             >
                {latestTranscript ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <TranscriptRenderer text={latestTranscript} />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 opacity-40 mt-4">
                        <Ear size={24} className="text-slate-500 animate-pulse" />
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Dinleniyor...</span>
                    </div>
                )}
                
                {/* FLOATING SAVE TOOLBAR (Appears when text is selected) */}
                {selectedText && (
                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 bg-slate-900 border border-emerald-500/30 rounded-full p-1.5 pr-4 shadow-2xl shadow-emerald-900/40 backdrop-blur-xl">
                        <button
                            onClick={clearSelection}
                            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
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
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs font-bold ${
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

             {/* DRAGGABLE WINDOWS - Fixed absolute to viewport to allow dragging anywhere */}
             
             {/* TRANSLATION WINDOW */}
             {showTranslation && translation && (
                <DraggableWindow 
                    title="Çeviri" 
                    icon={<Globe size={14}/>} 
                    content={translation} 
                    onClose={() => setShowTranslation(false)}
                    initialPosition={{ x: 100, y: 150 }}
                    colorClass="emerald"
                    type="translation"
                />
             )}

             {/* HINTS WINDOW */}
             {showHints && hints && (
                <DraggableWindow 
                    title="İpuçları" 
                    icon={<Sparkles size={14}/>} 
                    content={hints} 
                    onClose={() => setShowHints(false)}
                    initialPosition={{ x: (typeof window !== 'undefined' && window.innerWidth > 500) ? window.innerWidth - 420 : 20, y: 150 }}
                    colorClass="amber"
                    type="hints"
                />
             )}

      </div>

      {/* --- BOTTOM CONTROLS (COCKPIT) --- */}
      <div className="relative z-20 p-8 pb-10 flex flex-col items-center justify-end bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
            
            <div className="flex items-center gap-12">
                
                {/* End Session Button */}
                <button 
                    onClick={onClose}
                    className="group flex flex-col items-center gap-2"
                >
                    <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-red-400 group-hover:border-red-500/50 group-hover:bg-red-950/30 transition-all shadow-lg">
                        <Power size={20} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-600 group-hover:text-red-400 transition-colors tracking-widest">Çıkış</span>
                </button>

                {/* Mic Button (Centerpiece) */}
                <button 
                    onClick={toggleMic}
                    className={`relative w-20 h-20 rounded-full transition-all duration-300 shadow-2xl group flex items-center justify-center
                    ${isMicOn 
                        ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-emerald-500/40 hover:scale-105 hover:shadow-emerald-400/60 ring-4 ring-emerald-500/10' 
                        : 'bg-slate-800 border-2 border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-500/30'}`}
                >
                    {/* Ripple Animation */}
                    {isMicOn && (
                        <>
                             <div className="absolute inset-0 rounded-full border border-emerald-400/30 animate-[ping_2s_linear_infinite]"></div>
                             <div className="absolute inset-0 rounded-full border border-emerald-400/20 animate-[ping_2s_linear_infinite_1s]"></div>
                        </>
                    )}
                    
                    {isMicOn ? <Mic size={32} /> : <MicOff size={32} />}
                </button>

                {/* Status / Spacer for symmetry */}
                <div className="flex flex-col items-center gap-2 opacity-0 pointer-events-none">
                     <div className="w-12 h-12"></div>
                     <span className="text-[10px]">Spacer</span>
                </div>
            </div>
      </div>

    </div>
  );
};
