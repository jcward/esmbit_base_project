import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { CMSTemplateMiddleware } from './cms_templating';

const app = express();
const port = 2020;
const ws_port = 2021;

// Serve a timestamp (just for fun, not in use yet)
app.get('/ts', (req: Request, res: Response) => {
  res.send(`${ new Date().getTime() }`);
});

// Transform content returned to support cms:// URLs and {{cms://}} inlines
app.use(CMSTemplateMiddleware.do_cms_middleware);
CMSTemplateMiddleware.enableCssHotReload(app, ws_port);

app.listen(port, () => {
  console.log(`test_server app listening - http://127.0.0.1:${port}/index.html`);
});
