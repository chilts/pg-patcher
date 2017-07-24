pg-patcher - A Postgres patch helper for node-postgres.

## Synopsis ##

```
var pg = require('pg');
var pgpatcher = require('pg-patcher');

var client = new pg.Client({
    user     : 'mydb',
    database : 'mydatabase',
});

client.connect(function(err) {
    pgpatcher(client, 2, function(err) {
        // database is now patched to level 2
        client.end();
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

If you leave out ```opts``` completely, these defaults are set for you. These two examples are equivalent:

```
pgpatcher(client, 2, function(err) {
    // database is now patched to level 2
});

pgpatcher(client, 2, { dir : 'db', prefix : 'patch' }, function(err) {
    // database is now patched to level 2
});
```

## Why this module? ##

I have seen too many times that database patch scripts write the current patch level to the current directory. This is
wrong on so many levels.

* what if you release your site to multiple webservers/machines?
* what if your patch file gets out of sync with the database itself

Therefore, the only place the database patch level should be is in the database itself. This module does that.

## Patch Files ##

Patch files are just a set of statements that you'd like to perform on the database. These could be creation, altering,
dropping of tables, functions, trigger or whatever else Postgres allows. It could also be adding application data to
the database or manipulating various colums. It's entirely up to you.

pg-patcher just makes sure that the ```property``` table is updated to the current patch level you specified, once all
patches have been sucessfully applied.

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

## All or Nothing (by using Transactions) ##

Prior to patching, a new transaction is started. After patching it is committed. Therefore, every patch file you have
asked to be performed will either succeed or fail. ie. if your database is currently at patch level 3 and you ask to
move to patch level 7, then all of 3, 4, 5, 6 and 7 will succeed or none of them.

Therefore, there is no need for you to add ```BEGIN``` or ```COMMIT``` statements in your patch files. pg-patcher will
also make sure the property table contains the current patch level.

Postgres is most wonderful since that DDL can be performed _within_ transactions, which means it's great for creating
or altering tables, functions, triggers, whatever. This is why I love it.

## Command Line Tool ##

pg-patcher also has a command line tool you can run from your ```package.json``` with ```npm run```:

```
  "scripts": {
    "db-patch": "pg-patcher --host localhost --database mydatabase --user myuser --level 2"
  }
```

This can be invoked with ```npm db-patch``` (or with the name of your choosing). However, you may want to place this in
a separate script if you need to pass a password.

You may pass any or all of these to the executable: database, user, password, port, host, ssl.

# Author #

Written by:

* [Andrew Chilton](https://chilts.me/)
* [Blog](https://chilts.org/)
* [Twitter](https://twitter.com/andychilton)
* [GitHub](https://github.com/chilts)

For:

* [AppsAttic](https://appsattic.com/)
* [Twitter](https://twitter.com/AppsAttic)
* [GitHub](https://github.com/appsattic)

# License #

* [Copyright 2013 Andrew Chilton.  All rights reserved.](http://chilts.mit-license.org/2013/)

(Ends)
