import { JSUtil, ROLLUP_INLINE } from 'jsutil';
import StopwatchTimerComponent from './StopwatchTimer.svelte';

export const StopwatchTimer = StopwatchTimerComponent;

// Adding a <style> to the .svelte wasn't working for me...
// And this is an example of ROLLUP_INLINE, so... ok.
console.log(ROLLUP_INLINE('./test-inline.txt'));
