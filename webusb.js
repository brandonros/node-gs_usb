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
  startDiagnosticSession03: [0x02, 0x10, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00],
  readSoftwareNumber: [0x03, 0x22, 0xF1, 0x21, 0x00, 0x00, 0x00, 0x00],
  readPartNumber: [0x03, 0x22, 0xF1, 0x11, 0x00, 0x00, 0x00, 0x00],
  readVin: [0x03, 0x22, 0xF1, 0x90, 0x00, 0x00, 0x00, 0x00],
  continuationFrame: [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
}

const noisyArbitrationIds = new Set([
  0x0ae,
  0x0b3,
  0x0a1,
  0x094,
  0x0a3,
  0x03d,
  0x02f,
  0x18d,
  0x098,
  0x18e,
  0x087,
  0x096,
  0x0b1,
  0x1f3,
  0x4b0,
  0x141,
  0x1e9,
  0x4a6,
  0x0d5,
  0x14b,
  0x14d,
  0x1e5,
  0x33b,
  0x451,
  0x469,
  0x188,
  0x339,
  0x4d8,
  0x1ee,
  0x2f7,
  0x401,
  0x2cf,
  0x4bb,
  0x133,
  0x2f0,
  0x1e1,
  0x34b,
  0x32e,
  0x4aa,
  0x46b,
  0x37f,
  0x351,
  0x379,
  0x3e8,
  0x341,
  0x137,
  0x020,
  0x3c2,
  0x209,
  0x2b9,
  0x151,
  0x353,
  0x122,
  0x147,
  0x149,
  0x225,
  0x15a,
  0x22b,
  0x357,
  0x369,
  0x49b,
  0x3a4,
  0x37b,
  0x068,
  0x381,
  0x377,
  0x4af,
  0x2fb,
  0x2f1,
  0x31a,
  0x4d3,
  0x2f3,
  0x4b8,
  0x409,
  0x335,
  0x4cd,
  0x337,
  0x35d,
  0x2c4,
  0x2f5,
  0x320,
  0x328,
  0x3bc,
  0x4bd,
  0x3e7,
  0x40c,
  0x38e,
  0x4ae,
  0x3a2,
  0x458,
  0x2fe,
  0x075,
  0x3c4,
  0x48a,
  0x4c2,
  0x407,
  0x071,
  0x3c6,
  0x3ce,
  0x507,
  0x30b,
  0x3ed,
  0x490,
  0x50b,
  0x309,
  0x3ef,
  0x3f3,
  0x49e,
  0x3f1,
  0x4a8,
  0x3db,
  0x2c6,
  0x3eb,
  0x334,
  0x4c1,
  0x4c6,
  0x2de,
  0x4d6
])

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

const resetDevice = async (device) => {
  const bRequest = GS_USB_BREQ_MODE
  const wValue = 0
  const wIndex = device.configurations[0].interfaces[0].interfaceNumber
  const data = new ArrayBuffer(8)
  const dataView = new DataView(data)
  dataView.setUint32(0, 0x00000000, true) // mode
  dataView.setUint32(4, 0x00000000, true) // flags
  console.log({
    request: bRequest,
    value: wValue,
    index: wIndex,
    data: buf2hex(data)
  })
  return device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'interface',
    request: bRequest,
    value: wValue,
    index: wIndex
  }, data)
}

const sendHostConfig = async (device) => {
  const bRequest = GS_USB_BREQ_HOST_FORMAT
  const wValue = 1
  const wIndex = device.configurations[0].interfaces[0].interfaceNumber
  const data = new ArrayBuffer(4)
  const dataView = new DataView(data)
  dataView.setUint32(0, 0x0000BEEF, false) // not little-endian
  console.log({
    request: bRequest,
    value: wValue,
    index: wIndex,
    data: buf2hex(data)
  })
  return device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'interface',
    request: bRequest,
    value: wValue,
    index: wIndex
  }, data)
}

const readDeviceConfig = async (device) => {
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
  console.log({
    request: bRequest,
    value: wValue,
    index: wIndex,
    data: buf2hex(data)
  })
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
  const endpoint = device.configuration.interfaces[0].alternates[0].endpoints.find(e => e.direction === 'in')
  const endpointNumber = endpoint.endpointNumber
  const length = 0x14
  const result = await device.transferIn(endpointNumber, length)
  if (result.data && result.data.byteLength === length) {
    cb(result)
  }
  if (result.status === 'stall') {
    console.warn('Endpoint stalled. Clearing.')
    await device.clearHalt(1)
  }
  await delay(16)
  return readLoop(device, cb)
}

const send = async (device, arbitrationId, message) => {
  const endpoint = device.configuration.interfaces[0].alternates[0].endpoints.find(e => e.direction === 'out')
  const endpointNumber = endpoint.endpointNumber
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
  console.log(`> ${buf2hex(data)}`)
  //const frame = buf2hex(data).slice(24)
  //console.log(`${arbitrationId.toString(16).padStart(3, '0')} > ${frame}`)
  const result = await device.transferOut(endpointNumber, data)
  console.log(result)
}

const initDevice = async (deviceName) => {
  const device = await navigator.usb.requestDevice({
    filters: [
      devices[deviceName]
    ]
  })
  await device.open()
  const [ configuration ] = device.configurations
  if (device.configuration === null)
    await device.selectConfiguration(configuration.configurationValue)
  }
  await device.claimInterface(configuration.interfaces[0].interfaceNumber)
  await resetDevice(device)
  await sendHostConfig(device)
  const deviceConfig = await readDeviceConfig(device)
  console.log({ deviceConfig: buf2hex(deviceConfig.data.buffer) })
  const bitTimingConstants = await fetchBitTimingConstants(device)
  console.log({ bitTimingConstants: buf2hex(bitTimingConstants.data.buffer) })
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
      const result = await send(device, sourceArbitrationId, frame)
      const stringifiedFrame = JSON.stringify({
        type: 'out',
        arbitration_id: sourceArbitrationId.toString(16).padStart(3, '0'),
        frame: buf2hex(frame),
        sent: new Date().toISOString()
      })
      document.querySelector('#logs').value += `${stringifiedFrame}\n`
      // TODO: send continuation frame?
    })

    readLoop(device, (result) => {
      if (buf2hex(result.data.buffer) === 'ffffffffe807000008000000101462f190574444') {
        debugger
      }
      const arbitrationId = result.data.getUint16(4, true)
      const frame = buf2hex(result.data.buffer).slice(24)
      if (noisyArbitrationIds.has(arbitrationId)) {
        return
      }
      const stringifiedFrame = JSON.stringify({
        type: 'in',
        arbitration_id: arbitrationId.toString(16).padStart(3, '0'),
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
