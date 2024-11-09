import { StopwatchTimer } from "stopwatch_timer";

export class TestApp
{
  constructor() {
    const app_element = document.createElement('test-app');
    document.body.appendChild(app_element);

    // Initialize StopwatchTimer component
    const stopwatchTimer = new StopwatchTimer({
      target: app_element,
      props: {}
    });
  }
}
