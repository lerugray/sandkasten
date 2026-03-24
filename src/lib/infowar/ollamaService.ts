/**
 * Ollama service layer.
 *
 * Manages connection to a local Ollama instance, queues generation
 * requests, and handles graceful degradation when Ollama is unavailable.
 */

const DEFAULT_URL = "http://localhost:11434";
const MAX_CONCURRENT = 3;
const GENERATION_TIMEOUT_MS = 15000;
const DEFAULT_MODEL = "mistral";

interface QueueItem {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
}

class OllamaService {
  private baseUrl: string;
  private activeRequests = 0;
  private queue: QueueItem[] = [];
  private _connected = false;
  private _availableModels: string[] = [];

  constructor(baseUrl = DEFAULT_URL) {
    this.baseUrl = baseUrl;
  }

  get connected(): boolean {
    return this._connected;
  }

  get pending(): number {
    return this.queue.length + this.activeRequests;
  }

  get availableModels(): string[] {
    return this._availableModels;
  }

  /**
   * Check if Ollama is running and the desired model is available.
   */
  async checkConnection(model = DEFAULT_MODEL): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this._connected = false;
        return false;
      }

      const data = await res.json();
      const models: string[] = (data.models ?? []).map(
        (m: { name: string }) => m.name.split(":")[0]
      );
      this._availableModels = models;
      this._connected = true;

      // Check if the specific model is available
      const hasModel = models.some(
        (m) => m === model || m.startsWith(model)
      );
      return hasModel;
    } catch {
      this._connected = false;
      this._availableModels = [];
      return false;
    }
  }

  /**
   * Generate text from a system + user prompt. Returns the generated text.
   * Queued — respects MAX_CONCURRENT to avoid overwhelming the GPU.
   */
  generate(
    systemPrompt: string,
    userPrompt: string,
    model = DEFAULT_MODEL
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ systemPrompt, userPrompt, model, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.activeRequests < MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.activeRequests++;
      this.executeGeneration(item).finally(() => {
        this.activeRequests--;
        this.processQueue();
      });
    }
  }

  private async executeGeneration(item: QueueItem): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        GENERATION_TIMEOUT_MS
      );

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: item.model,
          messages: [
            { role: "system", content: item.systemPrompt },
            { role: "user", content: item.userPrompt },
          ],
          stream: false,
          options: {
            temperature: 0.8,
            top_p: 0.9,
            num_predict: 256,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        item.reject(new Error(`Ollama returned ${res.status}`));
        return;
      }

      const data = await res.json();
      const content = data.message?.content ?? "";
      item.resolve(content.trim());
    } catch (err) {
      item.reject(
        err instanceof Error ? err : new Error("Ollama generation failed")
      );
    }
  }
}

export const ollamaService = new OllamaService();
