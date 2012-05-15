// ## ArtMaker package
var ArtMaker = {
    Views: {},
    Models: {}
};

// ## ArtMaker.Model.Layer
// Representation of a collage layer
ArtMaker.Models.Layer = Backbone.Model.extend({
    defaults: {
        name: "unnamed",
        visible: true,
        img: null,
        top: 0,
        left: 0,
        scale: 1.0,
        opacity: 1.0,
        rotation: 0.0
    },
    sync: function () {}
});

// ## ArtMaker.Model.LayerCollection
ArtMaker.Models.LayerCollection = Backbone.Collection.extend({
    model: ArtMaker.Models.Layer,
    url: '/layers',
    sync: function () {}
});

// ## ArtMaker.Main
ArtMaker.Main = Backbone.View.extend({
    defaults: {
        art_base_urls: [
            'img/art/noun-project',
            'img/art/others'
        ],
    },
    initialize: function (options) {
        this.options = _.defaults(options, this.defaults);
        
        this.layers = new ArtMaker.Models.LayerCollection();
        this.layers.on('add', function (layer) {
            this.trigger('select', layer);
        });

        this.art_selector = new ArtMaker.Views.ArtSelector({
            el: this.$('ul.art-choices'),
            layers: this.layers,
            art_base_urls: this.options.art_base_urls
        });
        this.layer_manager = new ArtMaker.Views.LayerList({
            el: this.$('ul.layer-set'),
            layers: this.layers
        });
        this.canvas = new ArtMaker.Views.Canvas({
            el: this.$('.canvas-ui'),
            layers: this.layers
        });
    },
});

// ## ArtMaker.Views.ArtSelector
// A view for selecting clip art
ArtMaker.Views.ArtSelector = Backbone.View.extend({
    initialize: function (options) {
        var $this = this;
        $this.$el.on('click', 'a.choice', function () {
            return $this.handleArtChoice($(this));
        });
        $this.loadArtChoices();
    },
    loadArtChoices: function () {
        var $this = this;
        _.each($this.options.art_base_urls, function (base_url) {
            $.get(base_url + '/index.txt', function (data, status, resp) {
                var data = resp.responseText;
                var lines = data.match(/^.*((\r\n|\n|\r)|$)/gm);
                (function () {
                    var cb = arguments.callee,
                        batch = lines.splice(0, 10);
                    _.each(batch, function (name) {
                        if (!name) { return; }
                        $this.addArtChoice(name, base_url + '/' + name);
                    });
                    if (lines.length) { setTimeout(cb, 0.1); }
                })();
                /*
                _(lines).each(function (name) {
                    if (!name) { return; }
                    $this.addArtChoice(name, base_url + '/' + name);
                });
                */
            });
        });
    },
    addArtChoice: function (name, img_url) {
        var img_li = $('<li><a class="choice" href=""><img src=""></a></li>');
        img_li
            .find('a').attr('name', name).end()
            .find('img').attr('src', img_url);

        var orig_img = new Image();
        orig_img.src = img_url;
        img_li.find('img')
            .attr('data-original-width', orig_img.width)
            .attr('data-original-height', orig_img.height);

        this.$el.append(img_li);
    },
    handleArtChoice: function (target) {
        var img = target.find('img');
        this.options.layers.create({
            name: "Layer " + (this.options.layers.size() + 1),
            img: img
        });
        return false;
    }
});

// ## ArtMaker.Views.LayerList
// Manager of a set of layers
ArtMaker.Views.LayerList = Backbone.View.extend({
    tagName: 'ul',
    attributes: { 'class': 'layer-set' },
    initialize: function (options) {
        var layers = this.options.layers;
        layers.on('add', _.bind(this.render, this));
        layers.on('remove', _.bind(this.render, this));
    },
    render: function () {
        var $this = this;
        var layers = this.options.layers;
        this.$el.empty();
        layers.each(function (layer) {
            var item = new ArtMaker.Views.LayerItem({
                parent: $this, model: layer, layers: layers
            });
            $this.$el.append(item.el);
        });
    }
});

// ## ArtMaker.Views.LayerItem
// Controls for a single layer
ArtMaker.Views.LayerItem = Backbone.View.extend({
    tagName: "li",
    events: {
        "click .reorder-up": "handleReorderUp",
        "click .reorder-down": "handleReorderDown",
        "click .name": "handleSelect",
        "click .delete": "handleDelete",
    },
    initialize: function (options) {
        this.render();
    },
    template: [
        '<span class="reorder-up">[^]</span>',
        '<span class="reorder-down">[V]</span>',
        ' - ',
        '<span class="name"></span>',
        ' - ',
        '<span class="delete">[X]</span>',
    ].join(''),
    render: function () {
        var $this = this;
        var model = $this.options.model;
        var frag = $($this.template);
        this.$el.append(frag);
        this.$el.find('.name').text(model.get('name'));
    },
    handleDelete: function () {
        var model = this.options.model;
        model.collection.remove(model);
    },
    handleSelect: function () {
        this.options.layers.trigger('select', this.options.model);
    },
    handleReorderUp: function () {
    },
    handleReorderDown: function () {
    }
});

// ## ArtMaker.Views.Canvas
// Controls for manipulating the canvas
ArtMaker.Views.Canvas = Backbone.View.extend({
    defaults: {
        rotation_factor: 0.020,
        opacity_factor: 0.005,
        scale_factor: 0.005
    },
    initialize: function (options) {
        var $this = this;
        this.options = _.defaults(options, this.defaults);

        var layers = options.layers;
        layers.on('add', _.bind(this.render, this))
        layers.on('remove', _.bind(this.render, this))
        layers.on('select', function (layer) {
            $this.selected_layer = layer; 
        });

        this.curr_drag_el = null;
        this.canvas = $this.$('canvas.main');
        this.ctx = $this.canvas[0].getContext('2d');

        this.wireUpEvents();
    },
    wireUpEvents: function () {
        var $this = this;
        var ctx = this.ctx;

        var do_mousedown = function (ev) {
            if (!$this.selected_layer) { return false; }
            var el = $(this);
            $this.curr_drag_el = el; 
            $this.original_layer = $this.selected_layer.clone();
            $this.dragstart_x = ev.pageX;
            $this.dragstart_y = ev.pageY;
            $('.canvas-ui').addClass('dragging');
            return false;
        }

        $this.$el.mousedown(do_mousedown);
        _(['move', 'rotate', 'scale', 'opacity']).each(function (name) {
            $this.$('.ui-' + name).mousedown(do_mousedown);
        });

        $('body')
            .mouseup(function (ev) {
                $this.curr_drag_el = null;
                $this.$el.removeClass('dragging');
                $('#log').val("");
            })
            .mousemove(function (ev) {
                if (!$this.curr_drag_el) { return true; }
                if (!$this.selected_layer) { return true; }

                var drag_el = $this.curr_drag_el;
                var curr_x = ev.pageX - $this.dragstart_x;
                var curr_y = ev.pageY - $this.dragstart_y;
                var d_drag = $this._calcDistance(0, 0, curr_x, curr_y);
                var original_layer = $this.original_layer;
                var layer = $this.selected_layer;

                if (drag_el.is('.ui-move') || drag_el.is('.canvas-ui')) {
                    layer.set({
                        left: original_layer.get('left') + curr_x,
                        top: original_layer.get('top') + curr_y
                    });
                }
                if (drag_el.is('.ui-rotate')) {
                    var delta = (d_drag * $this.options.rotation_factor),
                        rotation = original_layer.get('rotation') + delta;
                    layer.set({ rotation: rotation });
                }
                if (drag_el.is('.ui-scale')) {
                    var delta = 0 - (d_drag * $this.options.scale_factor);
                    var scale = (original_layer.get('scale') + delta);
                    if (scale < 0) { scale = 0; }
                    layer.set({ scale: scale });
                }
                if (drag_el.is('.ui-opacity')) {
                    var delta = (d_drag * $this.options.opacity_factor);
                    var opacity = 1.0 - Math.abs(delta);
                    if (opacity < 0) { opacity = 0; }
                    if (opacity > 1) { opacity = 1; }
                    layer.set({ opacity: opacity });
                }

                $this.render();
            });
    },

    // ### _calcDistance
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

    render: function () {
        var $this = this;
        this.canvas[0].width = this.canvas[0].width;
        var ctx = this.ctx;
        ctx.save();
        // Set origin dead center in the canvas.
        ctx.translate($this.canvas[0].width/2, 
                      $this.canvas[0].height/2);
        // Draw all layers from bottom to top.
        var layers = this.options.layers;
        layers.each(function (layer) {
            $this.renderLayer(layer);
        });
        ctx.restore();
    },

    renderLayer: function (layer) {
        var $this = this;
        var img = layer.get('img');
        var ctx = this.ctx;
        var width = img.attr('data-original-width'),
            height = img.attr('data-original-height');
        ctx.save();
        ctx.translate(layer.get('left'), layer.get('top'));
        ctx.scale(layer.get('scale'), layer.get('scale'));
        ctx.rotate(layer.get('rotation'));
        ctx.globalAlpha = layer.get('opacity');
        ctx.drawImage(img[0], 0-(width / 2), 0-(height / 2));
        ctx.restore();
    }

});
