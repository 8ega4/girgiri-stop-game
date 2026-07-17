const DEV = import.meta.env.DEV;

export function track(event: string, parameters: Record<string, unknown> = {}): void {
  const source = new URLSearchParams(window.location.search).get("from") ?? "direct";
  const payload = { ...parameters, source };
  if (typeof window.gtag === "function") {
    window.gtag("event", event, payload);
  } else if (DEV) {
    console.info(`[analytics] ${event}`, payload);
  }
}
