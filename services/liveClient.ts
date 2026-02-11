import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

export class LiveClient {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private inputNode: ScriptProcessorNode | null = null; // Using ScriptProcessor as per guidelines
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private outputNode: GainNode | null = null;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private sessionPromise: Promise<any> | null = null; // Session object
  private onCloseCallback: () => void = () => {};
  private onVolumeChange: (vol: number) => void = () => {};

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async connect(
    onOpen: () => void,
    onError: (err: any) => void,
    onClose: () => void,
    onVolume: (vol: number) => void
  ) {
    this.onCloseCallback = onClose;
    this.onVolumeChange = onVolume;

    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    this.outputNode = this.outputAudioContext!.createGain();
    this.outputNode.connect(this.outputAudioContext!.destination);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            console.log('Live Session Opened');
            this.setupAudioInput();
            onOpen();
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live Session Error', e);
            onError(e);
          },
          onclose: (e: CloseEvent) => {
            console.log('Live Session Closed', e);
            this.disconnect();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Aoede, Charon, Fenrir, Kore, Puck
          },
          systemInstruction: "Você é um assistente de IA útil, inteligente e conciso. Você está conversando com o usuário por voz. Responda sempre em Português do Brasil.",
        },
      };

      this.sessionPromise = this.ai.live.connect(config);
      
    } catch (err) {
      console.error("Failed to initialize audio or connection", err);
      onError(err);
      this.disconnect();
    }
  }

  private setupAudioInput() {
    if (!this.inputAudioContext || !this.stream || !this.sessionPromise) return;

    this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.inputNode = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.inputNode.onaudioprocess = (audioProcessingEvent) => {
      const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualization
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolumeChange(rms * 100); // Scale up

      const pcmBlob = this.createBlob(inputData);
      
      this.sessionPromise!.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.sourceNode.connect(this.inputNode);
    this.inputNode.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio && this.outputAudioContext && this.outputNode) {
      // Calculate fake volume for output visualization based on chunk size presence
      this.onVolumeChange(Math.random() * 50 + 20);

      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      const audioBytes = this.decode(base64Audio);
      const audioBuffer = await this.decodeAudioData(audioBytes, this.outputAudioContext, 24000, 1);
      
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);
      
      source.addEventListener('ended', () => {
        this.sources.delete(source);
        if (this.sources.size === 0) {
           this.onVolumeChange(0); // Reset visualizer when silent
        }
      });

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
    }

    const interrupted = message.serverContent?.interrupted;
    if (interrupted) {
      console.log("Interrupted");
      this.sources.forEach(s => s.stop());
      this.sources.clear();
      this.nextStartTime = 0;
    }
  }

  disconnect() {
    if (this.sessionPromise) {
        this.sessionPromise.then(session => session.close()).catch(() => {}); // Best effort close
        this.sessionPromise = null;
    }
    
    this.sources.forEach(s => s.stop());
    this.sources.clear();

    if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
    }
    if (this.inputNode) {
        this.inputNode.disconnect();
        this.inputNode = null;
    }
    if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
    }
    if (this.inputAudioContext) {
        this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
        this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
    
    this.onCloseCallback();
  }

  private createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: this.encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
}