import React, { useState, useRef, KeyboardEvent } from 'react';
import { Send, Loader2, Mic, Square } from 'lucide-react';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
  onSendAudio: (audioBlob: Blob) => void;
  isLoading: boolean;
  disabled: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, onSendAudio, isLoading, disabled }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSendText = () => {
    if (text.trim() && !isLoading && !disabled) {
      onSendMessage(text);
      setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' }); // Genellikle webm opus
        onSendAudio(audioBlob);
        
        // Stop tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Mikrofona erişilemedi.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4 md:p-6 w-full max-w-4xl mx-auto">
      <div className={`relative flex items-end gap-2 bg-slate-800 rounded-xl border transition-all shadow-sm ${isRecording ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-700 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20'}`}>
        
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Ses kaydediliyor..." : (disabled ? "Devam etmek için API Anahtarını yapılandırın..." : "Mesaj yazın veya konuşun...")}
          disabled={disabled || isLoading || isRecording}
          className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm p-4 min-h-[56px] max-h-32 resize-none focus:outline-none disabled:cursor-not-allowed"
          rows={1}
          style={{ height: 'auto', minHeight: '56px' }}
        />

        <div className="flex gap-2 p-2 pb-2.5">
            {/* AUDIO BUTTON */}
            <button
                onClick={toggleRecording}
                disabled={isLoading || disabled || (!!text.trim())} // Metin varsa ses gönderemesin, karışmasın
                className={`p-2.5 rounded-lg transition-all shadow-lg flex items-center justify-center ${
                    isRecording 
                    ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? "Kaydı Bitir ve Gönder" : "Ses Kaydet"}
            >
                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* SEND TEXT BUTTON */}
            {!isRecording && (
                <button
                    onClick={handleSendText}
                    disabled={!text.trim() || isLoading || disabled}
                    className="p-2.5 rounded-lg bg-indigo-600 text-white disabled:bg-slate-700 disabled:text-slate-500 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            )}
        </div>
      </div>
      <div className="text-center mt-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
           {isRecording ? <span className="text-red-400">● Kayıt Yapılıyor...</span> : "Kesinlikle gizlidir • YZ Uzman Sistemi"}
        </p>
      </div>
    </div>
  );
};