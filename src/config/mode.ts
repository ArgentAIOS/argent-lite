export type RuntimeMode = "satellite" | "standalone";

export const RUNTIME_MODES: readonly RuntimeMode[] = [
  "satellite",
  "standalone",
] as const;

export const DEFAULT_RUNTIME_MODE: RuntimeMode = "standalone";

export class InvalidRuntimeModeError extends Error {
  constructor(value: string) {
    super(
      `Invalid ARGENT_MODE=${JSON.stringify(value)}; expected one of ${RUNTIME_MODES.join(", ")}`,
    );
    this.name = "InvalidRuntimeModeError";
  }
}

function isRuntimeMode(value: string): value is RuntimeMode {
  return (RUNTIME_MODES as readonly string[]).includes(value);
}

export function loadMode(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeMode {
  const raw = env.ARGENT_MODE;
  if (raw === undefined || raw === "") {
    return DEFAULT_RUNTIME_MODE;
  }
  const normalized = raw.trim().toLowerCase();
  if (!isRuntimeMode(normalized)) {
    throw new InvalidRuntimeModeError(raw);
  }
  return normalized;
}
