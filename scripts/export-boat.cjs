// Exporta public/models/boat.glb desde src/tools/boatBuilder.ts.
// Uso: con `npx vite` corriendo en el puerto 5173, `node scripts/export-boat.cjs`.
let pw
try {
  pw = require('playwright')
} catch {
  pw = require('/opt/node22/lib/node_modules/playwright')
}
const { chromium } = pw
const fs = require('fs')
const path = require('path')
;(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage()
  p.on('pageerror', (e) => console.log('ERR ' + e.message))
  await p.goto('http://localhost:5173/')
  await p.waitForTimeout(3000)
  const b64 = await p.evaluate(async () => {
    const { buildBoat } = await import('/src/tools/boatBuilder.ts')
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js')
    const root = buildBoat()
    const buf = await new GLTFExporter().parseAsync(root, { binary: true })
    let s = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return btoa(s)
  })
  const out = path.join(__dirname, '..', 'public', 'models', 'boat.glb')
  fs.writeFileSync(out, Buffer.from(b64, 'base64'))
  console.log('boat.glb', fs.statSync(out).size, 'bytes')
  await b.close()
})()
