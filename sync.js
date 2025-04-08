const getIssue = require('./issue')
const telegram = require('./platform/telegram')
const gist = require('./platform/gist')
const twitter = require('./platform/twitter')

const sync = () => {
  getIssue().then(issue => {
    telegram(issue)
  })
}

sync()
