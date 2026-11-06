function createAppWindowCaptureHandler({ isAppOrigin, getWebContents, getWindow, getSources }) {
  return async (request, callback) => {
    let responded = false
    const respond = (value) => {
      if (responded) return
      responded = true
      callback(value)
    }
    const deny = () => respond(null)
    const frame = request.frame
    if (!request.videoRequested || !isAppOrigin(request.securityOrigin) || !frame) return deny()

    try {
      if (frame.isDestroyed() || frame.parent !== null) return deny()
      const contents = getWebContents(frame)
      if (!contents || contents.isDestroyed() || !isAppOrigin(contents.getURL())) return deny()
      const window = getWindow(contents)
      if (!window || window.isDestroyed()) return deny()

      const sourceId = window.getMediaSourceId()
      const sources = await getSources({ types: ['window'], thumbnailSize: { width: 1, height: 1 } })
      if (frame.isDestroyed() || contents.isDestroyed() || window.isDestroyed()) return deny()
      const source = sources.find((candidate) => candidate.id === sourceId)
      return respond(source ? { video: source } : null)
    } catch (error) {
      console.error('Could not select the requesting app window for capture.', error)
      return deny()
    }
  }
}

module.exports = { createAppWindowCaptureHandler }
