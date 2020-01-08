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

const { setupDevice } = require('./index')

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const run = async () => {
  const moduleName = 'ecu'
  const canable = await setupDevice(0x1d50, 0x606f, 17)
  const canalyze = await setupDevice(0x1d50, 0x606f, 19)
  canable.on('frame-in', (frame) => {
    console.log(`canable < ${frame.toString('hex')}`)
  })
  canalyze.on('frame-in', (frame) => {
    console.log(`canalyze < ${frame.toString('hex')}`)
  })
  canable.emit('start')
  canalyze.emit('start')
  setInterval(async () => {
    const readVin = Buffer.from([0x03, 0x22, 0xF1, 0x90, 0x00, 0x00, 0x00, 0x00])
    const idBuffer = Buffer.alloc(2)
    idBuffer.writeUInt16LE(arbitrationIdPairs[moduleName].source, 0)
    const frame = Buffer.from(`ffffffff${idBuffer.toString('hex')}000008000000${readVin.toString('hex')}`, 'hex')
    canalyze.emit('frame-out', frame)
    //canable.emit('frame-out', frame)
  }, 500)
}

run()
