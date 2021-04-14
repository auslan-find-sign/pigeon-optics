const crypto = require('crypto')
const auth = require('../library/models/auth')
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')

const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai

describe('models/auth model api', () => {
  // before each test, record what users exist
  let userList = []
  beforeEach(async () => {
    userList = await auth.list()
  })
  // after each test, delete any users that were left created by failed tests
  afterEach(async () => {
    for await (const user of auth.iterate()) {
      if (!userList.includes(user)) auth.delete(user)
    }
  })

  it('auth.register(user, pass) makes a normal user', async () => {
    const testUser = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    await expect(auth.exists(testUser)).to.eventually.be.false
    await expect(auth.register(testUser, testPass)).to.eventually.deep.equal({ user: testUser, auth: 'user' }, 'result should indicate success')
    await expect(auth.exists(testUser)).to.eventually.be.true
  })

  it("auth.register(user, pass, 'admin') makes an admin", async () => {
    const testUser = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    await expect(auth.exists(testUser)).to.eventually.be.false
    await expect(auth.register(testUser, testPass, 'admin')).to.eventually.deep.equal({ user: testUser, auth: 'admin' })
    await expect(auth.exists(testUser)).to.eventually.be.true
  })

  it('auth.login(user, pass)', async () => {
    const testUser = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    await auth.register(testUser, testPass)
    await expect(auth.login(testUser, testPass)).to.eventually.deep.equal({ user: testUser, auth: 'user' })
    await expect(auth.login(testUser, 'wrong-password')).to.eventually.be.rejectedWith('Password incorrect')
    await expect(auth.login(`${testUser}-wrong`, testPass)).to.eventually.be.rejectedWith('Account not found')
    await expect(auth.login('', testPass)).to.eventually.be.rejectedWith('Account not found')
  })

  it('auth.changePassword(user, newPass)', async () => {
    const testUser = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    const newPass = crypto.randomBytes(32).toString('hex')
    await auth.register(testUser, testPass)
    await expect(auth.login(testUser, testPass)).to.eventually.deep.equal({ user: testUser, auth: 'user' })
    await expect(auth.login(testUser, newPass)).to.eventually.be.rejectedWith('Password incorrect')
    await auth.changePassword(testUser, newPass)
    await expect(auth.login(testUser, newPass)).to.eventually.deep.equal({ user: testUser, auth: 'user' })
    await expect(auth.login(testUser, testPass)).to.eventually.be.rejectedWith('Password incorrect')
  })

  it('auth.changeAuth(user, newAuth)', async () => {
    const testUser = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')

    await auth.register(testUser, testPass)
    await expect(auth.login(testUser, testPass)).to.eventually.deep.equal({ user: testUser, auth: 'user' })
    await auth.changeAuth(testUser, 'admin')
    await expect(auth.login(testUser, testPass)).to.eventually.deep.equal({ user: testUser, auth: 'admin' })
  })

  it('auth.getProfile(user)', async () => {
    const testUser = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')

    await auth.register(testUser, testPass)
    await expect(auth.getProfile(testUser)).to.eventually.deep.equal({ user: testUser, auth: 'user' })
  })

  it('auth.delete(user) and auth.exists()', async () => {
    const testUser = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')

    await expect(auth.exists(testUser)).to.eventually.be.false
    await auth.register(testUser, testPass)
    await expect(auth.exists(testUser)).to.eventually.be.true
    await auth.delete(testUser)
    await expect(auth.exists(testUser)).to.eventually.be.false
  })

  it('auth.iterate() and auth.list()', async () => {
    const list = await asyncIterableToArray(auth.iterate())
    const list2 = await auth.list()
    expect(list).to.deep.equal(list2)

    const testUser = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    await auth.register(testUser, testPass)
    await expect(auth.list()).to.eventually.include(testUser)
    await auth.delete(testUser)
    await expect(auth.list()).to.eventually.not.include(testUser)
  })
})
