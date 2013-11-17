// ----------------------------------------------------------------------------
//
// pg-patcher - A Postgres patch helper for node-postgres.
//
// Copyright (c) 2013, Andrew Chilton. All Rights Reserved.
//
// License: MIT - http://chilts.mit-license.org/2013/
//
// ----------------------------------------------------------------------------

// core
var fs = require('fs');

// npm
var xtend = require('xtend');
var async = require('async');

// ----------------------------------------------------------------------------

var defaults = {
    dir    : 'db',
    prefix : 'patch',
};

module.exports = function pgpatcher(client, level, opts, callback) {
    // optional 'opts'
    if ( typeof opts === 'function' ) {
        callback = opts;
        opts = {};
    }

    opts = xtend({}, defaults, opts);

    var forwardPatch = {};
    var reversePatch = {};
    var currentPatchLevel;

    async.series(
        [
            readPatchDir,
            getCurrentPatch,
            // checkAllPatchFilesExist,
            begin,
            nextPatch,
            writeCurrentLevel,
            commit,
            disconnect,
        ],
        function(err) {
            console.log('err:', err);
        }
    );

    function readPatchDir(done) {
        fs.readdir(opts.dir, function(err, files) {
            files.forEach(function(filename) {
                if ( filename.match(/~$/) ) {
                    return;
                }

                var parts = filename.split(/[-\.]/);
                var from = +parts[1];
                var to   = +parts[2];

                var patch = {
                    from     : from,
                    to       : to,
                    filename : filename,
                };

                if ( to > from ) {
                    forwardPatch[to] = patch;
                }
                else {
                    reversePatch[to] = patch;
                }
            });
            done();
        });
        
    }

    function begin(done) {
        console.log('Beginning transaction ...');
        client.query("BEGIN", done);
    }

    function commit(done) {
        console.log('Commiting transaction ...');
        client.query("COMMIT", done);
    }

    function getCurrentPatch(done) {
        console.log('Getting current patch ...');
        client.query("SELECT value FROM property WHERE key = 'patch'", function(err, res) {
            if (err) {
                if ( '' + err === 'error: relation "property" does not exist' ) {
                    console.log('Property table does not exist, patch level zero!');
                    currentPatchLevel = 0;
                    return done();
                }
                return done(err);
            }

            currentPatchLevel = +res.rows[0].value;
            console.log('* current patch is ' + currentPatchLevel);

            done();
        });
    }

    function nextPatch(done) {
        console.log('Patching to next level ...');

        var tryLevel;
        var patch;
        if ( level > currentPatchLevel ) {
            tryLevel = currentPatchLevel + 1;
            patch = forwardPatch[tryLevel];
            console.log(' * trying forward patch to ' + tryLevel);
        }
        else if ( level < currentPatchLevel ) {
            tryLevel = currentPatchLevel - 1;
            patch = reversePatch[tryLevel];
            console.log(' * trying reverse patch to ' + tryLevel);
        }
        else {
            // same, nothing to do
            console.log(' * nothing to patch');
            return process.nextTick(done);
        }

        // make the filename
        filename = opts.dir + '/' + opts.prefix + '-' + patch.from + '-' + patch.to + '.sql';

        // read the patch file
        fs.readFile(filename, { encoding : 'utf8' }, function(err, sql) {
            client.query(sql, function(err, res) {
                if (err) return done(err);

                // update the current patch level state
                currentPatchLevel = tryLevel;

                nextPatch(done);
            });
        });
    }

    function writeCurrentLevel(done) {
        console.log('Writing current patch level to database ...');
        // only write the if the patch level is greater than zero
        if ( currentPatchLevel > 0 ) {
            client.query("UPDATE property SET value = $1 WHERE key = 'patch'", [ currentPatchLevel ], done);
        }
        else {
            process.nextTick(done);
        }
    }

    function disconnect(done) {
        console.log('Disconnecting client ...');
        client.end(done);
    }
};

// ----------------------------------------------------------------------------
