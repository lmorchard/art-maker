//
// ## ArtMaker
//
var ArtMaker = Backbone.View.extend({

    default_options: {
        art_base_urls: [
            'img/art/noun-project',
            'img/art/others'
        ],
        rotation_factor: 0.020,
        opacity_factor: 0.005,
        scale_factor: 0.005
    },

    initialize: function (options) {
        var $this = this;

        $this.options = _.defaults(options, $this.default_options);
        
        $this.canvas = $this.$('canvas.main');
        var ctx = $this.ctx = $this.canvas[0].getContext('2d');

        $this.layers = [];
        $this.layer_set = new ArtMaker_LayerSet({
            parent: $this,
            el: $this.$('ul.layer-set')
        });

        var ul_choices = $this.$('ul.art-choices');
        ul_choices.on('click', 'a.choice', function () {
            return $this.handleArtChoice($(this));
        });

        $this.curr_drag_el = null;

        var do_mousedown = function (ev) {
            var el = $(this);
            $this.curr_drag_el = el; 
            $this.curr_layer = $this.layers[0];
            $this.initial_options = _.clone($this.curr_layer.options);
            $this.initial_drag_x = ev.pageX;
            $this.initial_drag_y = ev.pageY;
            $('.canvas-ui').addClass('dragging');
            return false;
        }

        $this.$('.canvas-ui').mousedown(do_mousedown);
        _(['move', 'rotate', 'scale', 'opacity']).each(function (name) {
            $this.$('.canvas-ui .ui-' + name).mousedown(do_mousedown);
        });

        $('body')
            .mouseup(function (ev) {
                $this.curr_drag_el = null;
                $('.canvas-ui').removeClass('dragging');
            })
            .mousemove(function (ev) {
                if (!$this.curr_drag_el) { return true; }
                if (!$this.curr_layer) { return true; }

                var drag_el = $this.curr_drag_el;
                var curr_x = ev.pageX - $this.initial_drag_x;
                var curr_y = ev.pageY - $this.initial_drag_y;
                var d_drag = $this._calcDistance(0, 0, curr_x, curr_y);
                
                if (drag_el.is('.ui-move') || drag_el.is('.canvas-ui')) {
                    $this.curr_layer.options.left =
                        $this.initial_options.left + curr_x;
                    $this.curr_layer.options.top =
                        $this.initial_options.top + curr_y;
                }
                if (drag_el.is('.ui-rotate')) {
                    var delta = (d_drag * $this.options.rotation_factor);
                    $this.curr_layer.options.rotation =
                        $this.initial_options.rotation + delta;
                }
                if (drag_el.is('.ui-scale')) {
                    var delta = 0 - (d_drag * $this.options.scale_factor);
                    var scale = ($this.initial_options.scale + delta);
                    if (scale < 0) { scale = 0; }
                    $this.curr_layer.options.scale = scale;
                }
                if (drag_el.is('.ui-opacity')) {
                    var delta = (d_drag * $this.options.opacity_factor);
                    var opacity = 1.0 - Math.abs(delta);
                    if (opacity < 0) { opacity = 0; }
                    if (opacity > 1) { opacity = 1; }
                    $this.curr_layer.options.opacity = opacity;
                }

                $this.render();
            });

        $this.$('.canvas-ui .ui-delete').click(function (ev) {
            return false;
        });

        $this.loadArtChoices();

        $this.render();
    },

    // ## _calcDistance
    // Calculate a drag distance. Whichever axis is the farthest from the
    // origin, use that as a quick and dirty horizontal/vertical lock.
    _calcDistance: function (x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx;
        } else {
            return dy;
        }
    },

    loadArtChoices: function () {
        var $this = this;
        _.each($this.options.art_base_urls, function (base_url) {
            $.get(base_url + '/index.txt', function (data, status, resp) {
                var data = resp.responseText;
                var lines = data.match(/^.*((\r\n|\n|\r)|$)/gm);
                _(lines).each(function (name) {
                    if (!name) { return; }
                    $this.addArtChoice(name, base_url + '/' + name);
                });
            });
        });
    },

    addArtChoice: function (name, img_url) {
        var $this = this;
        var ul_choices = $this.$('ul.art-choices');
        var img_li = $('<li><a class="choice" href="">' + 
                       '<img src="" width="50" height="50" /></a></li>');
        img_li
            .find('a').attr('name', name).end()
            .find('img').attr('src', img_url);

        var orig_img = new Image();
        orig_img.src = img_url;
        img_li.find('img')
            .attr('data-original-width', orig_img.width)
            .attr('data-original-height', orig_img.height);

        ul_choices.append(img_li);
    },

    handleArtChoice: function (target) {
        var $this = this;
        var img = target.find('img');
        var layer = new ArtMaker_Layer({
            parent: $this,
            img: img,
            name: "Layer " + ($this.layers.length + 1)
        });
        $this.layers.unshift(layer);
        $this.render();
        return false;
    },

    render: function () {
        var $this = this;
        $this.layer_set.render();
        $this.canvas[0].width = $this.canvas[0].width;
        var ctx = $this.ctx;
        ctx.save();
        // Set origin dead center in the canvas.
        ctx.translate($this.canvas[0].width/2, 
                      $this.canvas[0].height/2);
        // Draw all layers from bottom to top.
        for (var i=$this.layers.length-1; i>=0; i--) {
            $this.layers[i].render();
        };
        ctx.restore();
    }

});

//
// ## ArtMaker_ArtSelector
//
//
var ArtMaker_ArtSelector = Backbone.View.extend({
});

//
// ## ArtMaker_Layer
//
var ArtMaker_Layer = Backbone.View.extend({

    default_options: {
        parent: null,
        name: 'unnamed',
        img: null,
        top: 0,
        left: 0,
        scale: 1.0,
        opacity: 1.0,
        rotation: 0.0
        /* TODO: crop */
    },

    initialize: function (options) {
        var $this = this;
        $this.options = _.defaults(options, $this.default_options);
    },

    render: function () {
        var $this = this;
        var img = $this.options.img;

        var ctx = $this.options.parent.ctx;
        var width = img.attr('data-original-width'),
            height = img.attr('data-original-height');

        ctx.save();
        ctx.translate($this.options.left,
                      $this.options.top);
        ctx.scale($this.options.scale,
                  $this.options.scale);
        ctx.rotate($this.options.rotation);
        ctx.globalAlpha = $this.options.opacity;
        ctx.drawImage(img[0],
                      0-(width/2), 
                      0-(height/2));
        ctx.restore();
    }

});

//
// ## ArtMaker_LayerSet
//
var ArtMaker_LayerSet = Backbone.View.extend({

    default_options: {
        parent: null
    },

    template: [
        '<li class="layer">',
        '    <span class="name"></span>',
        '</li>'
    ].join(''),

    initialize: function (options) {
        var $this = this;
        $this.options = _.defaults(options, $this.default_options);
    },

    render: function () {
        var $this = this;
        var layers = $this.options.parent.layers;
        $this.$el.empty();
        _.each(layers, function (layer) {
            var layer_li = $($this.template);
            layer_li
                .find('.name').text(layer.options.name);
            $this.$el.append(layer_li);
        });
    }

});
