const nacl = require('tweetnacl')
const uri = require('encodeuricomponent-tag')
const assert = require('assert')
const unicodeSpaces = require('unicode/category/Zs')
const unicodeControl = require('unicode/category/Cc')
const unicodeFormat = require('unicode/category/Cf')
const unicodeLineSep = require('unicode/category/Zl')
const unicodeParaSep = require('unicode/category/Zp')

const file = require('./fs/objects')
const settings = require('./settings')
const updateEvents = require('../utility/update-events')
const asyncIterableToArray = require('../utility/async-iterable-to-array')
const createHttpError = require('http-errors')

exports.basicAuthMiddleware = async (req, res, next) => {
  // handle http basic auth
  if (req.get('Authorization')) {
    const [type, credsb64] = req.get('Authorization').split(' ', 2)
    if (type === 'Basic') {
      const [author, pass] = Buffer.from(credsb64, 'base64').toString('utf-8').split(':', 2)
      try {
        Object.assign(req, await exports.login(author, pass))
      } catch (err) {
        throw createHttpError.BadRequest(`Invalid credentials supplied with Basic HTTP authentication: ${err.message}`)
      }
    }
  }

  if (req.session && req.session.auth && req.session.auth.author) {
    Object.assign(req, req.session.auth)
  }

  next()
}

/** app.param handler to populate req.owner with a boolean for if this resource should be editable */
exports.ownerParam = (req, res, next, value, id) => {
  req.owner = req.auth && (req.author === req.params[id] || req.auth === 'admin')
  next()
}

/**
 * Express middleware to require auth and redirect authors to login
 */
exports.required = (req, res, next) => {
  if (!req.auth || !req.author) {
    if (req.accepts('html')) {
      res.redirect(303, uri`/auth?return=${req.originalUrl}`)
    } else {
      throw createHttpError(401, 'This request requires you be logged in with basic auth or a cookie', {
        headers: { 'www-authenticate': 'Basic realm="PigeonOptics", charset="UTF-8"]' }
      })
    }
  } else {
    next()
  }
}

/**
 * Express Middleware that requires the owner specified in a resource url is authenticated, or an admin role
 */
exports.ownerRequired = (req, res, next) => {
  if (req.owner) {
    return next()
  } else {
    const msg = 'You need to login as someone with permission to edit this'
    if (req.accepts('html')) {
      return res.redirect(303, uri`/auth?err=${msg}&return=${req.originalUrl}`)
    } else {
      throw createHttpError.Forbidden(msg)
    }
  }
}

/** Helper function, returns directory inside cbor-file database, where author's folder is
 * @param {string} author
 * @returns {string}
*/
exports.authorFolder = function (author) {
  return ['authors', author]
}

/** Helper function, path inside cbor-file database, where author's account is stored
 * @param {string} author
 * @returns {string}
*/
exports.authorAccountPath = function (author) {
  return [...this.authorFolder(author), 'account']
}

/** check a login attempt for a author account
 * @param {string} authorName
 * @param {string} password
 * @returns {object} - { author: "string author", auth: "string authorization level" }
 */
exports.login = async function (author, pass) {
  let account

  try {
    account = await file.read(this.authorAccountPath(author))
  } catch (err) {
    throw new Error('Account not found')
  }

  const hash = nacl.hash(Buffer.concat([account.passSalt, Buffer.from(`${pass}`), account.passSalt]))

  if (!nacl.verify(hash, account.passHash)) {
    throw new Error('Password incorrect')
  }

  return { author, auth: account.auth }
}

/** Register a new author account - throws errors if unsuccessful
 * @param {string} author
 * @param {string} password
 * @returns {object} - { author: "string author", auth: "string authorization level" }
 */
exports.register = async function (author, pass, auth = 'regular') {
  const path = this.authorAccountPath(author)
  const badChars = "!*'();:@&=+$,/?%#[]`“‘’’”".split('')
  const authorNameChars = author.split('')

  assert(!await file.exists(path), 'Someone else is using this name already, pick a different one')
  assert(!badChars.some(char => author.includes(char)), `Name must not contain any of ${badChars.join(' ')}`)
  assert(!authorNameChars.some(x => x !== ' ' && unicodeSpaces[x.charCodeAt(0)]), 'Name must not contain whitespace other than regular spaces')
  assert(!authorNameChars.some(x => unicodeControl[x.charCodeAt(0)]), 'Name must not contain control characters')
  assert(!authorNameChars.some(x => unicodeFormat[x.charCodeAt(0)]), 'Name must not contain unicode format characters')
  assert(!authorNameChars.some(x => unicodeLineSep[x.charCodeAt(0)]), 'Name must not contain unicode line seperator characters')
  assert(!authorNameChars.some(x => unicodeParaSep[x.charCodeAt(0)]), 'Name must not contain unicode paragraph seperator characters')

  assert(!settings.forbiddenAuthorNames.includes(author), 'Name is not allowed by site settings')
  assert(author.length >= 3, 'Name must be at least 3 characters long')
  assert(author.length <= 100, 'Name must not be longer than 100 characters')
  assert(pass.length >= 8, 'Password must be at least 8 characters long')

  const salt = Buffer.from(nacl.randomBytes(64))
  const authorData = {
    passSalt: salt,
    passHash: Buffer.from(nacl.hash(Buffer.concat([salt, Buffer.from(`${pass}`), salt]))),
    auth
  }

  await file.write(path, authorData)

  process.nextTick(() => updateEvents.pathUpdated('/meta/system:system/authors'))

  return { author, auth }
}

/** change the password on a author account
 * @param {string} authorrName
 * @param {string} newPassword
 */
exports.changePassword = async function (author, newPass) {
  await file.update(this.authorAccountPath(author), account => {
    if (!account) throw new Error('Author account name not found')
    account.passSalt = Buffer.from(nacl.randomBytes(64))
    account.passHash = Buffer.from(nacl.hash(Buffer.concat([account.passSalt, Buffer.from(`${newPass}`), account.passSalt])))
    return account
  })
}

/** Change authorization setting on a author account
 * @param {string} authorName
 * @param {"regular"|"admin"} authorization
 */
exports.changeAuth = async function (author, auth) {
  await file.update(this.authorAccountPath(author), account => {
    if (!account) throw new Error('Author account name not found')
    account.auth = auth
    return account
  })
}

/** get a author's profile */
exports.getProfile = async function (author) {
  const account = await file.read(this.authorAccountPath(author))
  return { author, auth: account.auth }
}

/** delete a author account
 * @param {string} authorName
 */
exports.delete = async function (author) {
  await file.delete(this.authorFolder(author))
  process.nextTick(() => updateEvents.pathUpdated('/meta/system:system/authors'))
}

/** check if author account exists
 * @param {string} authorName
 */
exports.exists = async function (author) {
  return await file.exists(this.authorAccountPath(author))
}

/**
 * list all authors known to the system
 * @yields {string} authorName
 */
exports.iterate = async function * () {
  for await (const author of file.iterateFolders(['authors'])) {
    if (!settings.forbiddenAuthorNames.includes(author)) {
      yield author
    }
  }
}

/**
 * return an array of all authors known to the system
 * @returns {string[]}
 */
exports.list = async function () {
  return await asyncIterableToArray(this.iterate())
}
