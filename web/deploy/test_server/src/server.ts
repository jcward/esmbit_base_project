import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { CMSTemplateMiddleware } from './cms_templating';

const app = express();
const port = parseInt( process.env?.SERVER_PORT || "2020" );
const ws_port = port + 1; // e.g. 2021

// Serve a timestamp (just for fun, not in use yet)
app.get('/ts', (req: Request, res: Response) => {
  res.send(`${ new Date().getTime() }`);
});

CMSTemplateMiddleware.enableHotReload(app, ws_port);

// Transform content returned to support cms:// URLs and {{cms://}} inlines
app.use(CMSTemplateMiddleware.do_cms_middleware);

// CMS remplate falls back to static files middleware
const webRoot = path.join(__dirname, CMSTemplateMiddleware.WEB_ROOT);
app.use(express.static(webRoot, { index: false })); // No automatic index.html at this level

app.listen(port, () => {
  console.log(`test_server app listening - http://127.0.0.1:${port}/`);
});
