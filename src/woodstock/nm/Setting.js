class Setting {

  constructor(ctx) {
    this.ctx = ctx
  }

  // 集合操作
  ListConnections(callback) {
    this.ctx.dbus.driver.invoke({
      destination: 'org.freedesktop.NetworkManager',
      path: '/org/freedesktop/NetworkManager/Settings',
      'interface': 'org.freedesktop.NetworkManager.Settings',
      member: 'ListConnections'
    }, (err, data) => {
      console.log('ListConnections', err, data)
    })
  }

  // 单例操作
  /**
   * 
   * @param {*} objPath - Setting ObjectPath 
   */
  ClearSecrets(objPath, callback) {
    this.ctx.dbus.driver.invoke({
      destination: 'org.freedesktop.NetworkManager',
      path: objPath,
      'interface': 'org.freedesktop.NetworkManager.Settings.Connection',
      member: 'ClearSecrets'
    }, (err, data) => {
      console.log('ClearSecrets', err, data)
    })
  }

  /**
   * 
   * @param {*} objPath - Setting ObjectPath 
   */
  Delete(objPath, callback) {
    this.ctx.dbus.driver.invoke({
      destination: 'org.freedesktop.NetworkManager',
      path: objPath,
      'interface': 'org.freedesktop.NetworkManager.Settings.Connection',
      member: 'Delete'
    }, (err, data) => {
      console.log('Delete', err, data)
    })
  }

  Update() {

  }

  /**
   * 
   * @param {*} objPath - Setting ObjectPath 
   */
  GetSetting(objPath, callback) {
    this.ctx.dbus.driver.invoke({
      destination: 'org.freedesktop.NetworkManager',
      path: objPath,
      'interface': 'org.freedesktop.NetworkManager.Settings.Connection',
      member: 'GetSetting'
    }, (err, data) => {
      console.log('GetSetting', err, data)
    })
  }
  
  mounted() {
    
  }

  listen(m) {

  }

  logout() {

  }
}

module.exports = Setting