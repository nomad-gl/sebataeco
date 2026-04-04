declare module "onnxruntime-web" {
  export class InferenceSession {
    static create(uri: string, options?: unknown): Promise<InferenceSession>;
    readonly inputNames: string[];
    readonly outputNames: string[];
    run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | BigInt64Array }>>;
  }

  export class Tensor {
    constructor(type: string, data: Float32Array | BigInt64Array | number[], dims: number[]);
    readonly data: Float32Array | BigInt64Array;
    readonly dims: number[];
  }

  export const env: {
    wasm: {
      wasmPaths?: string;
    };
  };
}
