const devices = {
  canalyze: {
    vendorId: 0x0483,
    productId: 0x1234
  },
  canable: {
    vendorId: 0x1d50,
    productId: 0x606f
  },
  cantact: {
    vendorId: 0x1d50,
    productId: 0x606f
  }
}

const arbitrationIdPairs = {
  cpc: {
    source: 0x7E5,
    destination: 0x7ED
  },
  tcu: {
    source: 0x749,
    destination: 0x729
  },
  suspension: {
    source: 0x744,
    destination: 0x724
  },
  ecu: {
    source: 0x7E0,
    destination: 0x7E8
  }
}

const messages = {
  readSoftwareNumber: [0x03, 0x22, 0xF1, 0x21, 0x00, 0x00, 0x00, 0x00],
  readPartNumber: [0x03, 0x22, 0xF1, 0x11, 0x00, 0x00, 0x00, 0x00],
  readVin: [0x03, 0x22, 0xF1, 0x90, 0x00, 0x00, 0x00, 0x00],
  continuationFrame: [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
}

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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}


const resetDevice = async (device) => {
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_MODE
  const wValue = 0
  const wIndex = device.configurations[0].interfaces[0].interfaceNumber
  const data = new ArrayBuffer(8)
  const dataView = new DataView(data)
  dataView.setUint32(0, 0x00000000, true) // mode
  dataView.setUint32(4, 0x00000000, true) // flags
  return device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'interface',
    request: bRequest,
    value: wValue,
    index: wIndex
  }, data)
}

const sendHostConfig = async (device) => {
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_HOST_FORMAT
  const wValue = 1
  const wIndex = device.configurations[0].interfaces[0].interfaceNumber
  const data = new ArrayBuffer(4)
  const dataView = new DataView(data)
  dataView.setUint32(0, 0x0000BEEF, true)
  return device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'interface',
    request: bRequest,
    value: wValue,
    index: wIndex
  }, data)
}

const readDeviceConfig = async (device) => {
  const bmRequestType =  USB_DIR_IN | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_DEVICE_CONFIG
  const wValue = 1
  const wIndex = device.configurations[0].interfaces[0].interfaceNumber
  const length = 0x0C
  return device.controlTransferIn({
    requestType: 'vendor',
    recipient: 'interface',
    request: bRequest,
    value: wValue,
    index: wIndex
  }, length)
}

const fetchBitTimingConstants = async (device) => {
  const bmRequestType =  USB_DIR_IN | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_BT_CONST
  const wValue = 0
  const wIndex = device.configurations[0].interfaces[0].interfaceNumber
  const length = 0x28
  return device.controlTransferIn({
    requestType: 'vendor',
    recipient: 'interface',
    request: bRequest,
    value: wValue,
    index: wIndex
  }, length)
}

const startDevice = async (device) => {
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_MODE
  const wValue = 0
  const wIndex = device.configurations[0].interfaces[0].interfaceNumber
  const data = new ArrayBuffer(8)
  const dataView = new DataView(data)
  dataView.setUint32(0, 0x00000001, true) // mode
  dataView.setUint32(4, 0x00000000, true) // flags
  return device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'interface',
    request: bRequest,
    value: wValue,
    index: wIndex
  }, data)
}

const buf2hex = (buffer) => { // buffer is an ArrayBuffer
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('')
}

const readLoop = async (device, cb) => {
  const endpointNumber = 0x01 // in
  const length = 0x14
  const result = await device.transferIn(endpointNumber, length)
  cb(result)
  await delay(16)
  return readLoop(device, cb)
}

let lastSentId = ''

const send = async (device, arbitrationId, message) => {
  const endpointNumber = 0x02 // out
  const data = new ArrayBuffer(0x14)
  const dataView = new DataView(data)
  dataView.setUint32(0x00, 0xffffffff, true)
  dataView.setUint16(0x04, arbitrationId, true)
  dataView.setUint16(0x06, 0x0000, true)
  dataView.setUint32(0x08, 0x00000008, true)
  dataView.setUint8(0x0C, message[0])
  dataView.setUint8(0x0D, message[1])
  dataView.setUint8(0x0E, message[2])
  dataView.setUint8(0x0F, message[3])
  dataView.setUint8(0x10, message[4])
  dataView.setUint8(0x11, message[5])
  dataView.setUint8(0x12, message[6])
  dataView.setUint8(0x13, message[7])
  const frame = buf2hex(data).slice(24)
  console.log(`< ${frame}`)
  lastSentId = arbitrationId.toString(16)
  return device.transferOut(endpointNumber, data)
}

const initDevice = async (deviceName) => {
  const device = await navigator.usb.requestDevice({
    filters: [
      devices[deviceName]
    ]
  })
  await device.open()
  const [ configuration ] = device.configurations
  const [ interface ] = configuration.interfaces
  await device.selectConfiguration(configuration.configurationValue)
  await device.claimInterface(interface.interfaceNumber)
  await resetDevice(device)
  await sendHostConfig(device)
  const deviceConfig = await readDeviceConfig(device)
  const bitTimingConstants = await fetchBitTimingConstants(device)
  await startDevice(device)
  return device
}

const init = async (deviceName) => {
  try {
    // init USB device
    const device = await initDevice()
    // init UI events
    const $arbitrationIdPair = document.querySelector('#arbitrationIdPair')
    const $message = document.querySelector('#message')

    document.querySelector('#send').addEventListener('click', async () => {
      const { source: sourceArbitrationId } = arbitrationIdPairs[$arbitrationIdPair.value]
      const frame = messages[$message.value]
      await send(device, sourceArbitrationId, frame)
      const stringifiedFrame = JSON.stringify({
        type: 'out',
        arbitration_id: sourceArbitrationId,
        frame,
        sent: new Date().toISOString()
      })
      document.querySelector('#logs').value += `${stringifiedFrame}\n`
      // TODO: send continuation frame?
    })

    readLoop(device, (result) => {
      if (!$arbitrationIdPair.value) {
        return
      }
      const {
        source: sourceArbitrationId,
        destination: destinationArbitrationId
      } = arbitrationIdPairs[$arbitrationIdPair.value]
      const arbitrationId = result.data.getUint16(4, true).toString(16).padStart(3, '0')
      if (arbitrationId !== sourceArbitrationId && arbitrationId !== destinationArbitrationId) {
        return
      }
      const frame = buf2hex(result.data.buffer).slice(24)
      const stringifiedFrame = JSON.stringify({
        type: 'in',
        arbitration_id: arbitrationId,
        frame,
        captured: new Date().toISOString()
      })
      document.querySelector('#logs').value += `${stringifiedFrame}\n`
    })

    document.querySelector('#status').innerHTML = 'status: connected'
  } catch (err) {
    alert(err)
  }
}

document.querySelector('#init').addEventListener('click', () => {
  init('cantact')
})
