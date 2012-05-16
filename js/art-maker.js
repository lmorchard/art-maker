// ## ArtMaker package
var ArtMaker = {
    Views: {},
    Models: {}
};

var noop_sync = function () {};

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
    sync: noop_sync
});

// ## ArtMaker.Model.LayerCollection
ArtMaker.Models.LayerCollection = Backbone.Collection.extend({
    model: ArtMaker.Models.Layer,
    url: '/layers',
    sync: noop_sync
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
        var $this = this;
        this.options = _.defaults(options, this.defaults);
        
        this.layers = new ArtMaker.Models.LayerCollection();
        this.layers.on('add', function (layer) {
            this.trigger('select', layer);
        });

        var serializing = false;
        var serialize = function (layer) {
            if (serializing) { return; }
            serializing = true;
            setTimeout(function () {
                var data = $this.$('canvas.main')[0].toDataURL('image/png');
                $('.output .data-url').attr('href', data);
                serializing = false;
            }, 500);
        };
        _(['add', 'remove', 'change']).each(function (ev_name) {
            $this.layers.on(ev_name, serialize);
        });

        this.$('button.to-imgur').click(function () {
            var canvas = $this.$('canvas.main')[0];
            // see: http://29a.ch/2011/9/11/uploading-from-html5-canvas-to-imgur-data-uri
            try {
                var img = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
            } catch(e) {
                var img = canvas.toDataURL().split(',')[1];
            }
            // open the popup in the click handler so it will not be blocked
            var w = window.open();
            w.document.write('Uploading...');
            // upload to imgur using jquery/CORS
            // https://developer.mozilla.org/En/HTTP_access_control
            $.ajax({
                url: 'http://api.imgur.com/2/upload.json',
                type: 'POST',
                data: {
                    type: 'base64',
                    // get your key here, quick and fast http://imgur.com/register/api_anon
                    key: 'e64443e503f39cd821f23b9cea8b6ab0',
                    name: (new Date().getTime()) + '.jpg',
                    title: 'test title',
                    caption: 'test caption',
                    image: img
                },
                dataType: 'json'
            }).success(function(data) {
                w.location.href = data['upload']['links']['imgur_page'];
            }).error(function() {
                alert('Could not reach api.imgur.com. Sorry :(');
                w.close();
            });
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
                // HACK: This is a self-recursive thingy that downloads and
                // adds art selectors in batches, rather than tie the browser
                // up for the whole time.
                (function () {
                    var cb = arguments.callee,
                        batch = lines.splice(0, 10);
                    if (!batch.length) { return; }
                    _.each(batch, function (name) {
                        if (!name) { return; }
                        $this.addArtChoice(name, base_url + '/' + name);
                    });
                    setTimeout(cb, 1);
                })();
            });
        });
    },
    addArtChoice: function (name, img_url) {
        // Inject the art selector item into the page.
        var img_li = $('<li><a class="choice" href=""><img src=""></a></li>');
        img_li
            .find('a').attr('name', name).end()
            .find('img').attr('src', img_url).end();
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
        var canvas_el = this.canvas[0];
        canvas_el.width = canvas_el.width;
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
        // HACK: Hardcoding these dimensions for now, but need to work out how
        // to get these from the source images. Other attempts have been buggy.
        var width = 256, height = 256;
        ctx.save();
        ctx.translate(layer.get('left'), layer.get('top'));
        ctx.scale(layer.get('scale'), layer.get('scale'));
        ctx.rotate(layer.get('rotation'));
        ctx.globalAlpha = layer.get('opacity');
        ctx.drawImage(img[0], 0-(width / 2), 0-(height / 2));
        ctx.restore();
    }

});
