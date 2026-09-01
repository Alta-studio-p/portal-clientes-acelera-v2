const GENERIC_TITLE_PATTERN = /^(impromptu|untitled|meeting|google meet|zoom meeting)/i;

const PURPOSE_HEADING_PATTERN =
  /##\s*(?:meeting purpose|session purpose|call purpose|prop[oó]sito de la reuni[oó]n|prop[oó]sito de la llamada)\s*\n+\s*(?:\[([^\]]+)\]|(.+))/i;

/**
 * Fathom sometimes leaves the raw calendar title ("Impromptu Google Meet
 * Meeting") when the host didn't rename the call. In that case the actual
 * topic lives in the first line of the summary ("Meeting Purpose" /
 * "Propósito de la reunión"), so we fall back to that instead of showing the
 * generic calendar title.
 */
export function displayCallTitle(call: {
  title: string | null;
  summary: string | null;
  display_title?: string | null;
}): string {
  if (call.display_title?.trim()) return call.display_title.trim();

  const title = call.title?.trim();
  const looksGeneric = !title || GENERIC_TITLE_PATTERN.test(title);

  if (looksGeneric && call.summary) {
    const match = call.summary.match(PURPOSE_HEADING_PATTERN);
    const summaryTitle = match?.[1] || match?.[2];
    if (summaryTitle) {
      return summaryTitle.replace(/\.$/, "").trim();
    }
  }

  return title || "Llamada sin título";
}
