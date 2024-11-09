import { JSUtil, type MixinConstructor } from "jsutil";

/**
 * IHaveElement, DOM and lifecycle notes.
 * - element must be instantiated in the constructor, and be readonly
 */
export interface IHaveElement {
  readonly element: HTMLElement;
  addChild(child: IHaveElement): void;
  remove(): void;

  // SetupOnFirstDOM logic
  setup_on_first_dom(): void;
  is_setup: boolean;
}

// Default Implementation (i.e. Mixin) -- careful, it creates a new class :thinking:
export function IHaveElementMixin<TBase extends MixinConstructor>(Base: TBase)
{
  return class extends Base implements IHaveElement
  {
    // Register sofd
    is_setup = (()=>{
      setTimeout(()=>{
        if (this.element==null) throw `this.element must be created in the constructor`;
        JSUtil.once_on_page(this.element, ()=>{
          this.is_setup = true;
          this.setup_on_first_dom();
        });
      }, 0);
      return false;
    })();

    setup_on_first_dom() { } // Should be overridden

    // @ts-ignore - an element must be created in the constructor
    readonly element: HTMLElement = null;

    addChild(other: IHaveElement | Element): void
    {
      if (other instanceof Element) {
        this.element.appendChild(other);
      } else { // other is IHaveElement
        this.element.appendChild(other.element);
      }
    }

    remove(): void
    {
      if (this.element.parentElement) {
        this.element.parentElement.removeChild(this.element);
      }
    }
  }
}
