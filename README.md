MultiPaint
==========

A collaborative painting app

The goal of this app is to support:
  * Multiple concurrent users
  * Multiple touches per user
  * Multiple layers (one per user)
  * Multiple input methods, including:
    * Mouse
    * Touchscreen
    * SmartBoard
    * Leap Motion
    * Mobile screen (a-la https://github.com/Remotes/Remotes)

Install Dependencies
--------------------
Install the server modules using npm:

`npm install` ![dependencies status](https://david-dm.org/markmsmith/multipaint.png)

then install the client-side dependencies using [Bower](http://bower.io/):

  node_modules/bower/bin/bower install

Then do:

    npm start
