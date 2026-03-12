import { spawn } from 'node:child_process'
import process from 'node:process'

const isWin = process.platform === 'win32'
const npmCommand = isWin ? 'npm.cmd' : 'npm'
const port = process.env.FRONTEND_PORT || process.env.PORT || '4173'
const host = process.env.FRONTEND_HOST || '0.0.0.0'

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
      shell: isWin,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
      }
    })
  })
}

async function main() {
  await run(npmCommand, ['run', 'build'])
  await run(npmCommand, ['run', 'preview', '--', '--host', host, '--port', port, '--strictPort'])
}

main().catch((error) => {
  console.error('[pm2-frontend] startup failed:', error)
  process.exit(1)
})
