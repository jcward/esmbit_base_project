#!/usr/bin/env ruby

require 'json'
require 'fileutils'

def write_push_build_artifacts copy_cmds
  File.open("./push_build_artifacts.sh", "w") { |f|
    copy_cmds_str = copy_cmds.join("\n    ")
    f.puts <<EOF
#!/bin/bash
FILE_TO_WATCH=".rollup.complete"
run_on_change() {
    echo "Rollup build detected, syncing files..."
    sleep 0.1 # do multiple builds ever need to complete?
    #{ copy_cmds_str }
}

touch $FILE_TO_WATCH
echo "Watching for rollup changes..."
while true; do
    inotifywait -e modify "$FILE_TO_WATCH"
    run_on_change
done
EOF
  }
  `chmod a+x push_build_artifacts.sh`
end

# Clear dist dir
`rm -rf esmbit-dist; mkdir esmbit-dist`

if (ARGV[0] == ".last.deploy.stdin") then
  info = File.read(".last.deploy.stdin")
else
  info = STDIN.read
  File.open("./.last.deploy.stdin", "w") { |f| f.puts info } if (info.length > 5)
end

# Copy dist from all widgets into esmbit-dist
module_map = {}
artifact_copy_cmds = []
imports = {}
imports["riot"] = "https://unpkg.com/riot@6/riot.esm.js" # tbd into ebo
widget_info = JSON.parse(info)
widget_info.each { |widget|

  # handle web_esm
  if (widget["artifacts"] && widget["artifacts"]["web_esm"]) then
    # Copy the js file from the widgets' web_esm dir
    module_name = widget["name"]

    esm_file = File.join("./dist", "esm.js") # output convention
    esm_file = File.join(widget["project_dir"], esm_file) unless esm_file.start_with?("/")
    if (!File.exist?(esm_file)) then
      raise "ERROR: web_esm artifact for #{ widget["name"] } not found at: #{ esm_file }... aborting!"
    end

    css_module_name = "css.#{ widget["name"] }.esm.js"
    css_file = File.join("./dist", css_module_name) # esmbit output naming convention
    css_file = File.join(widget["project_dir"], css_file) unless css_file.start_with?("/")
    if (File.exist?(css_file)) then
      FileUtils.cp css_file, "esmbit-dist/#{ css_module_name }"
      module_map[css_module_name] = "/esmbit-dist/#{ css_module_name }"
      artifact_copy_cmds.push("cp #{ css_file } esmbit-dist/#{ css_module_name }")
    end

    if (widget["language"]=="gql") then
      raise "GQL projects are not yet supported"
    else
      FileUtils.cp esm_file, "esmbit-dist/#{ module_name }.js"
      module_map[module_name] = "/esmbit-dist/#{ module_name }.js" # For building the ESM importmap
      artifact_copy_cmds.push("cp #{ esm_file } esmbit-dist/#{ module_name }.js")
    end

    # handle third_party esm deps
    third_party = widget["dependencies"]["third_party"]["esm"] rescue []
    if (third_party != nil && third_party.length > 0) then
      third_party.each { |dep|
        existing = imports[dep["name"]]
        if (existing != nil && existing != dep["url"]) then
          raise "Conflicting third party ESM dependencies requested for #{ dep["name"] }"
        end
        imports[dep["name"]] = dep["url"]
      }
    end
  end

  # handle web_assets
  if (widget["artifacts"] && widget["artifacts"]["web_assets"]) then
    # Copy files in the widgets' web_assets dir to esmbit-dist/assets/#{ name }/
    assets_dir = widget["artifacts"]["web_assets"]["dir"]
    assets_dir = File.join(widget["project_dir"], assets_dir) unless assets_dir.start_with?("/")
    raise "Specified assets dir does not exist: #{ assets_dir }" unless File.directory?(assets_dir)
    assets_dir += "/" unless assets_dir.end_with?("/")
    files = `cd #{ assets_dir } && find . -type f`.split("\n")
    `mkdir -p esmbit-dist/#{ widget["name"] }`
    files.each { |f|
      f.sub!(/^\.\//, "") # remove ./
      tgt = assets_dir.split("/").last+'/' + f # prefix the web_assets dirname, caos/assets/square.png
      if (tgt.include?("/")) then
        d = tgt.split("/")
        d.pop
        `mkdir -p esmbit-dist/#{ widget["name"] }/#{ d.join("/") }`
      end
      # `cp "#{ assets_dir }/#{ f }" "esmbit-dist/assets/#{ widget["name"] }/#{ tgt }"`
      FileUtils.cp "#{ assets_dir }/#{ f }", "esmbit-dist/#{ widget["name"] }/#{ tgt }"
      artifact_copy_cmds.push("rsync \"#{ assets_dir }/#{ f }\" \"esmbit-dist/#{ widget["name"] }/#{ tgt }\"")
    }
  end
}

# write push_build_artifacts.sh
write_push_build_artifacts(artifact_copy_cmds)

# copy esm libs from ebo.lib
`find ../ebo.lib/ -name esm.js | grep dist/esm.js`.split("\n").each { |esm_file|
  module_name = JSON.parse(File.read(esm_file.sub("dist/esm.js", "package.json")))["name"]
  tgt = "esmbit-dist/#{ module_name }.js"
  FileUtils.mkdir_p(File.dirname(tgt)) # Some module_names have / in them, ensure the directory structure is created
  FileUtils.cp esm_file, tgt
  module_map[module_name] = "/esmbit-dist/#{ module_name }.js" # For building the ESM importmap
}

# Write an import.map.json mapping for the esmbit files
File.open("./esmbit-dist/esmbit-import-map.json", "w") { |f|
  module_map.each { |name,path|
    if (imports[name] != nil) then
      raise "Conflicting local esm name with third party ESM - #{ dep["name"] }"
    end
    imports[name] = "cms://#{ path }"
  }
  f.puts JSON.pretty_generate(imports)
}
# Write an import.map.js mapping for the esmbit files
File.open("./esmbit-dist/esmbit-import-map.html", "w") { |f|
  f.puts '<script type="importmap">'
  f.puts '{ "imports": {{ cms://esmbit-dist/esmbit-import-map.json }} }'
  f.puts '</script>'
}

is_travis = false
is_travis = true if ("#{ ENV["TRAVIS_EVENT_TYPE"] }" != "")
is_travis = true if ("#{ ENV["TRAVIS_BUILD_DIR"] }" != "")
if (is_travis) then
  puts "Detected travis, not deploying to local wm_web/cms ... goodbye!"
  exit 0
end

# Deliver into wm_web/cms (leave a copy for debug inspection)
puts "TODO: deploy files into wm_web, e.g."
puts "rm -rf ~/dev/nimbee/edu/ruby/app/wm_web/cms/esmbit-dist"
puts "cp -rf esmbit-dist ~/dev/nimbee/edu/ruby/app/wm_web/cms/"
