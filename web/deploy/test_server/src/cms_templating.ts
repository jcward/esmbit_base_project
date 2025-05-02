import { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs_p from 'fs/promises'; // Use promises to handle async file operations
import fs from 'fs'; // Use promises to handle async file operations
import { WebSocket } from 'ws';
import http from 'http';
import chokidar from 'chokidar';
import { template } from 'underscore';

export class CMSTemplateMiddleware
{
  static REPLACE_IN_FILE_TYPES = new Set(['.html', '.css', '.js' ]);
  static WEB_ROOT = './www-root';
  static HOT_RELOAD_ENABLED = false;

  static APP_METADATAS: AppMetadata[];
  static REDIRECTS: RedirectType[];
  static IS_SETUP: boolean = parse_app_metadata();

  public static async do_cms_middleware(req: Request, res: Response, next: NextFunction)
  {
    const orig_url = req.url;
    let url = orig_url;
    const redirection = CMSTemplateMiddleware.processAppsAndRedirects(orig_url, res);
    if (redirection === true) {
      // response has been handled. All done.
      return;
    } else {
      url = redirection;
    }

    const urlpath = url.split("?")[0]; // ignore query stringurlpath
    const ext = path.extname(urlpath).toLowerCase();

    // Return early if the file is not .html, .css, or .js
    if (!CMSTemplateMiddleware.REPLACE_IN_FILE_TYPES.has(ext)) return next();

    try {
      const filePath = path.join(__dirname, CMSTemplateMiddleware.WEB_ROOT, urlpath);

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
      console.error(`Error processing file ${ orig_url } / ${ urlpath }:`, err);
      next();
    }
  }


  // Process the incoming url for redirection and serving apps. If the response
  // gets served (content, or redirect) return true. Otherwise return the string
  // of the (possibly mapped) url. Rewrites can change the URL, and it is recursive.
  // No-op is returning the orig_url. Rewrites can be recursive, max depth of 20.
  private static processAppsAndRedirects(orig_url: string, res: Response, depth=0): true | string
  {
    if (depth > 20) throw `Recursive redirect: ${ orig_url }`;

    const parts = orig_url.split("?");
    const urlpath = parts[0];
    let tgt_params = parts[1] ? new URLSearchParams(parts[1]) : undefined;

    for (const app_metadata of CMSTemplateMiddleware.APP_METADATAS) {
      if (app_metadata.route === urlpath) {
        let content: string;
        try {
          content = ESMBIT_APP_TEMPLATE(app_metadata);
          if (CMSTemplateMiddleware.HOT_RELOAD_ENABLED) {
            content = content.replace("</html>", "<script src='/hot-reload-client.js'></script></html>")
          }
          content = CMSTemplateMiddleware.expandCmsRawContent(content);
          res.set('Content-Type', 'text/html');
          res.send(content);
        } catch (e) {
          console.error(`Error serving app ${ app_metadata.module}`);
          console.error(e);
          res.status(500);
          res.send();
        }
        return true; // response has been handled
      } else if (app_metadata.route+'/' === urlpath) {
        // Canonical - remove the trailing /
        res.redirect(app_metadata.route);
        return true; // response has been handled
      }
    }

    for (const redir of CMSTemplateMiddleware.REDIRECTS) {
      if (redir.path_matcher(urlpath)) {
        let target = redir.target;
        if (tgt_params) target += '?' + tgt_params.toString();
        if (redir.is_rewrite) {
          return this.processAppsAndRedirects(target, res, depth++);
        } else {
          res.redirect(target);
          return true; // response has been handled
        }
      }
    }

    // Fall-through - this URL has no redirects or apps
    return orig_url;
  }

  private static cmsUrlStringReplace(content: string): string
  {
    const cmsUrlRegex = /(["'])cms:\/\/(.*?)\1/g;
    content = content.replace(cmsUrlRegex, (match, quote, cmsPath) => {
      if (!(cmsPath.indexOf("/")==0 || cmsPath.indexOf(".")==0)) {
        // By default - cms:// is an absolute paths (unless cms://./foo/bar)
        // cms:/// is accepted as absolute, same as cms://
        cmsPath = '/' + cmsPath;
      }
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
    const rtn = CMSTemplateMiddleware.expandCmsRawContent(raw);
    stack.pop();
    return rtn;
  }
  
  private static expandCmsRawContent(raw: string)
  {
    const step_one = CMSTemplateMiddleware.cmsUrlStringReplace(raw);
  
    const inlineCmsRegex = /\{\{\s*cms:\/\/(.*?)\s*\}\}/g;
    const step_two = step_one.replace(inlineCmsRegex, (match, cmsPath) => {
      // Resolve the actual file path
      const inlineFilePath = path.join(__dirname, CMSTemplateMiddleware.WEB_ROOT, cmsPath);
      return CMSTemplateMiddleware.expandCmsFile(inlineFilePath);
    });

    return step_two;
  }

  public static enableHotReload(app: Express, ws_port: number)
  {
    CMSTemplateMiddleware.HOT_RELOAD_ENABLED = true;
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    let clients: WebSocket[] = [];

    wss.on('connection', (ws) => {
      clients.push(ws);
    
      ws.on('close', () => {
        clients = clients.filter((client) => client !== ws);
      });
    });

    // Serve a client .js script to connect
    app.get('/hot-reload-client.js', (req: Request, res: Response) => {
      const script = HOT_RELOAD_CLIENT({ ws_port });
      res.set('Content-Type', 'application/javascript');
      res.send(script);
    });

    // Watch the 'dist' directory for changes to CSS ESM modules
    const fileWatcher = chokidar.watch(CMSTemplateMiddleware.WEB_ROOT+'/esmbit-dist/');
    const last_content: any = {};

    function handleChange(event: string, filePath: string) {
      // console.log(event, filePath);

      if (fs.lstatSync(filePath).isDirectory()) return;

      const content = fs.readFileSync(filePath).toString();
      if (last_content[filePath] === content) return;
      last_content[filePath] = content;

      if (clients.length==0) return;

      console.log(`File changed: ${filePath} - notifying ${ clients.length } connected clients...`);
      const widget_name = getWidgetNameFromFilePath(filePath);

      let messageData = {
        type: '',
        widget_name: widget_name,
        timestamp: Date.now(), // For cache-busting
      }

      if (filePath.startsWith('esmbit-dist/css.')) {
        messageData.type = 'css-update';
      } else {
        messageData.type = 'file-update';
      }

      const message = JSON.stringify(messageData);

      // Notify all connected clients about the file change
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }

    fileWatcher.on('all', (event, filePath) => {
      try {
        handleChange(event, filePath);
      } catch (e) {
        console.warn(`Error in enableCssHotReload - handling change in file: ${ filePath } - possibly fast-overwrite / can be ignored`);
        console.warn(e);
      }
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

type RedirectType = {
  path_matcher: (path:string)=>boolean,
  is_rewrite: boolean,
  target: string
}

function parse_app_metadata(): boolean {
  const fileContents = fs.readFileSync(CMSTemplateMiddleware.WEB_ROOT+'/esmbit-dist/app.metadata.json', 'utf8');
  const app_metadatas = JSON.parse(fileContents) as AppMetadata[]; // Parse YAML
  const redirects = [] as RedirectType[];

  function push_redirect(source: string, target: string, is_rewrite: boolean) {
    let rt: RedirectType = {} as any;
    if (source.indexOf('^')==0) {
      const rx = new RegExp(source);
      rt.path_matcher = (path)=>{ return rx.test(path); }
    } else if (source.indexOf('/')==0) {
      const str = source.trim();
      rt.path_matcher = (path)=>{ return path === str; }
    } else {
      throw `Invalid redirect ${ source } - must start with a ^ or /`;
    }
    rt.target = target;
    rt.is_rewrite = is_rewrite;
    redirects.push(rt);
  }

  app_metadatas.forEach((metadata)=>{
    try {
      if (!metadata.route || metadata.route.indexOf('/') !=0) throw 'App metadata error: route must begin with /';
      if (metadata.redirect_from) {
        // redirects - routes (can be regex) that redirect to the canonical route
        for (const source of metadata.redirect_from) { push_redirect(source, metadata.route, false); }
      }
      if (metadata.routes) {
        // routes - routes (can be regex) that rewrite to the canonical route
        for (const source of metadata.routes) { push_redirect(source, metadata.route, true); }
      }
    } catch (e) {
      console.error(`Failed parsing app.metadata.yaml for ${ metadata.module }\n${ JSON.stringify(metadata, null, "  ") }`);
      console.error(e);
      process.exit(1);
    }
  });
  CMSTemplateMiddleware.APP_METADATAS = app_metadatas;
  CMSTemplateMiddleware.REDIRECTS = redirects;
  return true;
}

type AppMetadata = {
  route: string,
  title: string,
  module: string,
  redirect_from ?: string[],
  routes ?: string[]
}

// Lodash template for the esmbit app page - inflated with data from the app.metadata.yaml
const ESMBIT_APP_TEMPLATE = template(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title><%= title %></title>
  <script>
    window.$importmap = {{ cms://esmbit-dist/esmbit-import-map.json }}
  </script>
  <!-- <script type="importmap"> must be inline, hence: -->
  {{ cms://esmbit-dist/esmbit-import-map.html }}
  {{ cms://esmbit-dist/common_head.html }}
</head>
<body>
</body>
<script>
  (function() {
    var app = '<%= module %>';
    const script = document.createElement('script');
    script.setAttribute('type', 'module');
    script.setAttribute('src', '/esmbit-dist/'+app+'.js');
    document.getElementsByTagName('head')[0].appendChild(script);
  })();
</script>
{{ cms://esmbit-dist/common_foot.html }}
</html>
`);

const HOT_RELOAD_CLIENT = template(`// hot-reload-client.js

const socket = new WebSocket('ws://127.0.0.1:<%= ws_port %>');

socket.addEventListener('open', () => {
  console.log('Connected to server for hot-reloading');
});

socket.addEventListener('message', async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'css-update') {
    const widget_name = data.widget_name;
    const timestamp = data.timestamp;

    console.log(\`CSS update for widget: \${widget_name}\`);

    // Remove the old style element
    const oldStyleElement = document.querySelector(\`style[widget="\${widget_name}"]\`);
    if (oldStyleElement) {
      oldStyleElement.remove();
    }

    // Dynamically import the updated CSS module with cache-busting
    try {
      const modulePath = \`/esmbit-dist/css.\${widget_name}.esm.js?cb=\${timestamp}\`; // Adjust the path as needed
      await import(modulePath);
      console.log(\`CSS for widget \${widget_name} updated\`);
    } catch (error) {
      console.error(\`Failed to update CSS for widget \${widget_name}:\`, error);
    }
  } else if (window.location.search.indexOf("reload=true") > 0) {
    window.location.reload();
  }
});
`);
