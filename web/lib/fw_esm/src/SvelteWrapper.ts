
export class SvelteWrapper<ComponentType extends new (opts: any) => {
    $destroy: () => void;
    $set?: (props: any) => void,
    $on: (event: string, callback: (event: any) => void) => () => void;
  }, OptsType>
{
  private comp: InstanceType<ComponentType>;
  public element: HTMLElement;

  constructor(ComponentClass: ComponentType, opts: OptsType) {
    this.comp = new ComponentClass(opts) as InstanceType<ComponentType>;
    this.element = (this.comp as any).$$?.root as HTMLElement;
  }

  // Listen to a Svelte event
  on(event: string, callback: (event: any) => void) {
    return this.comp.$on(event, callback);
  }

  // Optional custom functionality
  setProps(props: Partial<OptsType>) {
    if (this.comp.$set) {
      this.comp.$set(props);
    }
  }

  destroy() {
    this.comp.$destroy();
  }
}
