export function contextFromCall(call) {
  const summary = String(call.summary || "").trim();
  if (!summary) return null;
  const title = String(call.title || "").trim() || "primera llamada";
  const date = call.started_at ? String(call.started_at).slice(0, 10) : "fecha no disponible";
  return `Contexto general creado desde la primera llamada registrada (${date}, ${title}).\n\n${summary}`;
}
