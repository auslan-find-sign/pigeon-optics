const crypto = require('crypto')
const auth = require('../library/models/auth')
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')

const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai

describe('models/auth model api', () => {
  // before each test, record what accounts exist
  let accountList = []
  beforeEach(async () => {
    accountList = await auth.list()
  })
  // after each test, delete any accounts that were left created by failed tests
  afterEach(async () => {
    for await (const author of auth.iterate()) {
      if (!accountList.includes(author)) auth.delete(author)
    }
  })

  it('auth.register(account, pass) makes a regular account', async () => {
    const testAccount = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    await expect(auth.exists(testAccount)).to.eventually.be.false
    await expect(auth.register(testAccount, testPass)).to.eventually.deep.equal({ author: testAccount, auth: 'regular' }, 'result should indicate success')
    await expect(auth.exists(testAccount)).to.eventually.be.true
  })

  it("auth.register(account, pass, 'admin') makes an admin", async () => {
    const testAccount = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    await expect(auth.exists(testAccount)).to.eventually.be.false
    await expect(auth.register(testAccount, testPass, 'admin')).to.eventually.deep.equal({ author: testAccount, auth: 'admin' })
    await expect(auth.exists(testAccount)).to.eventually.be.true
  })

  it('auth.login(account, pass)', async () => {
    const testAccount = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    await auth.register(testAccount, testPass)
    await expect(auth.login(testAccount, testPass)).to.eventually.deep.equal({ author: testAccount, auth: 'regular' })
    await expect(auth.login(testAccount, 'wrong-password')).to.eventually.be.rejectedWith('Password incorrect')
    await expect(auth.login(`${testAccount}-wrong`, testPass)).to.eventually.be.rejectedWith('Account not found')
    await expect(auth.login('', testPass)).to.eventually.be.rejectedWith('Account not found')
  })

  it('auth.changePassword(account, newPass)', async () => {
    const testAccount = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    const newPass = crypto.randomBytes(32).toString('hex')
    await auth.register(testAccount, testPass)
    await expect(auth.login(testAccount, testPass)).to.eventually.deep.equal({ author: testAccount, auth: 'regular' })
    await expect(auth.login(testAccount, newPass)).to.eventually.be.rejectedWith('Password incorrect')
    await auth.changePassword(testAccount, newPass)
    await expect(auth.login(testAccount, newPass)).to.eventually.deep.equal({ author: testAccount, auth: 'regular' })
    await expect(auth.login(testAccount, testPass)).to.eventually.be.rejectedWith('Password incorrect')
  })

  it('auth.changeAuth(account, newAuth)', async () => {
    const testAccount = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')

    await auth.register(testAccount, testPass)
    await expect(auth.login(testAccount, testPass)).to.eventually.deep.equal({ author: testAccount, auth: 'regular' })
    await auth.changeAuth(testAccount, 'admin')
    await expect(auth.login(testAccount, testPass)).to.eventually.deep.equal({ author: testAccount, auth: 'admin' })
  })

  it('auth.getProfile(account)', async () => {
    const testAccount = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')

    await auth.register(testAccount, testPass)
    await expect(auth.getProfile(testAccount)).to.eventually.deep.equal({ author: testAccount, auth: 'regular' })
  })

  it('auth.delete(account) and auth.exists()', async () => {
    const testAccount = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')

    await expect(auth.exists(testAccount)).to.eventually.be.false
    await auth.register(testAccount, testPass)
    await expect(auth.exists(testAccount)).to.eventually.be.true
    await auth.delete(testAccount)
    await expect(auth.exists(testAccount)).to.eventually.be.false
  })

  it('auth.iterate() and auth.list()', async () => {
    const list = await asyncIterableToArray(auth.iterate())
    const list2 = await auth.list()
    expect(list).to.deep.equal(list2)

    const testAccount = crypto.randomBytes(32).toString('hex')
    const testPass = crypto.randomBytes(32).toString('hex')
    await auth.register(testAccount, testPass)
    await expect(auth.list()).to.eventually.include(testAccount)
    await auth.delete(testAccount)
    await expect(auth.list()).to.eventually.not.include(testAccount)
  })
})
