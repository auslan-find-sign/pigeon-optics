const Serialize = require('./serialize')

function diff(beforeList, afterList) {
  const beforeMap = Object.fromEntries(beforeList.map(x => [x.rpcID, x]))
  const afterMap = Object.fromEntries(afterList.map(x => [x.rpcID, x]))
  
  // prefix some extra elements to a path list in a diff list
  const prefix = (prepend, diffList) => {
    return diffList.map(([op, path, ...args]) => [op, [...prepend, ...path], ...args])
  }
  
  // type tests
  //  - is it a BasicWidget?
  const isWidget = (obj) => obj && typeof obj === 'object' && typeof obj.getConstructorOptions === 'function' && typeof obj.rpcID === 'string'
  //  - is it the result of a server side nanohtml function?
  const isHTML = (obj) => obj && typeof obj === 'object' && obj.__encoded === true
  
  // diff a simple type like numbers, strings
  const diffSetProp = (value) => [['sp', [], value]]
  
  // diff a plain Array
  const arrayDiff = (before, after) => {
    // if there wasn't an array here before, just set it to an array
    if (!Array.isArray(before)) {
      return diffSetProp(after)
    }
    
    // if there was an array here before, we need to figure out how it's changed
    // firstly, serialize all the elements to json in both, strings are easier to compare
    const encBefore = before.map(x => Serialize.encode(x, true))
    const encAfter = after.map(x => Serialize.encode(x, true))
    
    // build a list of things that used to be in the array but aren't there now
    const removals = encBefore.map((x, idx) => [idx, x]).filter(([idx, x]) => !encAfter.includes(x))
    const additions = encAfter.map((x, idx) => [idx, x]).filter(([idx, x]) => !encBefore.includes(x))
    
    // start building the patch
    const patch = []
    if (removals.length > 0) {
      // array filter command
      patch.push(['af', [], ...removals.map(x => x[0])])
    }
    if (additions.length > 0) {
      // array push command
      patch.push(['ap', [], ...additions.map(x => after[x[0]])])
    }
    
    // build a version of the previous array with removed elements taken out
    const beforeWithRemovals = before.filter((x, idx) => !removals.some(([idx2, y]) => encBefore[idx] === y))
    // build a version with additions appended, simulating the patch so far
    const beforePatched = [...beforeWithRemovals, ...additions.map(x => after[x[0]])]
    
    // check if the array sort has changed
    if (Serialize.encode(beforePatched, true) !== Serialize.encode(after, true)) {
      const pairs = []
      beforePatched.forEach((value, idx) => {
        if (value !== after[idx]) {
          let correctIndex = after.findIndex(x => x === value)
          pairs.push(idx, correctIndex)
        }
      })
      patch.push(['ar', [], ...pairs])
    }
    
    return patch
  }
  
  // diff a plain Object, creating set property (sp) and delete property (dp) operations
  const objectDiff = (before, after) => {
    const deletedProps = before ? Object.keys(before).filter(key => !key in after) : []
    const changedProps = []
    Object.keys(after).forEach(key => {
      changedProps.push(prefix([key], thingDiff(before[key], after[key])))
    })
    return [
      ...deletedProps.map(key => ['dp', [key]]),
      ...changedProps.flat()
    ]
  }
  
  // diff a BasicWidget, in a way that accounts for how ./serialize handles stubbing widgets
  const widgetDiff = (before, after) => {
    if (!isWidget(after)) throw new Error('Expected a widget')
    
    if (before) {
      return objectDiff(before.getConstructorOptions(), after.getConstructorOptions())
    } else {
      return diffSetProp(after)
    }
  }
  
  // diff whatever
  const thingDiff = (before, after) => {
    if (isWidget(after)) {
      // widget, process a stub for it if it changed
      if (!isWidget(before) || before.rpcID !== after.rpcID) {
        return diffSetProp(after)
      }
      
    } else if (isHTML(after)) {
      // nanohtml content, if it doesn't actually match, update it
      if (!isHTML(before) || `${before}` !== `${after}`) {
        return diffSetProp(after)
      }
      
    } else if (Array.isArray(after)) {
      return arrayDiff(before, after)
      
    } else if (after && typeof after === 'object') {
      // generic object
      return objectDiff(before, after)
      
    } else if (before !== after) {
      // the core type changed
      return diffSetProp(after)
    }
    
    return []
  }
  
  const output = {}
  for (const after of afterList) {
    const before = beforeMap[after.rpcID]
    
    if (before) {
      const list = widgetDiff(before, after)
      if (list.length > 0) {
        output[after.rpcID] = list
      }
    }
  }
  
  return output
}

module.exports = diff