class CharCounter {
  constructor(input, counter, limit = 250) {
    this.input = input
    this.counter = counter
    this.limit = limit

    this.updateCounter()

    input.on('keyup change input paste', () => this.updateCounter())
  }

  updateCounter() {
    var len = this.input.val().length
    this.counter.text(`${len} / ${this.limit}`)
    this.counter.add(this.input).toggleClass('full', len >= this.limit)
  }
}

module.exports = function(input, counter, limit) {
  return new CharCounter(input, counter, limit)
}
