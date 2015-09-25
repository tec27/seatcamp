export default class StoredSet {
  constructor(key, iterable) {
    this._set = new Set(iterable)
    this.key = key
    this.reload()
    window.addEventListener('storage', evt => {
      if (evt.key === this.key) {
        this.reload()
      }
    })
  }

  reload() {
    const array = JSON.parse(window.localStorage.getItem(this.key)) || []
    this._set.clear()
    for (const val of array) {
      this._set.add(val)
    }
  }

  write() {
    const array = Array.from(this._set.values())
    window.localStorage.setItem(this.key, JSON.stringify(array))
  }

  add(value) {
    const ret = this._set.add(value)
    this.write()
    return ret
  }

  clear() {
    const ret = this._set.clear()
    this.write()
    return ret
  }

  delete(value) {
    const ret = this._set.delete(value)
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
