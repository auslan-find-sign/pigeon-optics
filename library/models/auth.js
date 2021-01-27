const file = require('./cbor-file')
const nacl = require('tweetnacl')
const uri = require('encodeuricomponent-tag')

/**
 * Express middleware to require auth and redirect users to login
 */
module.exports.required = async (req, res, next) => {
  // handle http basic auth
  if (req.get('Authorization')) {
    const authHeader = req.get('Authorization')
    const [type, credsb64] = authHeader.split(' ', 2)
    if (type.toLowerCase() === 'basic') {
      const [user, pass] = Buffer.from(credsb64, 'base64').toString()
      try {
        req.session.auth = await module.exports.login(user, pass)
      } catch (err) {
        return res.sendJSON({ err: 'Invalid credentials supplied with Basic HTTP authentication' })
      }
    }
  }

  if (!req.session || !req.session.auth || !req.session.auth.user) {
    if (req.accepts('html')) {
      return res.redirect(uri`/auth/login?return=${req.originalUrl}`)
    } else {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="Datasets", charset="UTF-8"]').sendJSON({
        err: 'This request requires you be logged in with basic auth or a cookie'
      })
    }
  } else {
    next()
  }
}

/** Helper function, returns directory inside cbor-file database, where user's folder is
 * @param {string} username
 * @returns {string}
*/
module.exports.userFolder = (username) => `users/${encodeURIComponent(username)}`

/** Helper function, path inside cbor-file database, where user's account is stored
 * @param {string} username
 * @returns {string}
*/
module.exports.userAccountPath = (username) => `${module.exports.userFolder(username)}/account`

/** check a login attempt for a user account
 * @param {string} username
 * @param {string} password
 * @returns {object} - { user: "string username", auth: "string authorization level" }
 */
module.exports.login = async (user, pass) => {
  try {
    var account = await file.read(module.exports.userAccountPath(user))
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
module.exports.register = async (user, pass, auth = 'user') => {
  const path = module.exports.userAccountPath(user)

  if (await file.exists(path)) {
    throw new Error('This username is already in use')
  }

  const salt = Buffer.from(nacl.randomBytes(64))
  const userData = {
    user: `${user}`,
    passSalt: salt,
    passHash: Buffer.from(nacl.hash(Buffer.concat([salt, Buffer.from(`${pass}`), salt]))),
    auth
  }

  await file.write(path, userData)

  return { user, auth }
}

/** change the password on a user account
 * @param {string} username
 * @param {string} newPassword
 */
module.exports.changePassword = async (user, newPass) => {
  const path = module.exports.userAccountPath(user)
  const account = await file.read(path)
  account.passSalt = Buffer.from(nacl.randomBytes(64))
  account.passHash = Buffer.from(nacl.hash(Buffer.concat([account.passSalt, Buffer.from(`${newPass}`), account.passSalt])))
  await file.write(path, account)
}

/** Change authorization setting on a user account
 * @param {string} username
 * @param {string} authorization - default "user"
 */
module.exports.changeAuth = async (user, auth) => {
  const path = module.exports.userAccountPath(user)
  const account = await file.read(path)
  account.auth = auth
  await file.write(path, account)
}

/** delete a user
 * @param {string} username
 */
module.exports.delete = async (user) => {
  await file.delete(module.exports.userFolder(user))
}

/** list all users known to the system
 * @returns {string[]} - account names array
 */
module.exports.listUsers = async () => {
  return await file.list('users')
}
