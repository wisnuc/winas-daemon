const EventEmitter = require('events')

const debug = require('debug')('state')

class State {

  constructor(ctx, ...args) {
    this.ctx = ctx
    ctx.state = this
    this._enter(...args)
    if (ctx instanceof EventEmitter) {
      ctx.emit(this.constructor.name)
    }
  }

  setState (state, ...args) {
    this._exit()
    let NextState = this.ctx[state]
    new NextState(this.ctx, ...args)
  }

  _enter () {
    debug(`${this.ctx.constructor.name} enter ${this.constructor.name} state`)
    this.enter()
  }

  enter () {

  }

  _exit () {
    this.exit()
    debug(`${this.ctx.constructor.name} exit ${this.constructor.name} state`)
  }

  exit() {

  }

  view () {
    return null
  }

  destroy () {
    this.exit()
  }
}

module.exports = State