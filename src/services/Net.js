const { spawn, exec } = require('child_process')
const events = require('events')
const readline = require('readline')
const BaseState = require('../lib/state')
const debug = require('debug')('ws:net')

class State extends BaseState{
    exit() {
      if (this.child_scan && !this.child_scan.killed) {
        this.child_scan.kill()
        if (this.scanCallback) this.scanCallback(new Error('Killed'))
      }
    }

    scan (cb) {
      if (this.child_scan) return cb(new Error('Device Busy'))
      this.scanCallback = cb
      this.child_scan = exec(`iwlist ${this.ctx.device} scan | grep ESSID:`, (error, stdout, stderr) => {
        this.child_scan = undefined
        this.scanCallback = undefined
        if (error || stderr) return cb(error || stderr)
        const essids = stdout.split('\n').map(l => l.split(/"/)[1]).filter(v => !!v)
        const uniId = [...new Set(essids)]
        cb(null, uniId)
      })
    }

    connect(...args) {
      this.setState('Connecting', ...args)
    }
    
    disconnect(...args) {
      this.setState('Disconnecting', ...args)
    }

    view () {
      return null
    }
  
    destroy () {
      this.exit()
    }
}

class Disconnecting extends State {
  enter(cb) {
    this.child_disconn = exec(`nmcli device disconnect ${this.device}`, (error, stdout, stderr) => {
      if (error || stderr) cb(error || stderr)
      else {
        cb(null)
        this.setState('Disconnected')
      }
    })
  }

  disconnect(cb) {
    process.nextTick(() => cb(new Error('Device Busy')))
  }

  exit() {
    if (!this.child_disconn.killed) this.child_disconn.killed()
    super.exit()
  }
}

class Disconnected extends State {
  enter(error) {
    debug(error)
  }

  disconnect(cb) {
    process.nextTick(() => cb(null))
  }
}

class Connecting extends State {

  enter (essid, key, cb) {
    this.child_conn = exec(`nmcli device wifi connect ${essid} password ${key}`, (error, stdout, stderr) => {
      if (error || stderr) {
        cb(error || stderr)
        this.setState('Disconnected', error || stderr)
      } else {
        this.child_ifconf = exec(`ifconfig ${this.device}`, (err, stdo, stde) => {
          if (err || stde) {
            cb(err || stde)
            this.setState('Disconnected', err || stde)
          } else {
            const ip = stdo.toString().split('addr:')[1].split(' ')[0]
            cb(null, { ip })
            this.setState('Connected')
          }
        })
      }
    })
  }

  exit() {
    if (!this.child_conn.killed) this.child_conn.kill()
    if (!this.child_ifconf) this.child_ifconf.kill()
    super.exit()
  }
}

class Connected extends State {

}

class InitFailed extends State {
  enter(error) {
    this.error = error
    debug(error)
    this.timer = setTimeout(() => this.setState('Initing', () => {}), 5000)
  }

  scan(cb) {
    process.nextTick(() => cb(new Error('Device Busy')))
  }

  connect(essid, key, cb) {
    process.nextTick(() => cb(new Error('Device Busy')))
  }

  disconnect(cb) {
    process.nextTick(() => cb(new Error('Device Busy')))
  }

  exit() {
    clearTimeout(this.timer)
  }
}

class Initing extends State {
  enter (cb) {
    this.callback = cb
    this.child = exec(`nmcli d | grep wifi`, (error, stdout, stderr) => {
      if (error || stderr) {
        this.error = error || stderr
        return this.setState('InitFailed', this.error)
      }
      else {
        const nic = {}
        try {
          const arr = stdout.split(/\s+/)
          nic.name = arr[0]
          nic.type = arr[1]
          nic.state = arr[2]
          nic.connection = arr[3]
        } catch (err) {
          const e = new Error('No Wifi Device')
          this.error = e
          return this.setState('InitFailed', this.error)
        }
        debug(nic)
        if (!nic.name || nic.type !== 'wifi') {
          const e = new Error('Init Wifi Device Error')
          this.error = e
          return this.setState('InitFailed', this.error)
        }
        this.data = nic.name
        this.ctx.device = this.data
        let connected = (nic.state === 'connected')
        this.setState('Inited', connected ? 'Connected': 'Disconnected')
      }
    })
  }

  scan(cb) {
    process.nextTick(() => cb(new Error('Device Busy')))
  }

  connect(essid, key, cb) {
    process.nextTick(() => cb(new Error('Device Busy')))
  }

  disconnect(cb) {
    process.nextTick(() => cb(new Error('Device Busy')))
  }

  exit() {
    if (!this.child.killed) {
      this.child.kill()
      if (this.callback) this.callback(new Error('Killed'))
    } else {
      this.error ? this.callback(this.error) : this.callback(null, this.data)
    }
  }
}

class Inited extends State {
  enter(nextState, data) {
    this.timer = setTimeout(() => {
      this.setState(nextState, data)
    }, 3000)
  }

  exit() {
    clearTimeout(this.timer)
  }
}

class Net extends events {
  constructor() {
    super()
    new Initing(this)
  }

  connect(...args) {
    this.state.connect(...args)
  }

  disconnect(...args) {
    this.state.disconnect(...args)
  }

  scan(...args) {
    this.state.scan(...args)
  }

  view() {
    return {
      state: this.state.constructor.name
    }
  }
}

Net.prototype.Initing = Initing
Net.prototype.Inited = Inited
Net.prototype.InitFailed = InitFailed
Net.prototype.Disconnecting = Disconnecting
Net.prototype.Disconnected = Disconnected
Net.prototype.Connected = Connected
Net.prototype.Connecting = Connecting

module.exports = Net
