import type { DigestAlgorithm } from "./index.jsutil";

export class JSUtil
{
  public static async inject_css(css: string, doc ?: Document): Promise<HTMLStyleElement>
  {
    if (!doc) doc = document;
    const id = await JSUtil.calcHash(css, 'SHA-1');
    let style:any = null;
    style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      style.styleSheet ? style.styleSheet.cssText = css : style.appendChild(document.createTextNode(css));
      document.getElementsByTagName("head")[0].appendChild(style)
    }
    return style;
  }

  public static async calcHash(input: string, algorithm ?: DigestAlgorithm | undefined): Promise<string>
  {
    // Convert input string to array of bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    algorithm ||= 'SHA-1';

    // Compute MD5 hash
    const hashBuffer = await crypto.subtle.digest(algorithm, data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  public static is_on_page(e:Element) {
    return JSUtil.is_a_descendant_of_b(e, document.body);
  }
  public static is_a_descendant_of_b(a:Element, b:Element): boolean
  {
    let ptr: Element = a;
    while (ptr!=null && ptr!=b) {
      ptr = ptr.parentElement as Element;
    }
    return ptr==b && b!=null;
  }

  public static once_on_page(e:Element,
                             f:()=>void,
                             timeout_ms=5000): ()=>void
  {
    var orig_callstack = "";
    var t0 = new Date().getTime();

    var cancelled = false;
    var cancel = function() {
      cancelled = true;
    }

    function monitor(has_thrown:boolean, orig_callstack:String) {
      if (cancelled) return;
      if (!JSUtil.is_on_page(e)) {
        var dt = new Date().getTime() - t0;
        if (dt > timeout_ms && !has_thrown) {
          console.warn('once_on_page, original callstack:\n'+orig_callstack);
          // util.LogUtil.async_throw('Error, once_on_page timeout!');
          has_thrown = true;
        }
        window.requestAnimationFrame(function(v) {
          monitor(has_thrown, orig_callstack);
        });
      } else {
        f();
      }
    }
    monitor(false, orig_callstack);

    // Allows caller to register on_dispose(cancel);
    return cancel;
  }
}
