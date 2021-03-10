import fetch from 'node-fetch'
import { encode } from 'qss'

class HTTPError extends Error {
  constructor(response) {
    super(response.error)
    const { statusCode, statusText, error, ...json } = response
    this.name = 'HTTPError'
    this.statusCode = statusCode
    this.statusText = statusText
    this.error = error
    this.json = json
  }
}

function getGlobals(property) {
  let parent

  if (typeof self !== 'undefined' && self && property in self) {
    parent = self
  }

  if (typeof window !== 'undefined' && window && property in window) {
    parent = window
  }

  if (typeof global !== 'undefined' && global && property in global) {
    parent = global
  }

  if (typeof parent === 'undefined') {
    return
  }

  const globalProperty = parent[property]
  return globalProperty
}

function getAuth (opts) {
  if (opts.auth) {
    return {
      Authorization: `Basic ${Buffer.from(`${opts.auth.username}:${opts.auth.password}`).toString('base64')}`,
    }
  }
}

async function handleResponse(response) {
  return response.json().then((json) => {
    if (!response.ok) {
      const error = {
        statusCode: response.status,
        statusText: response.statusText,
        ...json,
      }
      return Promise.reject(new HTTPError(error))
    }
    return json
  })
}

export default async function (input, opts) {
  const document = getGlobals('document')
  let url = new URL(input || input, document && document.baseURI)
  opts.params ? (url.search = encode(opts.params)) : undefined
  const defaultHeaders = {
    Accept: 'application/json, text/plain',
    'Content-Type': 'application/json',
  }

  if (!opts.form && typeof opts.body !== undefined) {
    delete defaultHeaders['Content-Type']
  }

  if (opts.form) {
    defaultHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  const headers = {
    ...defaultHeaders,
    ...opts.headers,
    ...getAuth(opts),
  }

  const response = await fetch(url.href, {
    headers: headers,
    ...opts,
  })

  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    return response.ok ? response : Promise.reject(new HTTPError(response))
  }

  const json = await handleResponse(response)

  return json
}