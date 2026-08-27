// import-fathom-v2.mjs prefixes clients.context_summary with a fixed
// sentence ("Contexto general creado desde la primera llamada registrada
// (DATE, TITLE)."). The date is shown as its own metadata row instead
// (derived from the actual call, not text-parsed), so that sentence is
// redundant noise in the rendered body.
const INTRO_LINE_PATTERN = /^Contexto general creado desde la primera llamada registrada[^\n]*\n*/;

export function stripContextIntro(text: string): string {
  return text.replace(INTRO_LINE_PATTERN, "").trimStart();
}
