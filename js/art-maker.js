//
// ArtMaker
//
var ArtMaker = Backbone.View.extend({

    default_options: {
        art_base_url: 'img/art/others'
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

        $this.curr_drag_el = null;

        var do_mousedown = function (ev) {
            var el = $(this);
            $this.curr_drag_el = el; 
            $this.curr_layer = $this.layers[0];
            $this.initial_options = _.clone($this.curr_layer.options);
            $this.initial_drag_x = ev.pageX;
            $this.initial_drag_y = ev.pageY;
            return false;
        }

        $this.$('.canvas-ui').mousedown(do_mousedown);
        _(['move', 'rotate', 'scale', 'opacity']).each(function (name) {
            $this.$('.canvas-ui .ui-' + name).mousedown(do_mousedown);
        });

        $this.$el
            .mouseup(function (ev) {
                $this.curr_drag_el = null;
            })
            .mousemove(function (ev) {
                if (!$this.curr_drag_el) { return true; }
                if (!$this.curr_layer) { return true; }

                var drag_el = $this.curr_drag_el;
                var curr_x = ev.pageX - $this.initial_drag_x;
                var curr_y = ev.pageY - $this.initial_drag_y;
                
                if (drag_el.is('.ui-move') || drag_el.is('.canvas-ui')) {
                    $this.curr_layer.options.left = $this.initial_options.left + curr_x;
                    $this.curr_layer.options.top = $this.initial_options.top + curr_y;
                }
                if (drag_el.is('.ui-scale')) {
                    $this.curr_layer.options.left = $this.initial_options.left + curr_x;
                    $this.curr_layer.options.top = $this.initial_options.top + curr_y;
                }
                if (drag_el.is('.ui-rotate')) {
                    var a = curr_x, b = curr_y, 
                        c = $this.initial_drag_x, d = $this.initial_drag_y,
                        x = (c-a), y = (d-b),
                        t = Math.atan2(-y, x);
                    $this.curr_layer.options.rotation = t;
                }

                $this.render();
            });

        $this.$('.canvas-ui .ui-delete').click(function (ev) {
            return false;
        });

        $this.loadArtChoices();
    },

    loadArtChoices: function () {
        var $this = this;
        $.get($this.options.art_base_url + '/index.txt', function (data, status, resp) {
            var data = resp.responseText;
            var lines = data.match(/^.*((\r\n|\n|\r)|$)/gm);

            var ul_choices = $this.$('ul.art-choices');
            ul_choices.on('click', 'a.choice', function () {
                return $this.handleArtChoice($(this));
            });

            _(lines).each(function (name) {
                if (!name) { return; }
                var img_url = $this.options.art_base_url + '/' + name;
                $this.addArtChoice(name, img_url);
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
        ul_choices.append(img_li);
    },

    handleArtChoice: function (target) {
        var $this = this;
        var img = target.find('img')[0];
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
        for (var i=$this.layers.length-1; i>=0; i--) {
            $this.layers[i].render();
        };
    }

});

//
//
//
var ArtMaker_Art = Backbone.View.extend({
});

//
// ArtMaker_Layer
//
var ArtMaker_Layer = Backbone.View.extend({

    default_options: {
        parent: null,
        name: 'unnamed',
        img: null,
        top: 0,
        left: 0,
        width: 0,
        height: 0,
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
        var ctx = $this.options.parent.ctx;
        ctx.save();
        ctx.rotate($this.options.rotation);
        ctx.drawImage($this.options.img,
                      $this.options.left, $this.options.top)/*,
                      $this.options.width, $this.options.height)*/;
        ctx.restore();
    }

});

//
// ArtMaker_LayerSet
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
