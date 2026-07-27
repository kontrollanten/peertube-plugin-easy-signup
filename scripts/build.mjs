import path from 'path'
import esbuild from 'esbuild'

const clientFiles = [
  // Add here your client files, without the file extension:
  'common-client-plugin'
]

const configs = clientFiles.map(f => ({
   
  entryPoints: [ path.resolve(import.meta.dirname, '..', 'client', f+'.ts') ],
  bundle: true,
  minify: true,
  // FIXME: sourcemap:`true` does not work for now, because peertube does not serve static files.
  // See https://github.com/Chocobozzz/PeerTube/issues/5185
  sourcemap: false,
  format: 'esm',
  target: 'safari11',
   
  outfile: path.resolve(import.meta.dirname, '..', 'dist/client', f+'.js'),
}))

const promises = configs.map(async c => esbuild.build(c))

Promise.all(promises)
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Ignore
  .catch(() => process.exit(1))
