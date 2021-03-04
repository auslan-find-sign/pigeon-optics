const nacl = require('tweetnacl')
const uri = require('encodeuricomponent-tag')
const assert = require('assert')
const unicodeSpaces = require('unicode/category/Zs')
const unicodeControl = require('unicode/category/Cc')
const unicodeFormat = require('unicode/category/Cf')
const unicodeLineSep = require('unicode/category/Zl')
const unicodeParaSep = require('unicode/category/Zp')

const file = require('./file/cbor')
const codec = require('./codec')
const settings = require('./settings')
const updateEvents = require('../utility/update-events')

exports.basicAuthMiddleware = async (req, res, next) => {
  // handle http basic auth
  if (req.get('Authorization')) {
    const authHeader = req.get('Authorization')
    const [type, credsb64] = authHeader.split(' ', 2)
    if (type.toLowerCase() === 'basic') {
      const [user, pass] = Buffer.from(credsb64, 'base64').toString().split(':', 2)
      try {
        req.session.auth = await exports.login(user, pass)
      } catch (err) {
        return res.type('json').send(JSON.stringify({ err: 'Invalid credentials supplied with Basic HTTP authentication' }))
      }
    }
  }

  if (req.session && req.session.auth && req.session.auth.user) {
    req.user = req.session.auth.user
    req.auth = req.session.auth.auth
  }

  next()
}

/** app.param handler to populate req.owner with a boolean for if this resource should be editable */
exports.ownerParam = (req, res, next, value, id) => {
  req.owner = req.session.auth && (req.session.auth.user === req.params[id] || req.session.auth.auth === 'admin')
  next()
}

/**
 * Express middleware to require auth and redirect users to login
 */
exports.required = (req, res, next) => {
  if (!req.session || !req.session.auth || !req.session.auth.user) {
    if (req.accepts('html')) {
      return res.redirect(uri`/auth?return=${req.originalUrl}`)
    } else {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="Datasets", charset="UTF-8"]').sendJSON({
        err: 'This request requires you be logged in with basic auth or a cookie'
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
    const msg = { err: 'You need to login as someone with permission to edit this' }
    if (req.accepts('html')) {
      return res.redirect(uri`/auth?err=${msg.err}&return=${req.originalUrl}`)
    } else {
      return codec.respond(req, res.status(403), msg)
    }
  }
}

/** Helper function, returns directory inside cbor-file database, where user's folder is
 * @param {string} username
 * @returns {string}
*/
exports.userFolder = (username) => ['users', username]

/** Helper function, path inside cbor-file database, where user's account is stored
 * @param {string} username
 * @returns {string}
*/
exports.userAccountPath = (username) => [...exports.userFolder(username), 'account']

/** check a login attempt for a user account
 * @param {string} username
 * @param {string} password
 * @returns {object} - { user: "string username", auth: "string authorization level" }
 */
exports.login = async (user, pass) => {
  let account

  try {
    account = await file.read(exports.userAccountPath(user))
  } catch (err) {
    throw new Error('Account not found: ' + err.message)
  }

  const hash = Buffer.from(nacl.hash(Buffer.concat([account.passSalt, Buffer.from(`${pass}`), account.passSalt])))

  if (account.user !== user) {
    throw new Error("Corruption issue, user on account doesn't match user specified")
  }

  if (!hash.equals(account.passHash)) {
    throw new Error('Password incorrect')
  }

  return { user, auth: account.auth }
}

/** Register a new user account - throws errors if unsuccessful
 * @param {string} username
 * @param {string} password
 * @returns {object} - { user: "string username", auth: "string authorization level" }
 */
exports.register = async (user, pass, auth = 'user') => {
  const path = exports.userAccountPath(user)
  const badChars = "!*'();:@&=+$,/?%#[]`“‘’’”".split('')
  const userChars = user.split('')

  assert(!await file.exists(path), 'This username is already in use')
  assert(!badChars.some(char => user.includes(char)), `Username must not contain any of ${badChars.join(' ')}`)
  assert(!userChars.some(x => unicodeSpaces[x.charCodeAt(0)]), 'Username must not contain spaces')
  assert(!userChars.some(x => unicodeControl[x.charCodeAt(0)]), 'Username must not contain control characters')
  assert(!userChars.some(x => unicodeFormat[x.charCodeAt(0)]), 'Username must not contain unicode format characters')
  assert(!userChars.some(x => unicodeLineSep[x.charCodeAt(0)]), 'Username must not contain unicode line seperator characters')
  assert(!userChars.some(x => unicodeParaSep[x.charCodeAt(0)]), 'Username must not contain unicode paragraph seperator characters')

  assert(!settings.forbiddenUsernames.includes(user), 'Username is not allowed by site settings')
  assert(user.length >= 3, 'Username must be at least 3 characters long')
  assert(user.length <= 100, 'Username must not be longer than 100 characters')
  assert(pass.length >= 8, 'Password must be at least 8 characters long')

  const salt = Buffer.from(nacl.randomBytes(64))
  const userData = {
    user: `${user}`,
    passSalt: salt,
    passHash: Buffer.from(nacl.hash(Buffer.concat([salt, Buffer.from(`${pass}`), salt]))),
    auth
  }

  await file.write(path, userData)

  process.nextTick(() => updateEvents.pathUpdated('/meta/system:system/users'))

  return { user, auth }
}

/** change the password on a user account
 * @param {string} username
 * @param {string} newPassword
 */
exports.changePassword = async (user, newPass) => {
  const path = exports.userAccountPath(user)
  const account = await file.read(path)
  account.passSalt = Buffer.from(nacl.randomBytes(64))
  account.passHash = Buffer.from(nacl.hash(Buffer.concat([account.passSalt, Buffer.from(`${newPass}`), account.passSalt])))
  await file.write(path, account)
}

/** Change authorization setting on a user account
 * @param {string} username
 * @param {string} authorization - default "user"
 */
exports.changeAuth = async (user, auth) => {
  const path = exports.userAccountPath(user)
  const account = await file.read(path)
  account.auth = auth
  await file.write(path, account)
}

/** get a user's profile */
exports.getProfile = async (user) => {
  const account = await file.read(exports.userAccountPath(user))
  return account
}

/** delete a user
 * @param {string} username
 */
exports.delete = async (user) => {
  await file.delete(exports.userFolder(user))
  process.nextTick(() => updateEvents.pathUpdated('/meta/system:system/users'))
}

/** check if user account exists
 * @param {string} username
 */
exports.exists = async (user) => {
  return await file.exists(exports.userAccountPath(user))
}

/** list all users known to the system
 * @returns {AsyncIterable} - yields string account names
 */
exports.iterateUsers = async function * () {
  for await (const user of file.listFolders(['users'])) {
    if (!settings.forbiddenUsernames.includes(user)) {
      yield user
    }
  }
}
