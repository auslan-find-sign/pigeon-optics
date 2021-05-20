/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const chai = require('chai')
const expect = chai.expect
const raw = require('../library/models/file/raw').instance({ extension: '.dataset.br' })
const { open } = require('../library/models/dataset-archive')

const testData = [
  ['abc', 'xyz'],
  ['cat', 'dog'],
  ['pea', 'soup']
]

describe('models/dataset-archive', function () {
  /** @type {import('../library/models/dataset-archive').DatasetArchive} */
  let tape

  it('creates an archive and read it back', async () => {
    tape = open(raw, ['test-archive'])
    await tape.write(testData)

    const readback = await asyncIterableToArray(tape.read())
    expect(readback).to.deep.equal(testData)
  })

  it('adds a record', async () => {
    await tape.set('beans', 'cool!')

    const readback = await asyncIterableToArray(tape.read())
    expect(readback).to.deep.equal([['beans', 'cool!'], ...testData])
  })

  it('merges', async () => {
    await tape.merge([['cat', 'friend'], ['beans', undefined]])

    const readback = Object.fromEntries(await asyncIterableToArray(tape.read()))
    expect(readback).to.deep.equal({
      abc: 'xyz',
      cat: 'friend',
      pea: 'soup'
    })
  })

  it('selects', async () => {
    expect(await asyncIterableToArray(tape.select(key => key.includes('c')))).to.deep.equal([
      ['cat', 'friend'],
      ['abc', 'xyz']
    ])

    expect(await asyncIterableToArray(tape.select((key, value) => value.includes('o')))).to.deep.equal([
      ['pea', 'soup']
    ])
  })

  it('deletes', async () => {
    await tape.delete('abc', 'pea')

    const readback = Object.fromEntries(await asyncIterableToArray(tape.read()))
    expect(readback).to.deep.equal({ cat: 'friend' })
  })

  it('retains', async () => {
    await tape.write(testData)
    await tape.retain('abc', 'cat')

    const readback = Object.fromEntries(await asyncIterableToArray(tape.read()))
    expect(readback).to.deep.equal({ abc: 'xyz', cat: 'dog' })
  })

  it('filters', async () => {
    await tape.write(testData)
    await tape.filter((key, value) => key === 'abc' || value === 'dog')

    const readback = Object.fromEntries(await asyncIterableToArray(tape.read()))
    expect(readback).to.deep.equal({ abc: 'xyz', cat: 'dog' })
  })

  it('gets', async () => {
    expect(await tape.get('cat')).to.equal('dog')
    expect(await tape.get('fake')).to.be.undefined
  })

  it('deletes the archive', async () => {
    await tape.deleteArchive()
    expect(await tape.get('cat')).to.be.undefined
    expect(await tape.raw.exists(tape.path)).to.be.false
  })
})
