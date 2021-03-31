const objectToRuby = require('../library/utility/object-to-ruby')
const assert = require('assert')

/* eslint-disable */
const tests = {
  'true': true,
  'false': false,
  'nil': null,
  '5': 5,
  '9274': 9274,
  '0.0001': 0.0001,
  '[1, 2, 3]': [1, 2, 3],
  '[nil, nil, nil]': [null, null, null],
  "{:type=>'Buffer', :data=>[104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]}": Buffer.from('hello world'),
  "{'a'=>1, 'b'=>2}": { a: 1, b: 2 },
  "{'1'=>false, '2'=>true}": { 1: false, 2: true },
  "{'foo'=>[1, 2, 3, nil, 5], 'bar'=>{'1'=>'yes', '2'=>'no', 'g'=>'maybe'}, 'bools'=>[true, false], 'buffery'=>{:type=>'Buffer', :data=>[104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]}}": {
    foo: [1, 2, 3, null, 5],
    bar: {
      1: 'yes',
      2: 'no',
      g: 'maybe'
    },
    bools: [true, false],
    buffery: Buffer.from('hello world')
  }
}
/* eslint-enable */

describe('library/utility/object-to-ruby', function () {
  for (const [expects, obj] of Object.entries(tests)) {
    it(`encode to ${expects}`, function () {
      const output = objectToRuby(obj)
      assert.strictEqual(output, expects, 'encoded value should match ruby encoding goal')
    })
  }
})
