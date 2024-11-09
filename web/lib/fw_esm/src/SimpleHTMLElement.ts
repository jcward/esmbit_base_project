import { IHaveElementMixin } from "./IHaveElement";

export class SimpleHTMLElement extends IHaveElementMixin(class {})
{
  readonly element: HTMLElement;

  constructor(opts ?: {
                        tag ?: string,
                        class ?: string,
                        html ?: string,
                      })
  {
    opts = opts ?? {};
    opts.tag ||= 'div';
    super();
    this.element = document.createElement(opts.tag);
    if (opts.class) this.element.className = opts.class;
    if (opts.html) this.element.innerHTML = opts.html;
  }
}

