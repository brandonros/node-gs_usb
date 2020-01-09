const usb = require('usb')
const util = require('util')
const debug = require('debug')('node-gs_usb')

const GS_USB_BREQ_HOST_FORMAT = 0
const GS_USB_BREQ_BITTIMING = 1
const GS_USB_BREQ_MODE = 2
const GS_USB_BREQ_BERR = 3
const GS_USB_BREQ_BT_CONST = 4
const GS_USB_BREQ_DEVICE_CONFIG = 5
const GS_USB_BREQ_TIMESTAMP = 6
const GS_USB_BREQ_IDENTIFY = 7

const GS_CAN_MODE_RESET = 0
const GS_CAN_MODE_START = 1

const USB_DIR_OUT = 0
const USB_DIR_IN = 0x80
const USB_TYPE_VENDOR = (0x02 << 5)
const USB_RECIP_INTERFACE = 0x01

const setDeviceMode = (device, mode, flags) => {
  debug('resetDevice')
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_MODE
  const wValue = 0
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const data = Buffer.alloc(8)
  data.writeUInt32LE(mode, 0) // mode
  data.writeUInt32LE(flags, 4) // flags
  console.log({
    direction: 'out',
    fn: 'setDeviceMode',
    request: bRequest,
    value: wValue,
    wIndex: wIndex,
    data: data.toString('hex')
  })
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    data
  )
}

const sendHostConfig = (device) => {
  debug('sendHostConfig')
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_HOST_FORMAT
  const wValue = 1
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const data = Buffer.alloc(4)
  data.writeUInt32LE(0x0000BEEF, 0)
  console.log({
    direction: 'out',
    fn: 'sendHostConfig',
    request: bRequest,
    value: wValue,
    wIndex: wIndex,
    data: data.toString('hex')
  })
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    data
  )
}

const transferDataOut = (outEndpoint, frame) => {
  debug('transferDataOut')
  return new Promise((resolve, reject) => {
    console.log(`> ${frame.toString()}`)
    outEndpoint.transfer(frame, (err) => {
      if (err) {
        return reject(err)
      }
      resolve()
    })
  })
}

const transferDataIn = (inEndpoint, length) => {
  debug('inEndpoint')
  return new Promise((resolve, reject) => {
    inEndpoint.transfer(length, (err, res) => {
      if (err) {
        return reject(err)
      }
      resolve(res)
    })
  })
}

const setupDevice = async (vendorId, productId) => {
  //usb.setDebugLevel(4)
  const deviceList = usb.getDeviceList()
  const device = deviceList.find(device => device.deviceDescriptor.idProduct === productId &&
      device.deviceDescriptor.idVendor === vendorId)
  if (!device) {
    throw new Error('Device not found')
  }
  device.open()
  device.interfaces[0].claim()
  device.controlTransfer = util.promisify(device.controlTransfer)
  await setDeviceMode(device, 0x00000000, 0x00000000) // reset device
  await sendHostConfig(device)
  await setDeviceMode(device, 0x00000001, 0x00000000) // start device
  const inEndpoint = device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'InEndpoint')
  const outEndpoint = device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'OutEndpoint')
  return {
    inEndpoint,
    outEndpoint
  }
}

module.exports = {
  setupDevice,
  transferDataOut,
  transferDataIn
}
