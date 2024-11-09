import { StopwatchTimerComponent } from "stopwatch_timer";

export class TestApp
{
  stopwatchTimer: StopwatchTimerComponent;

  constructor() {
    const app_element = document.createElement('test-app');
    document.body.appendChild(app_element);

    // Initialize StopwatchTimer component
    this.stopwatchTimer = new StopwatchTimerComponent({
      target: app_element,
      props: {}
    });

    this.stopwatchTimer.start();
  }
}
