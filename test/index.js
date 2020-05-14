const GsUsb = require('../index')
document.querySelector('#go').addEventListener('click', async (event) => {
  const gsUsb = new GsUsb()
  await gsUsb.init()
  await gsUsb.recv()
})
