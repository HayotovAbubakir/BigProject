const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const BACKUP_DIR = path.join(ROOT, 'comment_backups')
const EXTS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html']

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function isBinary(filePath) {
  const buf = fs.readFileSync(filePath)
  for (let i = 0; i < Math.min(buf.length, 24); i++) {
    if (buf[i] === 0) return true
  }
  return false
}

function stripComments(content, ext) {
  let s = content
  
  if (ext === '.html') {
    s = s.replace(/<!--([\s\S]*?)-->/g, '')
  }
  
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  
  s = s.replace(/\{\/\*([\s\S]*?)\*\/\}/g, '')
  
  s = s.replace(/(^|[^:\\])\/\/.*$/gm, (m, p1) => p1)

  
  s = s.replace(/\n{3,}/g, '\n\n')

  
  s = s.split('\n').map(l => l.replace(/[ \t]+$/,'')).join('\n')

  return s
}

function walk(dir, cb) {
  const items = fs.readdirSync(dir)
  for (const it of items) {
    const full = path.join(dir, it)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      
      if (it === 'node_modules' || it === '.git' || it === 'comment_backups') continue
      walk(full, cb)
    } else if (st.isFile()) {
      cb(full)
    }
  }
}

mkdirp(BACKUP_DIR)

const modified = []
walk(ROOT, (filePath) => {
  const rel = path.relative(ROOT, filePath)
  const ext = path.extname(filePath).toLowerCase()
  if (!EXTS.includes(ext)) return
  if (filePath.includes('comment_backups')) return
  try {
    if (isBinary(filePath)) return
    const content = fs.readFileSync(filePath, 'utf8')
    const stripped = stripComments(content, ext)
    if (stripped !== content) {
      const backupPath = path.join(BACKUP_DIR, rel)
      mkdirp(path.dirname(backupPath))
      fs.writeFileSync(backupPath, content, 'utf8')
      fs.writeFileSync(filePath, stripped, 'utf8')
      modified.push(rel)
    }
  } catch (err) {
    console.error('Error processing', rel, err.message)
  }
})

console.log('Strip comments: modified', modified.length, 'files')
if (modified.length) console.log(modified.join('\n'))
else console.log('No files changed')
console.log('Backups are in:', BACKUP_DIR)
