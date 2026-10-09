export type LogLevel = "info" | "warn" | "error";

export interface OperationalLogEvent {
  level: LogLevel;
  event: string;
  ownerId?: string | null;
  documentId?: string;
  revision?: number;
  durationMs?: number;
  statusCode?: number;
  errorCode?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

// In-memory ring buffer for inspecting logs during testing and health checks
const LOG_BUFFER: OperationalLogEvent[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Emits structured operational telemetry while strictly preventing
 * the leakage of raw candidate facts, bullet texts, prompts, or credentials.
 */
export function logOperation(event: OperationalLogEvent): void {
  const sanitizedMetadata: Record<string, string | number | boolean | null> = {};
  if (event.metadata) {
    for (const [key, value] of Object.entries(event.metadata)) {
      // Discard potential PII, prompts, or sensitive credentials
      if (
        /prompt|password|secret|token|authorization|rawtext|bullettext|content|email|phone/i.test(
          key,
        )
      ) {
        continue;
      }
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        sanitizedMetadata[key] = value;
      }
    }
  }

  const cleanEvent: OperationalLogEvent = {
    ...event,
    metadata: Object.keys(sanitizedMetadata).length > 0 ? sanitizedMetadata : undefined,
  };

  LOG_BUFFER.push(cleanEvent);
  if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
    LOG_BUFFER.shift();
  }

  if (process.env.NODE_ENV !== "test") {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...cleanEvent,
    });
    if (event.level === "error") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }
}

export function getLogBuffer(): readonly OperationalLogEvent[] {
  return [...LOG_BUFFER];
}

export function clearLogBuffer(): void {
  LOG_BUFFER.length = 0;
}
