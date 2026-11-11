export function clientWorkspaceShowsCalls(section, selectedCallId) {
  return Boolean(selectedCallId) || section !== 'map';
}
