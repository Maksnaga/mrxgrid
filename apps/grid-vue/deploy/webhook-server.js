const http = require('http')
const crypto = require('crypto')
const { execFile } = require('child_process')

const PORT = 9000
const SECRET = process.env.WEBHOOK_SECRET || ''

function verifySignature(payload, signature) {
  if (!SECRET) return true
  const hmac = crypto.createHmac('sha256', SECRET)
  hmac.update(payload)
  const expected = 'sha256=' + hmac.digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200)
    res.end('ok')
    return
  }

  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'] || ''
    if (SECRET && !verifySignature(body, signature)) {
      console.log('[WEBHOOK] Invalid signature, ignoring')
      res.writeHead(401)
      res.end('Invalid signature')
      return
    }

    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      res.writeHead(400)
      res.end('Invalid JSON')
      return
    }

    if (payload.ref !== 'refs/heads/main') {
      console.log(`[WEBHOOK] Ignoring push to ${payload.ref}`)
      res.writeHead(200)
      res.end('Ignored (not main)')
      return
    }

    console.log(`[WEBHOOK] Push to main by ${payload.pusher?.name || 'unknown'}, starting deploy...`)
    res.writeHead(200)
    res.end('Deploy started')

    execFile('/app/deploy.sh', (error, stdout, stderr) => {
      if (error) {
        console.error('[DEPLOY] FAILED:', error.message)
        console.error(stderr)
      } else {
        console.log('[DEPLOY] SUCCESS')
        console.log(stdout)
      }
    })
  })
})

server.listen(PORT, () => {
  console.log(`[WEBHOOK] Server listening on port ${PORT}`)
})
