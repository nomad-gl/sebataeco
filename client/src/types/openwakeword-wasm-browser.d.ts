declare module "openwakeword-wasm-browser" {
  interface WakeWordEngineConfig {
    baseAssetUrl?: string;
    modelUrls?: Record<string, string>;
    keywords?: string[];
    detectionThreshold?: number;
    cooldownMs?: number;
    debug?: boolean;
    ortWasmPath?: string;
    deviceId?: string;
    gain?: number;
  }

  interface DetectEvent {
    keyword: string;
    score: number;
    at: number;
  }

  type WakeWordEventMap = {
    detect: DetectEvent;
    "speech-start": void;
    "speech-end": void;
    ready: void;
    error: unknown;
  };

  class WakeWordEngine {
    constructor(config: WakeWordEngineConfig);
    load(): Promise<void>;
    start(opts?: { deviceId?: string; gain?: number }): Promise<void>;
    stop(): Promise<void>;
    setGain(value: number): void;
    setActiveKeywords(keywords: string[]): void;
    runWav(arrayBuffer: ArrayBuffer): Promise<number>;
    on<K extends keyof WakeWordEventMap>(
      event: K,
      listener: (data: WakeWordEventMap[K]) => void
    ): () => void;
  }

  export default WakeWordEngine;
}
