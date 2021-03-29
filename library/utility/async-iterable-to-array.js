module.exports = async function asyncIterableToArray (iterable) {
  const output = []
  for await (const item of iterable) {
    output.push(item)
  }
  return output
}
