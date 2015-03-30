class CharCounter {
  constructor(input, counter, limit = 250) {
    this.input = input
    this.counter = counter
    this.limit = limit

    this.updateCounter()

    ;['keyup', 'change', 'input', 'paste'].forEach(event => {
        input.addEventListener(event, () => this.updateCounter)
    })
  }

  updateCounter() {
    let len = this.input.value.length
    this.counter.innerHTML = `${len} / ${this.limit}`
    let isFull = len >= this.limit
    this.counter.classList.toggle('full', isFull)
    this.input.classList.toggle('full', isFull)
  }
}

module.exports = function(input, counter, limit) {
  return new CharCounter(input, counter, limit)
}
