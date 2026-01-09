
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, PlacementQuestion, NewsArticle, WritingFeedback, IdiomCard, ShadowingResult } from '../types';
import { generatePlacementTest, evaluateWriting, generateNewsArticles, generateIdiom, evaluateShadowing, generateSpeechFromText } from '../services/geminiService';
import { audioBufferToWavBlob } from '../utils/audioUtils';
import { X, BookOpen, PenTool, Mic, Newspaper, Sparkles, Check, RefreshCw, Play, Pause, ChevronRight, GraduationCap, AlertCircle, Volume2, ArrowRight } from 'lucide-react';

interface StudyHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  audioContext: AudioContext | null;
  onUpdateLevel: (level: string) => void;
}

export const StudyHubModal: React.FC<StudyHubModalProps> = ({ isOpen, onClose, settings, audioContext, onUpdateLevel }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'test' | 'writing' | 'reading' | 'shadowing' | 'idiom'>('menu');
  const [isLoading, setIsLoading] = useState(false);

  // --- PLACEMENT TEST STATES ---
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [testScore, setTestScore] = useState(0);
  const [testFinished, setTestFinished] = useState(false);

  // --- WRITING STATES ---
  const [writingText, setWritingText] = useState("");
  const [writingFeedback, setWritingFeedback] = useState<WritingFeedback | null>(null);

  // --- READING STATES ---
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  // --- SHADOWING STATES ---
  const [shadowText, setShadowText] = useState("The quick brown fox jumps over the lazy dog.");
  const [isRecording, setIsRecording] = useState(false);
  const [shadowResult, setShadowResult] = useState<ShadowingResult | null>(null);
  const recognitionRef = useRef<any>(null);

  // --- IDIOM STATES ---
  const [idiom, setIdiom] = useState<IdiomCard | null>(null);

  // --- HELPERS ---
  const playAudio = async (text: string) => {
      if (!audioContext) return;
      const buffer = await generateSpeechFromText(text, settings, audioContext);
      if (buffer) {
          const wavBlob = audioBufferToWavBlob(buffer);
          const audio = new Audio(URL.createObjectURL(wavBlob));
          audio.play();
      }
  };

  // --- HANDLERS ---

  const startPlacementTest = async () => {
      setIsLoading(true);
      const qs = await generatePlacementTest(settings);
      setQuestions(qs);
      setCurrentQIndex(0);
      setTestScore(0);
      setTestFinished(false);
      setIsLoading(false);
      setActiveTab('test');
  };

  const handleTestAnswer = (index: number) => {
      if (index === questions[currentQIndex].correctIndex) {
          setTestScore(s => s + 1);
      }
      if (currentQIndex < questions.length - 1) {
          setCurrentQIndex(p => p + 1);
      } else {
          setTestFinished(true);
          // Simple logic: >8 correct -> Upgrade level (mock)
          if (testScore >= 7) {
              // Logic to upgrade level could be passed here
          }
      }
  };

  const submitWriting = async () => {
      if (!writingText.trim()) return;
      setIsLoading(true);
      const fb = await evaluateWriting(writingText, settings);
      setWritingFeedback(fb);
      setIsLoading(false);
  };

  const loadNews = async () => {
      setIsLoading(true);
      const news = await generateNewsArticles(settings);
      setArticles(news);
      setIsLoading(false);
      setActiveTab('reading');
  };

  const loadIdiom = async () => {
      setIsLoading(true);
      const card = await generateIdiom(settings);
      setIdiom(card);
      setIsLoading(false);
      setActiveTab('idiom');
  };

  const startShadowing = () => {
      setActiveTab('shadowing');
      setShadowResult(null);
  };

  const handleShadowRecord = () => {
      if (!('webkitSpeechRecognition' in window)) {
          alert("Tarayıcı desteklemiyor.");
          return;
      }
      setIsRecording(true);
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsRecording(false);
          setIsLoading(true);
          const res = await evaluateShadowing(shadowText, transcript, settings);
          setShadowResult(res);
          setIsLoading(false);
      };
      recognition.start();
      recognitionRef.current = recognition;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose}></div>
        
        <div className="relative w-full max-w-5xl h-[85vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-lg"><GraduationCap className="text-white" size={20} /></div>
                    <h2 className="text-xl font-bold text-white">Study Hub</h2>
                </div>
                <div className="flex gap-2">
                    {activeTab !== 'menu' && (
                        <button onClick={() => setActiveTab('menu')} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-sm">Menüye Dön</button>
                    )}
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><X size={20} /></button>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                
                {/* MENU */}
                {activeTab === 'menu' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <button onClick={startPlacementTest} className="group p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500 hover:bg-slate-800 transition-all text-left">
                            <div className="mb-4 p-3 bg-emerald-500/10 w-fit rounded-lg"><Check className="text-emerald-500" size={24} /></div>
                            <h3 className="text-lg font-bold text-white mb-1">Seviye Tespit Sınavı</h3>
                            <p className="text-sm text-slate-400">Mevcut İngilizce seviyeni ölç ve güncelle.</p>
                        </button>

                        <button onClick={() => setActiveTab('writing')} className="group p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-blue-500 hover:bg-slate-800 transition-all text-left">
                            <div className="mb-4 p-3 bg-blue-500/10 w-fit rounded-lg"><PenTool className="text-blue-500" size={24} /></div>
                            <h3 className="text-lg font-bold text-white mb-1">Writing Assistant</h3>
                            <p className="text-sm text-slate-400">Yazılarını yapay zeka ile düzelt ve puanla.</p>
                        </button>

                        <button onClick={loadNews} className="group p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-amber-500 hover:bg-slate-800 transition-all text-left">
                            <div className="mb-4 p-3 bg-amber-500/10 w-fit rounded-lg"><Newspaper className="text-amber-500" size={24} /></div>
                            <h3 className="text-lg font-bold text-white mb-1">Günlük Haberler</h3>
                            <p className="text-sm text-slate-400">Seviyene uygun kısa haberleri oku ve çevir.</p>
                        </button>

                        <button onClick={startShadowing} className="group p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-purple-500 hover:bg-slate-800 transition-all text-left">
                            <div className="mb-4 p-3 bg-purple-500/10 w-fit rounded-lg"><Mic className="text-purple-500" size={24} /></div>
                            <h3 className="text-lg font-bold text-white mb-1">Shadowing (Gölgeleme)</h3>
                            <p className="text-sm text-slate-400">Dinle ve tekrar et. Telaffuzunu geliştir.</p>
                        </button>

                        <button onClick={loadIdiom} className="group p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-pink-500 hover:bg-slate-800 transition-all text-left">
                            <div className="mb-4 p-3 bg-pink-500/10 w-fit rounded-lg"><Sparkles className="text-pink-500" size={24} /></div>
                            <h3 className="text-lg font-bold text-white mb-1">Günün Deyimi</h3>
                            <p className="text-sm text-slate-400">İngilizce deyimler ve sokak ağzı öğren.</p>
                        </button>
                    </div>
                )}

                {/* PLACEMENT TEST */}
                {activeTab === 'test' && (
                    <div className="max-w-2xl mx-auto">
                        {isLoading ? <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto mb-4 text-emerald-500" /> Test Hazırlanıyor...</div> : (
                            testFinished ? (
                                <div className="text-center py-20 bg-slate-900 rounded-2xl border border-slate-800">
                                    <h3 className="text-3xl font-bold text-white mb-2">Test Tamamlandı!</h3>
                                    <p className="text-slate-400 mb-6">Sonuç: {testScore} / {questions.length}</p>
                                    <button onClick={() => setActiveTab('menu')} className="px-6 py-3 bg-emerald-600 text-white rounded-lg">Menüye Dön</button>
                                </div>
                            ) : (
                                <div>
                                    <div className="mb-6 flex justify-between text-sm text-slate-400">
                                        <span>Soru {currentQIndex + 1}/{questions.length}</span>
                                        <span>Seviye: {questions[currentQIndex]?.level}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-6 leading-relaxed">{questions[currentQIndex]?.question}</h3>
                                    <div className="space-y-3">
                                        {questions[currentQIndex]?.options.map((opt, i) => (
                                            <button key={i} onClick={() => handleTestAnswer(i)} className="w-full p-4 text-left bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-200 transition-colors border border-slate-700">
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* WRITING ASSISTANT */}
                {activeTab === 'writing' && (
                    <div className="flex flex-col md:flex-row gap-6 h-full">
                        <div className="flex-1 flex flex-col gap-4">
                            <textarea 
                                value={writingText}
                                onChange={(e) => setWritingText(e.target.value)}
                                placeholder="Buraya İngilizce bir paragraf yazın..."
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 resize-none focus:outline-none focus:border-blue-500 min-h-[300px]"
                            />
                            <button onClick={submitWriting} disabled={isLoading || !writingText} className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                {isLoading ? <RefreshCw className="animate-spin" /> : <PenTool />} Analiz Et
                            </button>
                        </div>
                        {writingFeedback && (
                            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-y-auto">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-white">Sonuçlar</h3>
                                    <div className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full font-bold text-sm">Puan: {writingFeedback.score}</div>
                                </div>
                                <p className="text-slate-400 text-sm mb-6 italic">{writingFeedback.critique}</p>
                                <div className="space-y-4">
                                    {writingFeedback.mistakes.map((m, i) => (
                                        <div key={i} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                            <div className="text-red-400 line-through text-sm">{m.original}</div>
                                            <div className="text-emerald-400 font-bold text-base">{m.correction}</div>
                                            <div className="text-slate-500 text-xs mt-1">{m.explanation}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-800">
                                    <h4 className="text-white font-bold mb-2">Düzeltilmiş Metin:</h4>
                                    <p className="text-slate-300 text-sm leading-relaxed">{writingFeedback.correctedText}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* READING */}
                {activeTab === 'reading' && (
                    <div className="max-w-4xl mx-auto">
                        {isLoading ? <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto mb-4 text-amber-500" /> Haberler Hazırlanıyor...</div> : (
                            selectedArticle ? (
                                <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800">
                                    <button onClick={() => setSelectedArticle(null)} className="mb-4 text-amber-500 text-sm hover:underline">← Listeye Dön</button>
                                    <h2 className="text-2xl font-bold text-white mb-4">{selectedArticle.title}</h2>
                                    <p className="text-slate-300 leading-relaxed text-lg mb-6">{selectedArticle.content}</p>
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6">
                                        <h4 className="text-amber-400 font-bold mb-2 text-sm uppercase">Çeviri</h4>
                                        <p className="text-slate-400 text-sm italic">{selectedArticle.translation}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold mb-2">Önemli Kelimeler</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedArticle.keywords.map((kw, i) => (
                                                <span key={i} className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs text-slate-300">
                                                    <span className="text-white font-bold">{kw.word}</span>: {kw.meaning}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {articles.map((art) => (
                                        <button key={art.id} onClick={() => setSelectedArticle(art)} className="p-5 bg-slate-900 border border-slate-800 hover:border-amber-500 rounded-xl text-left transition-all">
                                            <h3 className="text-lg font-bold text-white mb-2">{art.title}</h3>
                                            <p className="text-slate-400 text-sm line-clamp-2">{art.content}</p>
                                        </button>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* IDIOMS */}
                {activeTab === 'idiom' && (
                    <div className="flex items-center justify-center h-full">
                        {isLoading ? <RefreshCw className="animate-spin text-pink-500" /> : idiom && (
                            <div className="max-w-md w-full bg-slate-900 border border-pink-500/30 p-8 rounded-2xl text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-500"></div>
                                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-4">{idiom.idiom}</h2>
                                <p className="text-white text-lg font-medium mb-6">{idiom.meaning}</p>
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4">
                                    <p className="text-slate-300 italic">"{idiom.example}"</p>
                                </div>
                                <p className="text-slate-500 text-xs mt-4">{idiom.origin}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* SHADOWING */}
                {activeTab === 'shadowing' && (
                    <div className="max-w-2xl mx-auto flex flex-col items-center gap-8 py-10">
                        <div className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center">
                            <h3 className="text-slate-400 text-sm uppercase font-bold mb-4">Referans Cümle</h3>
                            <p className="text-2xl font-medium text-white mb-6">{shadowText}</p>
                            <button onClick={() => playAudio(shadowText)} className="p-3 bg-indigo-600 rounded-full text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30">
                                <Volume2 size={24} />
                            </button>
                        </div>

                        <button 
                            onClick={handleShadowRecord}
                            className={`w-20 h-20 rounded-full flex items-center justify-center border-4 transition-all ${isRecording ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-slate-800 border-slate-600 hover:border-purple-500'}`}
                        >
                            <Mic size={32} className="text-white" />
                        </button>
                        <p className="text-slate-500 text-sm">{isRecording ? "Dinleniyor..." : "Mikrofon butonuna basılı tutmayın, tıklayıp konuşun."}</p>

                        {isLoading && <RefreshCw className="animate-spin text-purple-500" />}

                        {shadowResult && (
                            <div className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-white font-bold">Sonuç</h4>
                                    <div className="text-emerald-400 font-bold text-xl">{shadowResult.score}/100</div>
                                </div>
                                <div className="p-3 bg-slate-800 rounded-lg mb-4 text-slate-300 italic text-sm">
                                    Algılanan: "{shadowResult.transcript}"
                                </div>
                                <p className="text-slate-400 text-sm">{shadowResult.feedback}</p>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};
