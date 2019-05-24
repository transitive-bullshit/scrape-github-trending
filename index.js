#!/usr/bin/env node
'use strict'

const pMap = require('p-map')
const cheerio = require('cheerio')
const got = require('got')
const { resolve } = require('url')

const baseUrl = 'https://github.com'

exports.main = async () => {
  const { body } = await got(`https://github.com/trending`)

  const $ = cheerio.load(body)
  const repos = $('.repo-list li').get().map((li) => {
    try {
      const $li = $(li)
      const $link = $li.find('h3 a')
      const url = resolve(baseUrl, $link.attr('href'))
      const linkText = $link.text()
      const repoParts = linkText.split('/').map((p) => p.trim())
      const desc = $li.find('p').text().trim()

      return {
        url,
        userName: repoParts[0],
        repoName: repoParts[1],
        desc
      }
    } catch (err) {
      console.error('parse error', err)
    }
  }).filter(Boolean)

  return (await pMap(repos, processDetailPage, {
    concurrency: 3
  })).filter(Boolean)
}

async function processDetailPage (repo) {
  console.warn('processing repo', repo.url)

  try {
    const { body } = await got(repo.url)

    const $ = cheerio.load(body)
    const numCommits = $('.commits span').text().trim()

    const [
      numIssues,
      numPRs,
      numProjects
    ] = $('.Counter').map((i, el) => parseInt($(el).text().trim())).get()

    const [
      numWatchers,
      numStars,
      numStarsRedundant, // eslint-disable-line
      numForks
    ] = $('.social-count').map((i, el) => parseInt($(el).text().trim().replace(/,/g, ''))).get()

    const languages = $('.repository-lang-stats-numbers li').map((i, li) => {
      const $li = $(li)
      const lang = $li.find('.lang').text().trim()
      const percentStr = $li.find('.percent').text().trim().replace('%', '')
      const percent = parseFloat(percentStr)

      return {
        language: lang,
        percent
      }
    }).get()

    return {
      ...repo,
      numCommits,
      numIssues,
      numPRs,
      numProjects,
      numWatchers,
      numStars,
      numForks,
      languages
    }
  } catch (err) {
    console.error(err.message)
  }
}

if (!module.parent) {
  exports.main()
    .then((repos) => {
      console.log(JSON.stringify(repos, null, 2))
      process.exit(0)
    }).catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
