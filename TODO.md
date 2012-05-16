TODO
----

* Layer management
    * Thumbnail for each layer
    * Visibility checkmark
    * Reordering
        * touch arrows, drag and drop

* Serialization of layer data into...
    * (not including image data, just the commands to reproduce)
    * localStorage
    * a data: URL

* Serialization of canvas into PNG...
    * as base64 data: URL
    * can any services accept an upload to API?

* Image upload to server
    * Can I use an input type=file?
    * Encode as Base64 and submit?
    * http://hacks.mozilla.org/2011/01/how-to-develop-a-html5-image-uploader/

* Simultaneous previews of several sizes
    * 512x512 editor
    * 256x256, 128x128, 64x64 previews

* Need clip art sources
    * Easy configuration / manifests
    * http://openclipart.org/
    * http://thenounproject.com/

* Art selector improvements
    * categories
    * on-demand loading in response to search / category reveal

* Drag and drop art item into canvas

* External art search APIs?
    * Noun Project or OCAL?

* Flip horizontal / vertical

* Colored backgrounds
    * Since everything is transparent right now

* Colorize black line-art images (eg. noun project) by compositing atop a solid
  color fill? (destination-in?)
  * https://developer.mozilla.org/en/Canvas_tutorial/Compositing

* Art upload from local machine? 
    * Drag and drop into window?

* Snap to grid
    * Require modifier key?

* Keyboard controls
    * Cursor arrows to move layer
    * Shift-arrows for fine movement?
    * Shift-left/right to rotate?
    * Shift-up/down to scale?
    * Control-up/down for opacity?
