import type { AgentContext } from "./agent-context.js";
import type { AgentDescriptor, AgentMessage, AgentState } from "./types.js";

export abstract class BaseAgent {
  readonly id: string;
  protected readonly ctx: AgentContext;
  private _state: AgentState = "init";
  private _startedAt?: number;
  private _runPromise?: Promise<void>;
  private _unsubscribe?: () => void;

  constructor(id: string, ctx: AgentContext) {
    this.id = id;
    this.ctx = ctx;
  }

  get state(): AgentState {
    return this._state;
  }

  describe(): AgentDescriptor {
    return {
      id: this.id,
      state: this._state,
      startedAt: this._startedAt,
    };
  }

  abstract run(): Promise<void>;

  onMessage(_msg: AgentMessage): void | Promise<void> {
    return undefined;
  }

  start(): Promise<void> {
    if (this._state !== "init") {
      throw new Error(`BaseAgent(${this.id}): cannot start from state "${this._state}"`);
    }
    this._state = "running";
    this._startedAt = this.ctx.now();
    this._unsubscribe = this.ctx.bus.subscribe(this.id, (msg) => this.onMessage(msg));
    this._runPromise = this.run().finally(() => {
      this._unsubscribe?.();
      this._unsubscribe = undefined;
      if (this._state !== "stopped") {
        this._state = "stopped";
      }
    });
    return this._runPromise;
  }

  suspend(): void {
    if (this._state !== "running") {
      throw new Error(`BaseAgent(${this.id}): cannot suspend from state "${this._state}"`);
    }
    this._state = "suspended";
  }

  resume(): void {
    if (this._state !== "suspended") {
      throw new Error(`BaseAgent(${this.id}): cannot resume from state "${this._state}"`);
    }
    this._state = "running";
  }

  stop(): void {
    if (this._state !== "running" && this._state !== "suspended") {
      throw new Error(`BaseAgent(${this.id}): cannot stop from state "${this._state}"`);
    }
    this._state = "stopped";
  }
}
