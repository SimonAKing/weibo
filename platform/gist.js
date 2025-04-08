const axios = require('axios')

const { GIST_TOKEN } = process.env

const gistID = '2387925d8c60bb011d92cc82ebcdc357'

const Gist = axios.create({
  baseURL: 'https://api.github.com/gists/',
  headers: { Authorization: 'token ' + GIST_TOKEN }
})

module.exports = issue => {
  Gist.patch(gistID, {
    description: '✨ Latest Thoughts',
    files: {
      'Thoughts.md': {
        content: issue
      }
    }
  })
}