/*
Copyright 2013-2016 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

/* eslint-env node */
"use strict";

var _ = require("lodash");
var path = require("path");
var execSync = require("child_process").execSync;

module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        revision: execSync("git rev-parse --verify --short HEAD"),
        branch: execSync("git rev-parse --abbrev-ref HEAD"),
        allBuildName: "<%= pkg.name %>-all",
        customBuildName: "<%= pkg.name %>-" + (grunt.option("name") || "custom"),
        isCompressed: !grunt.option("source"),
        banner: "/*!\n <%= pkg.name %> - v<%= pkg.version %>\n <%= grunt.template.today('dddd, mmmm dS, yyyy, h:MM:ss TT') %>\n branch: <%= branch %> revision: <%= revision %>*/\n",
        clean: {
            build: "build",
            products: "products",
            stylus: "src/framework/preferences/css/*.css"
        },
        copy: {
            all: {
                files: [{
                    expand: true,
                    src: ["src/**", "tests/**", "demos/**", "examples/**"],
                    dest: "build/"
                }]
            },
            custom: {
                files: [{
                    expand: true,
                    src: "<%= modulefiles.custom.output.dirs %>",
                    dest: "build/"
                }]
            },
            necessities: {
                files: [{
                    src: ["README.*", "ReleaseNotes.*", "Infusion-LICENSE.*"],
                    dest: "build/"
                }, {
                    // The jQuery license file needs to be copied explicitly since
                    // "src/lib/jQuery" directory contains several jQuery modules
                    // that have individual dependencies.json files.
                    src: "src/lib/jQuery/jQuery-LICENSE.txt",
                    dest: "build/lib/jQuery/jQuery-LICENSE.txt",
                    filter: function () {
                        return grunt.file.exists("build/lib/jQuery/");
                    }
                }]
            }
        },
        uglify: {
            options: {
                banner: "<%= banner %>",
                mangle: false,
                sourceMap: true,
                sourceMapIncludeSources: true
            },
            all: {
                files: [{
                    src: "<%= modulefiles.all.output.files %>",
                    dest: "./build/<%= allBuildName %>.js"
                }]
            },
            custom: {
                files: [{
                    src: "<%= modulefiles.custom.output.files %>",
                    dest: "./build/<%= customBuildName %>.js"
                }]
            }
        },
        modulefiles: {
            all: {
                src: ["src/**/*Dependencies.json"]
            },
            custom: {
                options: {
                    exclude: grunt.option("exclude"),
                    include: grunt.option("include")
                },
                src: ["src/**/*Dependencies.json"]
            }
        },
        map: {
            // append "/**" to the end of all of all of
            // directory paths for copy:custom to ensure that
            // all of the subdirectories and files are copied over
            copyDirs: {
                prop: "copy.custom.files.0.src",
                fn: function (str) {
                    return str + "/**";
                }
            },
            // prepend "build/" to all of the file paths for
            // concat:all to rebase the paths to the build directory
            concatAllFiles: {
                prop: "concat.all.src",
                fn: function (str) {
                    return "build/" + str;
                }
            },
            // prepend "build/" to all of the file paths for
            // concat:custom to rebase the paths to the build directory
            concatCustomFiles: {
                prop: "concat.custom.src",
                fn: function (str) {
                    return "build/" + str;
                }
            }
        },
        // Still need the concat task as uglify does not honour the {compress: false} option
        // see: https://github.com/mishoo/UglifyJS2/issues/696
        concat: {
            options: {
                separator: ";\n",
                banner: "<%= banner %>",
                sourceMap: true
            },
            all: {
                src: "<%= modulefiles.all.output.files %>",
                dest: "./build/<%= allBuildName %>.js"
            },
            custom: {
                src: "<%= modulefiles.custom.output.files %>",
                dest: "./build/<%= customBuildName %>.js"
            }
        },
        compress: {
            all: {
                options: {
                    archive: "products/<%= allBuildName %>-<%= pkg.version %>.zip"
                },
                files: [{
                    expand: true,     // Enable dynamic expansion.
                    cwd: "./build/",      // Src matches are relative to this path.
                    src: ["**/*"], // Actual pattern(s) to match.
                    dest: "./infusion"   // Destination path prefix in the zip package
                }]
            },
            custom: {
                options: {
                    archive: "products/<%= customBuildName %>-<%= pkg.version %>.zip"
                },
                files: "<%= compress.all.files %>"
            }
        },
        eslint: {
            all: ["src/**/*.js", "tests/**/*.js", "demos/**/*.js", "examples/**/*.js", "*.js"],
        },
        jsonlint: {
            all: ["src/**/*.json", "tests/**/*.json", "demos/**/*.json", "examples/**/*.json"]
        },
        stylus: {
            compile: {
                options: {
                    compress: "<%= isCompressed %>"
                },
                files: [{
                    expand: true,
                    src: ["src/**/css/stylus/*.styl"],
                    ext: ".css",
                    rename: function (dest, src) {
                        // Move the generated css files one level up out of the stylus directory
                        var dir = path.dirname(src);
                        var filename = path.basename(src);
                        return path.join(dir, "..", filename);
                    }
                }]
            }
        },
        shell: {
            runTests: {
                command: "vagrant ssh -c 'cd /home/vagrant/sync/; DISPLAY=:0 testem ci --file tests/testem.json'"
            }
        }
    });

    // Load the plugins:
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-compress");
    grunt.loadNpmTasks("fluid-grunt-eslint");
    grunt.loadNpmTasks("grunt-jsonlint");
    grunt.loadNpmTasks("grunt-modulefiles");
    grunt.loadNpmTasks("grunt-contrib-stylus");
    grunt.loadNpmTasks("grunt-shell");

    // Custom tasks:

    // Simple task for transforming a property
    grunt.registerMultiTask("map", "a task wrapper around the map function from lodash", function () {
        var transformed = _.map(grunt.config.get(this.data.prop), this.data.fn);
        grunt.config.set(this.data.prop, transformed);
    });

    grunt.registerTask("pathMap", "Triggers the map task for the specified build target", function (target) {
        if (target === "all") {
            grunt.task.run("map:concatAllFiles");
        } else if (target === "custom") {
            grunt.task.run("map:copyDirs", "map:concatCustomFiles");
        }
    });

    // Task for organizing the build
    grunt.registerTask("build", "Generates a minified or source distribution for the specified build target", function (target) {
        target = target || "all";
        var concatTask = grunt.option("source") ? "concat:" : "uglify:";
        var tasks = [
            "clean",
            "stylus",
            "modulefiles:" + target,
            "pathMap:" + target,
            "copy:" + target,
            "copy:necessities",
            concatTask + target,
            "compress:" + target
        ];
        grunt.task.run(tasks);
    });

    grunt.registerTask("buildStylus", ["clean:stylus", "stylus"]);

    grunt.registerTask("default", ["build:all"]);
    grunt.registerTask("custom", ["build:custom"]);

    grunt.registerTask("lint", "Apply eslint and jsonlint", ["eslint", "jsonlint"]);

    grunt.registerTask("tests", "Run tests", ["shell:runTests"]);
};
