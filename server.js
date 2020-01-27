const {
  setupDevice,
  transferDataOut,
  transferDataIn,
  buildFrame
} = require('./index')

const sendQueue = []

/*
18B_CPCNG_MC1C4131_T_PROD

TODO:
diag sessions
---
Unknown payload: 0210015555555555
Unknown payload: 0210835555555555

DIDs
---
unknown payload: 0322f11155555555

03 19 02 0c 55555555 // read DTC

Unknown payload: 053181ff05005555
Unknown payload: 021083 5555555555
Unknown payload: 028582 5555555555
Unknown payload: 03288101 55555555
Unknown payload: 05 31 81 020400 5555
Unknown payload: 06 31 81 0206 00 01 55

coding
---
0322013155555555
0322f19655555555
0322100155555555

*/

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const drainSendQueue = async (outEndpoint) => {
  while (sendQueue.length) {
    const frame = sendQueue.shift()
    await transferDataOut(outEndpoint, frame)
    await delay(50)
  }
}

const readLoop = async (inEndpoint, cb) => {
  const maxFrameLength = 32
  const frame = await transferDataIn(inEndpoint, maxFrameLength)
  cb(frame)
  readLoop(inEndpoint, cb)
}

const sendResponse = async (arbitrationId, frames) => {
  for (let i = 0; i < frames.length; ++i) {
    sendQueue.push(buildFrame(arbitrationId, frames[i]))
  }
}

const state = {
  f100Counter: 0
}

const requests = {
  startDiagnosticSession01: Buffer.from('0210015555555555', 'hex'),
  startDiagnosticSession02: Buffer.from('0210025555555555', 'hex'),
  startDiagnosticSession03: Buffer.from('0210035555555555', 'hex'),
  startDiagnosticSession83: Buffer.from('0210835555555555', 'hex'),
  testerPresent: Buffer.from('023e005555555555', 'hex'),
  readDid010C: Buffer.from('0322010c55555555', 'hex'),
  readDidF100: Buffer.from('0322f10055555555', 'hex'),
  readDidF186: Buffer.from('0322f18655555555', 'hex'),
  readDidF15B: Buffer.from('0322f15b55555555', 'hex'),
  readDidF153: Buffer.from('0322f15355555555', 'hex'),
  readDidF150: Buffer.from('0322f15055555555', 'hex'),
  readDidF151: Buffer.from('0322f15155555555', 'hex'),
  readDid0100: Buffer.from('0322010055555555', 'hex'),
  readDidF154: Buffer.from('0322f15455555555', 'hex'),
  readDidF199: Buffer.from('0322f19955555555', 'hex'),
  readDid2005: Buffer.from('0322200555555555', 'hex'),
  readDid1000: Buffer.from('0322100055555555', 'hex'),
  eraseFlashMemory00: Buffer.from('063101ff00010055', 'hex'),
  eraseFlashMemory02: Buffer.from('063101ff00010255', 'hex'),
  controlFailSafeReactionsStopFunc: Buffer.from('053182ff05005555', 'hex'),
  controlFailSafeReactions2StopFunc: Buffer.from('0431820204555555', 'hex'),
  controlFailSafeReactions3StopFunc: Buffer.from('0531820204005555', 'hex'),
  prepareVehicleSystemsForReprogrammingStopFunc: Buffer.from('0431820206555555', 'hex'),
  communicationControl: Buffer.from('0328800155555555', 'hex'),
  controlDtcSettings: Buffer.from('0285815555555555', 'hex'),
  requestSeed11: Buffer.from('0227115555555555', 'hex'),
  sendKey12: Buffer.from('062712305d2d5c55', 'hex'),
  writeFingerPrint: Buffer.from('100c2ef15a000414', 'hex'),
  requestDownloadSegmentCalibration1: Buffer.from('100b341044803c00', 'hex'),
  requestDownloadSegmentCalibration2: Buffer.from('100b341044803fe4', 'hex'),
  requestDownloadSegmentBootloader: Buffer.from('100b341044800180', 'hex'),
  requestTransferExit: Buffer.from('0137555555555555', 'hex'),
  activateRoutine01ff04: Buffer.from('108c3101ff040004', 'hex'),
  activateRoutine01ff06: Buffer.from('043101ff06555555', 'hex'),
  hardReset: Buffer.from('0211015555555555', 'hex')
}

const responses = {
  startDiagnosticSession01: [
    [0x06, 0x50, 0x01, 0x00, 0x28, 0x00, 0xC8, 0xAA]
  ],
  startDiagnosticSession02: [
    [0x06, 0x50, 0x02, 0x00, 0x28, 0x00, 0xC8, 0xAA]
  ],
  startDiagnosticSession03: [
    [0x06, 0x50, 0x03, 0x00, 0x14, 0x00, 0xC8, 0xAA]
  ],
  startDiagnosticSession83: [
    [0x06, 0x50, 0x83, 0x00, 0x14, 0x00, 0xC8, 0xAA]
  ],
  testerPresent: [
    [0x02, 0x7E, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA]
  ],
  readDidF100: [
    //[0x07, 0x62, 0xF1, 0x00, 0x02, 0x3E, 0x11, 0x03] // 0x023E11 = 146961 = CPC_NG_R16B2; last byte is current diag session mode
    //[0x07, 0x62, 0xF1, 0x00, 0x02, 0x3E, 0x1E, 0x02] // 0x23E1E = 146974 = CPC_NG_R18B; last byte is current diag session mode
    [0x07, 0x62, 0xF1, 0x00, 0x03, 0x3E, 0x04, 0x02] // 0x033E04 = ? = CPC_NG_Common_Boot; ; last byte is current diag session mode
  ],
  readDid0100: [
    [0x10, 0x0F, 0x62, 0x01, 0x00, 0x00, 0x00, 0xFF],
    [0x21, 0xFF, 0x00, 0x01, 0xFF, 0xFF, 0x00, 0x01],
    [0x22, 0xFF, 0xFF, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA]
  ],
  readDid010C: [
    [0x07, 0x62, 0x01, 0x0C, 0x00, 0x06, 0x18, 0x6A]
  ],
  readDid1000: [
    [0x10, 0x67, 0x62, 0x10, 0x00, 0x43, 0x50, 0x43],
    [0x21, 0x5F, 0x4E, 0x47, 0x2D, 0x31, 0x36, 0x42],
    [0x22, 0x2D, 0x4D, 0x43, 0x31, 0x38, 0x33, 0x37],
    [0x23, 0x59, 0x31, 0x5F, 0x53, 0x57, 0x30, 0x31],
    [0x24, 0x2D, 0x32, 0x31, 0x33, 0x2D, 0x4D, 0x31],
    [0x25, 0x37, 0x37, 0x5F, 0x44, 0x45, 0x48, 0x4C],
    [0x26, 0x41, 0x34, 0x30, 0x5F, 0x55, 0x53, 0x41],
    [0x27, 0x2D, 0x4D, 0x45, 0x31, 0x37, 0x32, 0x32],
    [0x28, 0x30, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x29, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x2A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x2B, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x2C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x2D, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x2E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xAA]
  ],
  readDid2005: [
    [0x04, 0x62, 0x20, 0x05, 0x77, 0xAA, 0xAA, 0xAA]
  ],
  readDidF150: [
    [0x06, 0x62, 0xF1, 0x50, 0x0E, 0x2F, 0x00, 0xAA]
  ],
  readDidF151: [
    [0x10, 0x0C, 0x62, 0xF1, 0x51, 0x0F, 0x11, 0x00],
    [0x21, 0x11, 0x0B, 0x00, 0x11, 0x16, 0x00, 0xAA]
  ],
  readDidF153: [
    [0x06, 0x62, 0xF1, 0x53, 0x0F, 0x11, 0x00, 0xAA]
  ],
  readDidF15B: [
    [0x10, 0x21, 0x62, 0xF1, 0x5B, 0x01, 0x00, 0x00],
    [0x21, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x22, 0x01, 0x00, 0x04, 0x11, 0x0B, 0x10, 0x00],
    [0x23, 0x00, 0x00, 0x01, 0x01, 0x00, 0x04, 0x11],
    [0x24, 0x0B, 0x10, 0x00, 0x00, 0x00, 0x01, 0xAA],
  ],
  readDidF186: [
    [0x04, 0x62, 0xF1, 0x86, 0x03, 0xAA, 0xAA, 0xAA]
  ],
  readDidF199: [
    [0x03, 0x7F, 0x22, 0x31, 0xAA, 0xAA, 0xAA, 0xAA] // TODO: security fail?
    //[0x03, 0x62, 0xF1, 0x99, 0xAA, 0xAA, 0xAA, 0xAA] // guess
  ],
  readDidF154: [ // variant ID
    [0x05, 0x62, 0xF1, 0x54, 0x00, 0x9E, 0xAA, 0xAA] // 0x009E = Continental
  ],
  eraseFlashMemory00: [
    [0x06, 0x71, 0x01, 0xFF, 0x00, 0x00, 0x00, 0xAA] // guess
  ],
  eraseFlashMemory02: [
    [0x06, 0x71, 0x01, 0xFF, 0x00, 0x00, 0x00, 0xAA] // guess
  ],
  controlFailSafeReactionsStopFunc: [
    [0x05, 0x71, 0x82, 0xFF, 0x05, 0x00, 0xAA, 0xAA] // guess
  ],
  controlFailSafeReactions2StopFunc: [
    [0x04, 0x71, 0x82, 0x02, 0x04, 0xAA, 0xAA, 0xAA] // guess
  ],
  controlFailSafeReactions3StopFunc: [
    [0x05, 0x71, 0x82, 0x02, 0x04, 0x00, 0xAA, 0xAA] // guess
  ],
  prepareVehicleSystemsForReprogrammingStopFunc: [
    [0x04, 0x71, 0x82, 0x02, 0x06, 0x0AA, 0xAA, 0xAA] //guess
  ],
  communicationControl: [
    [0x02, 0x68, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA]
  ],
  controlDtcSettings: [
    [0x02, 0xC5, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA]
  ],
  requestSeed11: [
    [0x06, 0x67, 0x11, 0x2f, 0xcc, 0xb1, 0x8b, 0xaa]
  ],
  sendKey12: [
    [0x02, 0x67, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00]
  ],
  writeFingerPrint: [
    [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x03, 0x6E, 0xF1, 0x5A, 0x00, 0x00, 0x00, 0x00],
  ],
  requestDownloadSegmentCalibration1: [
    [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x04, 0x74, 0x20, 0x0F, 0xFD, 0x00, 0xAA, 0xAA]
  ],
  requestDownloadSegmentCalibration2: [
    [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x04, 0x74, 0x20, 0x0F, 0xFD, 0x00, 0xAA, 0xAA]
  ],
  requestDownloadSegmentBootloader: [
    [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x04, 0x74, 0x20, 0x0F, 0xFD, 0x00, 0xAA, 0xAA]
  ],
  transferData: [
    [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x01, 0x76, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA]
  ],
  requestTransferExit: [
    [0x01, 0x77, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
  ],
  activateRoutine01ff04: [
    [0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x06, 0x71, 0x01, 0xFF, 0x00, 0x00, 0x00, 0xAA] // guess
  ],
  activateRoutine01ff06: [
    [0x06, 0x71, 0x01, 0xFF, 0x00, 0x00, 0x00, 0xAA] // guess
  ],
  hardReset: [
    [0x02, 0x51, 0x01, 0x00, 0x00, 0x00, 0x00, 0xAA] // guess
  ]
}
const queue = []
let counter = 0x009E

const run = async () => {
  const vendorId = 0x1D50
  const deviceId = 0x606F
  const { inEndpoint, outEndpoint } = await setupDevice(vendorId, deviceId)
  readLoop(inEndpoint, (frame) => {
    queue.push(frame)
  })
  let locked = false
  setInterval(async () => {
    if (locked || !queue.length) {
      return
    }
    locked = true
    const frame = queue.shift()
    const arbitrationId = frame.readUInt32LE(4)
    const payload = frame.slice(12)
    const stringifiedPayload = payload.toString('hex')
    if (arbitrationId === 0x7E5) {
      if (payload.equals(requests.startDiagnosticSession01)) {
        sendResponse(0x7ED, responses.startDiagnosticSession01)
      } else if (payload.equals(requests.startDiagnosticSession02)) {
        sendResponse(0x7ED, responses.startDiagnosticSession02)
      } else if (payload.equals(requests.startDiagnosticSession03)) {
        sendResponse(0x7ED, responses.startDiagnosticSession03)
      } else if (payload.equals(requests.startDiagnosticSession83)) {
        sendResponse(0x7ED, responses.startDiagnosticSession83)
      } else if (payload.equals(requests.testerPresent)) {
        sendResponse(0x7ED, responses.testerPresent)
      } else if (payload.equals(requests.readDid010C)) {
        sendResponse(0x7ED, responses.readDid010C)
      } else if (payload.equals(requests.readDidF100)) {
        sendResponse(0x7ED, responses.readDidF100)
      } else if (payload.equals(requests.readDidF186)) {
        sendResponse(0x7ED, responses.readDidF186)
      } else if (payload.equals(requests.readDidF15B)) {
        sendResponse(0x7ED, responses.readDidF15B)
      } else if (payload.equals(requests.readDidF153)) {
        sendResponse(0x7ED, responses.readDidF153)
      } else if (payload.equals(requests.readDidF150)) {
        sendResponse(0x7ED, responses.readDidF150)
      } else if (payload.equals(requests.readDidF151)) {
        sendResponse(0x7ED, responses.readDidF151)
      } else if (payload.equals(requests.readDid0100)) {
        sendResponse(0x7ED, responses.readDid0100)
      } else if (payload.equals(requests.readDidF199)) {
        sendResponse(0x7ED, responses.readDidF199)
      } else if (payload.equals(requests.readDidF154)) {
        sendResponse(0x7ED, responses.readDidF154)
      } else if (payload.equals(requests.readDid1000)) {
        sendResponse(0x7ED, responses.readDid1000)
      } else if (payload.equals(requests.readDid2005)) {
        sendResponse(0x7ED, responses.readDid2005)
      } else if (payload.equals(requests.controlFailSafeReactionsStopFunc)) {
        sendResponse(0x7ED, responses.controlFailSafeReactionsStopFunc)
      } else if (payload.equals(requests.controlFailSafeReactions2StopFunc)) {
        sendResponse(0x7ED, responses.controlFailSafeReactions2StopFunc)
      } else if (payload.equals(requests.controlFailSafeReactions3StopFunc)) {
        sendResponse(0x7ED, responses.controlFailSafeReactions3StopFunc)
      } else if (payload.equals(requests.prepareVehicleSystemsForReprogrammingStopFunc)) {
        sendResponse(0x7ED, responses.prepareVehicleSystemsForReprogrammingStopFunc)
      } else if (payload.equals(requests.communicationControl)) {
        sendResponse(0x7ED, responses.communicationControl)
      } else if (payload.equals(requests.controlDtcSettings)) {
        sendResponse(0x7ED, responses.controlDtcSettings)
      } else if (payload.equals(requests.requestSeed11)) {
        sendResponse(0x7ED, responses.requestSeed11)
      } else if (payload.equals(requests.sendKey12)) {
        sendResponse(0x7ED, responses.sendKey12)
      } else if (payload.equals(requests.eraseFlashMemory00)) {
        sendResponse(0x7ED, responses.eraseFlashMemory00)
      } else if (payload.equals(requests.eraseFlashMemory02)) {
        sendResponse(0x7ED, responses.eraseFlashMemory02)
      } else if (payload.equals(requests.writeFingerPrint)) {
        sendResponse(0x7ED, responses.writeFingerPrint)
      } else if (payload.equals(requests.requestDownloadSegmentCalibration1)) {
        sendResponse(0x7ED, responses.requestDownloadSegmentCalibration1)
      } else if (payload.equals(requests.requestDownloadSegmentCalibration2)) {
        sendResponse(0x7ED, responses.requestDownloadSegmentCalibration2)
      } else if (payload.equals(requests.requestDownloadSegmentBootloader)) {
        sendResponse(0x7ED, responses.requestDownloadSegmentBootloader)
      } else if (payload.equals(requests.requestTransferExit)) {
        sendResponse(0x7ED, responses.requestTransferExit)
      } else if (payload.equals(requests.activateRoutine01ff04)) {
        sendResponse(0x7ED, responses.activateRoutine01ff04)
      } else if (payload.equals(requests.activateRoutine01ff06)) {
        sendResponse(0x7ED, responses.activateRoutine01ff06)
      } else if ((payload[0] >> 4) === 0x01 && payload[2] === 0x36) {
        sendResponse(0x7ED, responses.transferData)
      }  else {
        console.error(`Unknown payload: ${stringifiedPayload}`)
      }
    }
    console.log(`< ${arbitrationId.toString(16).padStart(3, '0')} ${stringifiedPayload}`)
    await drainSendQueue(outEndpoint)
    locked = false
  }, 100)
}

run()
