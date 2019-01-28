const request = require('superagent')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const State = require('../lib/state')
const child = require('child_process')
const Device = require('aws-iot-device-sdk').device
const UUID = require('uuid')
const Config = require('config')

const storageConf = Config.get('storage')
const provisionConf = Config.get('provision')
const iotConf = Config.get('iot')

//TODO: atecc

const certFolder = storageConf.dirs.certDir
const crtName = storageConf.files.cert
const csrName = storageConf.files.csr
const pkeyName = 'device.key'
const pubKName = 'device.pub'
const snName = 'deviceSN'
const caName = storageConf.files.caCert

const awsCA = `-----BEGIN CERTIFICATE-----
MIIE0zCCA7ugAwIBAgIQGNrRniZ96LtKIVjNzGs7SjANBgkqhkiG9w0BAQUFADCB
yjELMAkGA1UEBhMCVVMxFzAVBgNVBAoTDlZlcmlTaWduLCBJbmMuMR8wHQYDVQQL
ExZWZXJpU2lnbiBUcnVzdCBOZXR3b3JrMTowOAYDVQQLEzEoYykgMjAwNiBWZXJp
U2lnbiwgSW5jLiAtIEZvciBhdXRob3JpemVkIHVzZSBvbmx5MUUwQwYDVQQDEzxW
ZXJpU2lnbiBDbGFzcyAzIFB1YmxpYyBQcmltYXJ5IENlcnRpZmljYXRpb24gQXV0
aG9yaXR5IC0gRzUwHhcNMDYxMTA4MDAwMDAwWhcNMzYwNzE2MjM1OTU5WjCByjEL
MAkGA1UEBhMCVVMxFzAVBgNVBAoTDlZlcmlTaWduLCBJbmMuMR8wHQYDVQQLExZW
ZXJpU2lnbiBUcnVzdCBOZXR3b3JrMTowOAYDVQQLEzEoYykgMjAwNiBWZXJpU2ln
biwgSW5jLiAtIEZvciBhdXRob3JpemVkIHVzZSBvbmx5MUUwQwYDVQQDEzxWZXJp
U2lnbiBDbGFzcyAzIFB1YmxpYyBQcmltYXJ5IENlcnRpZmljYXRpb24gQXV0aG9y
aXR5IC0gRzUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCvJAgIKXo1
nmAMqudLO07cfLw8RRy7K+D+KQL5VwijZIUVJ/XxrcgxiV0i6CqqpkKzj/i5Vbex
t0uz/o9+B1fs70PbZmIVYc9gDaTY3vjgw2IIPVQT60nKWVSFJuUrjxuf6/WhkcIz
SdhDY2pSS9KP6HBRTdGJaXvHcPaz3BJ023tdS1bTlr8Vd6Gw9KIl8q8ckmcY5fQG
BO+QueQA5N06tRn/Arr0PO7gi+s3i+z016zy9vA9r911kTMZHRxAy3QkGSGT2RT+
rCpSx4/VBEnkjWNHiDxpg8v+R70rfk/Fla4OndTRQ8Bnc+MUCH7lP59zuDMKz10/
NIeWiu5T6CUVAgMBAAGjgbIwga8wDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8E
BAMCAQYwbQYIKwYBBQUHAQwEYTBfoV2gWzBZMFcwVRYJaW1hZ2UvZ2lmMCEwHzAH
BgUrDgMCGgQUj+XTGoasjY5rw8+AatRIGCx7GS4wJRYjaHR0cDovL2xvZ28udmVy
aXNpZ24uY29tL3ZzbG9nby5naWYwHQYDVR0OBBYEFH/TZafC3ey78DAJ80M5+gKv
MzEzMA0GCSqGSIb3DQEBBQUAA4IBAQCTJEowX2LP2BqYLz3q3JktvXf2pXkiOOzE
p6B4Eq1iDkVwZMXnl2YtmAl+X6/WzChl8gGqCBpH3vn5fJJaCGkgDdk+bW48DW7Y
5gaRQBi5+MHt39tBquCWIMnNZBU4gcmU7qKEKQsTb47bDN0lAtukixlE0kF6BWlK
WE9gyn6CagsCqiUXObXbf+eEZSqVir2G3l6BFoMtEMze/aiCKm0oHw0LxOXnGiYZ
4fQRbxC1lfznQgUy286dUV4otp6F01vvpX1FQHKOtw5rDgb7MzVIcbidJ4vEZV8N
hnacRHr2lVz2XTIIM6RUthg/aFzyQkqFOFSDX9HoLPKsEdao7WNq
-----END CERTIFICATE-----`

// For test environment
const deviceSN = () => process.env.NODE_ENV.startsWith('test') ? 'test_' + UUID.v4().slice(5) : UUID.v4()

class Failed extends State {
  enter(err) {
    this.err = err
    console.log('PROVISION FAILED:', err)
    this.timer = setTimeout(() => {
      this.setState('PreBuild')
    }, 5000)
  }

  exit() {
    clearTimeout(this.timer)
  }
}

class Finished extends State {
  enter() {
    global.useDebug ? '' : console.log('PROVISION FINISHED')
  }
}

class PreBuild extends State {

  enter() {
    this.createCsr(err => {
      if (err) return this.setState('Failed', err)
      this.setState('Provisioning')
    })
  }

  createCsr(callback) {
    if (this.ctx.useFake) {
      fs.lstat(path.join(certFolder, crtName), err => {
        if (err) {
          rimraf(certFolder, err => {
            if (err) return callback(err)
            mkdirp(certFolder, err => {
              if (err) return callback(err)
              try {
                child.execSync(`openssl genrsa 2048 > ${ path.join(certFolder, pkeyName)}`)
                child.execSync(`openssl rsa -in ${ path.join(certFolder, pkeyName)} -pubout > ${ path.join(certFolder, pubKName)}`)
                child.execSync(`openssl req -new -subj "/C=CN/CN=abc/O=wisnuc" -key ${ path.join(certFolder, pkeyName)} > ${ path.join(certFolder, csrName)}`)
                this.ctx.sn = deviceSN()
                fs.writeFileSync(path.join(certFolder, snName), this.ctx.sn)
                fs.writeFileSync(path.join(certFolder, caName), awsCA)
              }
              catch(e) {
                callback(e)
              }
              callback(null)
            })
          })
        } else {
          callback(null)
        }
      })
    } else {
      // TODO: create real CSR use atecc
    }
  }
}

class Provisioning extends State {
  enter() {
    // FIXME: 
    let csrPath = this.ctx.useFake ? path.join(certFolder, csrName) : path.join(certFolder, csrName)
    let crtPath = this.ctx.useFake ? path.join(certFolder, crtName) : path.join(certFolder, crtName)
    this.req = request
      .post(provisionConf.address + '/sign')
      .send({
        csr: fs.readFileSync(csrPath).toString(),
        type: this.ctx.useFake ? 'test' : 'xxxx',
        sn: this.ctx.sn
      })
    this.req
      .then(res => {
        if (!res.ok) {
          this.setState('Failed', new Error('Provisioning Error'))
        } else {
          fs.writeFile(crtPath, res.body.certPem, err => {
            if(err) return this.setState('Failed', err)
            this.setState('ConnectTest')
          })
        }
      },err => this.setState('Failed', err))
  }

  exit() {
    if (this.req) this.req.abort()
  }
}

class Saveing extends State {

  enter() {
    let p = path.join(storageConf.roots.p, storageConf.files.provision)
    fs.writeFile(p, '1', err => {
      if (err) return this.setState('Failed', err)
      this.setState('Finished')
    })
  }

}

// TODO: use telsa
class ConnectTest extends State {
  
  enter () {
    this.ctx.useFake ? this.fakeTest(err => {
      let nextState = err ? 'Failed': 'Saveing'
      this.setState(nextState, err)
    }) : this.realTest(err => {
      let nextState = err ? 'Failed': 'Saveing'
      this.setState(nextState, err)
    })
  }

  fakeTest(callback) {
    let finished = false
    let cb = (err) => {
      if (finished) return
      finished = true
      this.device.removeAllListeners()
      this.device.on('error', () => {})
      setTimeout(() => {
        this.device.end(true)
        this.device = undefined
        callback(err)
      }, 1000) // fix aws error
    }
    this.device = new Device({
      keyPath: path.join(certFolder, pkeyName),
      certPath: path.join(certFolder, crtName),
      caPath: path.join(certFolder, caName),
      clientId: this.ctx.sn,
      host: iotConf.endpoint,
    })
    this.device.on('connect', () => cb())
    this.device.on('error', cb)
  }

  // use atecc and telas
  realTest(callback) {
    
  }

  exit() {
    if (this.device) {
      this.device.removeAllListeners()
      this.device.on('error', () => {})
      this.device.end()
    }
  }
}

class Provision extends require('events'){

  constructor() {
    super()
    this.useFake = Config.system.useFake
    new PreBuild(this)
  }

  get status() {
    return this.state.constructor.name
  }

  destroy() {
    this.state.destroy()
  }
}

Provision.prototype.Failed = Failed
Provision.prototype.Finished = Finished
Provision.prototype.Provisioning = Provisioning
Provision.prototype.ConnectTest = ConnectTest
Provision.prototype.PreBuild = PreBuild
Provision.prototype.Saveing = Saveing

module.exports = Provision