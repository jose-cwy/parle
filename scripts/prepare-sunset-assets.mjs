import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

function distSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return dr * dr + dg * dg + db * db
}

function isCheckerPixel(r, g, b) {
  // Two typical baked checker shades (approx).
  // Use a slightly generous tolerance to catch antialiased edges.
  const d1 = distSq(r, g, b, 238, 238, 238)
  const d2 = distSq(r, g, b, 205, 205, 205)
  return d1 < 2200 || d2 < 2200
}

async function readPng(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG())
      .on('parsed', function () {
        resolve(this)
      })
      .on('error', reject)
  })
}

function featherAlpha(png) {
  // Light 1px feather to avoid harsh edges after keying.
  const { width, height, data } = png
  const getA = (x, y) => data[(y * width + x) * 4 + 3]
  const setA = (x, y, a) => {
    data[(y * width + x) * 4 + 3] = a
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const a = getA(x, y)
      if (a === 0) continue
      const n =
        getA(x - 1, y) +
        getA(x + 1, y) +
        getA(x, y - 1) +
        getA(x, y + 1) +
        getA(x - 1, y - 1) +
        getA(x + 1, y - 1) +
        getA(x - 1, y + 1) +
        getA(x + 1, y + 1)
      const avg = Math.round(n / 8)
      // If surrounded by transparency, soften edge a bit.
      if (avg < 200 && a > 200) setA(x, y, Math.max(avg, 140))
    }
  }
}

async function cleanSun() {
  const inPath = path.resolve('public/images/landing/sun-isolated.png')
  const outPath = path.resolve('public/images/landing/sun-isolated-clean.png')

  const png = await readPng(inPath)
  const { data } = png

  let checkerCount = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a === 0) continue
    if (isCheckerPixel(r, g, b)) {
      data[i + 3] = 0
      checkerCount++
    }
  }

  featherAlpha(png)

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(outPath)
    png.pack().pipe(stream).on('finish', resolve).on('error', reject)
  })

  console.log(`Wrote ${path.relative(process.cwd(), outPath)} (keyed ${checkerCount} pixels)`)
}

await cleanSun()
