// Importa el barco de Tripo: modelos-fuente/barco-tripo.glb → public/models/boat.glb.
// Uso: con `npx vite` corriendo en el puerto 5173, `node scripts/import-tripo-boat.cjs`.
// 1. gltf-transform (CLI, vía npx) descomprime Draco, suelda y simplifica (~1,2 M → ~55 k triángulos).
// 2. src/tools/tripoBoat.ts (en el navegador) lo orienta, lo escala y recorta las piezas animadas.
// 3. gltf-transform comprime: textura WebP y mallas con meshopt (el juego las carga con useGLTF(url, false, true)).
let pw
try {
  pw = require('playwright')
} catch {
  pw = require('/opt/node22/lib/node_modules/playwright')
}
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const root = path.join(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tripo-'))
const gt = (args) => execSync(`npx -y @gltf-transform/cli@4 ${args}`, { stdio: 'inherit', cwd: tmp })
;(async () => {
  fs.copyFileSync(path.join(root, 'modelos-fuente', 'barco-tripo.glb'), path.join(tmp, 'src.glb'))
  gt('copy src.glb plain.glb')
  gt('weld plain.glb welded.glb')
  gt('simplify welded.glb simple.glb --ratio 0.02 --error 0.002')
  const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage()
  p.on('pageerror', (e) => console.log('ERR ' + e.message))
  await p.route('**/__tripo.glb', (r) => r.fulfill({ body: fs.readFileSync(path.join(tmp, 'simple.glb')), contentType: 'model/gltf-binary' }))
  await p.goto('http://localhost:5173/')
  await p.waitForTimeout(3000)
  const b64 = await p.evaluate(async () => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js')
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js')
    const { buildTripoBoat } = await import('/src/tools/tripoBoat.ts')
    const gltf = await new GLTFLoader().loadAsync('/__tripo.glb')
    const boat = buildTripoBoat(gltf.scene)
    const buf = await new GLTFExporter().parseAsync(boat, { binary: true })
    let s = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return btoa(s)
  })
  await b.close()
  fs.writeFileSync(path.join(tmp, 'boat.glb'), Buffer.from(b64, 'base64'))
  gt('webp boat.glb boat-webp.glb --quality 85')
  gt('meshopt boat-webp.glb boat-final.glb --level medium')
  const out = path.join(root, 'public', 'models', 'boat.glb')
  fs.copyFileSync(path.join(tmp, 'boat-final.glb'), out)
  console.log('boat.glb', fs.statSync(out).size, 'bytes')
})()
