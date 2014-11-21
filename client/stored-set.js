// V8/traceur don't support extending builtins yet, so we wrap :(
class StoredSet {
  constructor(key, iterable) {
    this._set = new Set(iterable)
    this.key = key
    this.reload()
    window.addEventListener('storage', evt => {
      if (evt.key == this.key) {
        this.reload()
      }
    })
  }

  reload() {
    var array = JSON.parse(localStorage.getItem(this.key)) || []
    this._set.clear()
    for (let val of array) {
      this._set.add(val)
    }
  }

  write() {
    var array = Array.from(this._set.values())
    localStorage.setItem(this.key, JSON.stringify(array))
  }

  add(value) {
    var ret = this._set.add(value)
    this.write()
    return ret
  }

  clear() {
    var ret = this._set.clear()
    this.write()
    return ret
  }

  delete(value) {
    var ret = this._set.delete(value)
    this.write()
    return ret
  }

  entries() {
    return this._set.entries()
  }

  forEach(callbackFn, thisArg) {
    return this._set.forEach(callbackFn, thisArg)
  }

  has(value) {
    return this._set.has(value)
  }

  keys() {
    return this._set.keys()
  }

  values() {
    return this._set.values()
  }
}

module.exports = StoredSet
