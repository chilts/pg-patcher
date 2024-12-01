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
    logger : function() {}, // noop
};

module.exports = function pgpatcher(client, level, opts, callback) {
    // optional 'opts'
    if ( typeof opts === 'function' ) {
        callback = opts;
        opts = {};
    }

    opts = xtend({}, defaults, opts);
    var logger = opts.logger;

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
        ],
        function(err) {
            if (err) {
                return callback(err);
            }
            callback(null, currentPatchLevel);
        }
    );

    function readPatchDir(done) {
        fs.readdir(opts.dir, function(err, files) {
            files.forEach(function(filename) {
                if ( filename.match(/~$/) ) {
                    return;
                }

                var parts = filename.split(/[-_\.]/);
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
        logger('Beginning transaction ...');
        client.query("BEGIN", done);
        logger('Beginning transaction ... done!');
    }

    function commit(done) {
        logger('Commiting transaction ...');
        client.query("COMMIT", done);
        logger('Commiting transaction ... done!');
    }

    function getCurrentPatch(done) {
        logger('Getting current patch ...');
        client.query("SELECT value FROM property WHERE key = 'patch'", function(err, res) {
            if (err) {
                if ( '' + err === 'error: relation "property" does not exist' ) {
                    logger('Property table does not exist, patch level zero!');
                    currentPatchLevel = 0;
                    return done();
                }
                return done(err);
            }

            currentPatchLevel = +res.rows[0].value;
            logger('Current patch is ' + currentPatchLevel);
            logger('Getting current patch ... done!');

            done();
        });
    }

    function nextPatch(done) {
        var tryLevel;
        var patch;
        if ( level > currentPatchLevel ) {
            tryLevel = currentPatchLevel + 1;
            patch = forwardPatch[tryLevel];
            logger('Trying patch to %s ...', tryLevel);
        }
        else if ( level < currentPatchLevel ) {
            tryLevel = currentPatchLevel - 1;
            patch = reversePatch[tryLevel];
            logger('Trying patch to %s ...', tryLevel);
        }
        else {
            // same, nothing to do
            logger('No patching needed');
            return process.nextTick(done);
        }

        // make the filename
        filename = opts.dir + '/' + patch.filename;

        // read the patch file
        fs.readFile(filename, { encoding : 'utf8' }, function(err, sql) {
            client.query(sql, function(err, res) {
                if (err) return done(err);

                // update the current patch level state
                currentPatchLevel = tryLevel;
                logger('Trying patch to %s ...', tryLevel, 'done!');

                nextPatch(done);
            });
        });
    }

    function writeCurrentLevel(done) {
        // only write the if the patch level is greater than zero
        if ( currentPatchLevel > 0 ) {
            logger('Writing current patch level %s to database ...', currentPatchLevel);
            client.query("UPDATE property SET value = $1 WHERE key = 'patch'", [ currentPatchLevel ], done);
            logger('Writing current patch level %s to database ...', currentPatchLevel, 'done!');
        }
        else {
            logger("Patch level 0 - no need to write this to the database");
            process.nextTick(done);
        }
    }
};

// ----------------------------------------------------------------------------
