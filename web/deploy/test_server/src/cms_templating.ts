import { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs_p from 'fs/promises'; // Use promises to handle async file operations
import fs from 'fs'; // Use promises to handle async file operations
import { WebSocket } from 'ws';
import http from 'http';
import chokidar from 'chokidar';

export class CMSTemplateMiddleware
{
  static replaceInFiletypes = new Set(['.html', '.css', '.js']);
  static web_root = './www-root';

  public static async do_cms_middleware(req: Request, res: Response, next: NextFunction)
  {
    const url = req.url.split("?")[0]; // ignore query string
    const ext = path.extname(url).toLowerCase();

    // Return early if the file is not .html, .css, or .js
    if (!CMSTemplateMiddleware.replaceInFiletypes.has(ext)) return next();

    try {
      const filePath = path.join(__dirname, CMSTemplateMiddleware.web_root, url);

      if (!fs.existsSync(filePath)) {
        console.error(`404 - ${ filePath }`);
        res.status(404);
        res.send();
        return;
      }
  
      // Read the file content (resolving symlinks if necessary)
      let content = CMSTemplateMiddleware.expandCmsFile(filePath);

      // Send the transformed content
      const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext];
      res.set('Content-Type', type || 'text/plain');
      res.send(content);
    } catch (err) {
      console.error(`Error processing file ${req.url}:`, err);
      next();
    }
  }

  private static cmsUrlStringReplace(content: string): string
  {
    const cmsUrlRegex = /(["'])cms:\/\/(.*?)\1/g;
    content = content.replace(cmsUrlRegex, (match, quote, cmsPath) => {
      return `${quote}${cmsPath}${quote}`;
    });
    return content;
  }

  // This is all synchronous and unoptimized, which isn't ideal, but is
  // fine for a dev server.
  private static expandCmsFile(filePath: string, stack ?: string[]): string
  {
    if (!stack) stack = [];
    if (stack.indexOf(filePath)>=0) throw `Recursive reference expanding CMS content:\n - ${ stack.join("\n - ") }`;
    if (!fs.existsSync(filePath)) {
      console.error(`Error: CMS file not found: ${ filePath } - CMS stack is:\n - ${ stack.join("\n - ") }`);
      return `{{ ?? ${ filePath } }}`
    }

    stack.push(filePath);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const step_one = CMSTemplateMiddleware.cmsUrlStringReplace(raw);
  
    const inlineCmsRegex = /\{\{\s*cms:\/\/(.*?)\s*\}\}/g;
    const step_two = step_one.replace(inlineCmsRegex, (match, cmsPath) => {
      // Resolve the actual file path
      const inlineFilePath = path.join(__dirname, CMSTemplateMiddleware.web_root, cmsPath);
      return CMSTemplateMiddleware.expandCmsFile(inlineFilePath);
    });

    stack.pop();
    return step_two;
  }

  public static enableCssHotReload(app: Express, ws_port: number)
  {
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    let clients: WebSocket[] = [];

    wss.on('connection', (ws) => {
      console.log('Client connected');
      clients.push(ws);
    
      ws.on('close', () => {
        console.log('Client disconnected');
        clients = clients.filter((client) => client !== ws);
      });
    });
    
    // Watch the 'dist' directory for changes to CSS ESM modules
    const cssWatcher = chokidar.watch(CMSTemplateMiddleware.web_root+'/esmbit-dist/');
    const last_content: any = {};

    cssWatcher.on('all', (event, filePath) => {
      // console.log(event, filePath);
      if (filePath.indexOf('esmbit-dist/css.')<0) return; // only watching CSS files

      const content = fs.readFileSync(filePath).toString();
      if (last_content[filePath] === content) return;
      last_content[filePath] = content;

      console.log(`File changed: ${filePath}`);
      const widget_name = getWidgetNameFromFilePath(filePath);

      // Notify all connected clients about the CSS change
      const message = JSON.stringify({
        type: 'css-update',
        widget_name: widget_name,
        timestamp: Date.now(), // For cache-busting
      });
    
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });

    function getWidgetNameFromFilePath(filePath: string) {
      // Extract the widget name from the file path
      // Assuming the file is named 'css.{widget_name}.esm.js'
      const baseName = path.basename(filePath);
      const match = baseName.match(/^css\.(.+)\.esm\.js$/);
      return match ? match[1] : null;
    }
    
    // Start the server
    server.listen(ws_port, () => {
      console.log(`CSS hot reload server is listening on port ${ ws_port }`);
    });
  }
}
