<script lang="ts">
  import SPrintfJS from 'sprintf-js';
  import { onMount } from 'svelte';

  let t0 = new Date().getTime();
  let display_time = 0;
  let timer: number = NaN;

  function is_running() { return !Number.isNaN(timer); }

  function start() {
    if (is_running()) return;
    t0 = (new Date().getTime()) - display_time;
    timer = setInterval(() => {
      display_time = (new Date().getTime() - t0);
    }, 73);
  }

  function stop() {
    if (!is_running()) return;
    clearInterval(timer);
    timer = NaN;
  }

  function reset() { // resets to 0, but doesn't change the state of running
    display_time = 0;
    t0 = new Date().getTime();
  }
</script>

<!-- Inline styling is not working... rollup problem? Use css/style.scss instead -->
<style>
</style>

<div class="stopwatch_timer">
  <h2>Stopwatch Timer</h2>
  <div style="padding: 5px">
    <p>Time: { SPrintfJS.sprintf("%.3f", display_time/1000) } seconds</p>
    <button on:click={start}>Start</button>
    <button on:click={stop}>Stop</button>
    <button on:click={reset}>Reset</button>
  </div>
  
  <!--- Demo of MathType - by Wiris (not free, looks like dated Windows UI)
  <script src="https://www.wiris.net/demo/editor/editor"></script>
  <script>
  var editor;
  window.onload = function () {
    editor = com.wiris.jsEditor.JsEditor.newInstance({'language': 'en'});
          editor.insertInto(document.getElementById('editorContainer'));
  }
  </script>

  <div id="editorContainer"></div>
  -->

  <!--- Drop-in demo of Quill.js
  <link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet" />

  <div id="editor">
    <p>Hello World!</p>
    <p>Some initial <strong>bold</strong> text</p>
    <p><br /></p>
  </div>

  <script type="module">
    import quill from 'https://cdn.jsdelivr.net/npm/quill@2.0.2/+esm'
    const q = new quill('#editor', {
      theme: 'snow'
    });
  </script>
-->
  
</div>
