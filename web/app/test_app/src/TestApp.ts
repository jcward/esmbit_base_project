import { StopwatchTimerComponent } from "stopwatch_timer";
import { JSUtil } from "jsutil";

export class TestApp
{
  stopwatchTimer: StopwatchTimerComponent;

  constructor()
  {
    const app_element = document.createElement('test-app');
    document.body.appendChild(app_element);
    app_element.classList.add('esmbit-app');
    const msg = JSUtil.calc_sha1(window.document.body.innerHTML);
    app_element.innerHTML = `<div class="esmbit-app-header">My Test App - ${ msg }</div><div><img style="width:175px" src="assets://test_app/test_logo.svg"></div>`;

    // Initialize StopwatchTimer component
    this.stopwatchTimer = new StopwatchTimerComponent({
      target: app_element,
      props: {}
    });

    this.stopwatchTimer.start();
  }
}
