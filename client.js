const assert = require('assert')
const readline = require('readline')
const fs = require('fs')
const {
  setupDevice,
  transferDataOut,
  transferDataIn,
  buildFrame
} = require('./index')

const receiveQueue = []
const sendQueue = []

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const drainSendQueue = async (outEndpoint) => {
  while (sendQueue.length) {
    const frame = sendQueue.shift()
    const arbitrationId = frame.readUInt32LE(4)
    const payload = frame.slice(12)
    const stringifiedArbitrationId = arbitrationId.toString(16).padStart(3, '0')
    const stringifiedPayload = payload.toString('hex')
    console.log(`> ${stringifiedArbitrationId} ${stringifiedPayload}`)
    await transferDataOut(outEndpoint, frame)
    await delay(100)
  }
}

const readLoop = async (inEndpoint, cb) => {
  const maxFrameLength = 32
  const frame = await transferDataIn(inEndpoint, maxFrameLength)
  cb(frame)
  readLoop(inEndpoint, cb)
}

const waitForResponse = async () => {
  await delay(10)
  if (receiveQueue.length) {
    return receiveQueue.shift()
  }
  return waitForResponse()
}

const logFrame = (arbitrationId, payload) => {
  console.log(`< ${arbitrationId.toString(16).padStart(3, '0')} ${payload.toString('hex')}`)
}

const startDiagnosticSession = async (outEndpoint, level) => {
  console.log(`startDiagnosticSession: ${level.toString(16).padStart(2, '0')}`)
  sendQueue.push(buildFrame(0x7E5, [0x02, 0x10, level]))
  await drainSendQueue(outEndpoint)
  const payload = await waitForResponse()
  //assert(payload[1] === 0x50)
  logFrame(0x7ED, payload)
}

const requestSeed = async (outEndpoint, level) => {
  console.log(`requestSeed: ${level.toString(16).padStart(2, '0')}`)
  sendQueue.push(buildFrame(0x7E5, [0x02, 0x27, level]))
  await drainSendQueue(outEndpoint)
  const payload = await waitForResponse()
  //assert(arbitrationId === 0x7ED)
  //assert(payload[1] === 0x50)
  logFrame(0x7ED, payload)
}

const sendKey = async (outEndpoint, level, key) => {
  console.log(`sendKey: ${level.toString(16).padStart(2, '0')}`)
  sendQueue.push(buildFrame(0x7E5, [0x02, 0x27, level, key[0], key[1], key[2], key[3]]))
  await drainSendQueue(outEndpoint)
  const payload = await waitForResponse()
  //assert(arbitrationId === 0x7ED)
  //assert(payload[1] === 0x50)
  logFrame(0x7ED, payload)
}

const readDid = async (outEndpoint, did) => {
  console.log(`readDid: ${did.toString(16).padStart(4, '0')}`)
  sendQueue.push(buildFrame(0x7E5, [0x03, 0x22, did >> 8, did & 0xFF]))
  await drainSendQueue(outEndpoint)
  const payload = await waitForResponse()
  logFrame(0x7ED, payload)
}

const requests = {
  testerPresent: [0x02, 0x3E, 0x00],
  startDiagnosticSession00: [0x02, 0x10, 0x00],
  startDiagnosticSession01: [0x02, 0x10, 0x01],
  startDiagnosticSession02: [0x02, 0x10, 0x02],
  startDiagnosticSession03: [0x02, 0x10, 0x03],
  startDiagnosticSession04: [0x02, 0x10, 0x04],
  startDiagnosticSession05: [0x02, 0x10, 0x05],
  startDiagnosticSession06: [0x02, 0x10, 0x06],
  readMemoryByAddress: [0x01, 0x23],
  writeMemoryByAddress: [0x01, 0x3D]
}

const run = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  const vendorId = 0x1D50
  const deviceId = 0x606F
  const { inEndpoint, outEndpoint } = await setupDevice(vendorId, deviceId)
  readLoop(inEndpoint, (frame) => {
    const arbitrationId = frame.readUInt32LE(4)
    if (arbitrationId !== 0x7ED) {
      return
    }
    const payload = frame.slice(12)
    receiveQueue.push(payload)
  })
  await startDiagnosticSession(outEndpoint, 0x03)
  await requestSeed(outEndpoint, 0x11)
  await requestSeed(outEndpoint, 0x11)
  const key = await new Promise(resolve => {
    rl.question('Key: ', (answer) => {
      resolve(answer)
      rl.close()
    })
  })
  await sendKey(outEndpoint, 0x12, Buffer.from(key, 'hex'))
  await readDid(outEndpoint, 0xF199)
  for (let i = 0; i <= 0xFF; ++i) {
    await requestSeed(outEndpoint, i)
  }
}

run()

process.on('unhandledRejection', (err) => {
  console.error(err)
})
process.on('uncaughtException', (err) => {
  console.error(err)
})