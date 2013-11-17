pg-patcher - A Postgres patch helper for node-postgres.

## Synopsis ##

```
var pg = require('pg');
var pgpatcher = require('./index.js');

var client = new pg.Client({
    user     : 'mydb',
    database : 'mydatabase',
});

client.connect(function(err) {
    pgpatcher(client, 2, function(err) {
        // database is now patched to level 2
    }); 
});
```

Meanwhile:

```
$ ls -l db/
total 80
-rw-rw-r-- 1 chilts chilts 124 Nov 18 11:52 patch-0-1.sql
-rw-rw-r-- 1 chilts chilts  21 Nov 18 11:34 patch-1-0.sql
-rw-rw-r-- 1 chilts chilts 405 Nov 18 11:36 patch-1-2.sql
-rw-rw-r-- 1 chilts chilts 110 Nov 18 11:37 patch-2-1.sql
```

Each patch file needs a prefix, two version (from and to) and should end in ```.sql```.

## API ##

The API is pretty simple. Just pass your Pg client, the level you want to patch to (whether forwards or backwards), any
options and a callback.

```
var pgpatcher = require('pg-patcher');
pgpatcher(client, level, [opts], callback);
```

There are only two options to the module, both of which are optional:

```
var options = {
    dir    : 'db',
    prefix : 'patch',
};
```

If you leave out ```opts``` completely, these defaults are set for you.

## Why this module? ##

I have seen too many times that database patch scripts write the current patch level to the current directory. This is
wrong on so many levels.

* what if you release your site to multiple webservers/machines?
* what if your patch file gets out of sync with the database itself

Therefore, the only place the database patch level should be is in the database itself. This module does that.

## The First Forward and Reverse Patch ##

The first patch ```patch-0-1.sql``` should create a property table and set the ```patch``` key to ```1```. The first
reverse patch should drop this table. ie. the first two patches are:

```
$ cat db/patch-0-1.sql
CREATE TABLE property (
    key   TEXT PRIMARY KEY,
    value TEXT
);
INSERT INTO property(key, value) VALUES('patch', 1);

$ cat db/patch-1-0.sql
DROP TABLE property;
```

# Author #

Written by [Andrew Chilton](http://chilts.org/) - [Blog](http://chilts.org/blog/) -
[Twitter](https://twitter.com/andychilton).

# License #

* [Copyright 2013 Andrew Chilton.  All rights reserved.](http://chilts.mit-license.org/2013/)

(Ends)
