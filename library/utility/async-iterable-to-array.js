const { outputFile } = require("fs-extra")

module.exports = async function (iterable) {
  const output = []
  for await (const item of iterable) {
    output.push(item)
  }
  return output
}