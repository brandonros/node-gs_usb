const usb = require('usb')
const EventEmitter = require('events')
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

const sendHostConfig = (device) => {
  debug('sendHostConfig')
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_HOST_FORMAT
  const wValue = 1
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const data = Buffer.from([0x00, 0x00, 0xBE, 0xEF])
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

const readDeviceConfig = (device) => {
  debug('readDeviceConfig')
  const bmRequestType =  USB_DIR_IN | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_DEVICE_CONFIG
  const wValue = 1
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const length = 0x0C
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    length
  )
}

const fetchBitTimingConstants = (device) => {
  debug('fetchBitTimingConstants')
  const bmRequestType =  USB_DIR_IN | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_BT_CONST
  const wValue = 0
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const length = 0x28
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    length
  )
}

const startDevice = (device) => {
  debug('startDevice')
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_MODE
  const wValue = 0
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const data = Buffer.alloc(8)
  data.writeUInt32LE(0x00000001, 0) // mode
  data.writeUInt32LE(0x00000000, 4) // flags
  console.log({
    direction: 'out',
    fn: 'startDevice',
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

const resetDevice = (device) => {
  debug('resetDevice')
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_MODE
  const wValue = 0
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const data = Buffer.alloc(8)
  data.writeUInt32LE(0x00000000, 0) // mode
  data.writeUInt32LE(0x00000000, 4) // flags
  console.log({
    direction: 'out',
    fn: 'resetDevice',
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

const transferFrame = (outEndpoint, frame) => {
  debug('transferFrame')
  return new Promise((resolve, reject) => {
    outEndpoint.transfer(frame, (err) => {
      if (err) {
        return reject(err)
      }
      resolve()
    })
  })
}

const setupDevice = async (vendorId, productId, deviceAddress) => {
  //usb.setDebugLevel(4)
  const deviceList = usb.getDeviceList()
  const device = deviceList.find(device => device.deviceDescriptor.idProduct === productId &&
      device.deviceDescriptor.idVendor === vendorId &&
      device.deviceAddress === deviceAddress)
  if (!device) {
    throw new Error('Device not found')
  }
  device.open()
  device.interfaces[0].claim()
  device.controlTransfer = util.promisify(device.controlTransfer)
  await resetDevice(device)
  await sendHostConfig(device)
  const deviceConfig = await readDeviceConfig(device)
  const bitTimingConstants = await fetchBitTimingConstants(device)
  await startDevice(device)
  const emitter = new EventEmitter()
  const inEndpoint = device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'InEndpoint')
  const outEndpoint = device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'OutEndpoint')
  inEndpoint.on('data', (frame) => {
    emitter.emit('frame-in', frame)
  })
  inEndpoint.on('error', (err) => {
    console.error(err)
  })
  outEndpoint.on('error', (err) => {
    console.error(err)
  })
  emitter.on('frame-out', async (frame) => {
    await transferFrame(outEndpoint, frame)
  })
  emitter.on('start', () => inEndpoint.startPoll())
  return emitter
}

module.exports = {
  setupDevice,
  transferFrame
}
