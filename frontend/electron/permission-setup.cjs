/** Run only when the user explicitly starts the one-time setup mode. */
async function requestRecordingPermissions(systemPreferences) {
  const result = {}
  for (const kind of ['camera', 'microphone']) {
    const status = systemPreferences.getMediaAccessStatus(kind)
    if (status === 'not-determined') await systemPreferences.askForMediaAccess(kind)
    result[kind] = systemPreferences.getMediaAccessStatus(kind)
  }
  return result
}

module.exports = { requestRecordingPermissions }
