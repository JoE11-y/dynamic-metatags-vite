import fs from 'node:fs/promises'
import express from 'express'
import axios from 'axios'

// Constants
const isProduction = process.env.NODE_ENV === 'production'
const port = process.env.PORT || 5173
const base = process.env.BASE || '/'

// Cached production assets
const templateHtml = isProduction
  ? await fs.readFile('./dist/client/index.html', 'utf-8')
  : ''
const ssrManifest = isProduction
  ? await fs.readFile('./dist/client/ssr-manifest.json', 'utf-8')
  : undefined

// Create http server
const app = express()

// Add Vite or respective production middlewares
let vite
if (!isProduction) {
  const { createServer } = await import('vite')
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base
  })
  app.use(vite.middlewares)
} else {
  const compression = (await import('compression')).default
  const sirv = (await import('sirv')).default
  app.use(compression())
  app.use(base, sirv('./dist/client', { extensions: [] }))
}

// Serve HTML
app.use('*', async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, '')
    // const postId = req.query.id
    // const post = getPostById(postId);
    
    let template
    let render
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.readFile('./index.html', 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render
    } else {
      template = templateHtml
      render = (await import('./dist/server/entry-server.js')).render
    }

    if(url.includes('/') && url.split('/').length >2) {
      const urli = url.split('/')
      const index = urli[2]
      const meta = await axios.get(`https://bafybeifhofputngb7k3zqpl5otnv4utpvse66sbzutxsg6bkozks6ytt7m.ipfs.dweb.link/${index}`);
      const image = `https://bafybeies3odi24wyk3e22rnautr57tiuk3b56nxrd53fxgtvr37abmz5j4.ipfs.dweb.link/${index}.png`;
      template = template
      .replace("<title>Azuki|LooksRare</title>", `<title>${meta?.data.name} - Azuki|LooksRare</title>`)
      .replace("__META_OG_TITLE__", `${meta?.data.name} - Azuki|LooksRare`)
      .replace("__META_OG_DESCRIPTION__", `LocksRare is a Community-first Marketplace for NFT's and digital.`)
      .replace("__META_OG_IMAGE__", image);
    }

    const rendered = await render(url, ssrManifest)

    const html = template
      .replace(`<!--app-head-->`, rendered.head ?? '')
      .replace(`<!--app-html-->`, rendered.html ?? '')

    res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
  } catch (e) {
    vite?.ssrFixStacktrace(e)
    console.log(e.stack)
    res.status(500).end(e.stack)
  }
})

app.get("/*", (req, res, next) => {
  fs.readFile('./index.html', 'utf-8', (err, htmlData) => {
    if (err) {
      console.error("Error during file reading", err);
      return res.status(404).end();
    }
    // get post info
   
    return res.send(htmlData);
  });
});

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})
