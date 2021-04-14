const GsUsb = require('../index.js')

const run = async () => {
  const gsUsb = new GsUsb()
  await gsUsb.init()
  gsUsb.on('frame', (frame) => {
    console.log(frame)
  })
  setInterval(async () => {
    await gsUsb.sendCanFrame(0x7E0, Buffer.from('0210035555555555', 'hex'))
  }, 1000)
  await gsUsb.recv()
}

run()
