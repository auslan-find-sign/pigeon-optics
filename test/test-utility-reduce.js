/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const reduce = require('../library/utility/reduce')
const chai = require('chai')
const { expect } = chai

describe('utility/reduce()', () => {
  it('concats arrays', () => {
    expect(reduce([[1, 2, 3], [4, 5, 6]])).to.deep.equal([1, 2, 3, 4, 5, 6])
  })

  it('overwrites strings', () => {
    expect(reduce(['abc', 'def'])).to.equal('def')
  })

  it('unions sets', () => {
    expect(reduce([new Set([1, 2, 3]), new Set([2, 3, 4])])).to.deep.equal(new Set([1, 2, 3, 4]))
  })

  it('overwrites buffers', () => {
    expect(reduce([Buffer.from('hello'), Buffer.from('world')])).to.deep.equal(Buffer.from('world'))
  })

  it('adds numbers', () => {
    expect(reduce([1, 2, 3])).to.equal(6)
  })

  it('adds bignums', () => {
    expect(reduce([1n, 2n, 3n])).to.equal(6n)
  })

  it('chooses the most recent date', () => {
    const newestDate = new Date(Date.now() + 60000)
    const dates = [
      new Date(60000), // 60s after epoch
      newestDate, // 60s after now
      new Date(0), // epoch
      new Date() // now
    ]
    expect(reduce(dates).valueOf()).to.equal(newestDate.valueOf())
  })

  it('merges objects', () => {
    expect(reduce([
      { a: '1', b: '2', c: '3' },
      { a: '5', d: '4' }
    ])).to.deep.equal({ a: '5', b: '2', c: '3', d: '4' })
  })

  it('merges maps', () => {
    expect(reduce([
      new Map([
        [1, 'foo'],
        [2, 'bar']
      ]),
      new Map([
        [2, 'yehaw'],
        [3, 'nah']
      ])
    ])).to.deep.equal(new Map([
      [1, 'foo'],
      [2, 'yehaw'],
      [3, 'nah']
    ]))
  })

  it('handles a complex object', () => {
    expect(reduce([
      {
        id: 5,
        url: 'http://foo.com/item/1',
        regions: new Set([]),
        counter: 0
      },
      { tags: new Set(['bird']) },
      { tags: new Set(['person']) },
      { counter: 1 },
      { regions: new Set(['nsw']) },
      { counter: 1, tags: new Set(['bird']) }
    ])).to.deep.equal({
      id: 5,
      url: 'http://foo.com/item/1',
      regions: new Set(['nsw']),
      tags: new Set(['bird', 'person']),
      counter: 2
    })
  })
})
