// converts object to ruby-like syntax

module.exports = function encode (object) {
  if (object === null || object === undefined) {
    return 'nil'
  } else if (typeof object === 'number' || typeof object === 'bigint') {
    return object.toString()
  } else if (typeof object === 'string') {
    return `'${object.replace('\\', '\\\\').replace("'", "\\'")}'`
  } else if (typeof object === 'boolean') {
    return object ? 'true' : 'false'
  } else if (typeof object === 'symbol') {
    return `:${encode(object.description)}`
  } else if (Array.isArray(object)) {
    return `[${object.map(x => encode(x)).join(', ')}]`
  } else if (Buffer.isBuffer(object)) {
    return `{:type=>'Buffer', :data=>${encode([...object.values()])}}`
  } else if (typeof object === 'object') {
    return `{${Object.entries(object).map(([key, value]) => `${encode(key)}=>${encode(value)}`).join(', ')}}`
  }
}
