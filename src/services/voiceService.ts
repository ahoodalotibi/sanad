/**
 * Voice Service: Speech-to-Text & Text-to-Speech
 * Powers the Voice-to-Voice Experience in SANAD for English, Urdu, and Bengali
 */
import { SupportedLanguage } from '../types';

// Speech Recognition API type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export class VoiceService {
  private recognition: any = null;
  private isRecording = false;

  private langLocales: Record<SupportedLanguage, string> = {
    en: 'en-US',
    ur: 'ur-PK',
    bn: 'bn-BD'
  };

  constructor() {
    const SpeechRecognitionClass = 
      typeof window !== 'undefined' 
        ? window.SpeechRecognition || window.webkitSpeechRecognition 
        : null;

    if (SpeechRecognitionClass) {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
    }
  }

  public isSpeechSupported(): boolean {
    return Boolean(this.recognition);
  }

  public isTtsSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Start Speech-to-Text Recording
   */
  public startListening(
    lang: SupportedLanguage,
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (errorMsg: string) => void,
    onEnd: () => void
  ) {
    if (!this.recognition) {
      onError("Speech recognition is not supported in this browser. Please type your question.");
      return;
    }

    try {
      this.recognition.lang = this.langLocales[lang] || 'en-US';
      this.isRecording = true;

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        onResult(currentText, Boolean(finalTranscript));
      };

      this.recognition.onerror = (event: any) => {
        this.isRecording = false;
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          onError("Microphone permission was denied. Please allow microphone access.");
        } else {
          onError(`Voice input error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        onEnd();
      };

      this.recognition.start();
    } catch (err: any) {
      this.isRecording = false;
      onError(err?.message || "Could not start voice recording.");
    }
  }

  /**
   * Stop Speech-to-Text Recording
   */
  public stopListening() {
    if (this.recognition && this.isRecording) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Error stopping speech recognition:', err);
      }
      this.isRecording = false;
    }
  }

  /**
   * Text-to-Speech Playback
   */
  public speak(
    text: string, 
    lang: SupportedLanguage,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (!this.isTtsSupported()) return;

    // Cancel any previous speech
    window.speechSynthesis.cancel();

    // Clean markdown stars/tags for natural speech
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/👉/g, '')
      .replace(/#+/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = this.langLocales[lang] || 'en-US';
    utterance.rate = 0.95; // Slightly measured, calm tone
    utterance.pitch = 1.0;

    // Pick a voice matching language if available
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(lang));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (this.isTtsSupported()) {
      window.speechSynthesis.cancel();
    }
  }
}

export const voiceService = new VoiceService();
