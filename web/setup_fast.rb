#!/usr/bin/env ruby

require 'io/console'
require 'open3'

def color_disabled() false end
def nocolor() color_disabled ? '' : "\033[0m"  ; end
def blue()    color_disabled ? '' : "\033[36m" ; end
def magenta() color_disabled ? '' : "\033[35m" ; end

def die msg
  puts msg
  exit 1
end

def read_single_char
  char = IO.console.getch
  char
end

def run_command(command)
  stdout_str, stderr_str, status = Open3.capture3(command)
  { stdout: stdout_str, stderr: stderr_str, status: status.exitstatus, success: status.exitstatus==0 }
end

def run_command_with_streams(command)
  Open3.popen3(command) do |stdin, stdout, stderr, thread|
    output = stdout.read
    errors = stderr.read
    exit_status = thread.value.exitstatus
    { stdout: output, stderr: errors, status: exit_status, success: exit_status==0 }
  end
end

def run_command_with_live_output(command)
  Open3.popen3(command) do |stdin, stdout, stderr, thread|
    all_stdout = []
    all_stderr = []

    # Start a thread to handle stdout
    stdout_thread = Thread.new do
      stdout.each_line do |line|
        puts line
        all_stdout << line
      end
    end

    # Start a thread to handle stderr
    stderr_thread = Thread.new do
      stderr.each_line do |line|
        puts line
        all_stderr << line
      end
    end

    # Wait for both threads to complete
    stdout_thread.join
    stderr_thread.join

    # Wait for the command to finish and get the exit status
    exit_status = thread.value.exitstatus
    return { stdout: all_stdout.join("\n"), stderr: all_stderr.join("\n"), exit_status: exit_status, success: exit_status==0 }
  end
end

def step1a1_check_local_mongo
  existing = `(netstat -lpunt | grep -i 27017) 2> /dev/null`
  if (existing.length < 2) then
    puts "Didn't detect a mongo service on :27017 ..."
    print "Start a local docker mongo? "
    ans = read_single_char
    puts ""
    if (ans.match(/y/i)) then
      loc = `which local-mongo.sh`
      die "Didn't find local-mongo.sh -- is it on your $PATH ?" if (loc.length < 2)

      `local-mongo.sh start`
    end
  end
end

def step1a_opt_start_api
  print "Start API in a new terminal? "
  ans = read_single_char
  puts ""
  if (ans.match(/y/i)) then
    step1a1_check_local_mongo
    File.open("/tmp/launch_api.sh", "w") { |f| f.puts "cd #{ `pwd`.chomp }/../api\nbit.js build --no-progress-bar\nNODE_ENV=test pnpm api\nbash" }
    `chmod a+x /tmp/launch_api.sh`
    `gnome-terminal -- bash -l "/tmp/launch_api.sh"`
    sleep 3 # Allow build ebo.local types
  end
end

def step1b_opt_full_build
  print "Full rebuild now? "
  ans = read_single_char
  puts ""
  if (ans.match(/y/i)) then
    puts "Starting full build..."
    result = run_command_with_live_output("cd deploy && bit.js build -f --no-progress-bar")
    if (!result[:success]) then
      puts "The full build failed!"
      exit 1
    end
  end
end

def step2_select_watchers
  watch = []
  while true
    begin
      msg = watch.length==0 ? "Search for widgets to watch (ESC to exit): " : "[#{ watch.length }] Search for widgets to watch (ESC to exit): "
      result = run_command_with_live_output("ls app/*/bit.yaml widget/*/bit.yaml lib/*/bit.yaml | typeahead-cli -s -p '#{ msg }'")
      widget = result[:stdout].chomp
      if (widget!=nil && widget.end_with?(".yaml")) then
        watch << widget
      elsif (!result[:success] || widget=="") then
        break
      end
    end
  end

  if (watch.length==0) then #implies watch all
    watch = `ls app/*/bit.yaml widget/*/bit.yaml lib/*/bit.yaml`.split("\n")
    puts "Watching all #{ watch.length } widgets"
  end

  watch
end

WATCH_SCRIPT = "./run_watchers.sh"
def write_go_fast watch
  commands = watch.map { |bit_fn|
    "cd #{ bit_fn.sub("bit.yaml", "") } && watch.rb 'pnpx rollup -c ebo.rollup.config.js' src css assets"
  }

  commands << "cd #{ Dir.pwd }/deploy/; ./push_build_artifacts.sh"
  commands << "cd #{ Dir.pwd }/deploy/test_server; yarn install && yarn build && yarn start"

  File.open(WATCH_SCRIPT, 'w') do |f|
    f.puts <<~SCRIPT
      #!/bin/bash
      set -e
   
      # Function to handle CTRL-C
      trap 'kill $(jobs -p) && exit' INT
   
      # Array of commands
      commands=(
    SCRIPT

    commands.each do |cmd|
      f.puts "      \"#{cmd}\""
    end

    f.puts <<~SCRIPT
      )
   
      # Launch commands in the background
      for cmd in "${commands[@]}"; do
        echo "Starting: $cmd"
        eval "$cmd &"
      done
   
      # Wait for all background jobs
      echo "Press CTRL-C to terminate all processes."
      wait
    SCRIPT
  end

  `chmod a+x #{ WATCH_SCRIPT }`
  system(WATCH_SCRIPT)

  # puts "#{ blue() }Wrote: #{ WATCH_SCRIPT } - you can run it with:#{ nocolor() }"
  # puts "#{ magenta() }node #{ WATCH_SCRIPT }#{ nocolor() }"
end

def run_watch_script
  system(WATCH_SCRIPT)
end

def main
  if (ARGV[0]=="-c") then
    if (!File.exist?(WATCH_SCRIPT)) then
      die "Cannot continue - missing #{ WATCH_SCRIPT }";
    end
    run_watch_script()
  else
    step1a_opt_start_api() if (File.exist?("../api"))
    step1b_opt_full_build()
    watch = step2_select_watchers()
    write_go_fast(watch)
    run_watch_script()
  end
end
main()
