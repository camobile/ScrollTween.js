var ScrollTween = this['ScrollTween'] || {};
(function($) {
  var $window = $(window),
      $document = $(document),
      console = window.console || {
        log: function() {},
        debug: function() {},
        error: function() {}
      },
      settings = {
        tick: 50
      };

  $.extend(settings, ScrollTween.settings);

  var AnimationLoop = (function() {
    var containers = [],
        TICK = settings.tick,
        raf = window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame || 
      window.mozRequestAnimationFrame || 
      window.oRequestAnimationFrame || 
      window.msRequestAnimationFrame ||
      function(callback) {
        setTimeout(callback, TICK);
      };
    
    var animationLoop = function(time) {
      for (var i = 0, n = containers.length; i < n; i++) {
        containers[i].render(time);
      }
      if (containers.length !== 0) {
        raf(animationLoop);
      }
    };
    return {
      join: function(container) {
        var exists = false;
        for (var i = 0, n = containers.length; i < n; i++) {
          if (containers[i] === container) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          containers.push(container);
          if (containers.length === 1) {
            animationLoop();
          }
        }
      },
      leave: function(container) {
        var _tmp = [];
        for (var i = 0, n = containers.length; i < n; i++) {
          if (containers[i] !== container) {
            _tmp.push(containers[i]);
          }
        }
        containers = _tmp;
      }
    };
  })();
  function ScrollTweenContainer(elem, options) {
    var self = this;
    this.settings = {
      touchSpeed: 5,
      wheelSpeed: 45,
      tweenSpeed: .3
    };
    $.extend(this.settings, options);
    this._elems = []; // added elements
    this._tweens = []; // tween instances from elements
    this.tweenTop = 0; // animation's current position
    this.scrollTop = 0; // scroll position (updated by mouse wheel or touch move)
    this.scrollEnd = 0; // after initialized, calcurated by tween's max endPos.
    
    // prepare container's styles
    var target = this.target = $(elem);
    target.css('overflow', 'hidden');
    var targetStylePosition = target.css('position');
    if (targetStylePosition !== 'position' || targetStylePosition === 'static') {
      target.css('position', 'relative');
    }
    //=== set up event handlers
    // touch event
    (function setupTouchEvent() {
      var touchStart = {}, scrollStart;
      if ('ontouchstart' in window) {
        target[0].addEventListener('touchstart', function(e) {
          var touches = e.touches;
          touchStart.x = touches[0].pageX;
          touchStart.y = touches[0].pageY;
          scrollStart = self.scrollTop;
        }, true);
        target[0].addEventListener('touchmove', function(e) {
          e.preventDefault();
          var touches = e.touches;
          var offsetY = touchStart.y - touches[0].pageY;
          self.scrollTop = Math.max(0, scrollStart + offsetY * (1 + self.settings.touchSpeed));
          if (self.scrollTop < 0) self.scrollTop = 0;
          if (self.scrollEnd < self.scrollTop) self.scrollTop = self.scrollEnd;
        }, true);
        target[0].addEventListener('touchend', function(e) {
          //console.log('TOUCH END: scrollTop:' + self.scrollTop + ', delta:' + (self.scrollTop - scrollStart));
        }, true);
      }
    })();
    // mouse wheel event
    $document.on('mousewheel', function(e, delta, deltaX, deltaY) {
      e.preventDefault();
      self.scrollTop -= delta * self.settings.wheelSpeed;
      if (self.scrollTop < 0) self.scrollTop = 0;
      if (self.scrollEnd < self.scrollTop) self.scrollTop = self.scrollEnd;
    });
    // resize
    $window.on('resize', function() {
      self.stop();
      if (typeof self.onresize === 'function') {
        self.onresize.call(this);
      }
      self.play();
    });
  }
  ScrollTweenContainer.prototype = {
    add: function(elem, configurator) {
      this._elems.push({
        elem: $(elem).css({
          position: 'absolute',
          display: 'none'
        }),
        configurator: configurator
      });
    },
    resize: function(callback) {
      this.onresize = callback;
    },
    progress: function(callback) {
      this.onprogress = callback;
    },
    play: function() {
      var self = this,
          elements = this._elems,
          tweens = this._tweens = [],
          maxEndPos = 0;
      for (var i = 0, n = elements.length; i < n; i++) {
        var elem = elements[i];
        var tween = new Tween(elem.elem, this);
        elem.configurator.call(elem.elem, tween);
        tween.init();
        tweens.push(tween);
        if (tween.endPos > maxEndPos) {
          maxEndPos = tween.endPos;
        }
      }
      self.scrollEnd = maxEndPos;
      AnimationLoop.join(this);
      self.scrollTop++;
    },
    stop: function() {
      var tweens = this._tweens;
      if (tweens) {
        for (var i = 0, n = tweens.length; i < n; i++) {
          tweens[i].end();
        }
        delete this._tweens;
      }
    },
    width: function() {
      return this.target.width();
    },
    height: function() {
      return this.target.height();
    },
    getScrollTop: function() {
      return this.scrollTop;
    },
    getScrollEnd: function() {
      return this.scrollEnd;
    },
    isScrollEnd: function() {
      return this.scrollTop >= this.scrollEnd;
    },
    scroll: function(delta) {
      this.scrollTo(this.scrollTop + delta);
    },
    scrollTo: function(scrollTop) {
      if (scrollTop < 0) {
          scrollTop = 0;
      } else if (scrollTop > this.scrollEnd) {
          scrollTop = this.scrollEnd;
      }
      this.scrollTop = scrollTop;
    },
    render: function() {
      var self = this,
          tweens = self._tweens,
          scrollTop = self.scrollTop,
          tweenTop = self.tweenTop;
      if (Math.abs(scrollTop - tweenTop) < 1) {
        return;
      }
      var start = now();
      tweenTop += self.settings.tweenSpeed * (scrollTop - tweenTop);
      self.tweenTop = tweenTop;
      for (var i = 0, n = tweens.length; i < n; i++) {
        var tween = tweens[i];
        if (tweenTop >= tween.startPos && tweenTop <= tween.endPos) {
          tween.render();
        } else {
          tween.end();
        }
      }
      if (typeof this.onprogress === 'function') {
        this.onprogress.call(this);
      }
      var end = now();
      //console.log('elapsed:' + (end - start) + 'millis');
    }
  };
  function now() {
    return window.performance && window.performance.webkitNow ? performance.webkitNow() : new Date().getTime();
  }

  function TweenStyleBuilder(tween) {
    this.tween = tween;
    var $tweenTarget = this.$tweenTarget = tween.target;
    
    this._widthOfTweenTarget = $tweenTarget.width();
    this._heightOfTweenTarget = $tweenTarget.height();
    this._hWidthOfTweenTarget = this._widthOfTweenTarget / 2;
    this._hHeightOfTweenTarget = this._heightOfTweenTarget / 2;
    
    var container = this.container = tween.container;
    this._widthOfContainer = container.width();
    this._heightOfContainer = container.height();
    this._hWidthOfContainer = this._widthOfContainer / 2;
    this._hHeightOfContainer = this._heightOfContainer / 2;
    this._styles = {};
  }
  TweenStyleBuilder.prototype = {
    center: function(offset) {
      var value = this._hWidthOfContainer - this._hWidthOfTweenTarget;
      if (offset) {
        if (-1 < offset && offset < 1) {
          offset = this._widthOfContainer * offset;
        }
        value += offset;
      }
      this._styles.left = value;
      return this;
    },
    middle: function(offset) {
      var value = this._hHeightOfContainer - this._hHeightOfTweenTarget;
      if (offset) {
        if (-1 < offset && offset < 1) {
          offset = this._heightOfContainer * offset;
        }
        value += offset;
      }
      this._styles.top = value;
      return this;
    },
    bottom: function(offset) {
      var value = this._heightOfContainer - this._heightOfTweenTarget;
      if (offset) {
        if (-1 < offset && offset < 1) {
          offset = this._heightOfContainer * -offset;
        }
        value += offset;
      }
      this._styles.top = value;
      return this;
    },
    bottomOut: function() {
      this._styles.top = this._heightOfContainer;
      return this;
    },
    top: function(offset) {
      var value = 0;
      if (offset) {
        if (-1 < offset && offset < 1) {
          offset = this._heightOfContainer * offset;
        }
        value += offset;
      }
      this._styles.top = value;
      return this;
    },
    topOut: function() {
      this._styles.top = -this._heightOfTweenTarget;
      return this;
    },
    left: function(offset) {
      var value = 0;
      if (offset) {
        if (-1 < offset && offset < 1) {
          offset = this._widthOfContainer * offset;
        }
        value += offset;
      }
      this._styles.left = value;
      return this;
    },
    leftOut: function() {
      this._styles.left = -this._widthOfTweenTarget;
      return this;
    },
    right: function(offset) {
      var value = this._widthOfContainer - this._widthOfTweenTarget;
      if (offset) {
        if (-1 < offset && offset < 1) {
          offset = this._widthOfContainer * -offset;
        }
        value += offset;
      }
      this._styles.left = value;
      return this;
    },
    rightOut: function() {
      this._styles.left = this._widthOfContainer;
      return this;
    },
    extend: function(props) {
      $.extend(this._styles, props);
      return this;
    },
    clone: function() {
      var newStyles = this.tween.styles();
      newStyles.extend(this._styles);
      return newStyles;
    },
    get: function() {
      return this._styles;
    },
    apply: function() {
      this.$tweenTarget.css(this.get());
    }
  };
  var Easing = {
    'linear': function(k) {
      return k;
    },
    'ease-in': function(k) {
      return k * k * k * k;
    },
    'ease-out': function(k) {
      return -k * (k - 2);
    },
    'ease-in-out': function(k) {
      if ( ( k *= 2 ) < 1 ) return 0.5 * k * k;
	  return - 0.5 * ( --k * ( k - 2 ) - 1 );
    }
  };
  function Tween($elem, container) {
    this.target = $elem;
    this.container = container;
    this.keyframes = [];
    this.initialized = false;
    this.rendering = false;
    this._framePositions = [];
    this._debug = false;
    this.startPos = 0;
    this.endPos = 0;
    this._onenter = null;
    this._onprogress = null;
  }
  Tween.prototype = {
    width: function() {
      return this.target.width();
    },
    height: function() {
      return this.target.height();
    },
    to: function(scrollTop, styles, options) {
      if (typeof styles === 'function') {
        styles = styles.call(this);
      }
      if (!styles) {
        styles = {};
      }
      if (styles instanceof TweenStyleBuilder) {
        styles = styles.get();
      }
      this.keyframes.push({
        scrollTop: scrollTop,
        styles: styles,
        options: options
      });
      this._framePositions.push(scrollTop);
      return this;
    },
    range: function(from, to, styles, fromOptions, toOptions) {
      this.to(from, styles, fromOptions);
      this.to(to, styles, toOptions);
      return this;
    },
    debug: function(b) {
      if (b === undefined) {
        return this._debug;
      }
      this._debug = !!b;
      return this;
    },
    enter: function(callback) {
      this._onenter = callback;
      return this;
    },
    progress: function(callback) {
      this._onprogress = callback;
      return this;
    },
    styles: function(params) {
      var styleBuilder = new TweenStyleBuilder(this);
      if (params) {
        styleBuilder.extend(params);
      }
      return styleBuilder;
    },
    init: function() {
      this._framePositions.sort(function(a, b) {
        return Number(a) - Number(b);
      });
      var framePositions = this._framePositions;
      this.startPos = framePositions[0];
      this.endPos = framePositions[framePositions.length - 1];
      this.initialized = true;
    },
    render: function() {
      var target = this.target,
          keyframes = this.keyframes,
          startPos = this.startPos,
          endPos = this.endPos,
          progressFunc = this._onprogress,
          styles = {};
      
      if (!this.initialized) {
        throw new Error('not yet initialized');
      }
      if (!this.rendering) {
        target[0].style.display = 'block';
        if (keyframes[0].styles) {
          target.css(keyframes[0].styles);
        }
        if (typeof this._onenter === 'function') {
          var s = this._onenter.call(this);
          if (s instanceof TweenStyleBuilder) {
            s = s.get();
          }
          $.extend(styles, s);
        }
        this.rendering = true;
      }
      for (var i = 1, n = keyframes.length; i < n; i++) {
        var keyframe = keyframes[i],
            keyframeOptions = keyframe.options || {},
            lastKeyframe = keyframes[i - 1],
            lastKeyframeOptions = lastKeyframe.options || {},
            keyframeEnterFunc = lastKeyframeOptions.enter,
            keyframeProgressFunc = keyframeOptions.progress,
            easingFunction = typeof keyframeOptions.easing === 'string' ? Easing[keyframeOptions.easing] : Easing.linear,
            lastKeyframeScrollTop = lastKeyframe.scrollTop,
            keyframeScrollTop = keyframe.scrollTop,
            wasCurrent = lastKeyframe.current; // for the 'enter' event
        
        lastKeyframe.current = keyframe.current = false;
        var tweenTop = this.container.tweenTop;
        if (tweenTop < lastKeyframeScrollTop || keyframeScrollTop < tweenTop) {
          continue;
        }
        lastKeyframe.current = true;
        // fire the 'enter' event
        if (!wasCurrent && typeof keyframeEnterFunc === 'function') {
          var styles_ = keyframeEnterFunc.call(this);
          if (styles_ instanceof TweenStyleBuilder) {
            styles_ = styles_.get();
          }
          $.extend(styles_, lastKeyframe.styles);
          lastKeyframe.styles = styles_;
        }
        var progressInKeyframes =
          (lastKeyframeScrollTop - tweenTop) / (lastKeyframeScrollTop - keyframeScrollTop);
        if (typeof keyframeProgressFunc === 'function') {
          var styles_ = keyframeProgressFunc.call(this, progressInKeyframes);
          if (styles_) {
            if (styles_ instanceof TweenStyleBuilder) {
              styles_ = styles_.get();
            }
            $.extend(styles_, keyframe.styles);
            keyframe.styles = styles_;
          }
        }
        if (!keyframe.styles) {
          continue;
        }
        for (var style in lastKeyframe.styles) {
          var lastStyleValue = lastKeyframe.styles[style];
          var nextStyleValue = keyframe.styles[style];
          if (nextStyleValue === undefined || nextStyleValue === null) {
            keyframe.styles[style] = nextStyleValue = lastStyleValue;
          }
          lastStyleValue = getUnitValue(lastStyleValue);
          nextStyleValue = getUnitValue(nextStyleValue);

          var delta = nextStyleValue.value - lastStyleValue.value;
          var currentValue = easingFunction(progressInKeyframes) * delta + lastStyleValue.value;
          if (typeof nextStyleValue.unit === 'string') {
            currentValue += nextStyleValue.unit;
          }
          styles[style] = currentValue;
        }
      }
      if (typeof progressFunc === 'function') {
        var progress = (startPos - tweenTop) / (startPos - endPos);
        var customStyles = this._onprogress.call(this, progress);
        if (customStyles) {
          if (customStyles instanceof TweenStyleBuilder) {
            customStyles = customStyles.get();
          }
          $.extend(styles, customStyles);
        }
      }
      target.css(styles);
    },
    end: function() {
      if (!this.container.isScrollEnd()) {
        this.target[0].style.display = 'none';
      }
      this.rendering = false;
    }
  };
  var UNIT_VALUE_PATTERN = /([\d\.\-]+)([^\d]+)/;
  function getUnitValue(value) {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === 'number') {
      return { value: value };
    }
    if (!UNIT_VALUE_PATTERN.test(value)) {
      throw new Error('Bad value:' + value);
    }
    return {
      value: parseInt(RegExp.$1, 10),
      unit: RegExp.$2,
      toString: function() {
        return value;
      }
    };
  }
  ScrollTween.container = function(elem, options) {
    return new ScrollTweenContainer(elem, options);
  };
})(jQuery);
