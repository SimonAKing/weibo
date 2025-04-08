const axios = require('axios')

const owner = 'SimonAKing'
const repo = 'weibo'
const { ISSUE_TOKEN } = process.env

const Weibo = axios.create({
  baseURL: 'https://api.github.com/',
  headers: {
    'Accept': 'application/json',
    Authorization: `bearer ${ISSUE_TOKEN}`
  }
})

const getIssues = vars => {
  const ql = `
  query getIssues($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      issues(first: 1, orderBy: {field: CREATED_AT, direction: DESC},
        filterBy: {createdBy: $owner, states: OPEN}) {
        nodes {
          body
        }
      }
    }
  }
  `
  return { operationName: 'getIssues', query: ql, variables: vars }
}

const filterIssue = body => {
  const header = ``
  const footer = `\r\n\r\n微博地址: https://simonaking.com/blog/weibo`
  return header + body + footer
}

module.exports = () => {
  return Weibo.post('/graphql',
    getIssues({ owner, repo })
  ).then(res => {
    const issue = res.data.data.repository.issues.nodes[0].body
    return filterIssue(issue)
  })
}
