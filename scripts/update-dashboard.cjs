const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const dashboardPath = path.join(root, 'planning-dashboard.html')
const modulesPath = path.join(root, 'status', 'modules.md')
const roadmapPath = path.join(root, 'status', 'roadmap.md')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function upsertJsonScript(html, id, value) {
  const json = JSON.stringify(value).replace(/<\//g, '<\\/')
  const tag = `<script type="application/json" id="${id}">${json}</script>`
  const pattern = new RegExp(`<script type="application/json" id="${id}">[\\s\\S]*?<\\/script>`)

  if (pattern.test(html)) {
    return html.replace(pattern, tag)
  }

  return html.replace('</body>', `  ${tag}\n</body>`)
}

function main() {
  let html = readUtf8(dashboardPath)
  html = upsertJsonScript(html, 'embedded-modules-md', readUtf8(modulesPath))
  html = upsertJsonScript(html, 'embedded-roadmap-md', readUtf8(roadmapPath))
  fs.writeFileSync(dashboardPath, html, 'utf8')
  console.log('planning-dashboard.html updated from status/modules.md and status/roadmap.md')
}

main()

