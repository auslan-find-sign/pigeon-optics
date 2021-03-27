// Environment script, establishes any APIs available inside of the javascript lens virtual machine

Math.random = function () {
  throw new Error('Math.random() is unavailable. Lenses must be deterministic, not random')
}
