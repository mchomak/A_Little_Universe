const path = require('node:path')

function getRecordingRoot(app) {
  return path.join(app.getPath('videos'), 'A_Little_Universe_Records')
}

module.exports = { getRecordingRoot }
