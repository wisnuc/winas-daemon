const Bluetooth = require('../woodstock/winas/bluetooth')
const DBus = require('../woodstock/lib/dbus')
class BLED extends require('events') {
  constructor() {
    super()
    this.dbus = new DBus()
    this.dbus.on('connect', () => {
      this.ble = Bluetooth()
      this.dbus.attach('/org/bluez/bluetooth', this.ble)
    })
    this.handlers = new Map()
  }

  set ble(x) {
    if (this._ble) {
      this._ble.removeAllListeners()
    }
    this._ble = x
    this._ble.on('WriteValue', this.handleBleMessage.bind(this))
  }

  get ble() { return this._ble }

  handleBleMessage(data, opts) {
    let packet
    try {
      packet = JSON.parse(data)
    } catch(e) {
      return this.update({ code: 'ENOTJSON', message: 'packet error'})
    }

    if (packet.action === 'scan') this.dispatch('CMD_SCAN', packet)
    if (packet.action === 'conn') this.dispatch('CMD_CONN', packet)
    if (packet.action === 'net') this.dispatch('CMD_NET', packet)
  }

  addHandler(type, callback){
    if (this.handlers.has(type)) {
      this.handlers.get(type).push(callback)
    }
    else {
      this.handlers.set(type, [callback])
    }
  }

  dispatch(type, data) {
    if (this.handlers.has(type)) {
      this.handlers.get(type).forEach(cb => cb(data))
    }
  }

  view() {
    return {
      state: this.ble ? 'Started' : 'Starting',
      address: 'XXXXX:XXXX:XXXX:XXXXX'
    }
  }

  update(data) {
    if (this.ble) {
      data = Buffer.from(JSON.stringify(data))
      this.ble.update(data)
    }
  }

  setStationId (id) {}

  setStationStatus (status) {}

  sendMsg (msg) {}
}

module.exports = BLED