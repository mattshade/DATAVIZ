// Spectrum Colorpicker v1.3.4
// https://github.com/bgrins/spectrum
// Author: Brian Grinstead
// License: MIT
var codeValue = "";
var initCode = "";
var previewCode;

(function(window, $, undefined) {
    var defaultOpts = {

            // Callbacks
            beforeShow: noop,
            move: noop,
            change: noop,
            show: noop,
            hide: noop,

            // Options
            color: false,
            flat: false,
            showInput: false,
            allowEmpty: false,
            showButtons: true,
            clickoutFiresChange: false,
            showInitial: false,
            showPalette: false,
            showPaletteOnly: false,
            showSelectionPalette: true,
            localStorageKey: false,
            appendTo: "body",
            maxSelectionSize: 7,
            cancelText: "cancel",
            chooseText: "choose",
            clearText: "Clear Color Selection",
            preferredFormat: false,
            className: "", // Deprecated - use containerClassName and replacerClassName instead.
            containerClassName: "",
            replacerClassName: "",
            showAlpha: false,
            theme: "sp-light",
            palette: [
                ["#ffffff", "#000000", "#ff0000", "#ff8000", "#ffff00", "#008000", "#0000ff", "#4b0082", "#9400d3"]
            ],
            selectionPalette: [],
            disabled: false
        },
        spectrums = [],
        IE = !!/msie/i.exec(window.navigator.userAgent),
        rgbaSupport = (function() {
            function contains(str, substr) {
                return !!~('' + str).indexOf(substr);
            }

            var elem = document.createElement('div');
            var style = elem.style;
            style.cssText = 'background-color:rgba(0,0,0,.5)';
            return contains(style.backgroundColor, 'rgba') || contains(style.backgroundColor, 'hsla');
        })(),
        inputTypeColorSupport = (function() {
            var colorInput = $("<input type='color' value='!' />")[0];
            return colorInput.type === "color" && colorInput.value !== "!";
        })(),
        replaceInput = [
            "<div class='sp-replacer'>",
            "<div class='sp-preview'><div class='sp-preview-inner'></div></div>",
            "<div class='sp-dd'></div>",
            "</div>"
        ].join(''),
        markup = (function() {

            // IE does not support gradients with multiple stops, so we need to simulate
            //  that for the rainbow slider with 8 divs that each have a single gradient
            var gradientFix = "";
            if (IE) {
                for (var i = 1; i <= 6; i++) {
                    gradientFix += "<div class='sp-" + i + "'></div>";
                }
            }

            return [
                "<div class='sp-container sp-hidden'>",
                "<div class='sp-palette-container'>",
                "<div class='sp-palette sp-thumb sp-cf'></div>",
                "</div>",
                "<div class='sp-picker-container'>",
                "<div class='sp-top sp-cf'>",
                "<div class='sp-fill'></div>",
                "<div class='sp-top-inner'>",
                "<div class='sp-color'>",
                "<div class='sp-sat'>",
                "<div class='sp-val'>",
                "<div class='sp-dragger'></div>",
                "</div>",
                "</div>",
                "</div>",
                "<div class='sp-clear sp-clear-display'>",
                "</div>",
                "<div class='sp-hue'>",
                "<div class='sp-slider'></div>",
                gradientFix,
                "</div>",
                "</div>",
                "<div class='sp-alpha'><div class='sp-alpha-inner'><div class='sp-alpha-handle'></div></div></div>",
                "</div>",
                "<div class='sp-input-container sp-cf'>",
                "<input class='sp-input' type='text' spellcheck='false'  />",
                "</div>",
                "<div class='sp-initial sp-thumb sp-cf'></div>",
                "<div class='sp-button-container sp-cf'>",
                "<a class='sp-cancel' href='#'></a>",
                "<button type='button' class='sp-choose'></button>",
                "</div>",
                "</div>",
                "</div>"
            ].join("");
        })();

    function paletteTemplate(p, color, className, tooltipFormat) {
        var html = [];
        for (var i = 0; i < p.length; i++) {
            var current = p[i];
            if (current) {
                var tiny = tinycolor(current);
                var c = tiny.toHsl().l < 0.5 ? "sp-thumb-el sp-thumb-dark" : "sp-thumb-el sp-thumb-light";
                c += (tinycolor.equals(color, current)) ? " sp-thumb-active" : "";

                var formattedString = tiny.toString(tooltipFormat || "rgb");
                var swatchStyle = rgbaSupport ? ("background-color:" + tiny.toRgbString()) : "filter:" + tiny.toFilter();
                html.push('<span title="' + formattedString + '" data-color="' + tiny.toRgbString() + '" class="' + c + '"><span class="sp-thumb-inner" style="' + swatchStyle + ';" /></span>');
            } else {
                var cls = 'sp-clear-display';
                html.push('<span title="No Color Selected" data-color="" style="background-color:transparent;" class="' + cls + '"></span>');
            }
        }
        return "<div class='sp-cf " + className + "'>" + html.join('') + "</div>";
    }

    function hideAll() {
        for (var i = 0; i < spectrums.length; i++) {
            if (spectrums[i]) {
                spectrums[i].hide();
            }
        }
    }

    function instanceOptions(o, callbackContext) {
        var opts = $.extend({}, defaultOpts, o);
        opts.callbacks = {
            'move': bind(opts.move, callbackContext),
            'change': bind(opts.change, callbackContext),
            'show': bind(opts.show, callbackContext),
            'hide': bind(opts.hide, callbackContext),
            'beforeShow': bind(opts.beforeShow, callbackContext)
        };

        return opts;
    }

    function spectrum(element, o) {

        var opts = instanceOptions(o, element),
            flat = opts.flat,
            showSelectionPalette = opts.showSelectionPalette,
            localStorageKey = opts.localStorageKey,
            theme = opts.theme,
            callbacks = opts.callbacks,
            resize = throttle(reflow, 10),
            visible = false,
            dragWidth = 0,
            dragHeight = 0,
            dragHelperHeight = 0,
            slideHeight = 0,
            slideWidth = 0,
            alphaWidth = 0,
            alphaSlideHelperWidth = 0,
            slideHelperHeight = 0,
            currentHue = 0,
            currentSaturation = 0,
            currentValue = 0,
            currentAlpha = 1,
            palette = [],
            paletteArray = [],
            paletteLookup = {},
            selectionPalette = opts.selectionPalette.slice(0),
            maxSelectionSize = opts.maxSelectionSize,
            draggingClass = "sp-dragging",
            shiftMovementDirection = null;

        var doc = element.ownerDocument,
            body = doc.body,
            boundElement = $(element),
            disabled = false,
            container = $(markup, doc).addClass(theme),
            dragger = container.find(".sp-color"),
            dragHelper = container.find(".sp-dragger"),
            slider = container.find(".sp-hue"),
            slideHelper = container.find(".sp-slider"),
            alphaSliderInner = container.find(".sp-alpha-inner"),
            alphaSlider = container.find(".sp-alpha"),
            alphaSlideHelper = container.find(".sp-alpha-handle"),
            textInput = container.find(".sp-input"),
            paletteContainer = container.find(".sp-palette"),
            initialColorContainer = container.find(".sp-initial"),
            cancelButton = container.find(".sp-cancel"),
            clearButton = container.find(".sp-clear"),
            chooseButton = container.find(".sp-choose"),
            isInput = boundElement.is("input"),
            isInputTypeColor = isInput && inputTypeColorSupport && boundElement.attr("type") === "color",
            shouldReplace = isInput && !flat,
            replacer = (shouldReplace) ? $(replaceInput).addClass(theme).addClass(opts.className).addClass(opts.replacerClassName) : $([]),
            offsetElement = (shouldReplace) ? replacer : boundElement,
            previewElement = replacer.find(".sp-preview-inner"),
            initialColor = opts.color || (isInput && boundElement.val()),
            colorOnShow = false,
            preferredFormat = opts.preferredFormat,
            currentPreferredFormat = preferredFormat,
            clickoutFiresChange = !opts.showButtons || opts.clickoutFiresChange,
            isEmpty = !initialColor,
            allowEmpty = opts.allowEmpty && !isInputTypeColor;

        function applyOptions() {

            if (opts.showPaletteOnly) {
                opts.showPalette = true;
            }

            if (opts.palette) {
                palette = opts.palette.slice(0);
                paletteArray = $.isArray(palette[0]) ? palette : [palette];
                paletteLookup = {};
                for (var i = 0; i < paletteArray.length; i++) {
                    for (var j = 0; j < paletteArray[i].length; j++) {
                        var rgb = tinycolor(paletteArray[i][j]).toRgbString();
                        paletteLookup[rgb] = true;
                    }
                }
            }

            container.toggleClass("sp-flat", flat);
            container.toggleClass("sp-input-disabled", !opts.showInput);
            container.toggleClass("sp-alpha-enabled", opts.showAlpha);
            container.toggleClass("sp-clear-enabled", allowEmpty);
            container.toggleClass("sp-buttons-disabled", !opts.showButtons);
            container.toggleClass("sp-palette-disabled", !opts.showPalette);
            container.toggleClass("sp-palette-only", opts.showPaletteOnly);
            container.toggleClass("sp-initial-disabled", !opts.showInitial);
            container.addClass(opts.className).addClass(opts.containerClassName);

            reflow();
        }

        function initialize() {

            if (IE) {
                container.find("*:not(input)").attr("unselectable", "on");
            }

            applyOptions();

            if (shouldReplace) {
                boundElement.after(replacer).hide();
            }

            if (!allowEmpty) {
                clearButton.hide();
            }

            if (flat) {
                boundElement.after(container).hide();
            } else {

                var appendTo = opts.appendTo === "parent" ? boundElement.parent() : $(opts.appendTo);
                if (appendTo.length !== 1) {
                    appendTo = $("body");
                }

                appendTo.append(container);
            }

            updateSelectionPaletteFromStorage();

            offsetElement.bind("click.spectrum touchstart.spectrum", function(e) {
                if (!disabled) {
                    toggle();
                }

                e.stopPropagation();

                if (!$(e.target).is("input")) {
                    e.preventDefault();
                }
            });

            if (boundElement.is(":disabled") || (opts.disabled === true)) {
                disable();
            }

            // Prevent clicks from bubbling up to document.  This would cause it to be hidden.
            container.click(stopPropagation);

            // Handle user typed input
            textInput.change(setFromTextInput);
            textInput.bind("paste", function() {
                setTimeout(setFromTextInput, 1);
            });
            textInput.keydown(function(e) {
                if (e.keyCode == 13) {
                    setFromTextInput();
                }
            });

            cancelButton.text(opts.cancelText);
            cancelButton.bind("click.spectrum", function(e) {
                e.stopPropagation();
                e.preventDefault();
                hide("cancel");
            });

            clearButton.attr("title", opts.clearText);
            clearButton.bind("click.spectrum", function(e) {
                e.stopPropagation();
                e.preventDefault();
                isEmpty = true;
                move();

                if (flat) {
                    //for the flat style, this is a change event
                    updateOriginalInput(true);
                }
				
				
            });
			

            chooseButton.text(opts.chooseText);
            chooseButton.bind("click.spectrum", function(e) {
                e.stopPropagation();
                e.preventDefault();

                if (isValid()) {
                    updateOriginalInput(true);
                    hide();
                }
            });

            draggable(alphaSlider, function(dragX, dragY, e) {
                currentAlpha = (dragX / alphaWidth);
                isEmpty = false;
                if (e.shiftKey) {
                    currentAlpha = Math.round(currentAlpha * 10) / 10;
                }

                move();
            }, dragStart, dragStop);

            draggable(slider, function(dragX, dragY) {
                currentHue = parseFloat(dragY / slideHeight);
                isEmpty = false;
                if (!opts.showAlpha) {
                    currentAlpha = 1;
                }
                move();
            }, dragStart, dragStop);

            draggable(dragger, function(dragX, dragY, e) {

                // shift+drag should snap the movement to either the x or y axis.
                if (!e.shiftKey) {
                    shiftMovementDirection = null;
                } else if (!shiftMovementDirection) {
                    var oldDragX = currentSaturation * dragWidth;
                    var oldDragY = dragHeight - (currentValue * dragHeight);
                    var furtherFromX = Math.abs(dragX - oldDragX) > Math.abs(dragY - oldDragY);

                    shiftMovementDirection = furtherFromX ? "x" : "y";
                }

                var setSaturation = !shiftMovementDirection || shiftMovementDirection === "x";
                var setValue = !shiftMovementDirection || shiftMovementDirection === "y";

                if (setSaturation) {
                    currentSaturation = parseFloat(dragX / dragWidth);
                }
                if (setValue) {
                    currentValue = parseFloat((dragHeight - dragY) / dragHeight);
                }

                isEmpty = false;
                if (!opts.showAlpha) {
                    currentAlpha = 1;
                }

                move();

            }, dragStart, dragStop);

            if (!!initialColor) {
                set(initialColor);

                // In case color was black - update the preview UI and set the format
                // since the set function will not run (default color is black).
                updateUI();
                currentPreferredFormat = preferredFormat || tinycolor(initialColor).format;

                addColorToSelectionPalette(initialColor);
            } else {
                updateUI();
            }

            // G.V. added !isInput
            if (flat) {
                show();
            }

            function palletElementClick(e) {
                if (e.data && e.data.ignore) {
                    set($(this).data("color"));
                    move();
                } else {
                    set($(this).data("color"));
                    move();
                    updateOriginalInput(true);
                    hide();
                }

                return false;
            }

            var paletteEvent = IE ? "mousedown.spectrum" : "click.spectrum touchstart.spectrum";
            paletteContainer.delegate(".sp-thumb-el", paletteEvent, palletElementClick);
            initialColorContainer.delegate(".sp-thumb-el:nth-child(1)", paletteEvent, {
                ignore: true
            }, palletElementClick);
        }

        function updateSelectionPaletteFromStorage() {

            if (localStorageKey && window.localStorage) {

                // Migrate old palettes over to new format.  May want to remove this eventually.
                try {
                    var oldPalette = window.localStorage[localStorageKey].split(",#");
                    if (oldPalette.length > 1) {
                        delete window.localStorage[localStorageKey];
                        $.each(oldPalette, function(i, c) {
                            addColorToSelectionPalette(c);
                        });
                    }
                } catch (e) {}

                try {
                    selectionPalette = window.localStorage[localStorageKey].split(";");
                } catch (e) {}
            }
        }

        function addColorToSelectionPalette(color) {
            if (showSelectionPalette) {
                var rgb = tinycolor(color).toRgbString();
                if (!paletteLookup[rgb] && $.inArray(rgb, selectionPalette) === -1) {
                    selectionPalette.push(rgb);
                    while (selectionPalette.length > maxSelectionSize) {
                        selectionPalette.shift();
                    }
                }

                if (localStorageKey && window.localStorage) {
                    try {
                        window.localStorage[localStorageKey] = selectionPalette.join(";");
                    } catch (e) {}
                }
            }
        }

        function getUniqueSelectionPalette() {
            var unique = [];
            if (opts.showPalette) {
                for (i = 0; i < selectionPalette.length; i++) {
                    var rgb = tinycolor(selectionPalette[i]).toRgbString();

                    if (!paletteLookup[rgb]) {
                        unique.push(selectionPalette[i]);
                    }
                }
            }

            return unique.reverse().slice(0, opts.maxSelectionSize);
        }

        function drawPalette() {

            var currentColor = get();

            var html = $.map(paletteArray, function(palette, i) {
                return paletteTemplate(palette, currentColor, "sp-palette-row sp-palette-row-" + i, opts.preferredFormat);
            });

            updateSelectionPaletteFromStorage();

            if (selectionPalette) {
                html.push(paletteTemplate(getUniqueSelectionPalette(), currentColor, "sp-palette-row sp-palette-row-selection", opts.preferredFormat));
            }

            paletteContainer.html(html.join(""));
        }

        function drawInitial() {
            if (opts.showInitial) {
                var initial = colorOnShow;
                var current = get();
                initialColorContainer.html(paletteTemplate([initial, current], current, "sp-palette-row-initial", opts.preferredFormat));
            }
        }

        function dragStart() {
            if (dragHeight <= 0 || dragWidth <= 0 || slideHeight <= 0) {
                reflow();
            }
            container.addClass(draggingClass);
            shiftMovementDirection = null;
            boundElement.trigger('dragstart.spectrum', [get()]);
        }

        function dragStop() {
            container.removeClass(draggingClass);
            boundElement.trigger('dragstop.spectrum', [get()]);
        }

        function setFromTextInput() {

            var value = textInput.val();

            if ((value === null || value === "") && allowEmpty) {
                set(null);
                updateOriginalInput(true);
            } else {
                var tiny = tinycolor(value);
                if (tiny.ok) {
                    set(tiny);
                    updateOriginalInput(true);
                } else {
                    textInput.addClass("sp-validation-error");
                }
            }
        }

        function toggle() {
            if (visible) {
                hide();
            } else {
                show();
            }
        }

        function show() {
            var event = $.Event('beforeShow.spectrum');

            if (visible) {
                reflow();
                return;
            }

            boundElement.trigger(event, [get()]);

            if (callbacks.beforeShow(get()) === false || event.isDefaultPrevented()) {
                return;
            }

            hideAll();
            visible = true;

            $(doc).bind("click.spectrum", hide);
            $(window).bind("resize.spectrum", resize);
            replacer.addClass("sp-active");
            container.removeClass("sp-hidden");

            reflow();
            updateUI();

            colorOnShow = get();

            drawInitial();
            callbacks.show(colorOnShow);
            boundElement.trigger('show.spectrum', [colorOnShow]);
        }

        function hide(e) {

            // Return on right click
            if (e && e.type == "click" && e.button == 2) {
                return;
            }

            // Return if hiding is unnecessary
            if (!visible || flat) {
                return;
            }
            visible = false;

            $(doc).unbind("click.spectrum", hide);
            $(window).unbind("resize.spectrum", resize);

            replacer.removeClass("sp-active");
            container.addClass("sp-hidden");

            var colorHasChanged = !tinycolor.equals(get(), colorOnShow);

            if (colorHasChanged) {
                if (clickoutFiresChange && e !== "cancel") {
                    updateOriginalInput(true);
                } else {
                    revert();
                }
            }

            callbacks.hide(get());
            boundElement.trigger('hide.spectrum', [get()]);
        }

        function revert() {
            set(colorOnShow, true);
        }

        function set(color, ignoreFormatChange) {
            if (tinycolor.equals(color, get())) {
                // Update UI just in case a validation error needs
                // to be cleared.
                updateUI();
                return;
            }

            var newColor, newHsv;
            if (!color && allowEmpty) {
                isEmpty = true;
            } else {
                isEmpty = false;
                newColor = tinycolor(color);
                newHsv = newColor.toHsv();

                currentHue = (newHsv.h % 360) / 360;
                currentSaturation = newHsv.s;
                currentValue = newHsv.v;
                currentAlpha = newHsv.a;
            }
            updateUI();

            if (newColor && newColor.ok && !ignoreFormatChange) {
                currentPreferredFormat = preferredFormat || newColor.format;
            }
        }

        function get(opts) {
            opts = opts || {};

            if (allowEmpty && isEmpty) {
                return null;
            }

            return tinycolor.fromRatio({
                h: currentHue,
                s: currentSaturation,
                v: currentValue,
                a: Math.round(currentAlpha * 100) / 100
            }, {
                format: opts.format || currentPreferredFormat
            });
        }

        function isValid() {
            return !textInput.hasClass("sp-validation-error");
        }

        function move() {
            updateUI();

            callbacks.move(get());
            boundElement.trigger('move.spectrum', [get()]);
        }

        function updateUI() {

            textInput.removeClass("sp-validation-error");

            updateHelperLocations();

            // Update dragger background color (gradients take care of saturation and value).
            var flatColor = tinycolor.fromRatio({
                h: currentHue,
                s: 1,
                v: 1
            });
            dragger.css("background-color", flatColor.toHexString());

            // Get a format that alpha will be included in (hex and names ignore alpha)
            var format = currentPreferredFormat;
            if (currentAlpha < 1 && !(currentAlpha === 0 && format === "name")) {
                if (format === "hex" || format === "hex3" || format === "hex6" || format === "name") {
                    format = "rgb";
                }
            }

            var realColor = get({
                    format: format
                }),
                displayColor = '';

            //reset background info for preview element
            previewElement.removeClass("sp-clear-display");
            previewElement.css('background-color', 'transparent');

            if (!realColor && allowEmpty) {
                // Update the replaced elements background with icon indicating no color selection
                previewElement.addClass("sp-clear-display");
            } else {
                var realHex = realColor.toHexString(),
                    realRgb = realColor.toRgbString();

                // Update the replaced elements background color (with actual selected color)
                if (rgbaSupport || realColor.alpha === 1) {
                    previewElement.css("background-color", realRgb);
                } else {
                    previewElement.css("background-color", "transparent");
                    previewElement.css("filter", realColor.toFilter());
                }

                if (opts.showAlpha) {
                    var rgb = realColor.toRgb();
                    rgb.a = 0;
                    var realAlpha = tinycolor(rgb).toRgbString();
                    var gradient = "linear-gradient(left, " + realAlpha + ", " + realHex + ")";

                    if (IE) {
                        alphaSliderInner.css("filter", tinycolor(realAlpha).toFilter({
                            gradientType: 1
                        }, realHex));
                    } else {
                        alphaSliderInner.css("background", "-webkit-" + gradient);
                        alphaSliderInner.css("background", "-moz-" + gradient);
                        alphaSliderInner.css("background", "-ms-" + gradient);
                        // Use current syntax gradient on unprefixed property.
                        alphaSliderInner.css("background",
                            "linear-gradient(to right, " + realAlpha + ", " + realHex + ")");
                    }
                }

                displayColor = realColor.toString(format);
            }

            // Update the text entry input as it changes happen
            if (opts.showInput) {
                textInput.val(displayColor);
            }

            if (opts.showPalette) {
                drawPalette();
            }

            drawInitial();
        }

        function updateHelperLocations() {
            var s = currentSaturation;
            var v = currentValue;

            if (allowEmpty && isEmpty) {
                //if selected color is empty, hide the helpers
                alphaSlideHelper.hide();
                slideHelper.hide();
                dragHelper.hide();
            } else {
                //make sure helpers are visible
                alphaSlideHelper.show();
                slideHelper.show();
                dragHelper.show();

                // Where to show the little circle in that displays your current selected color
                var dragX = s * dragWidth;
                var dragY = dragHeight - (v * dragHeight);
                dragX = Math.max(-dragHelperHeight,
                    Math.min(dragWidth - dragHelperHeight, dragX - dragHelperHeight)
                );
                dragY = Math.max(-dragHelperHeight,
                    Math.min(dragHeight - dragHelperHeight, dragY - dragHelperHeight)
                );
                dragHelper.css({
                    "top": dragY + "px",
                    "left": dragX + "px"
                });

                var alphaX = currentAlpha * alphaWidth;
                alphaSlideHelper.css({
                    "left": (alphaX - (alphaSlideHelperWidth / 2)) + "px"
                });

                // Where to show the bar that displays your current selected hue
                var slideY = (currentHue) * slideHeight;
                slideHelper.css({
                    "top": (slideY - slideHelperHeight) + "px"
                });
            }
        }

        function updateOriginalInput(fireCallback) {
            var color = get(),
                displayColor = '',
                hasChanged = !tinycolor.equals(color, colorOnShow);

            if (color) {
                displayColor = color.toString(currentPreferredFormat);
                // Update the selection palette with the current color
                addColorToSelectionPalette(color);
            }

            if (isInput) {
                boundElement.val(displayColor);
            }

            colorOnShow = color;

            if (fireCallback && hasChanged) {
                callbacks.change(color);
                boundElement.trigger('change', [color]);
            }
        }

        function reflow() {
            dragWidth = dragger.width();
            dragHeight = dragger.height();
            dragHelperHeight = dragHelper.height();
            slideWidth = slider.width();
            slideHeight = slider.height();
            slideHelperHeight = slideHelper.height();
            alphaWidth = alphaSlider.width();
            alphaSlideHelperWidth = alphaSlideHelper.width();

            if (!flat) {
                container.css("position", "absolute");
                container.offset(getOffset(container, offsetElement));
            }

            updateHelperLocations();

            if (opts.showPalette) {
                drawPalette();
            }

            boundElement.trigger('reflow.spectrum');
        }

        function destroy() {
            boundElement.show();
            offsetElement.unbind("click.spectrum touchstart.spectrum");
            container.remove();
            replacer.remove();
            spectrums[spect.id] = null;
        }

        function option(optionName, optionValue) {
            if (optionName === undefined) {
                return $.extend({}, opts);
            }
            if (optionValue === undefined) {
                return opts[optionName];
            }

            opts[optionName] = optionValue;
            applyOptions();
        }

        function enable() {
            disabled = false;
            boundElement.attr("disabled", false);
            offsetElement.removeClass("sp-disabled");
        }

        function disable() {
            hide();
            disabled = true;
            boundElement.attr("disabled", true);
            offsetElement.addClass("sp-disabled");
        }

        initialize();

        var spect = {
            show: show,
            hide: hide,
            toggle: toggle,
            reflow: reflow,
            option: option,
            enable: enable,
            disable: disable,
            set: function(c) {
                set(c);
                updateOriginalInput();
            },
            get: get,
            destroy: destroy,
            container: container
        };

        spect.id = spectrums.push(spect) - 1;

        return spect;
    }

    /**
     * checkOffset - get the offset below/above and left/right element depending on screen position
     * Thanks https://github.com/jquery/jquery-ui/blob/master/ui/jquery.ui.datepicker.js
     */
    function getOffset(picker, input) {
        var extraY = 0;
        var dpWidth = picker.outerWidth();
        var dpHeight = picker.outerHeight();
        var inputHeight = input.outerHeight();
        var doc = picker[0].ownerDocument;
        var docElem = doc.documentElement;
        var viewWidth = docElem.clientWidth + $(doc).scrollLeft();
        var viewHeight = docElem.clientHeight + $(doc).scrollTop();
        var offset = input.offset();
        offset.top += inputHeight;

        offset.left -=
            Math.min(offset.left, (offset.left + dpWidth > viewWidth && viewWidth > dpWidth) ?
                Math.abs(offset.left + dpWidth - viewWidth) : 0);

        offset.top -=
            Math.min(offset.top, ((offset.top + dpHeight > viewHeight && viewHeight > dpHeight) ?
                Math.abs(dpHeight + inputHeight - extraY) : extraY));

        return offset;
    }

    /**
     * noop - do nothing
     */
    function noop() {

    }

    /**
     * stopPropagation - makes the code only doing this a little easier to read in line
     */
    function stopPropagation(e) {
        e.stopPropagation();
    }

    /**
     * Create a function bound to a given object
     * Thanks to underscore.js
     */
    function bind(func, obj) {
        var slice = Array.prototype.slice;
        var args = slice.call(arguments, 2);
        return function() {
            return func.apply(obj, args.concat(slice.call(arguments)));
        };
    }

    /**
     * Lightweight drag helper.  Handles containment within the element, so that
     * when dragging, the x is within [0,element.width] and y is within [0,element.height]
     */
    function draggable(element, onmove, onstart, onstop) {
        onmove = onmove || function() {};
        onstart = onstart || function() {};
        onstop = onstop || function() {};
        var doc = element.ownerDocument || document;
        var dragging = false;
        var offset = {};
        var maxHeight = 0;
        var maxWidth = 0;
        var hasTouch = ('ontouchstart' in window);

        var duringDragEvents = {};
        duringDragEvents["selectstart"] = prevent;
        duringDragEvents["dragstart"] = prevent;
        duringDragEvents["touchmove mousemove"] = move;
        duringDragEvents["touchend mouseup"] = stop;

        function prevent(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.returnValue = false;
        }

        function move(e) {
            if (dragging) {
                // Mouseup happened outside of window
                if (IE && document.documentMode < 9 && !e.button) {
                    return stop();
                }

                var touches = e.originalEvent.touches;
                var pageX = touches ? touches[0].pageX : e.pageX;
                var pageY = touches ? touches[0].pageY : e.pageY;

                var dragX = Math.max(0, Math.min(pageX - offset.left, maxWidth));
                var dragY = Math.max(0, Math.min(pageY - offset.top, maxHeight));

                if (hasTouch) {
                    // Stop scrolling in iOS
                    prevent(e);
                }

                onmove.apply(element, [dragX, dragY, e]);
            }
        }

        function start(e) {
            var rightclick = (e.which) ? (e.which == 3) : (e.button == 2);
            var touches = e.originalEvent.touches;

            if (!rightclick && !dragging) {
                if (onstart.apply(element, arguments) !== false) {
                    dragging = true;
                    maxHeight = $(element).height();
                    maxWidth = $(element).width();
                    offset = $(element).offset();

                    $(doc).bind(duringDragEvents);
                    $(doc.body).addClass("sp-dragging");

                    if (!hasTouch) {
                        move(e);
                    }

                    prevent(e);
                }
            }
        }

        function stop() {
            if (dragging) {
                $(doc).unbind(duringDragEvents);
                $(doc.body).removeClass("sp-dragging");
                onstop.apply(element, arguments);
            }
            dragging = false;
        }

        $(element).bind("touchstart mousedown", start);
    }

    function throttle(func, wait, debounce) {
        var timeout;
        return function() {
            var context = this,
                args = arguments;
            var throttler = function() {
                timeout = null;
                func.apply(context, args);
            };
            if (debounce) clearTimeout(timeout);
            if (debounce || !timeout) timeout = setTimeout(throttler, wait);
        };
    }

    function log() { /* jshint -W021 */
        if (window.console) {
            if (Function.prototype.bind) log = Function.prototype.bind.call(console.log, console);
            else log = function() {
                Function.prototype.apply.call(console.log, console, arguments);
            };
            log.apply(this, arguments);
        }
    }

    /**
     * Define a jQuery plugin
     */
    var dataID = "spectrum.id";
    $.fn.spectrum = function(opts, extra) {

        if (typeof opts == "string") {

            var returnValue = this;
            var args = Array.prototype.slice.call(arguments, 1);

            this.each(function() {
                var spect = spectrums[$(this).data(dataID)];
                if (spect) {
                    var method = spect[opts];
                    if (!method) {
                        throw new Error("Spectrum: no such method: '" + opts + "'");
                    }

                    if (opts == "get") {
                        returnValue = spect.get();
                    } else if (opts == "container") {
                        returnValue = spect.container;
                    } else if (opts == "option") {
                        returnValue = spect.option.apply(spect, args);
                    } else if (opts == "destroy") {
                        spect.destroy();
                        $(this).removeData(dataID);
                    } else {
                        method.apply(spect, args);
                    }
                }
            });

            return returnValue;
        }

        // Initializing a new instance of spectrum
        return this.spectrum("destroy").each(function() {
            var options = $.extend({}, opts, $(this).data());
            var spect = spectrum(this, options);
            $(this).data(dataID, spect.id);
        });
    };

    $.fn.spectrum.load = true;
    $.fn.spectrum.loadOpts = {};
    $.fn.spectrum.draggable = draggable;
    $.fn.spectrum.defaults = defaultOpts;

    $.spectrum = {};
    $.spectrum.localization = {};
    $.spectrum.palettes = {};

    $.fn.spectrum.processNativeColorInputs = function() {
        if (!inputTypeColorSupport) {
            $("input[type=color]").spectrum({
                preferredFormat: "hex6"
            });
        }
    };

    // TinyColor v0.9.17
    // https://github.com/bgrins/TinyColor
    // 2013-08-10, Brian Grinstead, MIT License

    (function() {

        var trimLeft = /^[\s,#]+/,
            trimRight = /\s+$/,
            tinyCounter = 0,
            math = Math,
            mathRound = math.round,
            mathMin = math.min,
            mathMax = math.max,
            mathRandom = math.random;

        function tinycolor(color, opts) {

            color = (color) ? color : '';
            opts = opts || {};

            // If input is already a tinycolor, return itself
            if (typeof color == "object" && color.hasOwnProperty("_tc_id")) {
                return color;
            }

            var rgb = inputToRGB(color);
            var r = rgb.r,
                g = rgb.g,
                b = rgb.b,
                a = rgb.a,
                roundA = mathRound(100 * a) / 100,
                format = opts.format || rgb.format;

            // Don't let the range of [0,255] come back in [0,1].
            // Potentially lose a little bit of precision here, but will fix issues where
            // .5 gets interpreted as half of the total, instead of half of 1
            // If it was supposed to be 128, this was already taken care of by `inputToRgb`
            if (r < 1) {
                r = mathRound(r);
            }
            if (g < 1) {
                g = mathRound(g);
            }
            if (b < 1) {
                b = mathRound(b);
            }

            return {
                ok: rgb.ok,
                format: format,
                _tc_id: tinyCounter++,
                alpha: a,
                getAlpha: function() {
                    return a;
                },
                setAlpha: function(value) {
                    a = boundAlpha(value);
                    roundA = mathRound(100 * a) / 100;
                },
                toHsv: function() {
                    var hsv = rgbToHsv(r, g, b);
                    return {
                        h: hsv.h * 360,
                        s: hsv.s,
                        v: hsv.v,
                        a: a
                    };
                },
                toHsvString: function() {
                    var hsv = rgbToHsv(r, g, b);
                    var h = mathRound(hsv.h * 360),
                        s = mathRound(hsv.s * 100),
                        v = mathRound(hsv.v * 100);
                    return (a == 1) ?
                        "hsv(" + h + ", " + s + "%, " + v + "%)" :
                        "hsva(" + h + ", " + s + "%, " + v + "%, " + roundA + ")";
                },
                toHsl: function() {
                    var hsl = rgbToHsl(r, g, b);
                    return {
                        h: hsl.h * 360,
                        s: hsl.s,
                        l: hsl.l,
                        a: a
                    };
                },
                toHslString: function() {
                    var hsl = rgbToHsl(r, g, b);
                    var h = mathRound(hsl.h * 360),
                        s = mathRound(hsl.s * 100),
                        l = mathRound(hsl.l * 100);
                    return (a == 1) ?
                        "hsl(" + h + ", " + s + "%, " + l + "%)" :
                        "hsla(" + h + ", " + s + "%, " + l + "%, " + roundA + ")";
                },
                toHex: function(allow3Char) {
                    return rgbToHex(r, g, b, allow3Char);
                },
                toHexString: function(allow3Char) {
                    return '#' + this.toHex(allow3Char);
                },
                toHex8: function() {
                    return rgbaToHex(r, g, b, a);
                },
                toHex8String: function() {
                    return '#' + this.toHex8();
                },
                toRgb: function() {
                    return {
                        r: mathRound(r),
                        g: mathRound(g),
                        b: mathRound(b),
                        a: a
                    };
                },
                toRgbString: function() {
                    return (a == 1) ?
                        "rgb(" + mathRound(r) + ", " + mathRound(g) + ", " + mathRound(b) + ")" :
                        "rgba(" + mathRound(r) + ", " + mathRound(g) + ", " + mathRound(b) + ", " + roundA + ")";
                },
                toPercentageRgb: function() {
                    return {
                        r: mathRound(bound01(r, 255) * 100) + "%",
                        g: mathRound(bound01(g, 255) * 100) + "%",
                        b: mathRound(bound01(b, 255) * 100) + "%",
                        a: a
                    };
                },
                toPercentageRgbString: function() {
                    return (a == 1) ?
                        "rgb(" + mathRound(bound01(r, 255) * 100) + "%, " + mathRound(bound01(g, 255) * 100) + "%, " + mathRound(bound01(b, 255) * 100) + "%)" :
                        "rgba(" + mathRound(bound01(r, 255) * 100) + "%, " + mathRound(bound01(g, 255) * 100) + "%, " + mathRound(bound01(b, 255) * 100) + "%, " + roundA + ")";
                },
                toName: function() {
                    if (a === 0) {
                        return "transparent";
                    }

                    return hexNames[rgbToHex(r, g, b, true)] || false;
                },
                toFilter: function(secondColor) {
                    var hex8String = '#' + rgbaToHex(r, g, b, a);
                    var secondHex8String = hex8String;
                    var gradientType = opts && opts.gradientType ? "GradientType = 1, " : "";

                    if (secondColor) {
                        var s = tinycolor(secondColor);
                        secondHex8String = s.toHex8String();
                    }

                    return "progid:DXImageTransform.Microsoft.gradient(" + gradientType + "startColorstr=" + hex8String + ",endColorstr=" + secondHex8String + ")";
                },
                toString: function(format) {
                    var formatSet = !!format;
                    format = format || this.format;

                    var formattedString = false;
                    var hasAlphaAndFormatNotSet = !formatSet && a < 1 && a > 0;
                    var formatWithAlpha = hasAlphaAndFormatNotSet && (format === "hex" || format === "hex6" || format === "hex3" || format === "name");

                    if (format === "rgb") {
                        formattedString = this.toRgbString();
                    }
                    if (format === "prgb") {
                        formattedString = this.toPercentageRgbString();
                    }
                    if (format === "hex" || format === "hex6") {
                        formattedString = this.toHexString();
                    }
                    if (format === "hex3") {
                        formattedString = this.toHexString(true);
                    }
                    if (format === "hex8") {
                        formattedString = this.toHex8String();
                    }
                    if (format === "name") {
                        formattedString = this.toName();
                    }
                    if (format === "hsl") {
                        formattedString = this.toHslString();
                    }
                    if (format === "hsv") {
                        formattedString = this.toHsvString();
                    }

                    if (formatWithAlpha) {
                        return this.toRgbString();
                    }

                    return formattedString || this.toHexString();
                }
            };
        }

        // If input is an object, force 1 into "1.0" to handle ratios properly
        // String input requires "1.0" as input, so 1 will be treated as 1
        tinycolor.fromRatio = function(color, opts) {
            if (typeof color == "object") {
                var newColor = {};
                for (var i in color) {
                    if (color.hasOwnProperty(i)) {
                        if (i === "a") {
                            newColor[i] = color[i];
                        } else {
                            newColor[i] = convertToPercentage(color[i]);
                        }
                    }
                }
                color = newColor;
            }

            return tinycolor(color, opts);
        };

        // Given a string or object, convert that input to RGB
        // Possible string inputs:
        //
        //     "red"
        //     "#f00" or "f00"
        //     "#ff0000" or "ff0000"
        //     "#ff000000" or "ff000000"
        //     "rgb 255 0 0" or "rgb (255, 0, 0)"
        //     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
        //     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
        //     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
        //     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
        //     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
        //     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
        //
        function inputToRGB(color) {

            var rgb = {
                r: 0,
                g: 0,
                b: 0
            };
            var a = 1;
            var ok = false;
            var format = false;

            if (typeof color == "string") {
                color = stringInputToObject(color);
            }

            if (typeof color == "object") {
                if (color.hasOwnProperty("r") && color.hasOwnProperty("g") && color.hasOwnProperty("b")) {
                    rgb = rgbToRgb(color.r, color.g, color.b);
                    ok = true;
                    format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
                } else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("v")) {
                    color.s = convertToPercentage(color.s);
                    color.v = convertToPercentage(color.v);
                    rgb = hsvToRgb(color.h, color.s, color.v);
                    ok = true;
                    format = "hsv";
                } else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("l")) {
                    color.s = convertToPercentage(color.s);
                    color.l = convertToPercentage(color.l);
                    rgb = hslToRgb(color.h, color.s, color.l);
                    ok = true;
                    format = "hsl";
                }

                if (color.hasOwnProperty("a")) {
                    a = color.a;
                }
            }

            a = boundAlpha(a);

            return {
                ok: ok,
                format: color.format || format,
                r: mathMin(255, mathMax(rgb.r, 0)),
                g: mathMin(255, mathMax(rgb.g, 0)),
                b: mathMin(255, mathMax(rgb.b, 0)),
                a: a
            };
        }


        // Conversion Functions
        // --------------------

        // `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
        // <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

        // `rgbToRgb`
        // Handle bounds / percentage checking to conform to CSS color spec
        // <http://www.w3.org/TR/css3-color/>
        // *Assumes:* r, g, b in [0, 255] or [0, 1]
        // *Returns:* { r, g, b } in [0, 255]
        function rgbToRgb(r, g, b) {
            return {
                r: bound01(r, 255) * 255,
                g: bound01(g, 255) * 255,
                b: bound01(b, 255) * 255
            };
        }

        // `rgbToHsl`
        // Converts an RGB color value to HSL.
        // *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
        // *Returns:* { h, s, l } in [0,1]
        function rgbToHsl(r, g, b) {

            r = bound01(r, 255);
            g = bound01(g, 255);
            b = bound01(b, 255);

            var max = mathMax(r, g, b),
                min = mathMin(r, g, b);
            var h, s, l = (max + min) / 2;

            if (max == min) {
                h = s = 0; // achromatic
            } else {
                var d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r:
                        h = (g - b) / d + (g < b ? 6 : 0);
                        break;
                    case g:
                        h = (b - r) / d + 2;
                        break;
                    case b:
                        h = (r - g) / d + 4;
                        break;
                }

                h /= 6;
            }

            return {
                h: h,
                s: s,
                l: l
            };
        }

        // `hslToRgb`
        // Converts an HSL color value to RGB.
        // *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
        // *Returns:* { r, g, b } in the set [0, 255]
        function hslToRgb(h, s, l) {
            var r, g, b;

            h = bound01(h, 360);
            s = bound01(s, 100);
            l = bound01(l, 100);

            function hue2rgb(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            }

            if (s === 0) {
                r = g = b = l; // achromatic
            } else {
                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }

            return {
                r: r * 255,
                g: g * 255,
                b: b * 255
            };
        }

        // `rgbToHsv`
        // Converts an RGB color value to HSV
        // *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
        // *Returns:* { h, s, v } in [0,1]
        function rgbToHsv(r, g, b) {

            r = bound01(r, 255);
            g = bound01(g, 255);
            b = bound01(b, 255);

            var max = mathMax(r, g, b),
                min = mathMin(r, g, b);
            var h, s, v = max;

            var d = max - min;
            s = max === 0 ? 0 : d / max;

            if (max == min) {
                h = 0; // achromatic
            } else {
                switch (max) {
                    case r:
                        h = (g - b) / d + (g < b ? 6 : 0);
                        break;
                    case g:
                        h = (b - r) / d + 2;
                        break;
                    case b:
                        h = (r - g) / d + 4;
                        break;
                }
                h /= 6;
            }
            return {
                h: h,
                s: s,
                v: v
            };
        }

        // `hsvToRgb`
        // Converts an HSV color value to RGB.
        // *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
        // *Returns:* { r, g, b } in the set [0, 255]
        function hsvToRgb(h, s, v) {

            h = bound01(h, 360) * 6;
            s = bound01(s, 100);
            v = bound01(v, 100);

            var i = math.floor(h),
                f = h - i,
                p = v * (1 - s),
                q = v * (1 - f * s),
                t = v * (1 - (1 - f) * s),
                mod = i % 6,
                r = [v, q, p, p, t, v][mod],
                g = [t, v, v, q, p, p][mod],
                b = [p, p, t, v, v, q][mod];

            return {
                r: r * 255,
                g: g * 255,
                b: b * 255
            };
        }

        // `rgbToHex`
        // Converts an RGB color to hex
        // Assumes r, g, and b are contained in the set [0, 255]
        // Returns a 3 or 6 character hex
        function rgbToHex(r, g, b, allow3Char) {

                var hex = [
                    pad2(mathRound(r).toString(16)),
                    pad2(mathRound(g).toString(16)),
                    pad2(mathRound(b).toString(16))
                ];

                // Return a 3 character hex if possible
                if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
                    return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
                }

                return hex.join("");
            }
            // `rgbaToHex`
            // Converts an RGBA color plus alpha transparency to hex
            // Assumes r, g, b and a are contained in the set [0, 255]
            // Returns an 8 character hex
        function rgbaToHex(r, g, b, a) {

            var hex = [
                pad2(convertDecimalToHex(a)),
                pad2(mathRound(r).toString(16)),
                pad2(mathRound(g).toString(16)),
                pad2(mathRound(b).toString(16))
            ];

            return hex.join("");
        }

        // `equals`
        // Can be called with any tinycolor input
        tinycolor.equals = function(color1, color2) {
            if (!color1 || !color2) {
                return false;
            }
            return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
        };
        tinycolor.random = function() {
            return tinycolor.fromRatio({
                r: mathRandom(),
                g: mathRandom(),
                b: mathRandom()
            });
        };


        // Modification Functions
        // ----------------------
        // Thanks to less.js for some of the basics here
        // <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>

        tinycolor.desaturate = function(color, amount) {
            amount = (amount === 0) ? 0 : (amount || 10);
            var hsl = tinycolor(color).toHsl();
            hsl.s -= amount / 100;
            hsl.s = clamp01(hsl.s);
            return tinycolor(hsl);
        };
        tinycolor.saturate = function(color, amount) {
            amount = (amount === 0) ? 0 : (amount || 10);
            var hsl = tinycolor(color).toHsl();
            hsl.s += amount / 100;
            hsl.s = clamp01(hsl.s);
            return tinycolor(hsl);
        };
        tinycolor.greyscale = function(color) {
            return tinycolor.desaturate(color, 100);
        };
        tinycolor.lighten = function(color, amount) {
            amount = (amount === 0) ? 0 : (amount || 10);
            var hsl = tinycolor(color).toHsl();
            hsl.l += amount / 100;
            hsl.l = clamp01(hsl.l);
            return tinycolor(hsl);
        };
        tinycolor.darken = function(color, amount) {
            amount = (amount === 0) ? 0 : (amount || 10);
            var hsl = tinycolor(color).toHsl();
            hsl.l -= amount / 100;
            hsl.l = clamp01(hsl.l);
            return tinycolor(hsl);
        };
        tinycolor.complement = function(color) {
            var hsl = tinycolor(color).toHsl();
            hsl.h = (hsl.h + 180) % 360;
            return tinycolor(hsl);
        };


        // Combination Functions
        // ---------------------
        // Thanks to jQuery xColor for some of the ideas behind these
        // <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

        tinycolor.triad = function(color) {
            var hsl = tinycolor(color).toHsl();
            var h = hsl.h;
            return [
                tinycolor(color),
                tinycolor({
                    h: (h + 120) % 360,
                    s: hsl.s,
                    l: hsl.l
                }),
                tinycolor({
                    h: (h + 240) % 360,
                    s: hsl.s,
                    l: hsl.l
                })
            ];
        };
        tinycolor.tetrad = function(color) {
            var hsl = tinycolor(color).toHsl();
            var h = hsl.h;
            return [
                tinycolor(color),
                tinycolor({
                    h: (h + 90) % 360,
                    s: hsl.s,
                    l: hsl.l
                }),
                tinycolor({
                    h: (h + 180) % 360,
                    s: hsl.s,
                    l: hsl.l
                }),
                tinycolor({
                    h: (h + 270) % 360,
                    s: hsl.s,
                    l: hsl.l
                })
            ];
        };
        tinycolor.splitcomplement = function(color) {
            var hsl = tinycolor(color).toHsl();
            var h = hsl.h;
            return [
                tinycolor(color),
                tinycolor({
                    h: (h + 72) % 360,
                    s: hsl.s,
                    l: hsl.l
                }),
                tinycolor({
                    h: (h + 216) % 360,
                    s: hsl.s,
                    l: hsl.l
                })
            ];
        };
        tinycolor.analogous = function(color, results, slices) {
            results = results || 6;
            slices = slices || 30;

            var hsl = tinycolor(color).toHsl();
            var part = 360 / slices;
            var ret = [tinycolor(color)];

            for (hsl.h = ((hsl.h - (part * results >> 1)) + 720) % 360; --results;) {
                hsl.h = (hsl.h + part) % 360;
                ret.push(tinycolor(hsl));
            }
            return ret;
        };
        tinycolor.monochromatic = function(color, results) {
            results = results || 6;
            var hsv = tinycolor(color).toHsv();
            var h = hsv.h,
                s = hsv.s,
                v = hsv.v;
            var ret = [];
            var modification = 1 / results;

            while (results--) {
                ret.push(tinycolor({
                    h: h,
                    s: s,
                    v: v
                }));
                v = (v + modification) % 1;
            }

            return ret;
        };


        // Readability Functions
        // ---------------------
        // <http://www.w3.org/TR/AERT#color-contrast>

        // `readability`
        // Analyze the 2 colors and returns an object with the following properties:
        //    `brightness`: difference in brightness between the two colors
        //    `color`: difference in color/hue between the two colors
        tinycolor.readability = function(color1, color2) {
            var a = tinycolor(color1).toRgb();
            var b = tinycolor(color2).toRgb();
            var brightnessA = (a.r * 299 + a.g * 587 + a.b * 114) / 1000;
            var brightnessB = (b.r * 299 + b.g * 587 + b.b * 114) / 1000;
            var colorDiff = (
                Math.max(a.r, b.r) - Math.min(a.r, b.r) +
                Math.max(a.g, b.g) - Math.min(a.g, b.g) +
                Math.max(a.b, b.b) - Math.min(a.b, b.b)
            );

            return {
                brightness: Math.abs(brightnessA - brightnessB),
                color: colorDiff
            };
        };

        // `readable`
        // http://www.w3.org/TR/AERT#color-contrast
        // Ensure that foreground and background color combinations provide sufficient contrast.
        // *Example*
        //    tinycolor.readable("#000", "#111") => false
        tinycolor.readable = function(color1, color2) {
            var readability = tinycolor.readability(color1, color2);
            return readability.brightness > 125 && readability.color > 500;
        };

        // `mostReadable`
        // Given a base color and a list of possible foreground or background
        // colors for that base, returns the most readable color.
        // *Example*
        //    tinycolor.mostReadable("#123", ["#fff", "#000"]) => "#000"
        tinycolor.mostReadable = function(baseColor, colorList) {
            var bestColor = null;
            var bestScore = 0;
            var bestIsReadable = false;
            for (var i = 0; i < colorList.length; i++) {

                // We normalize both around the "acceptable" breaking point,
                // but rank brightness constrast higher than hue.

                var readability = tinycolor.readability(baseColor, colorList[i]);
                var readable = readability.brightness > 125 && readability.color > 500;
                var score = 3 * (readability.brightness / 125) + (readability.color / 500);

                if ((readable && !bestIsReadable) ||
                    (readable && bestIsReadable && score > bestScore) ||
                    ((!readable) && (!bestIsReadable) && score > bestScore)) {
                    bestIsReadable = readable;
                    bestScore = score;
                    bestColor = tinycolor(colorList[i]);
                }
            }
            return bestColor;
        };


        // Big List of Colors
        // ------------------
        // <http://www.w3.org/TR/css3-color/#svg-color>
        var names = tinycolor.names = {
            aliceblue: "f0f8ff",
            antiquewhite: "faebd7",
            aqua: "0ff",
            aquamarine: "7fffd4",
            azure: "f0ffff",
            beige: "f5f5dc",
            bisque: "ffe4c4",
            black: "000",
            blanchedalmond: "ffebcd",
            blue: "00f",
            blueviolet: "8a2be2",
            brown: "a52a2a",
            burlywood: "deb887",
            burntsienna: "ea7e5d",
            cadetblue: "5f9ea0",
            chartreuse: "7fff00",
            chocolate: "d2691e",
            coral: "ff7f50",
            cornflowerblue: "6495ed",
            cornsilk: "fff8dc",
            crimson: "dc143c",
            cyan: "0ff",
            darkblue: "00008b",
            darkcyan: "008b8b",
            darkgoldenrod: "b8860b",
            darkgray: "a9a9a9",
            darkgreen: "006400",
            darkgrey: "a9a9a9",
            darkkhaki: "bdb76b",
            darkmagenta: "8b008b",
            darkolivegreen: "556b2f",
            darkorange: "ff8c00",
            darkorchid: "9932cc",
            darkred: "8b0000",
            darksalmon: "e9967a",
            darkseagreen: "8fbc8f",
            darkslateblue: "483d8b",
            darkslategray: "2f4f4f",
            darkslategrey: "2f4f4f",
            darkturquoise: "00ced1",
            darkviolet: "9400d3",
            deeppink: "ff1493",
            deepskyblue: "00bfff",
            dimgray: "696969",
            dimgrey: "696969",
            dodgerblue: "1e90ff",
            firebrick: "b22222",
            floralwhite: "fffaf0",
            forestgreen: "228b22",
            fuchsia: "f0f",
            gainsboro: "dcdcdc",
            ghostwhite: "f8f8ff",
            gold: "ffd700",
            goldenrod: "daa520",
            gray: "808080",
            green: "008000",
            greenyellow: "adff2f",
            grey: "808080",
            honeydew: "f0fff0",
            hotpink: "ff69b4",
            indianred: "cd5c5c",
            indigo: "4b0082",
            ivory: "fffff0",
            khaki: "f0e68c",
            lavender: "e6e6fa",
            lavenderblush: "fff0f5",
            lawngreen: "7cfc00",
            lemonchiffon: "fffacd",
            lightblue: "add8e6",
            lightcoral: "f08080",
            lightcyan: "e0ffff",
            lightgoldenrodyellow: "fafad2",
            lightgray: "d3d3d3",
            lightgreen: "90ee90",
            lightgrey: "d3d3d3",
            lightpink: "ffb6c1",
            lightsalmon: "ffa07a",
            lightseagreen: "20b2aa",
            lightskyblue: "87cefa",
            lightslategray: "789",
            lightslategrey: "789",
            lightsteelblue: "b0c4de",
            lightyellow: "ffffe0",
            lime: "0f0",
            limegreen: "32cd32",
            linen: "faf0e6",
            magenta: "f0f",
            maroon: "800000",
            mediumaquamarine: "66cdaa",
            mediumblue: "0000cd",
            mediumorchid: "ba55d3",
            mediumpurple: "9370db",
            mediumseagreen: "3cb371",
            mediumslateblue: "7b68ee",
            mediumspringgreen: "00fa9a",
            mediumturquoise: "48d1cc",
            mediumvioletred: "c71585",
            midnightblue: "191970",
            mintcream: "f5fffa",
            mistyrose: "ffe4e1",
            moccasin: "ffe4b5",
            navajowhite: "ffdead",
            navy: "000080",
            oldlace: "fdf5e6",
            olive: "808000",
            olivedrab: "6b8e23",
            orange: "ffa500",
            orangered: "ff4500",
            orchid: "da70d6",
            palegoldenrod: "eee8aa",
            palegreen: "98fb98",
            paleturquoise: "afeeee",
            palevioletred: "db7093",
            papayawhip: "ffefd5",
            peachpuff: "ffdab9",
            peru: "cd853f",
            pink: "ffc0cb",
            plum: "dda0dd",
            powderblue: "b0e0e6",
            purple: "800080",
            red: "f00",
            rosybrown: "bc8f8f",
            royalblue: "4169e1",
            saddlebrown: "8b4513",
            salmon: "fa8072",
            sandybrown: "f4a460",
            seagreen: "2e8b57",
            seashell: "fff5ee",
            sienna: "a0522d",
            silver: "c0c0c0",
            skyblue: "87ceeb",
            slateblue: "6a5acd",
            slategray: "708090",
            slategrey: "708090",
            snow: "fffafa",
            springgreen: "00ff7f",
            steelblue: "4682b4",
            tan: "d2b48c",
            teal: "008080",
            thistle: "d8bfd8",
            tomato: "ff6347",
            turquoise: "40e0d0",
            violet: "ee82ee",
            wheat: "f5deb3",
            white: "fff",
            whitesmoke: "f5f5f5",
            yellow: "ff0",
            yellowgreen: "9acd32"
        };

        // Make it easy to access colors via `hexNames[hex]`
        var hexNames = tinycolor.hexNames = flip(names);


        // Utilities
        // ---------

        // `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
        function flip(o) {
            var flipped = {};
            for (var i in o) {
                if (o.hasOwnProperty(i)) {
                    flipped[o[i]] = i;
                }
            }
            return flipped;
        }

        // Return a valid alpha value [0,1] with all invalid values being set to 1
        function boundAlpha(a) {
            a = parseFloat(a);

            if (isNaN(a) || a < 0 || a > 1) {
                a = 1;
            }

            return a;
        }

        // Take input from [0, n] and return it as [0, 1]
        function bound01(n, max) {
            if (isOnePointZero(n)) {
                n = "100%";
            }

            var processPercent = isPercentage(n);
            n = mathMin(max, mathMax(0, parseFloat(n)));

            // Automatically convert percentage into number
            if (processPercent) {
                n = parseInt(n * max, 10) / 100;
            }

            // Handle floating point rounding errors
            if ((math.abs(n - max) < 0.000001)) {
                return 1;
            }

            // Convert into [0, 1] range if it isn't already
            return (n % max) / parseFloat(max);
        }

        // Force a number between 0 and 1
        function clamp01(val) {
            return mathMin(1, mathMax(0, val));
        }

        // Parse a base-16 hex value into a base-10 integer
        function parseIntFromHex(val) {
            return parseInt(val, 16);
        }

        // Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
        // <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
        function isOnePointZero(n) {
            return typeof n == "string" && n.indexOf('.') != -1 && parseFloat(n) === 1;
        }

        // Check to see if string passed in is a percentage
        function isPercentage(n) {
            return typeof n === "string" && n.indexOf('%') != -1;
        }

        // Force a hex value to have 2 characters
        function pad2(c) {
            return c.length == 1 ? '0' + c : '' + c;
        }

        // Replace a decimal with it's percentage value
        function convertToPercentage(n) {
            if (n <= 1) {
                n = (n * 100) + "%";
            }

            return n;
        }

        // Converts a decimal to a hex value
        function convertDecimalToHex(d) {
                return Math.round(parseFloat(d) * 255).toString(16);
            }
            // Converts a hex value to a decimal
        function convertHexToDecimal(h) {
            return (parseIntFromHex(h) / 255);
        }

        var matchers = (function() {

            // <http://www.w3.org/TR/css3-values/#integers>
            var CSS_INTEGER = "[-\\+]?\\d+%?";

            // <http://www.w3.org/TR/css3-values/#number-value>
            var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

            // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
            var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

            // Actual matching.
            // Parentheses and commas are optional, but not required.
            // Whitespace can take the place of commas or opening paren
            var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
            var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

            return {
                rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
                rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
                hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
                hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
                hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
                hex3: /^([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
                hex6: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
                hex8: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
            };
        })();

        // `stringInputToObject`
        // Permissive string parsing.  Take in a number of formats, and output an object
        // based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
        function stringInputToObject(color) {

            color = color.replace(trimLeft, '').replace(trimRight, '').toLowerCase();
            var named = false;
            if (names[color]) {
                color = names[color];
                named = true;
            } else if (color == 'transparent') {
                return {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 0,
                    format: "name"
                };
            }

            // Try to match string input using regular expressions.
            // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
            // Just return an object and let the conversion functions handle that.
            // This way the result will be the same whether the tinycolor is initialized with string or object.
            var match;
            if ((match = matchers.rgb.exec(color))) {
                return {
                    r: match[1],
                    g: match[2],
                    b: match[3]
                };
            }
            if ((match = matchers.rgba.exec(color))) {
                return {
                    r: match[1],
                    g: match[2],
                    b: match[3],
                    a: match[4]
                };
            }
            if ((match = matchers.hsl.exec(color))) {
                return {
                    h: match[1],
                    s: match[2],
                    l: match[3]
                };
            }
            if ((match = matchers.hsla.exec(color))) {
                return {
                    h: match[1],
                    s: match[2],
                    l: match[3],
                    a: match[4]
                };
            }
            if ((match = matchers.hsv.exec(color))) {
                return {
                    h: match[1],
                    s: match[2],
                    v: match[3]
                };
            }
            if ((match = matchers.hex8.exec(color))) {
                return {
                    a: convertHexToDecimal(match[1]),
                    r: parseIntFromHex(match[2]),
                    g: parseIntFromHex(match[3]),
                    b: parseIntFromHex(match[4]),
                    format: named ? "name" : "hex8"
                };
            }
            if ((match = matchers.hex6.exec(color))) {
                return {
                    r: parseIntFromHex(match[1]),
                    g: parseIntFromHex(match[2]),
                    b: parseIntFromHex(match[3]),
                    format: named ? "name" : "hex"
                };
            }
            if ((match = matchers.hex3.exec(color))) {
                return {
                    r: parseIntFromHex(match[1] + '' + match[1]),
                    g: parseIntFromHex(match[2] + '' + match[2]),
                    b: parseIntFromHex(match[3] + '' + match[3]),
                    format: named ? "name" : "hex"
                };
            }

            return false;
        }

        // Expose tinycolor to window, does not need to run in non-browser context.
        window.tinycolor = tinycolor;

    })();


    $(function() {
        if ($.fn.spectrum.load) {
            $.fn.spectrum.processNativeColorInputs();
        }
    });

})(window, jQuery);
(function(window) {
    /*
     Highcharts Editor v0.1 (2012-10-29)

     (c) 2009-2011 Highsoft Solutions AS

     License: www.highcharts.com/license
    */
    var EditorNS = {
        views: {},
        dataProviders: {},
        config: {
            views: [{
                type: "panel",
                title: "Import<br>1",
                name: "data"
            }, {
                type: "tab",
                title: "Templates<br>2",
                name: "templates",
                config: {
                    line: {
                        title: "Line charts",
                        templates: {
                            basic: {
                                title: "Line chart",
                                urlImg: "http://cloud.highcharts.com/images/abywon/0/136.svg",
                                config: {
                                    "chart--type": "line"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            withdatalabel: {
                                title: "With data labels",
                                urlImg: "http://cloud.highcharts.com/images/agonam/2/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values. Data labels by default displays the Y value."
                            },
                            spline: {
                                title: "Spline",
                                urlImg: "http://cloud.highcharts.com/images/upafes/1/136.svg",
                                config: {
                                    "chart--type": "spline"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            splineWithDataLabel: {
                                title: "Spline with labels",
                                urlImg: "http://cloud.highcharts.com/images/odopic/2/136.svg",
                                config: {
                                    "chart--type": "spline",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            logarithmic: {
                                title: "Logarithmic",
                                urlImg: "http://cloud.highcharts.com/images/abywon/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "yAxis--type": "logarithmic",
                                    "yAxis--minorTickInterval": "auto"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            stepLine: {
                                title: "Step line",
                                urlImg: "http://cloud.highcharts.com/images/akeduw/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "plotOptions-line--step": "left"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            stepLineWithDataLabel: {
                                title: "Step line with labels",
                                urlImg: "http://cloud.highcharts.com/images/oxenux/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "plotOptions-series-dataLabels--enabled": !0,
                                    "plotOptions-line--step": "left"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            inverted: {
                                title: "Inverted",
                                urlImg: "http://cloud.highcharts.com/images/ozojul/1/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "chart--inverted": !0
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            negative: {
                                title: "Negative color",
                                urlImg: "http://cloud.highcharts.com/images/uxyfys/2/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "series[0]--negativeColor": "#0088FF",
                                    "series[0]--color": "#FF0000"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            errorbar: {
                                title: "Error bar",
                                urlImg: "http://cloud.highcharts.com/images/ypewak/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "series[0]--type": "line",
                                    "series[1]--type": "errorbar"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for the series' Y values. and two columns for the error bar series maximum and minimum."
                            },
                            combination: {
                                title: "Combination chart",
                                urlImg: "http://cloud.highcharts.com/images/ynikoc/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "series[0]--type": "column"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for the series' Y values. and two columns for the error bar series maximum and minimum."
                            }
                        }
                    },
                    area: {
                        title: "Area charts",
                        templates: {
                            basic: {
                                title: "Basic",
                                urlImg: "http://cloud.highcharts.com/images/ecexev/2/136.svg",
                                config: {
                                    "chart--type": "area"
                                },
                                tooltipText: "Non-stacked area chart. Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            basicDatalabels: {
                                title: "Area with labels",
                                urlImg: "http://cloud.highcharts.com/images/atikon/0/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Non-stacked area chart with data labels. Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            stacked: {
                                title: "Stacked",
                                urlImg: "http://cloud.highcharts.com/images/inebav/1/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "plotOptions-series--stacking": "normal"
                                },
                                tooltipText: "Stacked area chart. Requires one column for X values or categories, subsequently one column for each series' Y values. The first data series is in the top of the stack."
                            },
                            stackedDatalabels: {
                                title: "Stacked with labels",
                                urlImg: "http://cloud.highcharts.com/images/iluryh/0/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "plotOptions-series--stacking": "normal",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Stacked area chart. Requires one column for X values or categories, subsequently one column for each series' Y values. The first data series is in the top of the stack."
                            },
                            percentage: {
                                title: "Stacked percentage",
                                urlImg: "http://cloud.highcharts.com/images/iporos/1/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "plotOptions-series--stacking": "percent"
                                },
                                tooltipText: "Stacked percentage area chart. Requires one column for X values or categories, subsequently one column for each series' Y values. The first data series is in the top of the stack."
                            },
                            inverted: {
                                title: "Inverted",
                                urlImg: "http://cloud.highcharts.com/images/yqenid/0/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "chart--inverted": !0
                                },
                                tooltipText: "Area chart with inverted axes. Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            invertedDatalabels: {
                                title: "Inverted with labels",
                                urlImg: "http://cloud.highcharts.com/images/acemyq/0/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "chart--inverted": !0,
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Area chart with inverted axes and data labels. Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            stepLine: {
                                title: "Step line",
                                urlImg: "http://cloud.highcharts.com/images/abutix/0/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "plotOptions-area--step": "left"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            negative: {
                                title: "Negative color",
                                urlImg: "http://cloud.highcharts.com/images/ydypal/0/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "series[0]--negativeColor": "#0088FF",
                                    "series[0]--color": "#FF0000"
                                },
                                tooltipText: "Displays negative values with an alternative color. Colors can be set in Customize -> Simple -> Data series. Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            arearange: {
                                title: "Arearange",
                                urlImg: "http://cloud.highcharts.com/images/udepat/0/136.svg",
                                config: {
                                    "chart--type": "arearange"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently two data column for each arearange series' Y values."
                            }
                        }
                    },
                    column: {
                        title: "Column charts",
                        templates: {
                            grouped: {
                                title: "Basic",
                                urlImg: "http://cloud.highcharts.com/images/ovobiq/1/136.svg",
                                config: {
                                    "chart--type": "column"
                                },
                                tooltipText: "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values."
                            },
                            groupedLabels: {
                                title: "With label",
                                urlImg: "http://cloud.highcharts.com/images/ivetir/1/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Grouped column chart with datalabels. Requires one data column for X values or categories, subsequently one data column for each series' Y values."
                            },
                            column3d: {
                                title: "Column 3D",
                                urlImg: "http://cloud.highcharts.com/images/ahyqyx/1/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--margin": 75,
                                    "chart-options3d--enabled": !0,
                                    "chart-options3d--alpha": 15,
                                    "chart-options3d--beta": 15,
                                    "chart-options3d--depth": 50,
                                    "chart-options3d--viewDistance": 15,
                                    "plotOptions-column--depth": 25
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values."
                            },
                            columnstacked: {
                                title: "Stacked",
                                urlImg: "http://cloud.highcharts.com/images/ycehiz/1/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "plotOptions-series--stacking": "normal"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values."
                            },
                            columnstackedLabels: {
                                title: "Stacked with labels",
                                urlImg: "http://cloud.highcharts.com/images/acijil/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "plotOptions-series--stacking": "normal",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values."
                            },
                            columnStacked3d: {
                                title: "Stacked 3D",
                                urlImg: "http://cloud.highcharts.com/images/ahyqyx/1/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--margin": 75,
                                    "chart-options3d--enabled": !0,
                                    "chart-options3d--alpha": 15,
                                    "chart-options3d--beta": 15,
                                    "chart-options3d--depth": 50,
                                    "chart-options3d--viewDistance": 15,
                                    "plotOptions-column--depth": 25,
                                    "plotOptions-series--stacking": "normal"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values."
                            },
                            columnStackedPercentage: {
                                title: "Stacked percent",
                                urlImg: "http://cloud.highcharts.com/images/ojixow/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "plotOptions-series--stacking": "percent"
                                },
                                tooltipText: "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values."
                            },
                            columnStackedPercentageLabels: {
                                title: "Stacked percent with labels",
                                urlImg: "http://cloud.highcharts.com/images/iwanyg/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "plotOptions-series--stacking": "percent",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values."
                            },
                            negative: {
                                title: "Negative color",
                                urlImg: "http://cloud.highcharts.com/images/yxajih/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "series[0]--negativeColor": "#0088FF",
                                    "series[0]--color": "#FF0000"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            multiColor: {
                                title: "Multi color",
                                urlImg: "http://cloud.highcharts.com/images/alyqyz/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "plotOptions-series--colorByPoint": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            logarithmic: {
                                title: "Logarithmic",
                                urlImg: "http://cloud.highcharts.com/images/igipeg/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "yAxis--type": "logarithmic",
                                    "yAxis--minorTickInterval": "auto"
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            columnrange: {
                                title: "Columnrange",
                                urlImg: "http://cloud.highcharts.com/images/ihilaq/0/136.svg",
                                config: {
                                    "chart--type": "columnrange"
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently two data column for each series' Y values (horizontal axis)."
                            },
                            columnrangeLabelsLabels: {
                                title: "Columnrange with labels",
                                urlImg: "http://cloud.highcharts.com/images/ojykiw/0/136.svg",
                                config: {
                                    "chart--type": "columnrange",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently two data column for each series' Y values (horizontal axis)."
                            },
                            packedColumns: {
                                title: "Packed columns",
                                urlImg: "http://cloud.highcharts.com/images/exypor/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "plotOptions-series--pointPadding": 0,
                                    "plotOptions-series--groupPadding": 0,
                                    "plotOptions-series--borderWidth": 0,
                                    "plotOptions-series--shadow": !1
                                },
                                tooltiptext: "Requires one data column for X values or categories, subsequently one data column for the series' Y values."
                            },
                            errorbar: {
                                title: "Error bar",
                                urlImg: "http://cloud.highcharts.com/images/icytes/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "series[1]--type": "errorbar"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for the series' Y values. and two columns for the error bar series maximum and minimum."
                            }
                        }
                    },
                    bar: {
                        title: "Bar charts",
                        templates: {
                            basic: {
                                title: "Basic bar",
                                urlImg: "http://cloud.highcharts.com/images/ovuvul/1/137.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            basicLabels: {
                                title: "Basic with labels",
                                urlImg: "http://cloud.highcharts.com/images/ovuvul/1/137.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            barstacked: {
                                title: "Stacked bar",
                                urlImg: "http://cloud.highcharts.com/images/epodat/3/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "plotOptions-series--stacking": "normal"
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            barstackedLabels: {
                                title: "Stacked with labels",
                                urlImg: "http://cloud.highcharts.com/images/otupaz/1/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "plotOptions-series--stacking": "normal",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            barstackedpercentage: {
                                title: "Stacked percent bar",
                                urlImg: "http://cloud.highcharts.com/images/yhekaq/2/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "plotOptions-series--stacking": "percent"
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            barstackedpercentageLabels: {
                                title: "Stacked percentage with labels",
                                urlImg: "http://cloud.highcharts.com/images/izoqyx/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "plotOptions-series--stacking": "percent",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            negative: {
                                title: "Negative color",
                                urlImg: "http://cloud.highcharts.com/images/efygam/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "series[0]--negativeColor": "#0088FF",
                                    "series[0]--color": "#FF0000"
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            multiColor: {
                                title: "Multi color",
                                urlImg: "http://cloud.highcharts.com/images/ogixak/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "plotOptions-series-colorByPoint": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            logarithmic: {
                                title: "Logarithmic",
                                urlImg: "http://cloud.highcharts.com/images/imykus/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "yAxis--type": "logarithmic",
                                    "yAxis--minorTickInterval": "auto"
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently one data column for each series' Y values (horizontal axis)."
                            },
                            barRange: {
                                title: "Horizontal columnrange",
                                urlImg: "http://cloud.highcharts.com/images/iqagel/0/136.svg",
                                config: {
                                    "chart--type": "columnrange",
                                    "chart--inverted": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently two data column for each series' Y values (horizontal axis)."
                            },
                            barRangeLabels: {
                                title: "Columnrange with labels",
                                urlImg: "http://cloud.highcharts.com/images/eracar/0/136.svg",
                                config: {
                                    "chart--type": "columnrange",
                                    "chart--inverted": !0,
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires one data column for X values or categories (vertical axis), subsequently two data column for each series' Y values (horizontal axis)."
                            },
                            packedColumns: {
                                title: "Packed columns",
                                urlImg: "http://cloud.highcharts.com/images/orixis/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "plotOptions-series--pointPadding": 0,
                                    "plotOptions-series--groupPadding": 0,
                                    "plotOptions-series--borderWidth": 0,
                                    "plotOptions-series--shadow": !1
                                },
                                tooltiptext: "Requires one data column for X values or categories, subsequently one data column for the series' Y values."
                            },
                            errorbar: {
                                title: "Error bar",
                                urlImg: "http://cloud.highcharts.com/images/omikax/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "chart--inverted": !0,
                                    "series[1]--type": "errorbar"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for the series' Y values. and two columns for the error bar series maximum and minimum."
                            }
                        }
                    },
                    scatterandbubble: {
                        title: "Scatter and Bubble",
                        templates: {
                            scatter: {
                                title: "Scatter chart",
                                urlImg: "http://cloud.highcharts.com/images/ezatat/0/136.svg",
                                config: {
                                    "chart--type": "scatter"
                                },
                                tooltipText: "Requires one data column for X values and one for Y values."
                            },
                            bubbles: {
                                title: "Bubble chart",
                                urlImg: "http://cloud.highcharts.com/images/usyfyw/0/136.svg",
                                config: {
                                    "chart--type": "bubble"
                                },
                                tooltipText: "Requires three data columns: one for X values, one for Y values and one for the size of the bubble (Z value)."
                            },
                            scatterLine: {
                                title: "Scatter with line",
                                urlImg: "http://cloud.highcharts.com/images/ydaqok/0/136.svg",
                                config: {
                                    "chart--type": "scatter",
                                    "plotOptions-series--lineWidth": 1
                                },
                                tooltipText: "Requires one data column for X values and one for Y values."
                            },
                            scatterLineNoMarker: {
                                title: "Scatter with line, no marker",
                                urlImg: "http://cloud.highcharts.com/images/uvepiw/0/136.svg",
                                config: {
                                    "chart--type": "scatter",
                                    "plotOptions-series--lineWidth": 1
                                },
                                tooltipText: "Requires one data column for X values and one for Y values."
                            }
                        }
                    },
                    pie: {
                        title: "Pie charts",
                        templates: {
                            pie: {
                                title: "Pie chart",
                                urlImg: "http://cloud.highcharts.com/images/yqoxob/3/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "plotOptions-pie--allowPointSelect": !0,
                                    "plotOptions-pie--cursor": !0,
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires two data columns: one for slice names (shown in data labels) and one for their values."
                            },
                            pie3D: {
                                title: "3D Pie chart",
                                urlImg: "http://cloud.highcharts.com/images/erifer/3/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "chart-options3d--enabled": !0,
                                    "chart-options3d--alpha": 45,
                                    "chart-options3d--beta": 0,
                                    "plotOptions-pie--allowPointSelect": !0,
                                    "plotOptions-pie--depth": 35,
                                    "plotOptions-pie--cursor": "pointer",
                                    "plotOptions-series-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires two data columns: one for slice names (shown in data labels) and one for their values."
                            },
                            pielegend: {
                                title: "Pie with legend",
                                urlImg: "http://cloud.highcharts.com/images/anofof/0/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "plotOptions-pie--allowPointSelect": !0,
                                    "plotOptions-pie--cursor": !0,
                                    "plotOptions-pie--showInLegend": !0,
                                    "plotOptions-pie-dataLabels--enabled": !1
                                },
                                tooltipText: "Requires two data columns: one for slice names (shown in the legend) and one for their values."
                            },
                            pie3Dlegend: {
                                title: "3D Pie with legend",
                                urlImg: "http://cloud.highcharts.com/images/ubopaq/0/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "chart-options3d--enabled": !0,
                                    "chart-options3d--alpha": 45,
                                    "chart-options3d--beta": 0,
                                    "plotOptions-pie--allowPointSelect": !0,
                                    "plotOptions-pie--depth": 35,
                                    "plotOptions-pie--cursor": "pointer",
                                    "plotOptions-pie--showInLegend": !0,
                                    "plotOptions-pie-dataLabels--enabled": !1
                                },
                                tooltipText: "Requires two data columns: one for slice names (shown in legend) and one for their values."
                            },
                            donut: {
                                title: "Donut",
                                urlImg: "http://cloud.highcharts.com/images/upaxab/2/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "plotOptions-pie--allowPointSelect": !0,
                                    "plotOptions-pie--cursor": !0,
                                    "plotOptions-pie--innerSize": "60%",
                                    "plotOptions-pie-dataLabels--enabled": !0
                                },
                                tooltipText: "Requires two data columns: one for slice names (shown in data labels) and one for their values."
                            },
                            donutlegend: {
                                title: "Donut with legend",
                                urlImg: "http://cloud.highcharts.com/images/arutag/1/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "plotOptions-pie--allowPointSelect": !0,
                                    "plotOptions-pie--cursor": !0,
                                    "plotOptions-pie--showInLegend": !0,
                                    "plotOptions-pie--innerSize": "60%",
                                    "plotOptions-pie-dataLabels--enabled": !1
                                },
                                tooltipText: "Donut with categories. Requires two data columns: one for slice names (shown in legend) and one for their values."
                            },
                            donut3D: {
                                title: "3D Donut chart",
                                urlImg: "http://cloud.highcharts.com/images/ehuvoh/3/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "chart-options3d--enabled": !0,
                                    "chart-options3d--alpha": 45,
                                    "chart-options3d--beta": 0,
                                    "plotOptions-pie--allowPointSelect": !0,
                                    "plotOptions-pie--depth": 35,
                                    "plotOptions-pie--cursor": "pointer",
                                    "plotOptions-series-dataLabels--enabled": !0,
                                    "plotOptions-pie--innerSize": "60%"
                                },
                                tooltipText: "Requires two data columns: one for slice names (shown in data labels) and one for their values."
                            },
                            donut3Dlegend: {
                                title: "3D Donut chart with legend",
                                urlImg: "http://cloud.highcharts.com/images/oriwyb/1/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "chart-options3d--enabled": !0,
                                    "chart-options3d--alpha": 45,
                                    "chart-options3d--beta": 0,
                                    "plotOptions-pie--allowPointSelect": !0,
                                    "plotOptions-pie--depth": 35,
                                    "plotOptions-pie--cursor": "pointer",
                                    "plotOptions-series-dataLabels--enabled": !1,
                                    "plotOptions-pie--showInLegend": !0,
                                    "plotOptions-pie--innerSize": "60%"
                                },
                                tooltipText: "3D Donut with categories. Requires two data columns: one for slice names (shown in data labels) and one for their values."
                            },
                            semicircledonut: {
                                title: "Semi circle donut",
                                urlImg: "http://cloud.highcharts.com/images/iwyfes/2/136.svg",
                                config: {
                                    "chart--type": "pie",
                                    "plotOptions-pie--allowPointSelect": !1,
                                    "plotOptions-series-dataLabels--enabled": !0,
                                    "plotOptions-pie-dataLabels--distance": -30,
                                    "plotOptions-pie-dataLabels--style": {
                                        fontWeight: "bold",
                                        color: "white",
                                        textShadow: "0px 1px 2px black"
                                    },
                                    "plotOptions-pie--innerSize": "50%",
                                    "plotOptions-pie--startAngle": -90,
                                    "plotOptions-pie--endAngle": 90,
                                    "plotOptions-pie--center": ["50%", "75%"]
                                },
                                tooltipText: "Requires two data columns: one for slice names (shown in data labels) and one for their values."
                            }
                        }
                    },
                    polar: {
                        title: "Polar",
                        templates: {
                            polarLine: {
                                title: "Polar line",
                                urlImg: "http://cloud.highcharts.com/images/ajogud/2/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "chart--polar": !0
                                },
                                tooltipText: "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out)."
                            },
                            spiderLine: {
                                title: "Spider line",
                                urlImg: "http://cloud.highcharts.com/images/uqonaj/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "chart--polar": !0,
                                    "xAxis--tickmarkPlacement": "on",
                                    "xAxis--lineWidth": 0,
                                    "yAxis--lineWidth": 0,
                                    "yAxis--gridLineInterpolation": "polygon"
                                },
                                tooltipText: "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out)."
                            },
                            polarArea: {
                                title: "Polar area",
                                urlImg: "http://cloud.highcharts.com/images/oqajux/0/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "chart--polar": !0
                                },
                                tooltipText: "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out)."
                            },
                            spiderArea: {
                                title: "Spider area",
                                urlImg: "http://cloud.highcharts.com/images/exajib/0/136.svg",
                                config: {
                                    "chart--type": "area",
                                    "chart--polar": !0,
                                    "xAxis--tickmarkPlacement": "on",
                                    "xAxis--lineWidth": 0,
                                    "yAxis--lineWidth": 0,
                                    "yAxis--gridLineInterpolation": "polygon"
                                },
                                tooltipText: "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out)."
                            }
                        }
                    },
                    stock: {
                        title: "Stock charts",
                        templates: {
                            basic: {
                                title: "Basic",
                                urlImg: "http://cloud.highcharts.com/images/awuhad/3/136.svg",
                                constr: "StockChart",
                                config: {
                                    "chart--type": "line",
                                    "rangeSelector--enabled": !1
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values."
                            },
                            ohlc: {
                                title: "OHLC",
                                urlImg: "http://cloud.highcharts.com/images/opilip/2/136.svg",
                                constr: "StockChart",
                                config: {
                                    "chart--type": "ohlc",
                                    "rangeSelector--enabled": !1
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently four columns for each series' Y values, e.g. open, high, low, close."
                            },
                            candlestick: {
                                title: "Candlestick",
                                urlImg: "http://cloud.highcharts.com/images/etybef/0/136.svg",
                                constr: "StockChart",
                                config: {
                                    "chart--type": "candlestick",
                                    "rangeSelector--enabled": !1
                                },
                                tooltipText: "Requires one column for X values or categories, subsequently four columns for each series' Y values, e.g. open, high, low, close."
                            }
                        }
                    },
                    more: {
                        title: "More types",
                        templates: {
                            solidgauge: {
                                title: "Solid gauge",
                                urlImg: "http://cloud.highcharts.com/images/apocob/0/136.svg",
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                                config: {
                                    "chart--type": "solidgauge",
                                    "pane--center": ["50%", "85%"],
                                    "pane--size": "140%",
                                    "pane--startAngle": "-90",
                                    "pane--endAngle": "90",
                                    "pane--background": {
                                        backgroundColor: "#EEE",
                                        innerRadius: "60%",
                                        outerRadius: "100%",
                                        shape: "arc"
                                    },
                                    "tooltip--enabled": !1,
                                    "yAxis--stops": [
                                        [0.1, "#55BF3B"],
                                        [0.5, "#DDDF0D"],
                                        [0.9, "#DF5353"]
                                    ],
                                    "yAxis--min": 0,
                                    "yAxis--max": 100,
                                    "yAxis--lineWidth": 0,
                                    "yAxis--minorTickInterval": null,
                                    "yAxis--tickPixelInterval": 400,
                                    "yAxis--tickWidth": 0,
                                    "yAxis-title--y": -70,
                                    "yAxis-labels--y": 16,
                                    "plotOptions-solidgauge-dataLabels--y": 10,
                                    "plotOptions-solidgauge-dataLabels--borderWidth": 0,
                                    "plotOptions-solidgauge-dataLabels--useHTML": !0,
                                    "series[0]-dataLabels--format": '<div style="text-align:center"><span style="font-size:25px;color:#000000">{y}</span></div>'
                                }
                            },
                            funnel: {
                                title: "Funnel",
                                urlImg: "http://cloud.highcharts.com/images/exumeq/0/136.svg",
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                                config: {
                                    "chart--type": "funnel",
                                    "plotOptions-series-datalabels--color": "#000000",
                                    "plotOptions-series-dataLabels--softConnector": !0,
                                    "plotOptions-series--neckWidth": "20%",
                                    "plotOptions-series--neckHeight": "35%",
                                    "series[0]--width": "64%"
                                }
                            },
                            pyramid: {
                                title: "Pyramid",
                                urlImg: "http://cloud.highcharts.com/images/obulek/0/136.svg",
                                tooltipText: "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                                config: {
                                    "chart--type": "pyramid",
                                    "plotOptions-series-datalabels--color": "#000000",
                                    "plotOptions-series-dataLabels--softConnector": !0,
                                    "series[0]--width": "64%"
                                }
                            },
                            boxplot: {
                                title: "Boxplot",
                                urlImg: "http://cloud.highcharts.com/images/idagib/0/136.svg",
                                tooltipText: "Requires one column for X values, and one column each for low, lower quartile, median, upper quartile and high values.",
                                config: {
                                    "chart--type": "boxplot"
                                }
                            }
                        }
                    },
                    combinations: {
                        title: "Combination charts",
                        templates: {
                            lineColumn: {
                                title: "Line and column",
                                urlImg: "http://cloud.highcharts.com/images/ynikoc/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "series[0]--type": "column"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values. By default, the first series is a column series and subsequent series are lines."
                            },
                            columnLine: {
                                title: "Column and line",
                                urlImg: "http://cloud.highcharts.com/images/ufafag/0/136.svg",
                                config: {
                                    "chart--type": "column",
                                    "series[0]--type": "line"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values. By default, the first series is a line series and subsequent series are columns."
                            },
                            areaLine: {
                                title: "Area and line",
                                urlImg: "http://cloud.highcharts.com/images/ahimym/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "series[0]--type": "area"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values. By default, the first series is a area series and subsequent series are lines."
                            },
                            scatterLine: {
                                title: "Scatter and line",
                                urlImg: "http://cloud.highcharts.com/images/etakof/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "series[0]--type": "scatter"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values. By default, the first series is a scatter series and subsequent series are lines."
                            },
                            arearangeLine: {
                                title: "Arearange and line",
                                urlImg: "http://cloud.highcharts.com/images/ypepug/0/136.svg",
                                config: {
                                    "chart--type": "line",
                                    "series[0]--type": "arearange"
                                },
                                tooltipText: "Requires one data column for X values or categories, subsequently one data column for each series' Y values. By default, the first series is a arearange series and subsequent series are lines."
                            }
                        }
                    }
                }
            }, {
                type: "tab",
                title: "Simple",
                name: "settings",
                options: {
                    Titles: [{
                        text: "Main titles",
                        group: !0,
                        options: [{
                            text: "Chart title",
                            id: "title--text",
                            tooltipText: "The main chart title."
                        }, {
                            text: "Chart subtitle",
                            id: "subtitle--text",
                            tooltipText: "The chart's subtitle, normally displayed with smaller fonts below the main title."
                        }, {
                            text: "Y axis title",
                            id: "yAxis-title--text",
                            tooltipText: "The Y axis title, normally displayed vertically along the Y axis."
                        }]
                    }],
                    General: [{
                        text: "Chart size",
                        group: !0,
                        options: [{
                            id: "chart--width",
                            text: "Chart width",
                            custom: {
                                minValue: 0,
                                maxValue: 5E3,
                                step: 10
                            }
                        }, {
                            id: "chart--height",
                            text: "Chart height",
                            custom: {
                                minValue: 0,
                                maxValue: 5E3,
                                step: 10
                            }
                        }]
                    }, {
                        text: "Chart Interaction",
                        group: !0,
                        options: [{
                            id: "chart--zoomType",
                            text: "Allow zooming"
                        }, {
                            id: "chart--polar",
                            text: "Polar (radar) projection"
                        }, {
                            id: "chart--reflow",
                            text: "Reflow on window resize"
                        }]
                    }],
                    Appearance: [{
                        text: "Fonts",
                        group: !0,
                        options: [{
                            id: "chart--style",
                            text: "Font family",
                            tooltipText: "The font to use throughout the chart"
                        }]
                    }, {
                        text: "Titles",
                        group: !0,
                        options: [{
                            id: "title--style",
                            text: "Main title style",
                            tooltipText: "Styling for the main chart title"
                        }, {
                            id: "subtitle--style",
                            text: "Subtitle style",
                            tooltipText: "Styling for the chart's subtitle, normally displayed with smaller fonts below the main title"
                        }]
                    }, {
                        text: "Series colors",
                        group: !0,
                        options: [{
                            id: "colors",
                            text: "Colors",
                            tooltipText: "Default colors for the data series, or for individual points in a pie series or a column series with individual colors. Colors will be picked in succession. If a color is explicitly set for each series in the <em>Data series</em> view, that color will take precedence."
                        }]
                    }, {
                        text: "Chart area",
                        group: !0,
                        options: [{
                            id: "chart--backgroundColor",
                            text: "Background color",
                            tooltipText: "Background color for the full chart area"
                        }, {
                            id: "chart--borderWidth",
                            text: "Border width",
                            custom: {
                                minValue: 0
                            }
                        }, {
                            id: "chart--borderRadius",
                            text: "Border corner radius",
                            custom: {
                                minValue: 0
                            }
                        }, {
                            id: "chart--borderColor",
                            text: "Border color"
                        }]
                    }, {
                        text: "Plot area",
                        group: !0,
                        options: [{
                            id: "chart--plotBackgroundColor",
                            text: "Background color",
                            tooltipText: "Background color for the plot area, the area inside the axes"
                        }, {
                            id: "chart--plotBackgroundImage",
                            text: "Background image URL",
                            tooltipText: "The online URL for an image to use as the plot area background"
                        }, {
                            id: "chart--plotBorderWidth",
                            text: "Border width"
                        }, {
                            id: "chart--plotBorderColor",
                            text: "Border color"
                        }]
                    }],
                    Axes: [{
                        text: "Axes setup",
                        group: !0,
                        options: [{
                            id: "chart--inverted",
                            text: "Inverted axes"
                        }]
                    }, {
                        id: "xAxis",
                        text: "Horizontal Axis",
                        group: !0,
                        options: [{
                            id: "xAxis-title--style",
                            text: "X axis title",
                            tooltipText: "Styling and text for the X axis title"
                        }, {
                            id: "xAxis-title--text"
                        }, {
                            id: "xAxis--type",
                            text: "Type",
                            tooltipText: "The type of axis"
                        }, {
                            id: "xAxis--opposite",
                            text: "Opposite side of chart"
                        }, {
                            id: "xAxis--reversed",
                            text: "Reversed direction"
                        }, {
                            id: "xAxis-labels--format",
                            text: "Axis labels format",
                            tooltipText: "<p>A format string for the axis labels. The value is available through a variable <code>{value}</code>.</p><p><b>Units</b> can be added for example like <code>{value} USD</code>.</p><p><b>Formatting</b> can be added after a colon inside the variable, for example <code>USD {value:.2f}</code> to display two decimals, or <code>{value:%Y-%m-%d}</code> for a certain time format."
                        }, {
                            id: "xAxis-labels--rotation",
                            text: "Axis labels rotation",
                            custom: {
                                step: 5,
                                minValue: -90,
                                maxValue: 90
                            }
                        }]
                    }, {
                        id: "yAxis",
                        text: "Vertical Axis",
                        group: !0,
                        options: [{
                            id: "yAxis-title--style",
                            text: "Y axis title",
                            tooltipText: "Styling and text for the X axis title"
                        }, {
                            id: "yAxis--type",
                            text: "Type",
                            tooltipText: "The type of axis"
                        }, {
                            id: "yAxis--opposite",
                            text: "Opposite side of chart"
                        }, {
                            id: "yAxis--reversed",
                            text: "Reversed direction"
                        }, {
                            id: "yAxis-labels--format",
                            text: "Axis labels format",
                            tooltipText: "<p>A format string for the axis labels. The value is available through a variable <code>{value}</code>.</p><p><b>Units</b> can be added for example like <code>{value} USD</code>.</p><p><b>Formatting</b> can be added after a colon inside the variable, for example <code>USD {value:.2f}</code> to display two decimals, or <code>{value:%Y-%m-%d}</code> for a certain time format."
                        }]
                    }],
                    "Data series": [{
                        id: "series",
                        array: !0,
                        options: [{
                            id: "series--type",
                            text: "Series type",
                            tooltipText: "The type of series"
                        }, {
                            id: "series<*>--color",
                            text: "Color",
                            tooltipText: 'The main color of the series. If no color is given here, the color is pulled from the array of default colors as given in the "Appearance" section.'
                        }, {
                            id: "series<*>--colors",
                            text: "Colors"
                        }, {
                            id: "series<*>--negativeColor",
                            text: "Negative color",
                            tooltipText: "The negative color of the series below the threshold. Threshold is default zero, this can be changed in the advanced settings."
                        }, {
                            id: "series<*>--colorByPoint",
                            text: "Color by point",
                            tooltipText: 'Use one color per point. Colors can be changed in the "Appearance" section.'
                        }, {
                            id: "series<*>--dashStyle",
                            text: "Dash style"
                        }, {
                            id: "series<*>-marker--enabled",
                            text: "Enable point markers"
                        }, {
                            id: "series<*>-marker--symbol",
                            text: "Marker symbol"
                        }, {
                            id: "series<*>-tooltip--valuePrefix",
                            text: "Prefix in tooltip",
                            tooltipText: "Text to prepend before the value in the tooltip"
                        }, {
                            id: "series<*>-tooltip--valueSuffix",
                            text: "Suffix (unit) in tooltip",
                            tooltipText: "Text to append after the value in the tooltip"
                        }, {
                            id: "series-seriesMapping--x",
                            text: "Explicit x column"
                        }, {
                            id: "series-seriesMapping--label",
                            text: "Explicit label column"
                        }, {
                            id: "series<*>--width",
                            text: "Funnel width"
                        }, {
                            id: "series<*>--neckWidth",
                            text: "Neck width",
                            tooltipText: "The width of the neck, the lower part of the funnel. A number defines pixel width, a percentage string, f. eks. '25%', defines a percentage of the plot area width. Defaults to 25%."
                        }, {
                            id: "series<*>--neckHeight",
                            text: "Neck height",
                            tooltipText: "The height of the neck, the lower part of the funnel. A number defines pixel width, a percentage string, f. eks. '25%', defines a percentage of the plot area height. Defaults to 25%."
                        }]
                    }],
                    "Value labels": [{
                        id: "data-labels",
                        text: "Value labels",
                        group: !0,
                        options: [{
                            id: "plotOptions-series-dataLabels--enabled",
                            text: "Enable data labels for all series",
                            tooltipText: "Show small labels next to each data value (point, column, pie slice etc)"
                        }, {
                            id: "plotOptions-series-dataLabels--format",
                            text: "Data label format",
                            tooltipText: "<p>A format string for the value labels. The value is available through a variable <code>{y}</code>. Other available variables are <code>{x}</code> and <code>{key}</code> for the category.</p><p><b>Units</b> can be added for example like <code>{y} USD</code>.</p><p><b>Formatting</b> can be added after a colon inside the variable, for example <code>USD {y:.2f}</code> to display two decimals, or <code>{x:%Y-%m-%d}</code> for a certain time format."
                        }, {
                            id: "plotOptions-series-dataLabels--style",
                            text: "Text style"
                        }]
                    }],
                    Legend: [{
                        text: "General",
                        group: !0,
                        options: [{
                            id: "legend--enabled",
                            text: "Enable legend"
                        }, {
                            id: "legend--layout",
                            text: "Item layout"
                        }]
                    }, {
                        text: "Placement",
                        group: !0,
                        options: [{
                            id: "legend--align",
                            text: "Horizontal alignment"
                        }, {
                            id: "legend--x",
                            text: "Horizontal offset",
                            tooltipText: "The pixel offset of the legend relative to its alignment"
                        }, {
                            id: "legend--verticalAlign",
                            text: "Vertical alignment"
                        }, {
                            id: "legend--y",
                            text: "Vertical offset",
                            tooltipText: "The pixel offset of the legend relative to its alignment"
                        }, {
                            id: "legend--floating",
                            text: "Float on top of plot area"
                        }]
                    }, {
                        text: "Color and border",
                        group: !0,
                        options: [{
                            id: "legend--backgroundColor",
                            text: "Background color"
                        }, {
                            id: "legend--borderWidth",
                            text: "Border width"
                        }, {
                            id: "legend--borderRadius",
                            text: "Border corner radius"
                        }, {
                            id: "legend--borderColor",
                            text: "Border color"
                        }]
                    }],
                    Tooltip: [{
                        text: "General",
                        group: !0,
                        options: [{
                            id: "tooltip--enabled",
                            text: "Enable tooltip",
                            tooltipText: "Enable or disable the tooltip. The tooltip is the information box that appears on mouse-over or touch on a point."
                        }, {
                            id: "tooltip--shared",
                            text: "Shared between series"
                        }]
                    }, {
                        text: "Color and border",
                        group: !0,
                        options: [{
                            id: "tooltip--backgroundColor",
                            text: "Background color",
                            tooltipText: "The background color of the tooltip"
                        }, {
                            id: "tooltip--borderWidth",
                            text: "Border width",
                            custom: {
                                minValue: 0
                            }
                        }, {
                            id: "tooltip--borderRadius",
                            text: "Border corner radius",
                            custom: {
                                minValue: 0
                            }
                        }, {
                            id: "tooltip--borderColor",
                            text: "Border color",
                            tooltipText: "The border color of the tooltip. If no color is given, the corresponding series color is used."
                        }]
                    }],
                    Exporting: [{
                        text: "Exporting",
                        group: !0,
                        options: [{
                            id: "exporting--enabled",
                            text: "Enable exporting",
                            tooltipText: "Enable the context button on the top right of the chart, allowing end users to download image exports."
                        }, {
                            id: "exporting--sourceWidth",
                            text: "Exported width",
                            custom: {
                                minValue: 10,
                                maxValue: 2E3,
                                step: 10
                            },
                            tooltipText: "The width of the original chart when exported. The pixel width of the exported image is then multiplied by the <em>Scaling factor</em>."
                        }, {
                            id: "exporting--sourceHeight",
                            text: "Exported height",
                            custom: {
                                minValue: 10,
                                maxValue: 2E3,
                                step: 10
                            },
                            tooltipText: "Analogous to the <em>Exported width</em>"
                        }, {
                            id: "exporting--scale",
                            text: "Scaling factor",
                            custom: {
                                minValue: 1,
                                maxValue: 4
                            }
                        }]
                    }],
                    Localization: [{
                        text: "Number formatting",
                        group: !0,
                        options: [{
                            id: "lang--decimalPoint",
                            text: "Decimal point",
                            tooltipText: "The decimal point used for all numbers"
                        }, {
                            id: "lang--thousandsSep",
                            text: "Thousands separator",
                            tooltipText: "The thousands separator used for all numbers"
                        }]
                    }, {
                        text: "Exporting button and menu",
                        group: !0,
                        options: [{
                            id: "lang--contextButtonTitle",
                            text: "Context button title"
                        }, {
                            id: "lang--printChart",
                            text: "Print chart"
                        }, {
                            id: "lang--downloadPNG",
                            text: "Download PNG"
                        }, {
                            id: "lang--downloadJPEG",
                            text: "Download JPEG"
                        }, {
                            id: "lang--downloadPDF",
                            text: "Download PDF"
                        }, {
                            id: "lang--downloadSVG",
                            text: "Download SVG"
                        }]
                    }, {
                        text: "Zoom button",
                        group: !0,
                        options: [{
                            id: "lang--resetZoom",
                            text: "Reset zoom button"
                        }, {
                            id: "lang--resetZoomTitle",
                            text: "Reset zoom button title"
                        }]
                    }]
                }
            }, {
                type: "tab",
                title: "Embed<br>4",
                name: "share"
            }, {
                type: "tab",
                title: "Advanced",
                name: "advanced"
            }, {
                type: "tab",
                title: "Code",
                name: "code"
            }, {
                type: "panel",
                title: "Import<br>1",
                name: "importdata"
            }, {
                type: "panel",
                name: "output",
                outputContainerId: "container",
                template: {
                    chart: {
                        renderTo: "container"
                    },
                    plotOptions: {
                        series: {
                            animation: !1
                        }
                    }
                }
            }]
        }
    };
    Array.prototype.indexOf || (Array.prototype.indexOf = function(a) {
        if (null == this) throw new TypeError;
        var b = Object(this),
            c = b.length >>> 0;
        if (0 === c) return -1;
        var d = 0;
        1 < arguments.length && (d = Number(arguments[1]), d != d ? d = 0 : 0 != d && Infinity != d && -Infinity != d && (d = (0 < d || -1) * Math.floor(Math.abs(d))));
        if (d >= c) return -1;
        for (d = 0 <= d ? d : Math.max(c - Math.abs(d), 0); d < c; d++)
            if (d in b && b[d] === a) return d;
        return -1
    });
    Object.keys || (Object.keys = function() {
        var a = Object.prototype.hasOwnProperty,
            b = !{
                toString: null
            }.propertyIsEnumerable("toString"),
            c = ["toString", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "constructor"],
            d = c.length;
        return function(e) {
            if (typeof e !== "object" && typeof e !== "function" || e === null) throw new TypeError("Object.keys called on non-object");
            var f = [],
                g;
            for (g in e) a.call(e, g) && f.push(g);
            if (b)
                for (g = 0; g < d; g++) a.call(e, c[g]) && f.push(c[g]);
            return f
        }
    }());
    Array.prototype.map || (Array.prototype.map = function(a, b) {
        var c, d, e;
        if (this == null) throw new TypeError(" this is null or not defined");
        var f = Object(this),
            g = f.length >>> 0;
        if ({}.toString.call(a) != "[object Function]") throw new TypeError(a + " is not a function");
        b && (c = b);
        d = Array(g);
        for (e = 0; e < g;) {
            var h;
            if (e in f) {
                h = f[e];
                h = a.call(c, h, e, f);
                d[e] = h
            }
            e++
        }
        return d
    });

    function isOfType(a) {
        var b = typeof a;
        "object" === b && (a ? a instanceof Array && (b = "array") : b = "null");
        return b
    }

    function isEmpty(a) {
        for (var b in a)
            if (a.hasOwnProperty(b)) return !1;
        return !0
    }

    function stripDefaultValues(a, b) {
        var c;
        if (b)
            for (c in a) a.hasOwnProperty(c) && void 0 !== b[c] && b[c] === a[c] && delete a[c];
        return isEmpty(a) ? void 0 : a
    }

    function serializeCss(a) {
        var a = a.split(";"),
            b = {},
            c, d = /(?:(?:^|\n)\s+|\s+(?:$|\n))/g,
            e = function(a) {
                return a[1].toUpperCase()
            },
            f;
        for (c = 0; c < a.length; c += 1) f = a[c], f = f.split(":"), f[1] && (b[f[0].replace(d, "").replace(/-([a-z])/g, e)] = f[1].replace(d, ""));
        return b
    }

    function deserializeCss(a) {
        var b = "",
            c, d = function(a, b) {
                return "-" + b.toLowerCase()
            };
        for (c in a) a.hasOwnProperty(c) && "function" !== typeof a[c] && (b = b + c.replace(/([A-Z])/g, d) + ": " + a[c] + ";");
        return b
    }

    function getForegroundColor(a) {
        var a = /#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})/.exec(tinycolor.names[a] || a),
            b = 255;
        a && (b = 0.299 * parseInt(a[1], 16) + 0.587 * parseInt(a[2], 16) + 0.114 * parseInt(a[3], 16));
        return 140 < b ? "black" : "white"
    };
    void 0 !== window.Ext && (Ext.namespace("Ext.ux"), Ext.ux.FitToParent = Ext.extend(Object, {
        constructor: function(a) {
            a = a || {};
            if (a.tagName || a.dom || Ext.isString(a)) a = {
                parent: a
            };
            Ext.apply(this, a)
        },
        init: function(a) {
            this.component = a;
            a.on("render", function(a) {
                this.parent = Ext.get(this.parent || a.getPositionEl().dom.parentNode);
                this.fitSize();
                Ext.EventManager.onWindowResize(this.fitSize, this)
            }, this, {
                single: !0
            })
        },
        fitSize: function() {
            var a = this.component.getPosition(!0),
                b = this.parent.getViewSize();
            this.component.setSize(b.width -
                a[0], b.height - a[1])
        }
    }), Ext.preg("fittoparent", Ext.ux.FitToParent));
    void 0 !== window.Ext && Ext.define("Ext.ux.colorpicker", {
        extend: "Ext.form.field.Text",
        xtype: "colorpicker",
        layout: "hbox",
        cls: "colorpicker",
        initComponent: function() {
            var a = this;
            this.on("afterrender", function() {
                var b = $("table#" + this.el.id + " input"),
                    c = function(c) {
                        c ? a.setValue(c.toString()) : (b.spectrum("set", a.defaultValue), a.setValue(null))
                    };
                b.spectrum({
                    color: this.value,
                    showButtons: !1,
                    allowEmpty: !0,
                    showInitial: !0,
                    showInput: !0,
                    showAlpha: !0,
                    clickoutFiresChange: !0,
                    preferredFormat: "hex",
                    localStorageKey: "cloud.hc.color",
                    change: c,
                    move: c
                });
                a.elem = b
            });
            this.callParent()
        },
        setValue: function(a) {
            this.superclass.setValue.apply(this, arguments);
            this.elem && this.elem.spectrum("set", a)
        },
        getName: function() {
            return this.name
        }
    });
    void 0 !== window.Ext && Ext.define("Ext.ux.ColorStripe", {
        extend: "Ext.form.FieldContainer",
        xtype: "colorstripe",
        width: "100%",
        layout: "hbox",
        initComponent: function() {
            var a = this;
            Ext.apply(a, {
                items: [{
                    xtype: "panel",
                    html: '<div id="colorStripe"></div>',
                    contentEl: "colorStripe",
                    width: "100%",
                    height: 40,
                    listeners: {
                        afterrender: function() {
                            var b, c;
                            for (b = 0; b < a.colorArray.length; b += 1) c = $('<div class="colorbox" id="' + b + '"></div>'), c.appendTo("#colorStripe"), c.css("background-color", a.colorArray[b]), c.on("click", a.makeClickHandler(c,
                                b))
                        }
                    }
                }]
            });
            this.callParent();
            this.comp = a
        },
        makeClickHandler: function(a, b) {
            var c = this;
            return function() {
                var d = function(a) {
                    a ? c.setColor(this, a.toString()) : c.setColor(this, null)
                };
                a.spectrum({
                    color: c.colorArray[b],
                    showButtons: !1,
                    allowEmpty: !0,
                    showInitial: !0,
                    showInput: !0,
                    showAlpha: !0,
                    clickoutFiresChange: !0,
                    preferredFormat: "hex",
                    localStorageKey: "cloud.hc.color",
                    move: d,
                    change: d
                });
                window.setTimeout(function() {
                    a.spectrum("show")
                })
            }
        },
        setColor: function(a, b) {
            var c = $(a),
                d = c.index();
            null === b && (b = Highcharts.getOptions().colors[d]);
            c.css("background-color", b);
            this.colorArray[d] = b;
            this.fireEvent("change", this, this.colorArray)
        },
        setValue: function(a) {
            var b = this;
            this.colorArray = null === a || void 0 === a ? Highcharts.getOptions().colors : a;
            $.each($(".colorbox"), function() {
                $(this).css("background-color", b.colorArray[this.id])
            })
        },
        getName: function() {
            return this.name
        }
    });
    Ext.define("Ext.ux.CssEditor", {
        extend: "Ext.form.field.Text",
        alias: "widget.cssditor",
        xtype: "css-editor",
        cls: "cssEditor",
        validateBlur: function() {
            return !this.prompting
        },
        initComponent: function() {
            this.cssObject = {};
            this.callParent(arguments)
        },
        setRawValue: function(a) {
            Ext.ux.CssEditor.superclass.setRawValue.call(this, a)
        },
        onBlur: function() {},
        onFocus: function() {
            var a = this,
                b, c;
            b = a.getValue();
            a.cssObject = serializeCss(b);
            b = b.replace(";", ";\n");
            this.editorWindow = new Ext.Window({
                title: "CSS Editor",
                width: 553,
                height: 317,
                border: 0,
                modal: !0,
                layout: "hbox",
                items: [{
                    name: "textarea",
                    xtype: "textarea",
                    height: "100%",
                    width: "100%",
                    value: b
                }],
                buttons: [{
                    xtype: "button",
                    text: "Cancel",
                    listeners: {
                        click: function() {
                            a.ownerCt.cancelEdit && a.ownerCt.cancelEdit();
                            a.editorWindow.close()
                        }
                    }
                }, {
                    xtype: "button",
                    text: "Ok",
                    listeners: {
                        click: function() {
                            var b = a.textarea.value;
                            a.cssObject = serializeCss(b);
                            a.prompting = !1;
                            a.setValue(b);
                            a.editorWindow.close();
                            a.ownerCt.completeEdit && a.ownerCt.completeEdit()
                        }
                    }
                }]
            });
            for (b = 0; b < a.editorWindow.items.items.length; b +=
                1) c = a.editorWindow.items.items[b], c.name && (a[c.name] = c);
            this.prompting = !0;
            this.editorWindow.show(null, function() {
                a.textarea.focus(!1, 200)
            })
        },
        getName: function() {
            return this.name
        }
    });

    function FontEditor() {
        this.init.apply(this, arguments)
    }
    FontEditor.prototype = {
        init: function() {
            this.css = {}
        },
        toggleItalic: function() {
            void 0 === this.css.fontStyle ? this.css.fontStyle = "italic" : delete this.css.fontStyle
        },
        toggleBold: function() {
            this.css.fontWeight = void 0 === this.css.fontWeight || "normal" === this.css.fontWeight ? "bold" : "normal"
        },
        setFontSize: function(a) {
            this.css.fontSize = a
        },
        setFontColor: function(a) {
            "" === a ? delete this.css.color : this.css.color = a
        },
        setFontFamily: function(a) {
            this.css.fontFamily = a
        },
        getCss: function() {
            return this.css
        },
        setCss: function(a) {
            this.css =
                a
        }
    };
    void 0 !== window.Ext && Ext.define("Ext.ux.FontEditor", {
        extend: "Ext.form.FieldContainer",
        xtype: "font-editor",
        width: "100%",
        layout: "hbox",
        cls: "fonteditor",
        initComponent: function() {
            function a() {
                g.toggleBold();
                f.changeListener(f, g.getCss())
            }

            function b() {
                g.toggleItalic();
                f.changeListener(f, g.getCss())
            }

            function c(a, b) {
                g.setFontSize(b);
                f.changeListener(f, g.getCss())
            }

            function d(a, b) {
                g.setFontColor(b);
                f.changeListener(f, g.getCss())
            }

            function e(a, b) {
                g.setFontFamily(b);
                f.changeListener(f, g.getCss())
            }
            var f = this,
                g =
                new FontEditor,
                h, i;
            h = "chart--style" === f.name ? [{
                name: "comboFontFamily",
                xtype: "combobox",
                defaultValue: f.defaultValue ? f.defaultValue.fontFamily : "",
                queryMode: "local",
                store: new Ext.data.ArrayStore({
                    id: 0,
                    fields: ["optionValue", "optionName"],
                    data: [
                        ["Courier", "Courier"],
                        ["Arial", "Arial"],
                        ["Verdana", "Verdana"],
                        ["Georgia", "Georgia"],
                        ["Palatino Linotype", "Palatino Linotype"],
                        ["Times New Roman", "Times New Roman"],
                        ["Comic Sans MS", "Comic Sans MS"],
                        ["Impact", "Impact"],
                        ["Lucida Sans Unicode", "Lucida Sans Unicode"],
                        ["Tahoma", "Tahoma"],
                        ["Lucida Console", "Lucida Console"],
                        ["Courier New", "Courier New"],
                        ["Monaco", "Monaco"]
                    ]
                }),
                valueField: "optionValue",
                displayField: "optionName",
                triggerAction: "all",
                listeners: {
                    change: {
                        fn: e
                    }
                },
                style: {
                    width: "100%",
                    "max-width": "200px"
                },
                editable: !0
            }] : [{
                name: "btnBold",
                xtype: "button",
                defaultValue: f.defaultValue ? f.fontWeight : "",
                text: '<i class="icon-bold"></i>',
                enableToggle: !0,
                allowDepress: !0,
                listeners: {
                    click: {
                        fn: a
                    }
                },
                width: 28,
                margin: "0 2 0 0"
            }, {
                name: "btnItalic",
                xtype: "button",
                defaultValue: f.defaultValue ?
                    f.fontStyle : "",
                text: '<i class="icon-italic"></i>',
                enableToggle: !0,
                allowDepress: !0,
                listeners: {
                    click: {
                        fn: b
                    }
                },
                width: 28,
                margin: "0 2 0 0"
            }, {
                name: "comboFontSize",
                xtype: "combobox",
                defaultValue: f.defaultValue ? f.defaultValue.fontSize : "",
                queryMode: "local",
                store: new Ext.data.ArrayStore({
                    id: 0,
                    fields: ["optionValue", "optionName"],
                    data: [
                        [10, 10],
                        [11, 11],
                        [12, 12],
                        [13, 13],
                        [14, 14],
                        [15, 15],
                        [16, 16],
                        [17, 17],
                        [18, 18],
                        [19, 19],
                        [20, 20],
                        [25, 25]
                    ]
                }),
                valueField: "optionValue",
                displayField: "optionName",
                triggerAction: "all",
                listeners: {
                    change: {
                        fn: c
                    }
                },
                validator: this.fontSizeValidator,
                editable: !0,
                width: 48,
                margin: "0 2 0 0"
            }, {
                name: "comboFontColor",
                xtype: "colorpicker",
                defaultValue: f.defaultValue ? f.defaultValue.color : "",
                listeners: {
                    change: {
                        fn: d
                    }
                }
            }];
            Ext.apply(f, {
                items: h
            });
            this.callParent();
            this.fontEditor = g;
            for (i = 0; i < this.items.items.length; i += 1) h = this.items.items[i], h.name && (this[h.name] = h)
        },
        setValue: function(a) {
            var b;
            a && (this.btnItalic && this.btnItalic.toggle(a.fontStyle && "italic" === a.fontStyle.toLowerCase() || !1), this.btnBold && this.btnBold.toggle(a.fontWeight &&
                "bold" === a.fontWeight.toLowerCase() || !1), a.fontSize && this.comboFontSize && (b = parseInt(a.fontSize, 10), this.comboFontSize.setRawValue(b)), a.color && this.comboFontColor.setValue(a.color), a.fontFamily && this.comboFontFamily.setRawValue(a.fontFamily), this.fontEditor.setCss(a))
        },
        getName: function() {
            return this.name
        },
        fontSizeValidator: function(a) {
            return /^[0-9]*(|px|em|pt)$/.test(a)
        },
        addListener: function(a, b) {
            "change" === a && (this.changeListener = b);
            this.callParent(arguments)
        }
    });

    function ArrayPanel(a, b, c, d, e, f, g, h, i, j, l) {
        console.log("TODO: THIS IS NEVER USED!!!!!!!!!!");
        var m = this,
            k, o, n, p, q;
        this.apiRef = j;
        this.itemStr = a;
        this.store = new Ext.data.TreeStore({
            root: {},
            fields: ["id", "optionValue", "optionDisplayName"]
        });
        k = this.store.getRootNode();
        e && (o = new Ext.Button({
            margin: "0, 5, 5, 0",
            xtype: "button",
            text: "Add",
            width: 60,
            handler: function() {
                var a, d, f, g;
                a = e();
                f = k.appendChild({
                    optionDisplayName: m.formatItemName(b().length - 1)
                });
                for (d = 0; d < c.length; d += 1) g = c[d], f.appendChild({
                    id: g.id,
                    optionDisplayName: g.text,
                    optionValue: a.getSetting(g.id),
                    leaf: !0
                })
            }
        }));
        f && (n = new Ext.Button({
            margin: "0, 5, 5, 0",
            xtype: "button",
            text: "Remove",
            width: 60,
            disabled: !0,
            handler: function() {
                var a = m.treePanel.getSelectionModel(),
                    b = a.getSelection()[0],
                    c = k.indexOf(b);
                f(c);
                k.removeChild(b);
                a.deselectAll();
                m.refreshNames()
            }
        }));
        p = new Ext.Button({
            margin: "0, 5, 5, 0",
            xtype: "button",
            text: "Up",
            width: 60,
            disabled: !0,
            handler: function() {
                if (g) {
                    var a = m.treePanel.getSelectionModel(),
                        b = a.getSelection()[0],
                        c = k.indexOf(b);
                    g(c);
                    k.insertBefore(b, k.getChildAt(c -
                        1));
                    a.deselectAll();
                    a.select(b);
                    m.refreshNames()
                }
            }
        });
        q = new Ext.Button({
            margin: "0, 5, 5, 0",
            xtype: "button",
            text: "Down",
            width: 60,
            disabled: !0,
            handler: function() {
                if (h) {
                    var a = m.treePanel.getSelectionModel(),
                        b = a.getSelection()[0],
                        c = k.indexOf(b);
                    h(c);
                    k.insertBefore(b, k.getChildAt(c + 2));
                    a.deselectAll();
                    a.select(b);
                    m.refreshNames()
                }
            }
        });
        a = new Ext.Panel({
            layout: {
                type: "hbox",
                pack: "start",
                align: "stretch"
            },
            border: !1
        });
        o && a.add(o);
        n && a.add(n);
        a.add(p);
        a.add(q);
        this.panel = new Ext.Panel({
            border: !1,
            flex: 1,
            margin: "0 0 10 0",
            height: l,
            layout: {
                type: "vbox",
                pack: "start",
                align: "stretch"
            }
        });
        this.itemFields = c;
        d = TreeViewUtils.prototype.createCellEditor(i, d, j);
        i = TreeViewUtils.prototype.createColumnRenderer(j);
        this.treePanel = new Ext.tree.Panel({
            border: !0,
            autoScroll: !0,
            hideHeaders: !0,
            flex: 1,
            store: this.store,
            rootVisible: !1,
            padding: "0 0 0 0",
            useArrows: !0,
            columns: [{
                xtype: "treecolumn",
                text: "Option",
                dataIndex: "optionDisplayName",
                flex: 1
            }, {
                xtype: "templatecolumn",
                tpl: "{optionValue}",
                text: "Value",
                dataIndex: "optionValue",
                flex: 1,
                editor: "textfield",
                renderer: i
            }],
            selType: "cellmodel",
            plugins: [d],
            listeners: {
                selectionchange: function(a, b) {
                    var c = b[0],
                        d = k.indexOf(c);
                    n && n.setDisabled(0 > d);
                    p.setDisabled(c && c.isFirst() || 0 > d);
                    q.setDisabled(c && c.isLast() || 0 > d)
                },
                afterrender: function() {
                    var a = this.getView();
                    a.tip = Ext.create("Ext.tip.ToolTip", {
                        target: a.el,
                        delegate: a.itemSelector,
                        trackMouse: !0,
                        renderTo: Ext.getBody(),
                        listeners: {
                            beforeshow: function(b) {
                                var c = a.getRecord(b.triggerElement).get("id");
                                c ? b.update(j.getDescription(c, a.getRecord(b.triggerElement).raw.settingsContext)) :
                                    b.update(a.getRecord(b.triggerElement).get("optionDisplayName"))
                            }
                        }
                    })
                }
            }
        });
        this.panel.add(a);
        this.panel.add(this.treePanel)
    }
    ArrayPanel.prototype = {
        getPanel: function() {
            return this.panel
        },
        refresh: function(a) {
            var b, c, d, e, f, g, h;
            b = this.store.getRootNode();
            b.removeAll();
            for (c = 0; c < a.length; c += 1) {
                d = a[c];
                f = b.appendChild({
                    optionDisplayName: this.formatItemName(c)
                });
                for (e = 0; e < this.itemFields.length; e += 1) g = this.itemFields[e], h = d.getSettingsContext(this.apiRef), this.apiRef.optionExists(g.id, h) && f.appendChild({
                    id: g.id,
                    optionDisplayName: g.text,
                    optionValue: d.getSetting(g.id),
                    settingsContext: h,
                    leaf: !0
                })
            }
            this.treePanel.getView().refresh()
        },
        formatItemName: function(a) {
            return this.itemStr + " [" + a + "]"
        },
        refreshNames: function() {
            var a = this.store.getRootNode(),
                b, c;
            for (b = 0; b < a.childNodes.length; b += 1) c = a.childNodes[b], c.data.optionDisplayName = this.formatItemName(b);
            this.treePanel.getView().refresh()
        }
    };

    function OptionInfo(a, b, c, d, e, f, g, h) {
        this.name = a;
        this.returnType = b;
        this.title = c;
        this.description = d;
        this.depricated = e;
        this.rawDefaults = f;
        this.defaults = this.parse(f);
        this.values = g;
        this.requiresLicense = h
    }
    OptionInfo.prototype = {
        parse: function(a) {
            var b;
            if (void 0 === a) b = null;
            else if (null === a) b = null;
            else if ("true" === a) b = !0;
            else if ("false" === a) b = !1;
            else if (0 === a.indexOf("[")) try {
                b = JSON.parse(a)
            } catch (c) {
                console.log("Warning: unable to parse: " + a), b = a
            } else if (!isNaN(parseFloat(a)) && isFinite(a)) try {
                b = JSON.parse(a)
            } catch (d) {
                console.log("Warning: unable to parse: " + a), b = a
            } else b = a;
            return b
        },
        addEnumAllowedValues: function(a) {
            this.allowedValues = a
        },
        addEnumDisplayValues: function(a) {
            this.displayValues = a
        }
    };

    function ApiRef() {
        var a = this;
        this.optionInfos = {};
        this.validators = {};
        this.comboStores = {};
        this.alwaysOk = function() {
            return !0
        };
        this.isNumber = function(a) {
            return !isNaN(parseFloat(a)) && isFinite(a)
        };
        this.isNumberOrEmptyString = function(b) {
            return "" === b || a.isNumber(b)
        }
    }
    ApiRef.prototype = {
        expandMultiOptions: function(a) {
            var b, c, d;
            b = this.getSeriesTypes();
            a = this.getMatchingOptionInfos(this.expandWildcardWithPlotOptionTypes(a, b));
            for (b = 0; b < a.length; b += 1) c = a[b], d = c.name, d = d.replace("plotOptions-", "series<"), d = d.replace("-", ">-"), c = new OptionInfo(d, c.returnType, c.title, c.description, c.depricated, c.rawDefaults, c.values), this.addApiRef(c)
        },
        expandWildcardWithPlotOptionTypes: function(a, b) {
            var c = [],
                d, e, f;
            for (d = 0; d < a.length; d += 1) {
                e = a[d].replace("series<*>", "plotOptions-*");
                for (f =
                    0; f < b.length; f += 1) c.push(e.replace("*", b[f]))
            }
            return c
        },
        getMatchingOptionInfos: function(a) {
            var b = [],
                c, d;
            for (c = 0; c < a.length; c += 1) d = a[c], (d = this.optionInfos[d]) && b.push(d);
            return b
        },
        getSeriesTypes: function() {
            var a = [],
                b, c;
            for (b in this.optionInfos) this.optionInfos.hasOwnProperty(b) && 0 <= b.indexOf("plotOptions-") && (c = b.split("-"), c = c[1], 0 > a.indexOf(c) && a.push(c));
            return a
        },
        getConsumedColumnCount: function(a) {
            a = Highcharts.seriesTypes[a];
            return !a ? 0 : (a.prototype.pointArrayMap || [0]).length
        },
        applyContextToOptionName: function(a,
            b) {
            var c = b && b.getStarReplacement();
            a && 0 < a.indexOf("*") && void 0 === b && console.log("Missing context:", a);
            return a ? a.replace("*", c) : a
        },
        validate: function(a, b) {
            var c = this.validators[a];
            return c ? c(b) : !0
        },
        optionExists: function(a, b) {
            var c;
            c = !1;
            a && (c = 0 <= a.indexOf("*") ? (c = b && b.getStarReplacement()) ? this.optionInfos.hasOwnProperty(a.replace("*", c)) : !1 : !0);
            return c
        },
        getDisplayName: function(a, b) {
            var c = this.optionInfos[this.applyContextToOptionName(a, b)],
                d = "Not found";
            c && (d = c.title || "Not found");
            return d
        },
        getReturnType: function(a,
            b) {
            var c = this.optionInfos[this.applyContextToOptionName(a, b)],
                d;
            c && (d = -1 !== a.indexOf("hadow") || -1 !== a.indexOf("animation") || -1 !== a.indexOf("crosshairs") ? "Boolean" : -1 !== a.indexOf("tooltip--backgroundColor") || -1 !== a.indexOf("tooltip--borderColor") ? "Color" : c.returnType);
            return d
        },
        getDefaultValue: function(a, b) {
            var c = this.optionInfos[this.applyContextToOptionName(a, b)],
                d;
            if (c && "CSSObject" === c.returnType && c.defaults) try {
                d = JSON.parse(c.defaults)
            } catch (e) {
                console.error("ApiRef.getDefaultValue(), " + c.defaults),
                    console.error(e.message)
            } else c && (d = c.defaults);
            return d
        },
        getDescription: function(a, b) {
            var c = this.optionInfos[this.applyContextToOptionName(a, b)],
                d = "Not found";
            c && (d = c.description || "Not found");
            return d
        },
        getRequiresLicense: function(a, b) {
            var c = this.optionInfos[this.applyContextToOptionName(a, b)],
                d = !1;
            c && (d = c.requiresLicense || !1);
            return d
        },
        getAllowedValues: function(a, b) {
            var c = this.optionInfos[this.applyContextToOptionName(a, b)],
                d = [];
            c && (d = c.allowedValues || []);
            return d
        },
        getDisplayValues: function(a, b) {
            var c =
                this.optionInfos[this.applyContextToOptionName(a, b)],
                d, e;
            d = [];
            if (c) {
                d = this.getAllowedValues(a, b);
                c = c.displayValues || [];
                for (e = 0; e < d.length; e += 1) void 0 === c[e] && (c[e] = d[e]);
                d = c
            }
            return d
        },
        getComboboxData: function(a, b) {
            var c = this.optionInfos[this.applyContextToOptionName(a, b)],
                d, e = [],
                f, g;
            if (c) {
                f = this.getAllowedValues(a, b);
                g = this.getDisplayValues(a, b);
                for (d = 0; d < c.allowedValues.length; d += 1) e.push({
                    name: f[d],
                    display: g[d]
                })
            }
            this.comboStores[c.name] ? this.comboStores[c.name].loadData(e) : this.comboStores[c.name] =
                new Ext.data.Store({
                    fields: ["name", "display"],
                    data: e
                });
            return this.comboStores[c.name]
        },
        getFieldEditor: function(a, b) {
            var c = this.optionInfos[this.applyContextToOptionName(a, b)],
                d, e = "textfield";
            c && (d = this.getReturnType(a, b), c.allowedValues ? e = "combobox" : d && (e = "String" === d ? "textfield" : "Number" === d ? "numberfield" : "Color" === d ? "colorpicker" : "CSSObject" === d ? "font-editor" : "Boolean" === d ? "checkboxfield" : "Array<Color>" === d ? "colorstripe" : "textfield"));
            return e
        },
        addApiRef: function(a) {
            this.optionInfos[a.name] = a;
            if (a.values) try {
                this.addEnum(a, JSON.parse(a.values))
            } catch (b) {
                console.log("warning: unable to parse: " + a.values)
            }
            this.addApiValidator(a.name, a.returnType, a.defaults)
        },
        addApiValidator: function(a, b, c) {
            "String" === b ? this.validators[a] = this.alwaysOk : "Number" === b && (this.validators[a] = null === c ? this.isNumberOrEmptyString : this.isNumber)
        },
        createEnumValidator: function(a) {
            return function(b) {
                return void 0 !== a.displayValues ? 0 <= a.displayValues.indexOf(b) || 0 <= a.allowedValues.indexOf(b) : 0 <= a.allowedValues.indexOf(b)
            }
        },
        addEnum: function(a, b) {
            -1 < b.indexOf(null) && (b[b.indexOf(null)] = "null", a.defaults = "null");
            a.addEnumAllowedValues(b);
            this.validators[a.name] = this.createEnumValidator(a)
        },
        addEnumDisplayValues: function(a, b) {
            var c = this.optionInfos[a];
            c && (c.addEnumDisplayValues(b), this.validators[a] = this.createEnumValidator(c))
        },
        listColors: function() {
            var a = [],
                b, c;
            for (c in this.optionInfos) this.optionInfos.hasOwnProperty(c) && (b = this.optionInfos[c], "Color" === this.getReturnType(c) && b.defaults && a.push(b.defaults));
            return a
        }
    };

    function ViewState() {
        this.state = {}
    }
    ViewState.prototype = {
        setState: function(a, b) {
            this.state[a] = b
        },
        getState: function(a) {
            return this.state[a]
        },
        asHashMap: function() {
            return this.state
        },
        asJSON: function() {
            return JSON.stringify(this.state)
        }
    };

    function Communicator(a) {
        this.serverConfiguration = a
    }
    Communicator.prototype = {
        save: function(a, b, c) {
            void 0 === a.getName() ? this.saveAs(a, b, c) : this.update(a, function(a, c, f) {
                b && b(a, c, f)
            }, function() {
                c && c()
            })
        },
        saveDraft: function(a, b, c) {
            void 0 === a.getName() ? this.saveAs(a, b, c) : this.updateDraft(a, function(a, c, f) {
                b && b(a, c, f)
            }, function() {
                c && c()
            })
        },
        saveAs: function(a, b, c) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/chart",
                dataType: "json",
                data: a.asJSON(),
                success: function(a) {
                    b(a.location, a.version, a.baseVersion)
                },
                error: function() {
                    c()
                }
            })
        },
        update: function(a,
            b, c) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/chart/" + a.getName(),
                dataType: "json",
                data: a.asJSON(),
                success: function(a) {
                    b(a.location, a.version, a.baseVersion)
                },
                error: function() {
                    c()
                }
            })
        },
        updateDraft: function(a, b, c) {
            $.ajax({
                type: "PATCH",
                url: this.serverConfiguration.apiPath + "/chart/" + a.getName(),
                dataType: "json",
                data: a.asJSON(),
                success: function(a) {
                    b(a.location, a.version, a.baseVersion)
                },
                error: function() {
                    c()
                }
            })
        },
        setAsBase: function(a, b, c) {
            a = {
                location: a.getName(),
                version: a.getVersion()
            };
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/setasbase",
                dataType: "json",
                data: JSON.stringify(a),
                success: function(a) {
                    b(a.location, a.version, a.baseVersion)
                },
                error: function(a, b, f) {
                    c(f)
                }
            })
        },
        setPrivateToOwner: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/setprivate",
                dataType: "json",
                data: JSON.stringify({
                    location: a,
                    privateToOwner: b
                }),
                success: function(a) {
                    c(a.location, a.privateToOwner)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        setTitle: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath +
                    "/settitle",
                dataType: "json",
                data: JSON.stringify({
                    location: a,
                    title: b
                }),
                success: function(a) {
                    c(a.location, a.title)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        setUserDisplayName: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/setuserdisplayname",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    displayName: b
                }),
                success: function(a) {
                    c(a.userId, a.displayName)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        setUserEmail: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/setuseremail",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    email: b
                }),
                success: function(a) {
                    c(a.userId, a.email)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        setUserStartPrivate: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/setuserstartprivate",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    startPrivate: b
                }),
                success: function(a) {
                    c(a.userId, a.startPrivate)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        setRememberMe: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/setrememberme",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    rememberMe: b
                }),
                success: function(a) {
                    c(a.userId, a.rememberMe)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        listCharts: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/listcharts",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    page: b,
                    deleted: !1
                }),
                success: function(a) {
                    c(a.pageItems, a.pageCount)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        listDeletedCharts: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/listcharts",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    page: b,
                    deleted: !0
                }),
                success: function(a) {
                    c(a.pageItems, a.pageCount)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        get: function(a, b, c, d) {
            $.ajax({
                type: "GET",
                url: this.serverConfiguration.apiPath + "/chart/" + a + "/" + b,
                dataType: "json",
                success: function(d) {
                    var f = new Configuration(a, b);
                    f.deserialize(d);
                    c(f)
                },
                error: function() {
                    d()
                }
            })
        },
        getApiInfo: function() {
            var a = [];
            $.ajax({
                type: "GET",
                url: "http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/DATA-VISUALISATION/HIGHCHARTS/api/api.json",
                async: !1,
                dataType: "json",
                success: function(b) {
                    var c, d, e;
                    for (e in b)
                        if (b.hasOwnProperty(e))
                            for (c = 0; c <
                                b[e].length; c += 1) d = b[e][c], a.push(new OptionInfo(d.name, d.returnType, d.title, d.description, d.depricated, d.defaults, d.values, d.requiresLicense))
								
								
                },
                error: function() {
					console.log(this.serverConfiguration.apiPath)
                    console.log("error getting api chart options?!")
                }
            });
            return a
        },
        getApiOptionsTree: function(a) {
            $.ajax({
                type: "GET",
                url: "http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/DATA-VISUALISATION/HIGHCHARTS/options/tree/tree.json",
                async: !1,
                dataType: "json",
                success: function(b) {
                    a(b)
                },
                error: function() {
                    console.log("error getting api chart options?!")
                }
            })
        },
        getLang: function(a) {
            var b;
            $.ajax({
                type: "GET",
                url: "http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/DATA-VISUALISATION/HIGHCHARTS/lang/en/en.json",
                async: !1,
                dataType: "json",
                success: function(a) {
                    b = a
                },
                error: function() {
                    console.log("error ?!")
                }
            });
            return b
        },
        getViewState: function(a, b, c) {
            $.ajax({
                type: "GET",
                url: this.serverConfiguration.apiPath + "/state/" + a.getName() + "/" + a.getVersion(),
                dataType: "json",
                success: function(a) {
                    var c = new ViewState,
                        f;
                    for (f in a) a.hasOwnProperty(f) && c.setState(f, a[f]);
                    b(c)
                },
                error: function() {
                    c()
                }
            })
        },
        saveViewState: function(a, b, c, d, e) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/state/" + b + "/" + c,
                dataType: "json",
                data: a.asJSON(),
                success: function(a) {
                    d(a.location, a.version, a.baseVersion)
                },
                error: function() {
                    e()
                }
            })
        },
        deleteConfiguration: function(a, b, c) {
            $.ajax({
                type: "DELETE",
                url: this.serverConfiguration.apiPath + "/chart/" + a,
                success: function() {
                    b()
                },
                error: function(a, b, f) {
                    c(f)
                }
            })
        },
        undeleteConfiguration: function(a, b, c) {
            $.ajax({
                type: "PUT",
                url: this.serverConfiguration.apiPath + "/chart/" + a,
                success: function() {
                    b()
                },
                error: function(a, b, f) {
                    c(f)
                }
            })
        },
        listLicensedProducts: function(a, b, c) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath +
                    "/listlicensedproducts",
                dataType: "json",
                data: JSON.stringify({
                    userId: a
                }),
                success: function(a) {
                    b(a.products, a.subscriptions)
                },
                error: function(a, b, f) {
                    c(f)
                }
            })
        },
        registerLicense: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/registerlicense",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    licenseKey: b
                }),
                success: function(a) {
                    c(a.userId, a.productName)
                },
                error: function(a, b, c) {
                    d(c)
                }
            })
        },
        addMessageDisplayed: function(a, b, c) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/displayedmessage",
                dataType: "json",
                data: JSON.stringify({
                    messageId: a
                }),
                success: function() {
                    b && b()
                },
                error: function(a, b, f) {
                    c && c(f)
                }
            })
        },
        getStorage: function() {
            return window.sessionStorage
        },
        supportsClientStorage: function() {
            return void 0 !== this.getStorage()
        },
        storedInClient: function() {
            var a = this.getStorage();
            return void 0 !== a && null !== a.getItem("configuration") && null !== a.getItem("viewState")
        },
        clearClientStorage: function() {
            var a = this.getStorage();
            a.removeItem("configuration");
            a.removeItem("viewState")
        },
        writeConfigurationToClientStorage: function(a) {
            this.getStorage().setItem("configuration",
                a.asJSON())
        },
        writeViewStateToClientStorage: function(a) {
            this.getStorage().setItem("viewState", a.asJSON())
        },
        readConfigurationFromClientStorage: function(a, b) {
            var c = this.getStorage(),
                d = JSON.parse(c.getItem("configuration")),
                e = new Configuration(a, b);
            e.deserialize(d);
            c.removeItem("configuration");
            return e
        },
        readViewStateFromClientStorage: function() {
            var a = this.getStorage(),
                b = new ViewState,
                c, d = JSON.parse(a.getItem("viewState"));
            for (c in d) d.hasOwnProperty(c) && b.setState(c, d[c]);
            a.removeItem("viewState");
            return b
        },
        createExport: function(a, b, c) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/export",
                dataType: "json",
                data: JSON.stringify({
                    userId: a
                }),
                success: function(a) {
                    b(a.exportId)
                },
                error: function() {
                    c()
                }
            })
        },
        deleteExport: function(a, b, c) {
            $.ajax({
                type: "DELETE",
                url: this.serverConfiguration.apiPath + "/export/" + a,
                dataType: "json",
                success: function(a) {
                    b(a.exportId)
                },
                error: function() {
                    c()
                }
            })
        },
        listExports: function(a, b) {
            $.ajax({
                type: "GET",
                url: this.serverConfiguration.apiPath + "/export",
                dataType: "json",
                success: function(b) {
                    a(b.pageItems,
                        b.pageCount)
                },
                error: function(a, d, e) {
                    b(e)
                }
            })
        },
        listLogins: function(a, b) {
            $.ajax({
                type: "GET",
                url: this.serverConfiguration.apiPath + "/logins",
                dataType: "json",
                success: function(b) {
                    a(b.logins)
                },
                error: function(a, d, e) {
                    b(e)
                }
            })
        },
        deleteLogin: function(a, b, c) {
            $.ajax({
                type: "DELETE",
                url: this.serverConfiguration.apiPath + "/logins/" + a,
                dataType: "json",
                success: function() {
                    b()
                },
                error: function() {
                    c()
                }
            })
        },
        createOrUpdatePaymentSubscription: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/subscription/",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    planCode: b
                }),
                success: function(a) {
                    c && c(a.userId, a.uuid, a, a.errorDescription)
                },
                error: function(a, b, c) {
                    d && d(c)
                }
            })
        },
        getUserSubscription: function(a, b, c) {
            $.ajax({
                type: "GET",
                url: this.serverConfiguration.apiPath + "/subscription/",
                dataType: "json",
                success: function(a) {
                    b && b(a.userId, a.uuid, a, a.errorDescription)
                },
                error: function(a, b, f) {
                    c && c(f)
                }
            })
        },
        getUserAdjustments: function(a, b, c) {
            $.ajax({
                type: "GET",
                url: this.serverConfiguration.apiPath + "/adjustments/",
                dataType: "json",
                success: function(a) {
                    b && b(a.userId, a.charges, a.credits, a.errorDescription)
                },
                error: function(a, b, f) {
                    c && c(f)
                }
            })
        },
        getUserSubscriptionUsage: function(a, b, c) {
            $.ajax({
                type: "GET",
                url: this.serverConfiguration.apiPath + "/usage/",
                dataType: "json",
                success: function(a) {
                    b && b(a.userQuotas)
                },
                error: function(a, b, f) {
                    c && c(f)
                }
            })
        },
        createOrUpdatePaymentAccount: function(a, b, c, d) {
            $.ajax({
                type: "POST",
                url: this.serverConfiguration.apiPath + "/account/",
                dataType: "json",
                data: JSON.stringify({
                    userId: a,
                    billingToken: b
                }),
                success: function(a) {
                    a.recurlyErrors ?
                        d && d("transaction error", a.recurlyErrors) : c && c(a.billingInfo)
                },
                error: function(a, b, c) {
                    d && d(c, null)
                }
            })
        },
        deleteBillingInfo: function(a, b, c) {
            $.ajax({
                type: "DELETE",
                url: this.serverConfiguration.apiPath + "/account/",
                dataType: "json",
                data: JSON.stringify({
                    userId: a
                }),
                success: function(a) {
                    a.recurlyErrors ? c && c("transaction error", a.recurlyErrors) : b && b(a.billingInfo)
                },
                error: function(a, b, f) {
                    c && c(f, null)
                }
            })
        },
        postToRunner: function(a, b, c) {
            var d;
            d = document.createElement("form");
            d.target = c;
            d.action = this.serverConfiguration.runnerUrl +
                "/_runner";
            d.method = "POST";
            c = document.createElement("input");
            c.type = "hidden";
            c.name = "settings";
            c.value = a.asJSON();
            d.appendChild(c);
            c = document.createElement("input");
            c.type = "hidden";
            c.name = "state";
            c.value = b.asJSON();
            d.appendChild(c);
            document.body.appendChild(d);
            d.submit();
            document.body.removeChild(d)
        }
    };

    function Configuration(a, b, c) {
        this.settings = {};
        this.name = a;
        this.version = b;
        this.configurations = {};
        this.linkedData = void 0;
        this.parent = c;
        this.modified = !1;
        this.defaultCustomCode = '/*\n// Sample of extending options:\nHighcharts.extend(options, Highcharts.merge(options, {\n    chart: {\n        backgroundColor: "#bada55"\n    },\n    plotOptions: {\n        series: {\n            cursor: "pointer",\n            events: {\n                click: function(event) {\n                    alert(this.name + " clicked\\n" +\n                          "Alt: " + event.altKey + "\\n" +\n                          "Control: " + event.ctrlKey + "\\n" +\n                          "Shift: " + event.shiftKey + "\\n");\n                }\n            }\n        }\n    }\n}));\n*/\n';
        this.customCode = void 0;
        this.chainedSettings = {};
        this.addChainedSetting("series-seriesMapping--label", -1, "series<*>-dataLabels--enabled", !0);
        this.addChainedSetting("series-seriesMapping--label", -1, "series-dataLabels--format", "{point.label}")
    }
    Configuration.prototype = {
        getParent: function() {
            return this.parent
        },
        getName: function() {
            return this.name
        },
        setName: function(a) {
            this.name = a
        },
        setLinkedTo: function(a, b) {
            this.linkedDataIndex = a;
            this.linkedData = b
        },
        getLinkedTo: function() {
            return this.linkedDataIndex
        },
        getVersion: function() {
            return this.version
        },
        setModified: function(a) {
            this.modified = a
        },
        isModified: function() {
            var a = this.modified,
                b, c, d;
            if (!a)
                for (b in this.configurations)
                    if (this.configurations.hasOwnProperty(b)) {
                        c = this.listIndexedConfigurations(b);
                        for (d = 0; d < c.length; d += 1) a = a || c[d].isModified()
                    }
            return a
        },
        containsOptionThatRequiresLicense: function(a) {
            var b = this.getSettingsContext(a),
                c = !1;
            this.traverseConfigurations(!1, !1, function(d) {
                c = c || a.getRequiresLicense(d, b)
            });
            return c
        },
        deserialize: function(a) {
            for (var b in a) a.hasOwnProperty(b) && ("_custom--code" === b ? this.customCode = a[b] : "_template--options" === b ? this.template = a[b] : "_template--id" === b ? this.templateId = a[b] : "_template--constr" === b ? this.templateConstr = a[b] : this.deserializeSetting(b, a[b], null))
        },
        cleanOptionName: function(a) {
            var b = a && a.lastIndexOf("["),
                c = a && a.lastIndexOf("]");
            return 0 < b ? (a = a.substring(0, b) + a.substr(c + 1), this.cleanOptionName(a)) : a
        },
        deserializeSetting: function(a, b, c) {
            var d, e, f, g, h;
            if (0 < a.indexOf("[")) {
                d = PrettyPrintConfiguration.prototype.extractPathAndLeaf(a);
                e = d[0];
                f = [];
                d = this;
                for (g = 0; g < e.length; g += 1) h = e[g], 0 > h.indexOf("[") ? f.push(h) : (f.push(h), h = PrettyPrintConfiguration.prototype.extractNameAndIndex(f.join("-")), f = d.getIndexedConfiguration(h[0], h[1]), void 0 === f && (f = d.addIndexedConfiguration(h[0],
                    h[1])), d = f, f = []);
                a = this.cleanOptionName(a);
                d.setSetting(a, b, c)
            } else this.setSetting(a, b, c)
        },
        setSetting: function(a, b, c) {
            var d, e, f, g = this.hasTemplateSetting(a);
            c ? (this.modified = !0, f = this.getSettingsContext(c), d = c.getReturnType(a, f), e = c.getDefaultValue(a, f), "combobox" === c.getFieldEditor(a, f) && b === e && !g ? this.removeSetting(a) : "String" === d ? this.isLangOption(a) ? this.settings[a] = b : b === e && !g ? this.removeSetting(a) : this.settings[a] = "" === b ? null : b : "Boolean" === d && b === e && !g ? this.removeSetting(a) : "Number" === d && b ===
                e && !g ? this.removeSetting(a) : "Array" === d || "Array<Mixed>" === d ? (b === e || "" === b) && !g ? this.removeSetting(a) : (c = b.split(","), c = c.map(function(a) {
                    return a.trim()
                }), this.settings[a] = c) : "CSSObject" === d ? (delete b.toString, b = stripDefaultValues(b, e), void 0 !== b ? this.settings[a] = b : this.removeSetting(a)) : "Color" === d && ("" === b || b === e) ? this.removeSetting(a) : this.settings[a] = b, this.handleChainedSettings(a, b)) : this.settings[a] = b
        },
        addChainedSetting: function(a, b, c, d) {
            void 0 === this.chainedSettings[a] && (this.chainedSettings[a] = []);
            this.chainedSettings[a].push({
                disablingValue: b,
                name: c,
                value: d
            })
        },
        handleChainedSettings: function(a, b) {
            var c = this.chainedSettings[a],
                d, e;
            if (c)
                for (d = 0; d < c.length; d += 1) e = c[d], b !== e.disablingValue ? this.setSetting(e.name, e.value) : this.removeSetting(e.name)
        },
        removeSetting: function(a) {
            delete this.settings[a]
        },
        getSetting: function(a) {
            return this.hasLinkedData() ? this.getLinkedSetting(a) : this.settings[a]
        },
        getTemplateSetting: function(a) {
            if (this.template) return this.template[a]
        },
        getLinkedSetting: function(a) {
            return "xAxis--type" ===
                a ? (this.linkedData.xAxis || {}).type : "series--name" === a ? this.linkedData.series[this.getLinkedTo()].name : "series-data" === a ? this.linkedData.series[this.getLinkedTo()].data : this.settings[a]
        },
        hasSetting: function(a) {
            return this.settings.hasOwnProperty(a)
        },
        hasTemplateSetting: function(a) {
            return this.template ? this.template.hasOwnProperty(a) : !1
        },
        listSettings: function() {
            return Object.keys(this.settings)
        },
        getOverlappingSettings: function(a) {
            var b = a ? this.template : this.settings,
                a = a ? this.settings : this.template,
                c = {},
                d;
            if (void 0 !== b && void 0 !== a)
                for (d in b) b.hasOwnProperty(d) && a.hasOwnProperty(d) && a[d] !== b[d] && (c[d] = b[d]);
            return c
        },
        addIndexedConfiguration: function(a, b) {
            void 0 === this.configurations[a] && (this.configurations[a] = []);
            var c = new Configuration(void 0, void 0, this);
            void 0 !== b ? this.configurations[a][b] = c : this.configurations[a].push(c);
            return c
        },
        removeIndexedConfiguration: function(a, b) {
            this.configurations[a].splice(b, 1)
        },
        moveIndexedConfiguration: function(a, b, c) {
            var d = this.configurations[a],
                e = d[b];
            if ("series" ===
                a) {
                d = this.listSortedSeries();
                e = d[b];
                d.splice(b, 1);
                d.splice(c, 0, e);
                for (a = 0; a < d.length; a += 1) d[a].setSetting("series--index", a)
            } else d.splice(b, 1), d.splice(c, 0, e)
        },
        listSortedSeries: function() {
            var a = this.configurations.series,
                a = a ? a.slice(0) : [];
            a.sort(function(a, c) {
                return a.getSetting("series--index") - c.getSetting("series--index")
            });
            return a
        },
        listIndexedConfigurations: function(a) {
            return this.configurations[a] || []
        },
        getSortedSeries: function(a) {
            return this.listSortedSeries()[a]
        },
        getIndexedConfiguration: function(a,
            b) {
            return void 0 === this.configurations[a] ? void 0 : this.configurations[a][b]
        },
        getSettingsContext: function(a) {
            var b = this;
            return {
                getStarReplacement: function() {
                    var c, d = b.getParent();
                    return void 0 === d ? a.getDefaultValue("chart--type") : (c = b.getSetting("series--type")) || (c = d.getSetting("chart--type")) || (c = d.getTemplateSetting("series[" + b.linkedDataIndex + "]--type")) ? c : (c = d.getTemplateSetting("chart--type")) ? c : a.getDefaultValue("chart--type")
                }
            }
        },
        isLangOption: function(a) {
            return 0 === a.indexOf("lang--") || 0 === a.indexOf("global--")
        },
        traverseConfigurations: function(a, b, c) {
            for (var d in this.settings) this.settings.hasOwnProperty(d) && (b ? this.isLangOption(d) && c(d, this.settings[d]) : this.isLangOption(d) || c(d, this.settings[d]));
            if (!b)
                for (d in a && this.hasLinkedData() && (b = this.getSetting("xAxis--type"), void 0 !== b && c("xAxis--type", b)), this.configurations) this.configurations.hasOwnProperty(d) && (b = this.listIndexedConfigurations(d), this.traverseIndexedConfigurations(a, d, b, c))
        },
        traverseIndexedConfigurations: function(a, b, c, d) {
            var e, f, g, h, i;
            for (e = 0; e < c.length; e += 1) {
                h = c[e];
                for (f in h.settings) h.settings.hasOwnProperty(f) && (g = h.settings[f], i = b.length, i = f.substr(i), d(b + "[" + e + "]" + i, g));
                "series" === b && a && h.hasLinkedData() && (d(b + "[" + e + "]--name", h.getSetting("series--name")), d(b + "[" + e + "]-data", h.getSetting("series-data")))
            }
        },
        getColumnCount: function() {
            var a, b = 0,
                c = this.linkedData && this.linkedData.series || [],
                d;
            for (a = 0; a < c.length; a += 1) d = c[a].data[0], d = d.constructor === Array ? c[a].data[0].length : Object.keys(d).length, b += d;
            return b - c.length
        },
        traverseTemplateConfigurations: function(a) {
            for (var b in this.template) this.template.hasOwnProperty(b) &&
                a(b, this.template[b])
        },
        getTemplate: function() {
            return this.template
        },
        setTemplate: function(a, b) {
            this.templateId = a;
            this.template = b.config;
            void 0 !== b.constr ? this.templateConstr = b.constr : delete this.templateConstr;
            this.setModified(!0)
        },
        asHashMap: function() {
            var a = {};
            this.traverseConfigurations(!1, !1, function(b, c) {
                a[b] = c
            });
            this.traverseConfigurations(!1, !0, function(b, c) {
                a[b] = c
            });
            this.customCode && (a["_custom--code"] = this.customCode);
            this.template && (a["_template--options"] = this.template);
            this.templateId &&
                (a["_template--id"] = this.templateId);
            this.templateConstr && (a["_template--constr"] = this.templateConstr);
            return a
        },
        asJSON: function() {
            return JSON.stringify(this.asHashMap())
        },
        asObjectGraph: function(a) {
            var b = new PrettyPrintConfiguration(null);
            this.traverseConfigurations(a, !1, function(a, d) {
                b.addSetting(a, d)
            });
            return b.getObjectGraph()
        },
        asTemplateObjectGraph: function() {
            var a = new PrettyPrintConfiguration(null);
            this.traverseTemplateConfigurations(function(b, c) {
                a.addSetting(b, c)
            });
            return a.getObjectGraph()
        },
        getCustomCode: function() {
            return this.customCode ? this.customCode : this.defaultCustomCode
        },
        setCustomCode: function(a) {
            this.customCode = !a || a === this.defaultCustomCode ? void 0 : a;
            this.setModified(!0)
        },
        hasCustomCode: function() {
            return this.customCode && this.customCode !== this.defaultCustomCode
        },
        listColors: function(a) {
            var b = [],
                c = this.getSettingsContext(a);
            this.traverseConfigurations(!1, !1, function(d, e) {
                a.getReturnType(d, c) === "Color" && e && b.push(e)
            });
            return b
        },
        needsSeriesReload: function(a) {
            return "chart--type" ===
                a || "series--type" === a || -1 !== a.indexOf("seriesMapping--")
        },
        asLangObjectGraph: function() {
            var a = new PrettyPrintConfiguration(null);
            this.traverseConfigurations(!1, !0, function(b, c) {
                a.addSetting(b, c)
            });
            return a.getObjectGraph()
        },
        hasLinkedData: function() {
            return null !== this.linkedData && void 0 !== this.linkedData
        },
        setLinkedData: function(a) {
            var b, c, d, e, f, g;
            d = this.listIndexedConfigurations("series");
            if (a) {
                this.linkedData = a;
                f = d.length;
                g = a.series.length;
                if (g < f)
                    for (b = f; b > g; b -= 1)
                        for (c = 0; c < f; c += 1)
                            if (e = d[c], e.getLinkedTo() ===
                                b - 1) {
                                this.removeIndexedConfiguration("series", c);
                                break
                            }
                d = this.listIndexedConfigurations("series");
                for (b = 0; b < d.length; b += 1) e = d[b], c = e.getLinkedTo(), void 0 === c && (c = b), e.setLinkedTo(c, a);
                if (g > f)
                    for (b = f; b < g; b += 1) d = this.addIndexedConfiguration("series"), d.setLinkedTo(b, a), d.setSetting("series--index", b)
            } else {
                this.linkedData = void 0;
                a = d.length;
                for (b = 0; b < a; b += 1) this.removeIndexedConfiguration("series", 0)
            }
        },
        asSeriesMappingObjectGraph: function() {
            var a = [],
                b, c = this.asObjectGraph(!1).series,
                d;
            if (c) {
                d = c.length;
                for (b = 0; b < d; b += 1) c[b].seriesMapping ? a.push(c[b].seriesMapping) : a.push({});
                for (b = 0; b < d; b += 1) c = a[b], c.hasOwnProperty("x") || (c.x = 0)
            }
            return a
        }
    };

    function PrettyPrintConfiguration(a, b) {
        this.isLeaf = b;
        this.value = a;
        this.children = {};
        this.items = void 0
    }
    PrettyPrintConfiguration.prototype = {
        addSetting: function(a, b) {
            var c = this.extractPathAndLeaf(a);
            this.add(c[0], c[1], b)
        },
        extractPathAndLeaf: function(a) {
            var b;
            0 > a.indexOf("-") ? a = [
                [], a
            ] : (b = a.split("--"), a = b[0], b = b[1], a = a.split("-"), void 0 === b && (b = a.pop()), a = [a, b]);
            return a
        },
        add: function(a, b, c) {
            var d = this,
                e;
            for (e = 0; e < a.length; e += 1) d = d.getOrCreateNode(a[e]);
            d.children[b] = new PrettyPrintConfiguration(c, !0)
        },
        getOrCreateNode: function(a) {
            var b, c;
            0 > a.indexOf("[") ? (b = this.children[a], b || (b = new PrettyPrintConfiguration(null),
                this.children[a] = b)) : (b = this.extractNameAndIndex(a), a = b[0], c = b[1], b = this.children[a], b || (b = new PrettyPrintConfiguration(null), b.items = [], this.children[a] = b), a = b.items[c], a || (a = new PrettyPrintConfiguration(null), b.items[c] = a), b = a);
            return b
        },
        extractNameAndIndex: function(a) {
            var b = a.split("["),
                a = b[0],
                b = parseInt(b[1].substring(0, b[1].indexOf("]")), 10);
            return [a, b]
        },
        getObjectGraph: function() {
            return this.getObjectGraphForChildren(this)
        },
        getObjectGraphForChildren: function(a) {
            var b, c, d;
            if (void 0 !== a.items) {
                b = [];
                for (c = 0; c < a.items.length; c += 1) d = a.items[c], b[c] = void 0 === d ? {} : d.isLeaf ? d.value : this.getObjectGraphForChildren(d)
            } else
                for (c in b = {}, a.children) a.children.hasOwnProperty(c) && (d = a.children[c], b[c] = d.isLeaf ? d.value : this.getObjectGraphForChildren(d));
            return b
        }
    };

    function TreeViewUtils() {}
    TreeViewUtils.prototype = {
        createColumnRenderer: function(a) {
            return function(b, c, d) {
                d = a.getReturnType(d.raw.id, d.raw.settingsContext);
                "Color" === d ? (d = getForegroundColor(b), c.style = "color:" + d + ";background:" + b + ";") : "CSSObject" === d && (null === b && (b = {}), "object" === typeof b && (b.toString = function() {
                    var a = "",
                        b, c = function(a, b) {
                            return "-" + b.toLowerCase()
                        };
                    for (b in this) this.hasOwnProperty(b) && "function" !== typeof this[b] && (a = a + b.replace(/([A-Z])/g, c) + ": " + this[b] + ";");
                    return a
                }), b = b.toString());
                return b
            }
        },
        createCellEditor: function(a,
            b, c) {
            var d = new Ext.grid.plugin.CellEditing({
                clicksToEdit: 1
            });
            d.addListener("beforeedit", function(a, d) {
                var g = d.record.raw.id,
                    h = c.getFieldEditor(g, d.record.raw.settingsContext),
                    i = d.record.parentNode,
                    j = i.parentNode;
                if (null === j || "colorpicker" === h) return !1;
                i = null === j ? j.indexOf(i) : void 0;
                if (b(d.record.raw.id, i) || 2 === d.colIdx) return !1;
                "font-editor" === h && (h = "css-editor");
                "colorstripe" === h && (h = "textfield");
                "combobox" === h ? (g = c.getComboboxData(g), g = {
                    xtype: "combobox",
                    store: g,
                    displayField: "display",
                    valueField: "name",
                    queryMode: "local",
                    forceSelection: !0,
                    editable: !1
                }, d.column.setEditor(g)) : d.column.setEditor(h);
                return 0 === d.record.childNodes.length
            });
            d.addListener("validateedit", function(a, b) {
                var d = a.getEditor(b.record, b.column),
                    h = d.getValue();
                "CSSObject" === c.getReturnType(b.record.raw.id, b.record.raw.settingsContext) && d.field && (h = d.field.cssObject);
                return c.validate(b.record.raw.id, h)
            });
            d.addListener("edit", function(b, d) {
                var g = b.getEditor(d.record, d.column),
                    h = c.getReturnType(d.record.raw.id, d.record.raw.settingsContext);
                "CSSObject" === h && g.field && (d.value = g.field.cssObject);
                "Array<Color>" === h && (d.value = d.value.split(/,(?![^(]*\))/));
                a(d.record.raw.id, d.value)
            });
            return d
        }
    };

    function DataSets() {}
    DataSets.prototype = {
        cityTemperature: "row,Tokyo,New York,Berlin,London\n1,7,-0.2,-0.9,3.9\n2,6.9,0.8,0.6,4.2\n3,9.5,5.7,3.5,5.7\n4,14.5,11.3,8.4,8.5\n5,18.2,17,13.5,11.9\n6,21.5,22,17,15.2\n7,25.2,24.8,18.6,17\n8,26.5,24.1,17.9,16.6\n9,23.3,20.1,14.3,14.2\n10,18.3,14.1,9,10.3\n11,13.9,8.6,3.9,6.6\n12,9.6,2.5,1,4.8",
        usdEurRate: "Date,Exchange rate\n2006-01-01,0.8446\n2006-01-02,0.8445\n2006-01-03,0.8444\n2006-01-04,0.8451\n2006-01-05,0.8418\n2006-01-06,0.8264\n2006-01-07,0.8258\n2006-01-08,0.8232\n2006-01-09,0.8233\n2006-01-10,0.8258\n2006-01-11,0.8283\n2006-01-12,0.8278\n2006-01-13,0.8256\n2006-01-14,0.8292\n2006-01-15,0.8239\n2006-01-16,0.8239\n2006-01-17,0.8245\n2006-01-18,0.8265\n2006-01-19,0.8261\n2006-01-20,0.8269\n2006-01-21,0.8273\n2006-01-22,0.8244\n2006-01-23,0.8244\n2006-01-24,0.8172\n2006-01-25,0.8139\n2006-01-26,0.8146\n2006-01-27,0.8164\n2006-01-28,0.82\n2006-01-29,0.8269\n2006-01-30,0.8269\n2006-01-31,0.8269\n2006-02-01,0.8258\n2006-02-02,0.8247\n2006-02-03,0.8286\n2006-02-04,0.8289\n2006-02-05,0.8316\n2006-02-06,0.832\n2006-02-07,0.8333\n2006-02-08,0.8352\n2006-02-09,0.8357\n2006-02-10,0.8355\n2006-02-11,0.8354\n2006-02-12,0.8403\n2006-02-13,0.8403\n2006-02-14,0.8406\n2006-02-15,0.8403\n2006-02-16,0.8396\n2006-02-17,0.8418\n2006-02-18,0.8409\n2006-02-19,0.8384\n2006-02-20,0.8386\n2006-02-21,0.8372\n2006-02-22,0.839\n2006-02-23,0.84\n2006-02-24,0.8389\n2006-02-25,0.84\n2006-02-26,0.8423\n2006-02-27,0.8423\n2006-02-28,0.8435\n2006-03-01,0.8422\n2006-03-02,0.838\n2006-03-03,0.8373\n2006-03-04,0.8316\n2006-03-05,0.8303\n2006-03-06,0.8303\n2006-03-07,0.8302\n2006-03-08,0.8369\n2006-03-09,0.84\n2006-03-10,0.8385\n2006-03-11,0.84\n2006-03-12,0.8401\n2006-03-13,0.8402\n2006-03-14,0.8381\n2006-03-15,0.8351\n2006-03-16,0.8314\n2006-03-17,0.8273\n2006-03-18,0.8213\n2006-03-19,0.8207\n2006-03-20,0.8207\n2006-03-21,0.8215\n2006-03-22,0.8242\n2006-03-23,0.8273\n2006-03-24,0.8301\n2006-03-25,0.8346\n2006-03-26,0.8312\n2006-03-27,0.8312\n2006-03-28,0.8312\n2006-03-29,0.8306\n2006-03-30,0.8327\n2006-03-31,0.8282\n2006-04-01,0.824\n2006-04-02,0.8255\n2006-04-03,0.8256\n2006-04-04,0.8273\n2006-04-05,0.8209\n2006-04-06,0.8151\n2006-04-07,0.8149\n2006-04-08,0.8213\n2006-04-09,0.8273\n2006-04-10,0.8273\n2006-04-11,0.8261\n2006-04-12,0.8252\n2006-04-13,0.824\n2006-04-14,0.8262\n2006-04-15,0.8258\n2006-04-16,0.8261\n2006-04-17,0.826\n2006-04-18,0.8199\n2006-04-19,0.8153\n2006-04-20,0.8097\n2006-04-21,0.8101\n2006-04-22,0.8119\n2006-04-23,0.8107\n2006-04-24,0.8105\n2006-04-25,0.8084\n2006-04-26,0.8069\n2006-04-27,0.8047\n2006-04-28,0.8023\n2006-04-29,0.7965\n2006-04-30,0.7919\n2006-05-01,0.7921\n2006-05-02,0.7922\n2006-05-03,0.7934\n2006-05-04,0.7918\n2006-05-05,0.7915\n2006-05-06,0.787\n2006-05-07,0.7861\n2006-05-08,0.7861\n2006-05-09,0.7853\n2006-05-10,0.7867\n2006-05-11,0.7827\n2006-05-12,0.7834\n2006-05-13,0.7766\n2006-05-14,0.7751\n2006-05-15,0.7739\n2006-05-16,0.7767\n2006-05-17,0.7802\n2006-05-18,0.7788\n2006-05-19,0.7828\n2006-05-20,0.7816\n2006-05-21,0.7829\n2006-05-22,0.783\n2006-05-23,0.7829\n2006-05-24,0.7781\n2006-05-25,0.7811\n2006-05-26,0.7831\n2006-05-27,0.7826\n2006-05-28,0.7855\n2006-05-29,0.7855\n2006-05-30,0.7845\n2006-05-31,0.7798\n2006-06-01,0.7777\n2006-06-02,0.7822\n2006-06-03,0.7785\n2006-06-04,0.7744\n2006-06-05,0.7743\n2006-06-06,0.7726\n2006-06-07,0.7766\n2006-06-08,0.7806\n2006-06-09,0.785\n2006-06-10,0.7907\n2006-06-11,0.7912\n2006-06-12,0.7913\n2006-06-13,0.7931\n2006-06-14,0.7952\n2006-06-15,0.7951\n2006-06-16,0.7928\n2006-06-17,0.791\n2006-06-18,0.7913\n2006-06-19,0.7912\n2006-06-20,0.7941\n2006-06-21,0.7953\n2006-06-22,0.7921\n2006-06-23,0.7919\n2006-06-24,0.7968\n2006-06-25,0.7999\n2006-06-26,0.7999\n2006-06-27,0.7974\n2006-06-28,0.7942\n2006-06-29,0.796\n2006-06-30,0.7969\n2006-07-01,0.7862\n2006-07-02,0.7821\n2006-07-03,0.7821\n2006-07-04,0.7821\n2006-07-05,0.7811\n2006-07-06,0.7833\n2006-07-07,0.7849\n2006-07-08,0.7819\n2006-07-09,0.7809\n2006-07-10,0.7809\n2006-07-11,0.7827\n2006-07-12,0.7848\n2006-07-13,0.785\n2006-07-14,0.7873\n2006-07-15,0.7894\n2006-07-16,0.7907\n2006-07-17,0.7909\n2006-07-18,0.7947\n2006-07-19,0.7987\n2006-07-20,0.799\n2006-07-21,0.7927\n2006-07-22,0.79\n2006-07-23,0.7878\n2006-07-24,0.7878\n2006-07-25,0.7907\n2006-07-26,0.7922\n2006-07-27,0.7937\n2006-07-28,0.786\n2006-07-29,0.787\n2006-07-30,0.7838\n2006-07-31,0.7838\n2006-08-01,0.7837\n2006-08-02,0.7836\n2006-08-03,0.7806\n2006-08-04,0.7825\n2006-08-05,0.7798\n2006-08-06,0.777\n2006-08-07,0.777\n2006-08-08,0.7772\n2006-08-09,0.7793\n2006-08-10,0.7788\n2006-08-11,0.7785\n2006-08-12,0.7832\n2006-08-13,0.7865\n2006-08-14,0.7865\n2006-08-15,0.7853\n2006-08-16,0.7847\n2006-08-17,0.7809\n2006-08-18,0.778\n2006-08-19,0.7799\n2006-08-20,0.78\n2006-08-21,0.7801\n2006-08-22,0.7765\n2006-08-23,0.7785\n2006-08-24,0.7811\n2006-08-25,0.782\n2006-08-26,0.7835\n2006-08-27,0.7845\n2006-08-28,0.7844\n2006-08-29,0.782\n2006-08-30,0.7811\n2006-08-31,0.7795\n2006-09-01,0.7794\n2006-09-02,0.7806\n2006-09-03,0.7794\n2006-09-04,0.7794\n2006-09-05,0.7778\n2006-09-06,0.7793\n2006-09-07,0.7808\n2006-09-08,0.7824\n2006-09-09,0.787\n2006-09-10,0.7894\n2006-09-11,0.7893\n2006-09-12,0.7882\n2006-09-13,0.7871\n2006-09-14,0.7882\n2006-09-15,0.7871\n2006-09-16,0.7878\n2006-09-17,0.79\n2006-09-18,0.7901\n2006-09-19,0.7898\n2006-09-20,0.7879\n2006-09-21,0.7886\n2006-09-22,0.7858\n2006-09-23,0.7814\n2006-09-24,0.7825\n2006-09-25,0.7826\n2006-09-26,0.7826\n2006-09-27,0.786\n2006-09-28,0.7878\n2006-09-29,0.7868\n2006-09-30,0.7883\n2006-10-01,0.7893\n2006-10-02,0.7892\n2006-10-03,0.7876\n2006-10-04,0.785\n2006-10-05,0.787\n2006-10-06,0.7873\n2006-10-07,0.7901\n2006-10-08,0.7936\n2006-10-09,0.7939\n2006-10-10,0.7938\n2006-10-11,0.7956\n2006-10-12,0.7975\n2006-10-13,0.7978\n2006-10-14,0.7972\n2006-10-15,0.7995\n2006-10-16,0.7995\n2006-10-17,0.7994\n2006-10-18,0.7976\n2006-10-19,0.7977\n2006-10-20,0.796\n2006-10-21,0.7922\n2006-10-22,0.7928\n2006-10-23,0.7929\n2006-10-24,0.7948\n2006-10-25,0.797\n2006-10-26,0.7953\n2006-10-27,0.7907\n2006-10-28,0.7872\n2006-10-29,0.7852\n2006-10-30,0.7852\n2006-10-31,0.786\n2006-11-01,0.7862\n2006-11-02,0.7836\n2006-11-03,0.7837\n2006-11-04,0.784\n2006-11-05,0.7867\n2006-11-06,0.7867\n2006-11-07,0.7869\n2006-11-08,0.7837\n2006-11-09,0.7827\n2006-11-10,0.7825\n2006-11-11,0.7779\n2006-11-12,0.7791\n2006-11-13,0.779\n2006-11-14,0.7787\n2006-11-15,0.78\n2006-11-16,0.7807\n2006-11-17,0.7803\n2006-11-18,0.7817\n2006-11-19,0.7799\n2006-11-20,0.7799\n2006-11-21,0.7795\n2006-11-22,0.7801\n2006-11-23,0.7765\n2006-11-24,0.7725\n2006-11-25,0.7683\n2006-11-26,0.7641\n2006-11-27,0.7639\n2006-11-28,0.7616\n2006-11-29,0.7608\n2006-11-30,0.759\n2006-12-01,0.7582\n2006-12-02,0.7539\n2006-12-03,0.75\n2006-12-04,0.75\n2006-12-05,0.7507\n2006-12-06,0.7505\n2006-12-07,0.7516\n2006-12-08,0.7522\n2006-12-09,0.7531\n2006-12-10,0.7577\n2006-12-11,0.7577\n2006-12-12,0.7582\n2006-12-13,0.755\n2006-12-14,0.7542\n2006-12-15,0.7576\n2006-12-16,0.7616\n2006-12-17,0.7648\n2006-12-18,0.7648\n2006-12-19,0.7641\n2006-12-20,0.7614\n2006-12-21,0.757\n2006-12-22,0.7587\n2006-12-23,0.7588\n2006-12-24,0.762\n2006-12-25,0.762\n2006-12-26,0.7617\n2006-12-27,0.7618\n2006-12-28,0.7615\n2006-12-29,0.7612\n2006-12-30,0.7596\n2006-12-31,0.758\n2007-01-01,0.758\n2007-01-02,0.758\n2007-01-03,0.7547\n2007-01-04,0.7549\n2007-01-05,0.7613\n2007-01-06,0.7655\n2007-01-07,0.7693\n2007-01-08,0.7694\n2007-01-09,0.7688\n2007-01-10,0.7678\n2007-01-11,0.7708\n2007-01-12,0.7727\n2007-01-13,0.7749\n2007-01-14,0.7741\n2007-01-15,0.7741\n2007-01-16,0.7732\n2007-01-17,0.7727\n2007-01-18,0.7737\n2007-01-19,0.7724\n2007-01-20,0.7712\n2007-01-21,0.772\n2007-01-22,0.7721\n2007-01-23,0.7717\n2007-01-24,0.7704\n2007-01-25,0.769\n2007-01-26,0.7711\n2007-01-27,0.774\n2007-01-28,0.7745\n2007-01-29,0.7745\n2007-01-30,0.774\n2007-01-31,0.7716\n2007-02-01,0.7713\n2007-02-02,0.7678\n2007-02-03,0.7688\n2007-02-04,0.7718\n2007-02-05,0.7718\n2007-02-06,0.7728\n2007-02-07,0.7729\n2007-02-08,0.7698\n2007-02-09,0.7685\n2007-02-10,0.7681\n2007-02-11,0.769\n2007-02-12,0.769\n2007-02-13,0.7698\n2007-02-14,0.7699\n2007-02-15,0.7651\n2007-02-16,0.7613\n2007-02-17,0.7616\n2007-02-18,0.7614\n2007-02-19,0.7614\n2007-02-20,0.7607\n2007-02-21,0.7602\n2007-02-22,0.7611\n2007-02-23,0.7622\n2007-02-24,0.7615\n2007-02-25,0.7598\n2007-02-26,0.7598\n2007-02-27,0.7592\n2007-02-28,0.7573\n2007-03-01,0.7566\n2007-03-02,0.7567\n2007-03-03,0.7591\n2007-03-04,0.7582\n2007-03-05,0.7585\n2007-03-06,0.7613\n2007-03-07,0.7631\n2007-03-08,0.7615\n2007-03-09,0.76\n2007-03-10,0.7613\n2007-03-11,0.7627\n2007-03-12,0.7627\n2007-03-13,0.7608\n2007-03-14,0.7583\n2007-03-15,0.7575\n2007-03-16,0.7562\n2007-03-17,0.752\n2007-03-18,0.7512\n2007-03-19,0.7512\n2007-03-20,0.7517\n2007-03-21,0.752\n2007-03-22,0.7511\n2007-03-23,0.748\n2007-03-24,0.7509\n2007-03-25,0.7531\n2007-03-26,0.7531\n2007-03-27,0.7527\n2007-03-28,0.7498\n2007-03-29,0.7493\n2007-03-30,0.7504\n2007-03-31,0.75\n2007-04-01,0.7491\n2007-04-02,0.7491\n2007-04-03,0.7485\n2007-04-04,0.7484\n2007-04-05,0.7492\n2007-04-06,0.7471\n2007-04-07,0.7459\n2007-04-08,0.7477\n2007-04-09,0.7477\n2007-04-10,0.7483\n2007-04-11,0.7458\n2007-04-12,0.7448\n2007-04-13,0.743\n2007-04-14,0.7399\n2007-04-15,0.7395\n2007-04-16,0.7395\n2007-04-17,0.7378\n2007-04-18,0.7382\n2007-04-19,0.7362\n2007-04-20,0.7355\n2007-04-21,0.7348\n2007-04-22,0.7361\n2007-04-23,0.7361\n2007-04-24,0.7365\n2007-04-25,0.7362\n2007-04-26,0.7331\n2007-04-27,0.7339\n2007-04-28,0.7344\n2007-04-29,0.7327\n2007-04-30,0.7327\n2007-05-01,0.7336\n2007-05-02,0.7333\n2007-05-03,0.7359\n2007-05-04,0.7359\n2007-05-05,0.7372\n2007-05-06,0.736\n2007-05-07,0.736\n2007-05-08,0.735\n2007-05-09,0.7365\n2007-05-10,0.7384\n2007-05-11,0.7395\n2007-05-12,0.7413\n2007-05-13,0.7397\n2007-05-14,0.7396\n2007-05-15,0.7385\n2007-05-16,0.7378\n2007-05-17,0.7366\n2007-05-18,0.74\n2007-05-19,0.7411\n2007-05-20,0.7406\n2007-05-21,0.7405\n2007-05-22,0.7414\n2007-05-23,0.7431\n2007-05-24,0.7431\n2007-05-25,0.7438\n2007-05-26,0.7443\n2007-05-27,0.7443\n2007-05-28,0.7443\n2007-05-29,0.7434\n2007-05-30,0.7429\n2007-05-31,0.7442\n2007-06-01,0.744\n2007-06-02,0.7439\n2007-06-03,0.7437\n2007-06-04,0.7437\n2007-06-05,0.7429\n2007-06-06,0.7403\n2007-06-07,0.7399\n2007-06-08,0.7418\n2007-06-09,0.7468\n2007-06-10,0.748\n2007-06-11,0.748\n2007-06-12,0.749\n2007-06-13,0.7494\n2007-06-14,0.7522\n2007-06-15,0.7515\n2007-06-16,0.7502\n2007-06-17,0.7472\n2007-06-18,0.7472\n2007-06-19,0.7462\n2007-06-20,0.7455\n2007-06-21,0.7449\n2007-06-22,0.7467\n2007-06-23,0.7458\n2007-06-24,0.7427\n2007-06-25,0.7427\n2007-06-26,0.743\n2007-06-27,0.7429\n2007-06-28,0.744\n2007-06-29,0.743\n2007-06-30,0.7422\n2007-07-01,0.7388\n2007-07-02,0.7388\n2007-07-03,0.7369\n2007-07-04,0.7345\n2007-07-05,0.7345\n2007-07-06,0.7345\n2007-07-07,0.7352\n2007-07-08,0.7341\n2007-07-09,0.7341\n2007-07-10,0.734\n2007-07-11,0.7324\n2007-07-12,0.7272\n2007-07-13,0.7264\n2007-07-14,0.7255\n2007-07-15,0.7258\n2007-07-16,0.7258\n2007-07-17,0.7256\n2007-07-18,0.7257\n2007-07-19,0.7247\n2007-07-20,0.7243\n2007-07-21,0.7244\n2007-07-22,0.7235\n2007-07-23,0.7235\n2007-07-24,0.7235\n2007-07-25,0.7235\n2007-07-26,0.7262\n2007-07-27,0.7288\n2007-07-28,0.7301\n2007-07-29,0.7337\n2007-07-30,0.7337\n2007-07-31,0.7324\n2007-08-01,0.7297\n2007-08-02,0.7317\n2007-08-03,0.7315\n2007-08-04,0.7288\n2007-08-05,0.7263\n2007-08-06,0.7263\n2007-08-07,0.7242\n2007-08-08,0.7253\n2007-08-09,0.7264\n2007-08-10,0.727\n2007-08-11,0.7312\n2007-08-12,0.7305\n2007-08-13,0.7305\n2007-08-14,0.7318\n2007-08-15,0.7358\n2007-08-16,0.7409\n2007-08-17,0.7454\n2007-08-18,0.7437\n2007-08-19,0.7424\n2007-08-20,0.7424\n2007-08-21,0.7415\n2007-08-22,0.7419\n2007-08-23,0.7414\n2007-08-24,0.7377\n2007-08-25,0.7355\n2007-08-26,0.7315\n2007-08-27,0.7315\n2007-08-28,0.732\n2007-08-29,0.7332\n2007-08-30,0.7346\n2007-08-31,0.7328\n2007-09-01,0.7323\n2007-09-02,0.734\n2007-09-03,0.734\n2007-09-04,0.7336\n2007-09-05,0.7351\n2007-09-06,0.7346\n2007-09-07,0.7321\n2007-09-08,0.7294\n2007-09-09,0.7266\n2007-09-10,0.7266\n2007-09-11,0.7254\n2007-09-12,0.7242\n2007-09-13,0.7213\n2007-09-14,0.7197\n2007-09-15,0.7209\n2007-09-16,0.721\n2007-09-17,0.721\n2007-09-18,0.721\n2007-09-19,0.7209\n2007-09-20,0.7159\n2007-09-21,0.7133\n2007-09-22,0.7105\n2007-09-23,0.7099\n2007-09-24,0.7099\n2007-09-25,0.7093\n2007-09-26,0.7093\n2007-09-27,0.7076\n2007-09-28,0.707\n2007-09-29,0.7049\n2007-09-30,0.7012\n2007-10-01,0.7011\n2007-10-02,0.7019\n2007-10-03,0.7046\n2007-10-04,0.7063\n2007-10-05,0.7089\n2007-10-06,0.7077\n2007-10-07,0.7077\n2007-10-08,0.7077\n2007-10-09,0.7091\n2007-10-10,0.7118\n2007-10-11,0.7079\n2007-10-12,0.7053\n2007-10-13,0.705\n2007-10-14,0.7055\n2007-10-15,0.7055\n2007-10-16,0.7045\n2007-10-17,0.7051\n2007-10-18,0.7051\n2007-10-19,0.7017\n2007-10-20,0.7\n2007-10-21,0.6995\n2007-10-22,0.6994\n2007-10-23,0.7014\n2007-10-24,0.7036\n2007-10-25,0.7021\n2007-10-26,0.7002\n2007-10-27,0.6967\n2007-10-28,0.695\n2007-10-29,0.695\n2007-10-30,0.6939\n2007-10-31,0.694\n2007-11-01,0.6922\n2007-11-02,0.6919\n2007-11-03,0.6914\n2007-11-04,0.6894\n2007-11-05,0.6891\n2007-11-06,0.6904\n2007-11-07,0.689\n2007-11-08,0.6834\n2007-11-09,0.6823\n2007-11-10,0.6807\n2007-11-11,0.6815\n2007-11-12,0.6815\n2007-11-13,0.6847\n2007-11-14,0.6859\n2007-11-15,0.6822\n2007-11-16,0.6827\n2007-11-17,0.6837\n2007-11-18,0.6823\n2007-11-19,0.6822\n2007-11-20,0.6822\n2007-11-21,0.6792\n2007-11-22,0.6746\n2007-11-23,0.6735\n2007-11-24,0.6731\n2007-11-25,0.6742\n2007-11-26,0.6744\n2007-11-27,0.6739\n2007-11-28,0.6731\n2007-11-29,0.6761\n2007-11-30,0.6761\n2007-12-01,0.6785\n2007-12-02,0.6818\n2007-12-03,0.6836\n2007-12-04,0.6823\n2007-12-05,0.6805\n2007-12-06,0.6793\n2007-12-07,0.6849\n2007-12-08,0.6833\n2007-12-09,0.6825\n2007-12-10,0.6825\n2007-12-11,0.6816\n2007-12-12,0.6799\n2007-12-13,0.6813\n2007-12-14,0.6809\n2007-12-15,0.6868\n2007-12-16,0.6933\n2007-12-17,0.6933\n2007-12-18,0.6945\n2007-12-19,0.6944\n2007-12-20,0.6946\n2007-12-21,0.6964\n2007-12-22,0.6965\n2007-12-23,0.6956\n2007-12-24,0.6956\n2007-12-25,0.695\n2007-12-26,0.6948\n2007-12-27,0.6928\n2007-12-28,0.6887\n2007-12-29,0.6824\n2007-12-30,0.6794\n2007-12-31,0.6794\n2008-01-01,0.6803\n2008-01-02,0.6855\n2008-01-03,0.6824\n2008-01-04,0.6791\n2008-01-05,0.6783\n2008-01-06,0.6785\n2008-01-07,0.6785\n2008-01-08,0.6797\n2008-01-09,0.68\n2008-01-10,0.6803\n2008-01-11,0.6805\n2008-01-12,0.676\n2008-01-13,0.677\n2008-01-14,0.677\n2008-01-15,0.6736\n2008-01-16,0.6726\n2008-01-17,0.6764\n2008-01-18,0.6821\n2008-01-19,0.6831\n2008-01-20,0.6842\n2008-01-21,0.6842\n2008-01-22,0.6887\n2008-01-23,0.6903\n2008-01-24,0.6848\n2008-01-25,0.6824\n2008-01-26,0.6788\n2008-01-27,0.6814\n2008-01-28,0.6814\n2008-01-29,0.6797\n2008-01-30,0.6769\n2008-01-31,0.6765\n2008-02-01,0.6733\n2008-02-02,0.6729\n2008-02-03,0.6758\n2008-02-04,0.6758\n2008-02-05,0.675\n2008-02-06,0.678\n2008-02-07,0.6833\n2008-02-08,0.6856\n2008-02-09,0.6903\n2008-02-10,0.6896\n2008-02-11,0.6896\n2008-02-12,0.6882\n2008-02-13,0.6879\n2008-02-14,0.6862\n2008-02-15,0.6852\n2008-02-16,0.6823\n2008-02-17,0.6813\n2008-02-18,0.6813\n2008-02-19,0.6822\n2008-02-20,0.6802\n2008-02-21,0.6802\n2008-02-22,0.6784\n2008-02-23,0.6748\n2008-02-24,0.6747\n2008-02-25,0.6747\n2008-02-26,0.6748\n2008-02-27,0.6733\n2008-02-28,0.665\n2008-02-29,0.6611\n2008-03-01,0.6583\n2008-03-02,0.659\n2008-03-03,0.659\n2008-03-04,0.6581\n2008-03-05,0.6578\n2008-03-06,0.6574\n2008-03-07,0.6532\n2008-03-08,0.6502\n2008-03-09,0.6514\n2008-03-10,0.6514\n2008-03-11,0.6507\n2008-03-12,0.651\n2008-03-13,0.6489\n2008-03-14,0.6424\n2008-03-15,0.6406\n2008-03-16,0.6382\n2008-03-17,0.6382\n2008-03-18,0.6341\n2008-03-19,0.6344\n2008-03-20,0.6378\n2008-03-21,0.6439\n2008-03-22,0.6478\n2008-03-23,0.6481\n2008-03-24,0.6481\n2008-03-25,0.6494\n2008-03-26,0.6438\n2008-03-27,0.6377\n2008-03-28,0.6329\n2008-03-29,0.6336\n2008-03-30,0.6333\n2008-03-31,0.6333\n2008-04-01,0.633\n2008-04-02,0.6371\n2008-04-03,0.6403\n2008-04-04,0.6396\n2008-04-05,0.6364\n2008-04-06,0.6356\n2008-04-07,0.6356\n2008-04-08,0.6368\n2008-04-09,0.6357\n2008-04-10,0.6354\n2008-04-11,0.632\n2008-04-12,0.6332\n2008-04-13,0.6328\n2008-04-14,0.6331\n2008-04-15,0.6342\n2008-04-16,0.6321\n2008-04-17,0.6302\n2008-04-18,0.6278\n2008-04-19,0.6308\n2008-04-20,0.6324\n2008-04-21,0.6324\n2008-04-22,0.6307\n2008-04-23,0.6277\n2008-04-24,0.6269\n2008-04-25,0.6335\n2008-04-26,0.6392\n2008-04-27,0.64\n2008-04-28,0.6401\n2008-04-29,0.6396\n2008-04-30,0.6407\n2008-05-01,0.6423\n2008-05-02,0.6429\n2008-05-03,0.6472\n2008-05-04,0.6485\n2008-05-05,0.6486\n2008-05-06,0.6467\n2008-05-07,0.6444\n2008-05-08,0.6467\n2008-05-09,0.6509\n2008-05-10,0.6478\n2008-05-11,0.6461\n2008-05-12,0.6461\n2008-05-13,0.6468\n2008-05-14,0.6449\n2008-05-15,0.647\n2008-05-16,0.6461\n2008-05-17,0.6452\n2008-05-18,0.6422\n2008-05-19,0.6422\n2008-05-20,0.6425\n2008-05-21,0.6414\n2008-05-22,0.6366\n2008-05-23,0.6346\n2008-05-24,0.635\n2008-05-25,0.6346\n2008-05-26,0.6346\n2008-05-27,0.6343\n2008-05-28,0.6346\n2008-05-29,0.6379\n2008-05-30,0.6416\n2008-05-31,0.6442\n2008-06-01,0.6431\n2008-06-02,0.6431\n2008-06-03,0.6435\n2008-06-04,0.644\n2008-06-05,0.6473\n2008-06-06,0.6469\n2008-06-07,0.6386\n2008-06-08,0.6356\n2008-06-09,0.634\n2008-06-10,0.6346\n2008-06-11,0.643\n2008-06-12,0.6452\n2008-06-13,0.6467\n2008-06-14,0.6506\n2008-06-15,0.6504\n2008-06-16,0.6503\n2008-06-17,0.6481\n2008-06-18,0.6451\n2008-06-19,0.645\n2008-06-20,0.6441\n2008-06-21,0.6414\n2008-06-22,0.6409\n2008-06-23,0.6409\n2008-06-24,0.6428\n2008-06-25,0.6431\n2008-06-26,0.6418\n2008-06-27,0.6371\n2008-06-28,0.6349\n2008-06-29,0.6333\n2008-06-30,0.6334\n2008-07-01,0.6338\n2008-07-02,0.6342\n2008-07-03,0.632\n2008-07-04,0.6318\n2008-07-05,0.637\n2008-07-06,0.6368\n2008-07-07,0.6368\n2008-07-08,0.6383\n2008-07-09,0.6371\n2008-07-10,0.6371\n2008-07-11,0.6355\n2008-07-12,0.632\n2008-07-13,0.6277\n2008-07-14,0.6276\n2008-07-15,0.6291\n2008-07-16,0.6274\n2008-07-17,0.6293\n2008-07-18,0.6311\n2008-07-19,0.631\n2008-07-20,0.6312\n2008-07-21,0.6312\n2008-07-22,0.6304\n2008-07-23,0.6294\n2008-07-24,0.6348\n2008-07-25,0.6378\n2008-07-26,0.6368\n2008-07-27,0.6368\n2008-07-28,0.6368\n2008-07-29,0.636\n2008-07-30,0.637\n2008-07-31,0.6418\n2008-08-01,0.6411\n2008-08-02,0.6435\n2008-08-03,0.6427\n2008-08-04,0.6427\n2008-08-05,0.6419\n2008-08-06,0.6446\n2008-08-07,0.6468\n2008-08-08,0.6487\n2008-08-09,0.6594\n2008-08-10,0.6666\n2008-08-11,0.6666\n2008-08-12,0.6678\n2008-08-13,0.6712\n2008-08-14,0.6705\n2008-08-15,0.6718\n2008-08-16,0.6784\n2008-08-17,0.6811\n2008-08-18,0.6811\n2008-08-19,0.6794\n2008-08-20,0.6804\n2008-08-21,0.6781\n2008-08-22,0.6756\n2008-08-23,0.6735\n2008-08-24,0.6763\n2008-08-25,0.6762\n2008-08-26,0.6777\n2008-08-27,0.6815\n2008-08-28,0.6802\n2008-08-29,0.678\n2008-08-30,0.6796\n2008-08-31,0.6817\n2008-09-01,0.6817\n2008-09-02,0.6832\n2008-09-03,0.6877\n2008-09-04,0.6912\n2008-09-05,0.6914\n2008-09-06,0.7009\n2008-09-07,0.7012\n2008-09-08,0.701\n2008-09-09,0.7005\n2008-09-10,0.7076\n2008-09-11,0.7087\n2008-09-12,0.717\n2008-09-13,0.7105\n2008-09-14,0.7031\n2008-09-15,0.7029\n2008-09-16,0.7006\n2008-09-17,0.7035\n2008-09-18,0.7045\n2008-09-19,0.6956\n2008-09-20,0.6988\n2008-09-21,0.6915\n2008-09-22,0.6914\n2008-09-23,0.6859\n2008-09-24,0.6778\n2008-09-25,0.6815\n2008-09-26,0.6815\n2008-09-27,0.6843\n2008-09-28,0.6846\n2008-09-29,0.6846\n2008-09-30,0.6923\n2008-10-01,0.6997\n2008-10-02,0.7098\n2008-10-03,0.7188\n2008-10-04,0.7232\n2008-10-05,0.7262\n2008-10-06,0.7266\n2008-10-07,0.7359\n2008-10-08,0.7368\n2008-10-09,0.7337\n2008-10-10,0.7317\n2008-10-11,0.7387\n2008-10-12,0.7467\n2008-10-13,0.7461\n2008-10-14,0.7366\n2008-10-15,0.7319\n2008-10-16,0.7361\n2008-10-17,0.7437\n2008-10-18,0.7432\n2008-10-19,0.7461\n2008-10-20,0.7461\n2008-10-21,0.7454\n2008-10-22,0.7549\n2008-10-23,0.7742\n2008-10-24,0.7801\n2008-10-25,0.7903\n2008-10-26,0.7876\n2008-10-27,0.7928\n2008-10-28,0.7991\n2008-10-29,0.8007\n2008-10-30,0.7823\n2008-10-31,0.7661\n2008-11-01,0.785\n2008-11-02,0.7863\n2008-11-03,0.7862\n2008-11-04,0.7821\n2008-11-05,0.7858\n2008-11-06,0.7731\n2008-11-07,0.7779\n2008-11-08,0.7844\n2008-11-09,0.7866\n2008-11-10,0.7864\n2008-11-11,0.7788\n2008-11-12,0.7875\n2008-11-13,0.7971\n2008-11-14,0.8004\n2008-11-15,0.7857\n2008-11-16,0.7932\n2008-11-17,0.7938\n2008-11-18,0.7927\n2008-11-19,0.7918\n2008-11-20,0.7919\n2008-11-21,0.7989\n2008-11-22,0.7988\n2008-11-23,0.7949\n2008-11-24,0.7948\n2008-11-25,0.7882\n2008-11-26,0.7745\n2008-11-27,0.771\n2008-11-28,0.775\n2008-11-29,0.7791\n2008-11-30,0.7882\n2008-12-01,0.7882\n2008-12-02,0.7899\n2008-12-03,0.7905\n2008-12-04,0.7889\n2008-12-05,0.7879\n2008-12-06,0.7855\n2008-12-07,0.7866\n2008-12-08,0.7865\n2008-12-09,0.7795\n2008-12-10,0.7758\n2008-12-11,0.7717\n2008-12-12,0.761\n2008-12-13,0.7497\n2008-12-14,0.7471\n2008-12-15,0.7473\n2008-12-16,0.7407\n2008-12-17,0.7288\n2008-12-18,0.7074\n2008-12-19,0.6927\n2008-12-20,0.7083\n2008-12-21,0.7191\n2008-12-22,0.719\n2008-12-23,0.7153\n2008-12-24,0.7156\n2008-12-25,0.7158\n2008-12-26,0.714\n2008-12-27,0.7119\n2008-12-28,0.7129\n2008-12-29,0.7129\n2008-12-30,0.7049\n2008-12-31,0.7095\n",
        atmosphereTemperature: "Altitude (km), Temperature (\u00b0C)\n0, 15\n10, -50\n20, -56.5\n30, -46.5\n40, -22.1\n50, -2.5\n60, -27.7\n70, -55.7\n80, -76.5",
        logData: "Row, Log value\n0,1\n1,2\n2,4\n3,8\n4,16\n5,32\n6,64\n7,128\n8,256\n9,512",
        usaRussia: "Year,USA,USSR/Russia\n1940-01-01,,\n1941-01-01,,\n1942-01-01,,\n1943-01-01,,\n1944-01-01,,\n1945-01-01,6 ,\n1946-01-01,11,\n1947-01-01,32,\n1948-01-01,110,\n1949-01-01,235,\n1950-01-01,369,5\n1951-01-01,640,25\n1952-01-01,1005,50\n1953-01-01,1436,120\n1954-01-01,2063,150\n1955-01-01,3057,200\n1956-01-01,4618,426\n1957-01-01,6444,660\n1958-01-01,9822,869\n1959-01-01,15468,1060\n1960-01-01,20434,1605\n1961-01-01,24126,2471\n1962-01-01,27387,3322\n1963-01-01,29459,4238\n1964-01-01,31056,5221\n1965-01-01,31982,6129\n1966-01-01,32040,7089\n1967-01-01,31233,8339\n1968-01-01,29224,9399\n1969-01-01,27342,10538\n1970-01-01,26662,11643\n1971-01-01,26956,13092\n1972-01-01,27912,14478\n1973-01-01,28999,15915\n1974-01-01,28965,17385\n1975-01-01,27826,19055\n1976-01-01,25579,21205\n1977-01-01,25722,23044\n1978-01-01,24826,25393\n1979-01-01,24605,27935\n1980-01-01,24304,30062\n1981-01-01,23464,32049\n1982-01-01,23708,33952\n1983-01-01,24099,35804\n1984-01-01,24357,37431\n1985-01-01,24237,39197\n1986-01-01,24401,45000\n1987-01-01,24344,43000\n1988-01-01,23586,41000\n1989-01-01,22380,39000\n1990-01-01,21004,37000\n1991-01-01,17287,35000\n1992-01-01,14747,33000\n1993-01-01,13076,31000\n1994-01-01,12555,29000\n1995-01-01,12144,27000\n1996-01-01,11009,25000\n1997-01-01,10950,24000\n1998-01-01,10871,23000\n1999-01-01,10824,22000\n2000-01-01,10577,21000\n2001-01-01,10527,20000\n2002-01-01,10475,19000\n2003-01-01,10421,18000\n2004-01-01,10358,18000\n2005-01-01,10295,17000\n2006-01-01,10104,16000\n",
        fruitConsumption: "Fruit,John,Jane,Joe\nApples,5,2,3\nOranges,3,-2,4\nPears,4,-3,4\nGrapes,7,2,-2\nBananas,2,1,5\n",
        populationGrowth: "Region, Year 1800, Year 1900, Year 2008\nAfrica,107,133,973\nAmerica,31,156,914\nAsia,635,947,4054\nEurope,203,408,732\nOceania,2,6,34\n",
        totalFruitConsumption: "Fruit,John,Jane,Joe\nApples,5,2,3\nOranges,3,2,4\nPears,4,3,4\nGrapes,7,2,2\nBananas,2,1,5\n",
        browserMarketShare: "Browser,Market share\nFirefox,45.0\nIE,26.8\nChrome,12.8\nSafari,8.5\nOpera,6.2\nOthers,0.7\n"
    };

    function FieldUtils() {}
    FieldUtils.prototype = {
        createFieldConfig: function(a, b, c, d, e) {
            var f = d.getDefaultValue(a, c),
                f = {
                    fieldLabel: b,
                    labelWidth: "50%",
                    name: a,
                    xtype: d.getFieldEditor(a, c),
                    validator: function(a, b) {
                        return function(c) {
                            return b.validate(a, c)
                        }
                    }(a, d),
                    anchor: "100%",
                    defaultValue: f,
                    value: f && "null" !== f ? f : ""
                };
            d.getRequiresLicense(a, c) && console.log("Setting added in simple view that is tied to a license: " + a);
            e && e.custom && (f = $.extend(f, e.custom));
            "combobox" === f.xtype && (a = d.getComboboxData(a, c), f.store = a, f.lastQuery = "", f.queryMode =
                "local", f.displayField = "display", f.valueField = "name", f.forceSelection = !0, f.editable = !1);
            void 0 === b && (f.anchor = "50%", f.style = "float:right;");
            return f
        },
        makeTooltip: function(a, b, c) {
            c.addListener("afterrender", function() {
                Ext.tip.QuickTipManager.register({
                    target: c.getId(),
                    title: a.replace("--", ".").replace("-", ".").replace("<*>", ""),
                    trackMouse: !0,
                    text: b,
                    width: 200,
                    dismissDelay: 1E4
                })
            })
        }
    };

    function FieldSetSection(a, b, c, d, e) {
        this.itemFields = a;
        this.apiRef = e;
        this.afterEditHandler = b;
        this.fieldSet = new Ext.form.FieldSet({
            header: !1,
            border: !1,
            padding: "10 0 10 0",
            collapsible: !1
        });
        this.panel = new Ext.panel.Panel({
            items: [this.fieldSet],
            dockedItems: [{
                cls: "fieldset-bottom-toolbar",
                layout: {
                    pack: "end"
                },
                xtype: "toolbar",
                dock: "bottom",
                defaults: {
                    minWidth: 60
                },
                items: [{
                    xtype: "panel",
                    flex: 6,
                    html: '<span class="fieldset-bottom-toolbar-info">Move series up or down in legend and drawing order:</span>'
                }, {
                    xtype: "button",
                    flex: 1,
                    maxWidth: 60,
                    text: '<i class="icon-arrow-up"></i>',
                    handler: c
                }, {
                    xtype: "button",
                    flex: 1,
                    maxWidth: 60,
                    text: '<i class="icon-arrow-down"></i>',
                    handler: d
                }]
            }]
        });
        this.optionToFieldMap = {}
    }
    FieldSetSection.prototype = {
        populateFieldSet: function(a, b, c, d) {
            function e(a, c) {
                j.afterEditHandler(a.getName(), c, b)
            }

            function f() {
                var a = d - c;
                return function(b) {
                    if ("gauge" === b.data.name || "funnel" === b.data.name) return !1;
                    b = j.apiRef.getConsumedColumnCount("null" === b.data.name ? "line" : b.data.name);
                    return 0 <= a - b
                }
            }
            var g, h, i, j = this,
                l;
            for (h = 0; h < this.itemFields.length; h += 1)
                if (i = this.itemFields[h].id, g = this.itemFields[h].text, l = FieldUtils.prototype.createFieldConfig(i, g, a, this.apiRef), g = this.optionToFieldMap[i],
                    void 0 === g ? (g = this.fieldSet.add(l), g.addListener("change", e), FieldUtils.prototype.makeTooltip(i, this.itemFields[h].tooltipText || this.apiRef.getDescription(i, a), g), this.optionToFieldMap[i] = g) : l.xtype !== g.getXType() && (this.fieldSet.remove(g, !0), g = this.fieldSet.insert(h, l), g.addListener("change", e), FieldUtils.prototype.makeTooltip(i, this.itemFields[h].tooltipText || this.apiRef.getDescription(i, a), g), this.optionToFieldMap[i] = g), "series--type" === i) i = g.getStore(), null !== i && (i.clearFilter(), i.filterBy(f()))
        },
        getPanel: function() {
            return this.panel
        },
        refresh: function(a, b, c, d) {
            var e, f, g, h = a.settings ? a.settings["series--index"] : 0;
            this.indexedConfiguration = a;
            this.outerIndex = b;
            this.totalConsumedColumns = c;
            this.totalColumns = d;
            e = a.getSettingsContext(this.apiRef);
            this.panel.suspendLayout = !0;
            this.populateFieldSet(e, b, c, d);
            for (f in this.optionToFieldMap) this.optionToFieldMap.hasOwnProperty(f) && ((b = this.optionToFieldMap[f]) ? (b.suspendEvents(!1), c = f.split("--"), 1 < c.length && (g = c[1]), a.hasSetting(f) ? b.setValue(a.getSetting(f)) :
                a.parent.hasTemplateSetting(f) ? b.setValue(a.parent.getTemplateSetting(f)) : a.parent.hasTemplateSetting("plotOptions-series--" + g) ? b.setValue(a.parent.getTemplateSetting("plotOptions-series--" + g)) : a.parent.hasTemplateSetting("series[" + h + "]--" + g) ? b.setValue(a.parent.getTemplateSetting("series[" + h + "]--" + g)) : b.setValue(this.apiRef.getDefaultValue(f, e)), b.resumeEvents(), b.setVisible(this.apiRef.optionExists(f, e))) : console.log("Tab view, no field editor for " + f));
            this.panel.suspendLayout = !1
        }
    };

    function FieldListPanel(a, b, c, d, e) {
        var f = this;
        this.apiRef = e;
        this.afterEditHandler = d;
        this.fieldSetCombo = new Ext.form.field.ComboBox({
            id: "data-series-combo",
            queryMode: "local",
            store: new Ext.data.ArrayStore({
                id: 0,
                fields: ["optionValue", "optionName"],
                data: [
                    [99, "No data available"]
                ]
            }),
            listConfig: {
                getInnerTpl: function(a) {
                    return '<i class="icon-signal icon-fixed-width"></i> {' + a + "}"
                }
            },
            listeners: {
                change: function(a, b) {
                    f.selectedIndex = b;
                    0 < f.indexedConfigurations.length && f.createFieldSet(b, !0)
                }
            },
            valueField: "optionValue",
            displayField: "optionName",
            triggerAction: "all",
            editable: !1,
            forceSelection: !1,
            width: "50%",
            hidden: !0
        });
        this.noDataLabel = new Ext.form.Label({
            text: "No data available",
            padding: "2 0 0 0"
        });
        this.panel = new Ext.Panel({
            border: !1,
            items: [{
                xtype: "fieldset",
                cls: "series-fieldset",
                margin: "5 0 5 0",
                border: !0,
                defaultType: "textfield",
                layout: "anchor",
                items: [{
                    xtype: "fieldcontainer",
                    fieldLabel: '<i class="icon-signal icon-fixed-width"></i> Series',
                    labelWidth: "50%",
                    layout: "hbox",
                    items: [this.fieldSetCombo, this.noDataLabel]
                }]
            }]
        });
        this.selectedIndex = 0;
        this.itemFields = a;
        this.createUpHandler = function(a) {
            return function() {
                f.fieldSetCombo.getStore().getAt(a - 1) && (f.selectedIndex = a - 1, b(a))
            }
        };
        this.createDownHandler = function(a) {
            return function() {
                f.fieldSetCombo.getStore().getAt(a + 1) && (f.selectedIndex = a + 1, c(a))
            }
        }
    }
    FieldListPanel.prototype = {
        getPanel: function() {
            return this.panel
        },
        refresh: function(a) {
            var b, c, d;
            this.panel.suspendLayout = !0;
            this.indexedConfigurations = a;
            this.fieldSetCombo.store.removeAll();
            d = 0 === a.length ? -1 : -1 === this.fieldSetCombo.getValue() || null === this.fieldSetCombo.getValue() ? 0 : this.fieldSetCombo.getValue();
            for (b = 0; b < a.length; b += 1) c = a[b], c = c.getSetting("series--name"), this.fieldSetCombo.store.add({
                optionValue: b,
                optionName: c
            });
            this.noDataLabel.setVisible(0 === a.length);
            this.fieldSetCombo.setVisible(0 <
                a.length);
            this.fieldSetCombo.setValue(this.selectedIndex);
            this.selectedIndex === d && this.createFieldSet(d, void 0 === this.fieldSet);
            this.panel.suspendLayout = !1;
            this.panel.doLayout()
        },
        createFieldSet: function(a, b) {
            var c = this.indexedConfigurations[a],
                d, e, f = 0;
            for (d = 0; d < this.indexedConfigurations.length; d += 1) e = this.indexedConfigurations[d], e = this.apiRef.getConsumedColumnCount(e.getSettingsContext(this.apiRef).getStarReplacement()), this.selectedIndex > d && (f += e);
            b && void 0 !== this.fieldSet && this.panel.remove(this.fieldSet.getPanel());
            b && (this.fieldSet = new FieldSetSection(this.itemFields, this.afterEditHandler, this.createUpHandler(a), this.createDownHandler(a), this.apiRef));
            this.fieldSet.refresh(c, a, f, c.getColumnCount());
            this.panel.insert(this.fieldSet.getPanel())
        }
    };

    function EditorCodeView(a, b) {
        function c(a) {
            d.currentConfiguration.setCustomCode(f.getValue());
            a && b.update(d.currentConfiguration, d)
        }
        this.title = a.title;
        var d = this,
            e, f;
        this.panel = new Ext.Panel({
            title: a.title,
            margin: 0,
            layout: {
                type: "accordion",
                align: "stretch"
            },
            titleAlign: "center",
            cls: "codeview-panel",
            listeners: {
                activate: function() {
                    d.activate();
                    e.refresh();
                    f.refresh()
                }
            },
            items: [{
                border: 0,
                height: "50%",
                layout: {
                    type: "vbox",
                    pack: "start",
                    align: "stretch"
                },
                title: "Generated options",
                header: {
                    titlePosition: 1
                },
                tools: [{
                    html: '<span id="free">Free in Beta</span>',
                    xtype: "panel",
                    height: "25px",
                    region: "north"
                }],
                items: [{
                    xtype: "panel",
                    cls: "codeEditor",
                    border: 0,
                    flex: 1,
                    contentEl: "codeEditor"
                }]
            }, {
                border: 0,
                layout: {
                    type: "vbox",
                    pack: "start",
                    align: "stretch"
                },
                title: "Custom code",
                header: {
                    titlePosition: 1
                },
                tools: [{
                    id: "next",
                    padding: "2 0 0 0",
                    handler: function() {
                        c(!0)
                    }
                }, {
                    xtype: "label",
                    padding: "1 10 0 5",
                    text: "Run (Ctrl-Enter)"
                }, {
                    html: '<span id="free">Free in Beta</span>',
                    xtype: "panel",
                    height: "25px",
                    region: "north"
                }],
                items: [{
                    xtype: "panel",
                    cls: "codeEditor",
                    border: 0,
                    flex: 1,
                    contentEl: "customCodeEditor"
                }]
            }]
        });
        this.braceFoldFunc = CodeMirror.newFoldFunction(CodeMirror.braceRangeFinder);
        this.bracketFoldFunc = CodeMirror.newFoldFunction(CodeMirror.bracketRangeFinder);
        e = CodeMirror.fromTextArea(document.getElementById("codeEditorArea"), {
            mode: "javascript",
            theme: "eclipse",
            matchBrackets: !0,
            tabMode: "indent",
            lineNumbers: !0,
            readOnly: !0
        });
        e.on("gutterClick", this.braceFoldFunc);
        e.on("gutterClick", this.bracketFoldFunc);
        e.setSize("100%", "100%");
        this.codeMirror = e;
        f = CodeMirror.fromTextArea(document.getElementById("customCodeArea"), {
            mode: "javascript",
            theme: "eclipse",
            matchBrackets: !0,
            tabMode: "indent",
            lineNumbers: !0,
            readOnly: !1,
            extraKeys: {
                "Ctrl-Enter": function() {
                    c(!0)
                }
            }
        });
        f.setSize("100%", "100%");
        f.on("change", function() {
            d.typing && c(!1)
        });
        this.customCodeMirror = f
    }
	
	var currentCode;
	
    EditorCodeView.prototype = {
        getPanel: function() {
            return this.panel
        },
        activate: function() {
            var a = this.currentConfiguration,
                b = JSON.stringify(a.asLangObjectGraph(), null, "\t"),
                c = "",
                d;
            "{}" !== b && (c = c + "Highcharts.setOptions(" + b + ");\n\n");
            d = a.asObjectGraph(!0);
            if (d.series)
                for (b = 0; b < d.series.length; b += 1) delete d.series[b].seriesMapping;
            d = $.extend(!0, {}, a.asTemplateObjectGraph(), d);
            c = c + "var options = " + JSON.stringify(d, null, "\t") + ";\n";
            this.codeMirror.setValue(c);
			
            c = c.split("\n");
			
			currentCode = c;
			// shadyCode();
			
            for (b = 0; b < c.length; b += 1) - 1 !== c[b].indexOf('"data": [') &&
                this.bracketFoldFunc(this.codeMirror, b);
            try {
                this.typing = !1, this.customCodeMirror.setValue(a.getCustomCode() || "")
            } finally {
                this.typing = !0
            }
			console.log(currentCode)
			shadyCode(currentCode);
        },
        update: function(a) {
            this.currentConfiguration = a
			// alert(c.getValue)
			// console.log(this.currentConfiguration)
			
        }
    };
    EditorNS.views.code = EditorCodeView;

    function EditorNotesView(a, b) {
        this.init(a.title, b)
    }
    EditorNotesView.prototype = {
        init: function(a, b) {
            this.editor = b;
            this.title = a;
            this.createPanel()
        },
        createPanel: function() {
            return this.panel = new Ext.Panel({
                title: this.title,
                region: "center",
                flex: 1,
                bodyPadding: "5 5 5 5",
                layout: {
                    type: "hbox",
                    pack: "start",
                    align: "stretch"
                }
            })
        },
        getPanel: function() {
            return this.panel
        },
        update: function() {}
    };
    EditorNS.views.notes = EditorNotesView;

    function EditorImportView(a, b) {
        this.init(a.title, b)
    }
    EditorImportView.prototype = {
        init: function(a, b) {
            this.editor = b;
            this.title = a;
            this.createPanel()
        },
        createPanel: function() {
            var a = this.editor,
                b = this;
            return this.panel = new Ext.Panel({
                title: this.title,
                region: "center",
                bodyPadding: "0 5",
                autoScroll: !0,
                flex: 1,
                padding: "5 5 5 5",
                layout: {
                    pack: "start",
                    align: "stretch"
                },
                items: [{
                    cls: "paste-here",
                    html: '<h1>Paste your data here<h1><i class="icon-arrow-down icon-large"></i>'
                }, {
                    xtype: "textarea",
                    flex: 1,
                    height: "50%",
                    width: "100%",
                    id: "editorImportView.textarea",
                    cls: "import-area",
                    emptyText: "<insert CSV data here, " + (window.FileReader ? "drag and drop CSV files, or copy and paste from Excel>" : "or copy and paste from Excel>"),
                    enableKeyEvents: !0,
                    listeners: {
                        render: function(c) {
                            var d;
                            $(c.getEl().dom).bind("paste", null, function() {
                                setTimeout(function() {
                                    b.toDataproviderTable()
                                }, 50)
                            });
                            window.FileReader && (d = this.getEl().dom.getElementsByTagName("textarea")[0], d.addEventListener("dragover", function(a) {
                                a.stopPropagation();
                                a.preventDefault();
                                a.dataTransfer.dropEffect = "copy";
                                c.addClass("dropping")
                            }, !1), d.addEventListener("dragleave", function() {
                                c.removeCls("dropping")
                            }, !1), d.addEventListener("drop", function(d) {
                                d.stopPropagation();
                                d.preventDefault();
                                var d = d.dataTransfer.files,
                                    f = new FileReader;
                                f.onload = function() {
                                    c.setValue(f.result);
                                    b.toDataproviderTable()
                                };
                                /\.(csv|tsv)$/i.test(d[0].name) ? f.readAsText(d[0]) : a.showToast("Wrong file type", "Only CSV or TSV files are supported for data upload")
                            }, !1));
                            d = document.getElementById("importData").innerHTML;
                            0 < d.length && (c.setValue(d), b.toDataproviderTable())
                        }
                    }
                }, {
                    layout: "hbox",
                    cls: "import-controls",
                    items: [{
                        layout: "vbox",
                        width: "70%",
                        items: [{
                            xtype: "checkbox",
                            id: "editorImportView.switchRowsAndColumns",
                            boxLabel: "Switch rows and columns",
                            listeners: {
                                render: function() {
                                    Ext.create("Ext.tip.ToolTip", {
                                        target: this.getEl(),
                                        html: "<p>When this is <b>checked</b>, rows in your pasted data will become columns in the data grid to the right, and subsequently Highcharts will use those rows for data series.</p>"
                                    })
                                },
                                change: function() {
                                    b.toDataproviderTable()
                                }
                            }
                        }, {
                            xtype: "checkbox",
                            checked: !1,
                            id: "editorImportView.useCategories",
                            boxLabel: "Use categories",
                            listeners: {
                                render: function() {
                                    Ext.create("Ext.tip.ToolTip", {
                                        target: this.getEl(),
                                        html: "<p>When <b>unchecked</b>, we will try to recognize dates and times in your data. This allows ticks to be placed with natural intervals on the X axis, for example each midnight or at the start of each month. The tick interval will then adapt to the scale of the chart, so it looks good both on desktop monitors and narrow mobile views. In cases where the date format is ambiguous (like <code>m/d/Y</code> vs <code>d/m/Y</code>), you may get unexpected results in the chart. In that case we recommend checking the checkbox.</p><p>When <b>checked</b>, your data is handled as is, and shown as categories on the X axis. Categories are just text labels so we will try to fit as many as possible in the axis.</p>"
                                    })
                                },
                                change: function() {
                                    b.toDataproviderTable()
                                }
                            }
                        }, {
                            xtype: "combobox",
                            hidden: !0,
                            width: "80%",
                            id: "editorImportView.itemDelimiter",
                            fieldLabel: "Item separator",
                            displayField: "name",
                            valueField: "chr",
                            queryMode: "local",
                            listeners: {
                                render: function() {
                                    Ext.create("Ext.tip.ToolTip", {
                                        target: this.getEl(),
                                        html: "<p>What character separates the <em>values</em> in the data set. In Anglo-American CSV the comma is typically the separator, in Europe the semicolon. In content pasted from Excel, the values are separated by the tab character.</p>"
                                    })
                                },
                                change: function() {
                                    b.toDataproviderTable()
                                }
                            },
                            store: Ext.create("Ext.data.Store", {
                                fields: ["name", "chr"],
                                data: [{
                                    name: ", (comma)",
                                    chr: ","
                                }, {
                                    name: "; (semicolon)",
                                    chr: ";"
                                }, {
                                    name: "\\t (tab)",
                                    chr: "\t"
                                }]
                            })
                        }]
                    }, {
                        xtype: "button",
                        width: "29.5%",
                        text: "Apply",
                        id: "editorImportView.apply",
                        handler: function() {
                            b.toDataproviderTable()
                        }
                    }]
                }, {
                    cls: "samples-header",
                    html: "<h4>Sample datasets</h4><p>If you want to try the editor and have no data available, try the <a href=\"javascript:void(0)\" onclick=\"(function() { $('.samples').css({ visibility: 'visible'}); return false;})()\">sample data</a>.</p>"
                }, {
                    layout: "vbox",
                    cls: "samples",
                    items: [{
                        xtype: "button",
                        text: "Single data column with categories",
                        tooltip: "Single series, nice for pies and columns",
                        listeners: {
                            click: function() {
                                b.applyDataSet("browserMarketShare")
                            }
                        }
                    }, {
                        xtype: "button",
                        text: "Categorized, four data columns",
                        tooltip: "Categorized means that this data doesn't have numeric X values, but text labels. Suitable for column and line charts.",
                        listeners: {
                            click: function() {
                                b.applyDataSet("cityTemperature")
                            }
                        }
                    }, {
                        xtype: "button",
                        text: "Dates on X axis, one data column",
                        tooltip: "Long, time based series. Works well with lines and areas. Zooming recommended.",
                        listeners: {
                            click: function() {
                                b.applyDataSet("usdEurRate")
                            }
                        }
                    }]
                }]
            })
        },
        applyDataSet: function(a) {
            Ext.getCmp("editorImportView.textarea").setValue(DataSets.prototype[a]);
            this.toDataproviderTable()
        },
        toDataproviderTable: function() {
            var a = this,
                b, c, d = this.editor,
                e = Ext.getCmp("editorImportView.textarea").getValue();
            Ext.getCmp("editorImportView.textarea").removeCls("dropping");
            d.views.output && d.views.output.chart && d.views.output.chart.showLoading('<i class="icon-spinner icon-spin icon-3x"></i>');
            setTimeout(function() {
                d.setActiveDataProviderName("highcharts.dataprovider.table");
                c = new ViewState;
                d.getEditorViewState(c);
                d.updateEditorViewState(c);
                b = d.getDataProviderByName("highcharts.dataprovider.table");
                b.importFromCsv(e, void 0, void 0, function() {
                    try {
                        b.state.store.suspendEvents(), b.updateChart()
                    } finally {
                        b.state.store.resumeEvents()
                    }
                });
                a.showGridAndChart()
            }, 50)
        },
        showGridAndChart: function() {
            $("#import-info").css({
                left: "110%"
            });
            $(".right-panel .x-panel-body").css({
                marginLeft: 0
            })
        },
        autoApplyWizardStep: function() {
            var a =
                this.editor;
            return void 0 === a.masterConfiguration.linkedData || 0 === a.masterConfiguration.linkedData.series.length
        },
        applyWizardStep: function() {
            this.toDataproviderTable()
        },
        getNextWizardStepCaption: function() {
            return "Continue to Templates"
        },
        getPanel: function() {
            return this.panel
        },
        update: function() {}
    };
    EditorNS.views.importdata = EditorImportView;

    function EditorTemplatesView(a, b) {
        this.init(a, b)
    }
    EditorTemplatesView.prototype = {
        init: function(a, b) {
            this.galleryConfigurations = a.config;
            this.title = a.title;
            this.editor = b;
            this.createPanel()
        },
        createPanel: function() {
            function a(a, b, c, d) {
                return Ext.create("Ext.Img", {
                    xtype: "image",
                    chartType: c.config["series[0]--type"] || c.config["chart--type"] || "line",
                    src: c.urlImg,
                    cls: "templateIcon " + b,
                    listeners: {
                        render: function(a) {
                            var b = a.getEl();
                            b.on("click", d, a);
                            c.tooltipText && Ext.create("Ext.tip.ToolTip", {
                                target: b,
                                html: c.tooltipText,
                                width: 200
                            })
                        }
                    },
                    section: a,
                    template: b,
                    autoEl: "div",
                    tpl: '<div class="info">{title}</div>',
                    data: {
                        title: c.title
                    }
                })
            }

            function b(a) {
                var a = a.el.dom,
                    b = $(a),
                    c = Math.min(Math.round(a.offsetWidth / 150), 4);
                a.cols && b.removeClass("col-" + a.cols);
                a.cols = c;
                b.addClass("col-" + c)
            }
            var c, d, e, f, g = [],
                h = this,
                i, j;
            i = function() {
                var a = this,
                    b; - 1 < $(this.getEl()).attr("class").indexOf("grayscale") || (b = $("div#" + h.sectionPane.id), $("div.templateIcon .warning", b).remove(), $("div.templateIcon", "#" + h.sectionPane.id).each(function() {
                    this.id === a.id ? $(this).addClass("activeTemplate") :
                        $(this).removeClass("activeTemplate")
                }), h.changeListener(a.section, a.template))
            };
            h.sectionPane = new Ext.panel.Panel({
                border: 0,
                region: "center",
                xtype: "panel",
                cls: "templates-pane",
                autoScroll: !0,
                header: !1,
                margin: 0,
                flex: 1,
                listeners: {
                    render: function(a) {
                        h.warnForOverlappingOptions();
                        b(a)
                    },
                    resize: b
                }
            }); - 1 !== navigator.userAgent.indexOf("Trident") && $(document.body).addClass("x-trident");
            this.buttons = [];
            j = function() {
                h.buttonHandler(this)
            };
            for (c in this.galleryConfigurations)
                if (this.galleryConfigurations.hasOwnProperty(c)) {
                    d =
                        this.galleryConfigurations[c];
                    this.buttons.push(new Ext.button.Button({
                        xtype: "button",
                        margin: "0 5 5 0",
                        enableToggle: !0,
                        allowDepress: !1,
                        toggleGroup: "1",
                        handler: j,
                        text: d.title,
                        section: c
                    }));
                    for (e in d.templates) d.templates.hasOwnProperty(e) && (f = d.templates[e], f = a(c, e, f, i), g.push(f));
                    h.sectionPane.add(g)
                }
            this.panel = new Ext.Panel({
                region: "center",
                title: h.title,
                flex: 1,
                layout: {
                    type: "border",
                    align: "stretch"
                },
                items: [{
                    split: !0,
                    region: "west",
                    xtype: "panel",
                    header: !1,
                    border: !1,
                    layout: {
                        type: "vbox",
                        pack: "start",
                        align: "stretch"
                    },
                    flex: 0.4,
                    cls: "chapters templatechapters",
                    items: this.buttons
                }, h.sectionPane]
            })
        },
        changeListener: function(a, b) {
            var c, d = !1,
                e = this.currentConfiguration,
                f = this.galleryConfigurations[a].templates[b],
                g = f.config;
            this.activeTemplate = b;
            e.setTemplate(b, f);
            for (c in g) g.hasOwnProperty(c) && !d && e.needsSeriesReload(c) && (d = !0);
            d ? (this.editor.update(e, "silent"), this.editor.activeDataProvider.startGetData(this.editor.masterConfiguration.asTemplateObjectGraph(!1), this.editor.masterConfiguration.asSeriesMappingObjectGraph())) :
                this.editor.update(e, this)
        },
        validateVisibleTemplates: function() {
            var a = this.sectionPane.query("{isVisible()}"),
                b, c;
            for (c = 0; c < a.length; c += 1) b = a[c], this.disableTemplateIcon(b)
        },
        templateFitsData: function(a) {
            var b = 0,
                c = 0;
            a && void 0 !== this.currentConfiguration && (b = this.currentConfiguration.getColumnCount(), c = this.editor.apiRef.getConsumedColumnCount(a));
            return 1 > b || b >= c ? !0 : !1
        },
        disableTemplateIcon: function(a) {
            this.templateFitsData(a.chartType) ? a.removeCls("grayscale") : a.addCls("grayscale")
        },
        buttonHandler: function(a) {
            var b =
                this;
            b.activeSection = a.section;
            a.pressed = !0;
            this.sectionPane.items.each(function() {
                this.section === a.section ? (this.show(), b.disableTemplateIcon(this)) : this.hide();
                b.activeTemplate === this.template && this.section === a.section ? this.addCls("activeTemplate") : this.removeCls("activeTemplate")
            })
        },
        getPanel: function() {
            return this.panel
        },
        updateViewState: function(a) {
            this.activeSection = a.getState("templateView--activeSection");
            void 0 === this.activeSection && (this.activeSection = "line");
            for (a = 0; a < this.buttons.length; a +=
                1) this.buttons[a].section === this.activeSection && this.buttonHandler(this.buttons[a])
        },
        getViewState: function(a) {
            var b = this.activeSection;
            b && a.setState("templateView--activeSection", b)
        },
        warnForOverlappingOptions: function() {
            var a = this.currentConfiguration.getOverlappingSettings(),
                b;
            b = $("div." + (void 0 === this.activeTemplate ? "undefined" : this.activeTemplate), "#" + this.panel.id);
            isEmpty(a) ? 0 < b.length && 0 < $("div.warning", b).length && b.find(".warning").remove() : 0 < b.length && 1 > $("div.warning", b).length && (a = $("<div>", {
                "class": "warning"
            }).append('<span><i class="icon-exclamation-sign"></i></span><div>Conflicting<br/>settings</div>'), b.append(a))
        },
        autoApplyWizardStep: function() {
            return !1
        },
        applyWizardStep: function() {},
        getNextWizardStepCaption: function() {
            return "Continue to customize"
        },
        update: function(a) {
            this.activeTemplate = a.templateId;
            this.currentConfiguration = a;
            this.warnForOverlappingOptions();
            this.validateVisibleTemplates()
        }
    };
    EditorNS.views.templates = EditorTemplatesView;

    function EditorDataView(a, b) {
        this.init(a.title, b)
    }
    EditorDataView.prototype = {
        init: function(a, b) {
            this.title = a;
            this.editor = b;
            this.createPanel()
        },
        createPanel: function() {
            this.panel = this.createDataPanel()
        },
        createDataPanel: function() {
            function a(a, d) {
                return function(e, f) {
                    !0 === f && (b.removeAll(!1), b.add(a), c.propagateDataProviderSwitch && c.editor.setActiveDataProviderName(d))
                }
            }
            var b, c = this,
                d, e, f;
            c.propagateDataProviderSwitch = !0;
            b = new Ext.Container({
                padding: "0 0 0 5",
                border: !1,
                flex: 1,
                layout: {
                    type: "vbox",
                    pack: "start",
                    align: "stretch"
                }
            });
            c.dataProviderRadioButtons = [];
            for (f = 0; f < Editor.registeredProviders.length; f += 1) d = Editor.registeredProviders[f], e = new Ext.form.Radio({
                margin: 5,
                name: "dataprovider",
                boxLabel: d.getTitle()
            }), e.addListener("change", a(d.getExtPanel(), d.getName())), c.dataProviderRadioButtons.push(e);
            return new Ext.Panel({
                region: "center",
                flex: 1,
                bodyPadding: "5 5 5 5",
                layout: {
                    type: "hbox",
                    pack: "start",
                    align: "stretch"
                },
                items: [{
                        width: 150,
                        cls: "data-providers-listing",
                        layout: {
                            type: "vbox",
                            pack: "start",
                            align: "stretch"
                        },
                        border: !1,
                        items: c.dataProviderRadioButtons
                    },
                    b
                ]
            })
        },
        applyActiveDataProviderUIIndex: function(a) {
            if (this.dataProviderRadioButtons && a < this.dataProviderRadioButtons.length) try {
                this.propagateDataProviderSwitch = !1, this.dataProviderRadioButtons[a].setValue(!0)
            } finally {
                this.propagateDataProviderSwitch = !0
            }
        },
        getPanel: function() {
            return this.panel
        },
        update: function() {}
    };
    EditorNS.views.data = EditorDataView;

    function EditorShareView(a, b) {
        this.init(a.title, b)
    }
    EditorShareView.prototype = {
        init: function(a, b) {
            this.editor = b;
            this.title = a;
            this.createPanel()
        },
        createPanel: function() {
            var a = this.createSharePanel();
            this.panel = new Ext.Panel({
                title: this.title,
                margin: 0,
                layout: {
                    type: "border",
                    align: "stretch"
                },
                items: [a]
            })
        },
        createSharePanel: function() {
            return this.sharePanel = new Ext.Panel({
                region: "center",
                bodyPadding: "0 5 0 5",
                layout: {
                    type: "fit",
                    pack: "start"
                },
                cls: "share-panel",
                items: [{
                    id: "share-note",
                    xtype: "panel",
                    
					html:"<h3>cnbc.com code:</h3><textarea id='internal' style='width:100%;display:block;min-height:190px;'> </textarea><h3>external site code:</h3><textarea id='external' style='width:100%;display:block;min-height:190px;'> </textarea>",
					
                    items: [{
                        xtype: "button",
                        cls: "share-save heavy-btn",
                        text: "Get Code",
                        listeners: {
                            click: function() {
                                // window.onbeforeunload = void 0;
//                                 editor.save()
								// console.log("grabbing codez")
								// $("#share-note-body").append("<textarea></textarea>");
								$("#tab-1412-btnInnerEl").trigger('click')
								// console.log(currentCode)
								// var text = $("#codeEditor").text();
								//e = CodeMirror.fromTextArea(document.getElementById("codeEditorArea")
								    // alert(editor.getvalue());
// 								var theCode = document.getElementById("codeEditorArea")
// 								$("#codeEditor pre span").each(function( index ) {
// 								  console.log($(this) );

								  
								// });
                            }
                        },
                        width: "29%"
                    }// ,
// 					{
// 					                        xtype: "button",
// 					                        cls: "share-save heavy-btn",
// 					                        text: "Preview",
// 					                        listeners: {
// 					                            click: function() {
// 					                                // window.onbeforeunload = void 0;
// 					//                                 editor.save()
// 													// console.log("grabbing codez")
// 													// $("#share-note-body").append("<textarea></textarea>");
// 													// $("#tab-1412-btnInnerEl").trigger('click')
// 													// console.log('heyo')
// 													picoModal("<script>" + codeValue + "$(#'previewChart')</script><div id='previewChart'></div>").show();
// 													// var text = $("#codeEditor").text();
// 													//e = CodeMirror.fromTextArea(document.getElementById("codeEditorArea")
// 													    // alert(editor.getvalue());
// 					// 								var theCode = document.getElementById("codeEditorArea")
// 					// 								$("#codeEditor pre span").each(function( index ) {
// 					// 								  console.log($(this) );
//
//
// 													// });
// 					                            }
// 					                        },
// 					                        width: "29%"
// 					                    }
]
                }, {
                    id: "share-it",
                    xtype: "component",
                    autoEl: {
                        tag: "iframe",
                        style: "border: 0px;"
                    },
					
                }]
            })
        },
        getPanel: function() {
            return this.panel
        },
        autoApplyWizardStep: function() {
            return !1
        },
        applyWizardStep: function() {},
        getNextWizardStepCaption: function() {
            return "Done"
        },
        update: function(a) {
            var b = this.editor,
                c = this.sharePanel.getComponent("share-note"),
                d = this.sharePanel.getComponent("share-it"),
                e = d.autoEl,
                f = a.isModified() || void 0 === a.getName() && void 0 === a.getVersion();
            c.setVisible(f);
            d.setVisible(!f);
            a && !f && (e.src = b.serverConfiguration.contextPath + "/share/" + b.masterConfiguration.getName() + "/" + b.masterConfiguration.getVersion())
        }
    };
    EditorNS.views.share = EditorShareView;
	
	function shadyCode(){
	  
	  // $("#share-note-body textarea").remove();
	  // $("#share-note-body").append("<textarea style='width:100%;display:block;min-height:300px;'> </textarea>");
	  $.each( currentCode, function( key, value ) {
		  
		  
		      codeValue += value +"\n"
		  
	    console.log(value)
		  
		  
		  
	  });
	  
	  
	 var extendOptions ='Highcharts.setOptions({chart:{renderTo: "container",events:{load: function (){this.renderer.image("http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/DATA-VISUALIZATION/logos/cnbc-logo-charts.png", 10, this.chartHeight - 15, 100, 15).add();}},style:{fontFamily:"Gotham Narrow SSm 4r"}},title:{align: "left",x: 20,style:{fontSize: "22px",fontFamily:"Gotham Narrow SSm 5r",fontWeight:"bold",textAlign:"left"}},subtitle:{align: "left",x: 20, style:{fontSize: "18px",fontFamily:"Gotham Narrow SSm 5r",textAlign:"left"}}});';  
	  
	  var highchartsCode = '<script src="http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/DATA-VISUALISATION/HIGHCHARTS/js/highcharts.js"></script>';
	  var jqueryCode = '<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js"></script>'
	  var gothamPath = '<link href="http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/INTERNAL/EXPERIMENTS/GOTHAM/HCo_fonts.css" rel="stylesheet" />';
	  var chartCSS = '<link href="http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/DATA-VISUALISATION/HIGHCHARTS/css/chart.css" rel="stylesheet" />';	
	  var highChartsMoreJS = '<script src="http://code.highcharts.com/highcharts-more.js"></script>';
	  var highCharts3dJS = '<script src="http://code.highcharts.com/highcharts-3d.js"></script>';
	  var highChartsExportingJS = '<script src="http://code.highcharts.com/modules/exporting.js"></script>';
	  var chartContainer = '<div id="container"></div>';	  
	  initCode = '$("#container").highcharts(options);';	  
	  var functionStart = "$(function() {";
	  var functionEnd = "});"
	  var postLoadBegin = "postLoadFunctions = postLoadFunctions || {};postLoadFunctions.highchart = function(){";
	  var postLoadEnd = "}";
	  var loadScriptsBegin ='function loadScripts(array,callback){' +
'var loader = function(src,handler){' +
'var script = document.createElement("script");' +
'script.src = src;' +
'script.onload = script.onreadystatechange = function(){' +
'script.onreadystatechange = script.onload = null;' +
'handler();' +
	  '}';
	  
 var loadScriptsBreak = 'var domNode = document.getElementsByTagName("body")[0];' +
    '(domNode || document.body).appendChild( script );' +
'};' +
    '(function(){' +
        'if(array.length!=0){' +
        	'loader(array.shift(),arguments.callee);' +
        '}else{' +
        	'callback && callback();' +
        '}' +
    '})();' +
'}' +

'loadScripts([' +
   '"http://code.highcharts.com/stock/highstock.js",' +
   '"http://code.highcharts.com/highcharts-more.js",' +
   '"http://code.highcharts.com/highcharts-3d.js",' +
   '"http://code.highcharts.com/modules/exporting.js"'+   
'],function(){';
	  var loadScriptsEnd='}';
	  
	  previewCode = gothamPath + "\n" + chartCSS + "\n"  + jqueryCode + "\n" +highchartsCode + "\n" + highChartsMoreJS + "\n" + highCharts3dJS + "\n" + highChartsExportingJS + "\n" + "<script>" + extendOptions + "\n" + functionStart+ "\n" + codeValue + "\n" +  initCode + functionEnd +"\n" + "</script>" + "\n" + chartContainer;
	  
	  $("#share-note-body textarea#external").val(gothamPath + "\n" + chartCSS + "\n"  + jqueryCode + "\n" +highchartsCode + "\n" + highChartsMoreJS + "\n" + highCharts3dJS + "\n" + highChartsExportingJS + "\n" + "<script>" + extendOptions + "\n" + functionStart+ "\n" + codeValue + "\n" +  initCode + functionEnd +"\n" + "</script>" + "\n" + chartContainer);
	  
	  $("#share-note-body textarea#internal").val(chartCSS + "\n" + "<script>" + postLoadBegin + "\n" + loadScriptsBegin +"\n" + loadScriptsBreak + "\n" + extendOptions + "\n" + codeValue + "\n" +  initCode + "\n" + functionEnd +"\n" + postLoadEnd + "</script>" + "\n" + chartContainer);
	  
	   
	}
	
    function OutputView(a, b) {
        this.editor = b;
        this.template = a.template;
        this.chart = null;
        this.outputContainer = a.outputContainerId;
        this.init()
    }
    OutputView.prototype = {
        init: function() {
            var a = this;
            void 0 !== window.Ext && (this.panel = new Ext.Panel({
                contentEl: this.outputContainer,
                region: "north",
                cls: "preview-panel",
                split: !0,
                height: "50%",
                minHeight: 300,
                maxHeight: 500,
                listeners: {
                    resize: function(b, c, d) {
                        a.resize(c, d)
                    }
                }
            }))
        },
        update: function(a) {
            this.chart && (this.chart = this.chart.destroy());
            if (a.hasCustomCode()) Ext.get(this.outputContainer).removeCls("output-container"), this.updateWithCustomCode(a);
            else {
                Ext.get(this.outputContainer).addCls("output-container");
                Highcharts.setOptions(a.asLangObjectGraph());
                var b = $.extend(!0, {}, this.template, a.asTemplateObjectGraph(), a.asObjectGraph(!0));
                b.exporting = b.exporting || {};
                b.exporting.enabled = !a.isModified();
                a = void 0 === a.templateConstr ? "Chart" : a.templateConstr;
                try {
                    this.chart = new Highcharts[a](b)
                } catch (c) {
                    a = "<h4><i class='icon-warning-sign'></i>Something went wrong creating your chart</h4>", "string" === typeof c && -1 !== c.indexOf("error #14") && (a += "<p>There seems to be text in data cells where we expected numbers. Highcharts allows text in the first row, which is used for series names, and in the first column, that is used for category names. Other data should be numbers.</p><p>For examples of good data sets, see <b>Sample datasets</b> on the left.</p>"),
                        $("#container").html('<div class="info info-box">' + a + "</div>"), console.log(c, b)
                }
                this.centerOutput()
            }
        },
        updateWithCustomCode: function(a) {
            var b, c = this.outputContainer;
            Ext.get(c).setHTML('<iframe id="runneriframe" name="runneriframe" style="border: 0; width: 100%; height: 100%;"></iframe>');
            b = Ext.get(c).mask('<i class="icon-spinner icon-spin icon-2x"></i>');
            $("#runneriframe").load(function() {
                try {
                    b.fadeOut({
                        duration: 500
                    }), setTimeout(function() {
                        Ext.get(c).unmask()
                    }, 200)
                } catch (a) {}
            });
            this.editor.communicator.postToRunner(a,
                this.editor.getViewState(), "runneriframe")
        },
        getPanel: function() {
            return this.panel
        },
        centerOutput: function() {
            this.chart.chartWidth < this.panel.getBox().width && this.chart.chartHeight < this.panel.getBox().height ? $(this.chart.container).select(".highcharts-container").addClass("centered-highcharts-container") : $(this.chart.container).select(".highcharts-container").removeClass("centered-highcharts-container")
        },
        resize: function(a, b) {
            var c = this.chart && this.chart.options.chart;
            c && !1 !== c.reflow && this.chart.setSize(c.width ||
                a - 1, c.height || b - 1, !1);
            c && this.centerOutput()
        }
    };
    EditorNS.views.output = OutputView;

    function EditorSettingsView(a, b) {
        function c(a, c) {
            g.processing || ("chart--inverted" === a.getName() && g.swapAxisFieldSetTitles(c), void 0 !== g.currentConfiguration && (g.currentConfiguration.setSetting(a.getName(), c, b.apiRef), g.currentConfiguration.needsSeriesReload(a.getName()) ? (b.update(g.currentConfiguration, "silent"), b.activeDataProvider.startGetData(b.masterConfiguration.asObjectGraph(!1), b.masterConfiguration.asSeriesMappingObjectGraph())) : b.update(g.currentConfiguration, g), g.warnForOverride(a, c)))
        }

        function d(a, c, d) {
            c = new FieldListPanel(c, function(c) {
                g.currentConfiguration.moveIndexedConfiguration(a, c, c - 1);
                b.update(g.currentConfiguration)
            }, function(c) {
                g.currentConfiguration.moveIndexedConfiguration(a, c, c + 1);
                b.update(g.currentConfiguration)
            }, function(c, d, e) {
                e = "series" === a ? g.currentConfiguration.getSortedSeries(e) : g.currentConfiguration.getIndexedConfiguration(a, e);
                e.setSetting(c, d, b.apiRef);
                e.needsSeriesReload(c) ? (b.update(g.currentConfiguration, "silent"), b.activeDataProvider.startGetData(b.masterConfiguration.asObjectGraph(!1),
                    b.masterConfiguration.asSeriesMappingObjectGraph())) : b.update(g.currentConfiguration, g)
            }, b.apiRef);
            g.optionToArrayMap[a] = c;
            d.add(c.getPanel())
        }

        function e(a, f, h, i) {
            for (var l, j, a = h ? new Ext.form.FieldSet({
                    header: !0,
                    border: !1,
                    padding: 0,
                    title: a,
                    collapsible: !1
                }) : new Ext.form.FieldSet({
                    header: !1,
                    border: !1,
                    cls: "chapter " + a,
                    hidden: !0,
                    hideMode: "display"
                }), h = 0; h < f.length; h += 1) !0 === f[h].array ? d(f[h].id, f[h].options, a) : !0 === f[h].group ? a.add(e(f[h].text, f[h].options, !0, f[h].id)) : (l = f[h].id, j = f[h].text, j = FieldUtils.prototype.createFieldConfig(l,
                j, void 0, b.apiRef, f[h]), j = a.add(j), j.addListener("change", c), g.optionToFieldMap[l] = j, FieldUtils.prototype.makeTooltip(l, f[h].tooltipText || b.apiRef.getDescription(l), j));
            i && (o[i] = a);
            return a
        }

        function f(a) {
            i !== a && (Ext.Array.each(m.query('fieldset[cls~="chapter"]'), function() {
                this.setVisible(-1 < this.cls.indexOf(a.getText()) ? !0 : !1)
            }), i = a)
        }
        this.title = a.title;
        this.optionToFieldMap = {};
        this.optionToArrayMap = {};
        this.apiRef = b.apiRef;
        this.buttonToSection = {};
        var g = this,
            h, i, j = [],
            l = this.buttonToSection,
            m, k, o = {};
        m = new Ext.panel.Panel({
            border: !1,
            region: "center",
            xtype: "panel",
            autoScroll: !0,
            header: !1,
            layout: {
                type: "vbox",
                align: "stretch"
            },
            flex: 1,
            items: []
        });
        for (h in a.options) a.options.hasOwnProperty(h) && (k = new Ext.button.Button({
            xtype: "button",
            margin: "0 5 5 0",
            enableToggle: !0,
            allowDepress: !1,
            toggleGroup: "1",
            handler: f,
            text: h
        }), j.push(k), l[k.getText()] = e(h, a.options[h]), m.add(e(h, a.options[h])));
        this.panel = new Ext.Panel({
            title: a.title,
            margin: 10,
            id: "settings-chapters",
            layout: {
                type: "border",
                align: "stretch"
            },
            items: [{
                split: !0,
                region: "west",
                xtype: "panel",
                header: !1,
                border: !1,
                layout: {
                    type: "vbox",
                    pack: "start",
                    align: "stretch"
                },
                flex: 0.3,
                cls: "chapters",
                items: j
            }, m]
        });
        this.setActiveSection = function(a) {
            a = Math.max(a, 0);
            a = Math.min(a, j.length - 1);
            j[a].toggle();
            f(j[a])
        };
        this.getActiveSection = function() {
            return j.indexOf(i)
        };
        this.fieldSets = o
    }
    EditorSettingsView.prototype = {
        getPanel: function() {
            return this.panel
        },
        updateViewState: function(a) {
            a = a.getState("tabView--activeSection");
            void 0 === a && (a = 0);
            this.setActiveSection(a)
        },
        getViewState: function(a) {
            a.setState("tabView--activeSection", this.getActiveSection())
        },
        update: function(a) {
            var b, c, d = a.getOverlappingSettings();
            for (b in this.optionToFieldMap) this.optionToFieldMap.hasOwnProperty(b) && ((c = this.optionToFieldMap[b]) ? (c.suspendEvents(!1), a.hasSetting(b) ? c.setValue(a.getSetting(b)) : a.hasTemplateSetting(b) ?
                c.setValue(a.getTemplateSetting(b)) : c.setValue(this.apiRef.getDefaultValue(b)), d.hasOwnProperty(b) && this.warnForOverride(c, c.getValue()), "chart--inverted" === b && this.swapAxisFieldSetTitles(c.getValue()), c.resumeEvents()) : console.log("Section view, no field editor for " + b));
            for (b in this.optionToArrayMap) this.optionToArrayMap.hasOwnProperty(b) && (c = this.optionToArrayMap[b], d = "series" === b ? a.listSortedSeries() : a.listIndexedConfigurations(b), c && c.refresh(d));
            this.currentConfiguration = a
        },
        swapAxisFieldSetTitles: function(a) {
            var b =
                this.fieldSets,
                c = b.yAxis,
                b = b.xAxis,
                d = b.title,
                e = c.title,
                f = -1 === d.indexOf("Vertical") ? !1 : !0;
            if (!f && a || !a && f) c.setTitle(d), b.setTitle(e)
        },
        warnForOverride: function(a, b) {
            var c, d;
            this.currentConfiguration && this.currentConfiguration.template && this.currentConfiguration.template.hasOwnProperty(a.name) && (c = $("tr[role='presentation'] td:nth-child(1) label", a.getEl().dom).first(), this.currentConfiguration.template[a.name] !== b ? (d = $("i", c), 1 > d.length && 0 < c.length && c.append(' <i class="icon-exclamation-sign settings" title="overlapping option with template"></i>')) :
                $("i", c).remove())
        }
    };
    EditorNS.views.settings = EditorSettingsView;

    function EditorAdvancedView(a, b) {
        this.apiRef = b.apiRef;
        this.title = a.title;
        this.allIds = [];
        this.modified_class_name = "tree-node-modified";
        var c = this,
            d, e;
        this.store = new Ext.data.TreeStore({
            root: {},
            fields: ["id", "optionValue", "optionDisplayName"]
        });
        this.combostore = new Ext.data.ArrayStore({
            fields: ["id", "displayText"]
        });
        b.communicator.getApiOptionsTree(function(a) {
            function g(a, d) {
                var e, f;
                if ("[object Array]" === Object.prototype.toString.call(d))
                    for (e = 0; e < d.length; e += 1) f = d[e], "string" === typeof f ? (0 <= c.allIds.indexOf(f) ?
                        console.log("Warning, the id " + f + " is already added.") : c.allIds.push(f), a.appendChild({
                            id: f,
                            optionDisplayName: b.apiRef.getDisplayName(f),
                            leaf: !0
                        }), c.combostore.add({
                            id: f,
                            displayText: f.replace(/[\-]+/g, ".")
                        })) : g(a, f);
                else
                    for (e in d) d.hasOwnProperty(e) && ("optionNames" === e ? 0 !== d.optionNames.length && g(a, d.optionNames) : "children" === e ? g(a, d.children) : (f = a.getId() + e, f = a.appendChild({
                        id: f,
                        optionDisplayName: e
                    }), g(f, d[e])))
            }

            function h(a, d) {
                c.currentConfiguration.setSetting(a, d, b.apiRef);
                c.currentConfiguration.needsSeriesReload(a) ?
                    (b.update(c.currentConfiguration, "silent"), b.activeDataProvider.startGetData(b.masterConfiguration.asObjectGraph(!1), b.masterConfiguration.asSeriesMappingObjectGraph())) : b.update(c.currentConfiguration, c);
                var e = c.store.getNodeById(a);
                e && (c.currentConfiguration.hasSetting(a) ? (e.data.cls = c.modified_class_name, e.data.changed = !0, e.data.optionValue = d) : (e.data.cls = void 0, e.data.changed = !1, e.data.optionValue = b.apiRef.getDefaultValue(a)), e.commit())
            }
            g(c.store.getRootNode(), a);
            d = TreeViewUtils.prototype.createCellEditor(h,
                function() {
                    return !1
                }, b.apiRef);
            e = TreeViewUtils.prototype.createColumnRenderer(b.apiRef);
            c.treePanel = new Ext.tree.Panel({
                region: "center",
                margin: 0,
                store: c.store,
                rootVisible: !1,
                useArrows: !0,
                columns: [{
                    xtype: "treecolumn",
                    text: "Option",
                    dataIndex: "optionDisplayName",
                    flex: 1
                }, {
                    xtype: "templatecolumn",
                    tpl: "{optionValue}",
                    text: "Value",
                    dataIndex: "optionValue",
                    flex: 1,
                    editor: "textfield",
                    renderer: e
                }, {
                    xtype: "templatecolumn",
                    tpl: "{changed}",
                    text: "Reset",
                    dataIndex: "status",
                    width: 40,
                    tooltip: "Reset",
                    sortable: !1,
                    editor: "textfield",
                    renderer: function(a, b, c) {
                        return !0 === c.data.changed ? '<i class="icon-undo icon-small icon-fixed-width"></i>' : ""
                    }
                }],
                selType: "cellmodel",
                plugins: [d],
                listeners: {
                    afterrender: function() {
                        var a = this.getView();
                        a.tip = Ext.create("Ext.tip.ToolTip", {
                            target: a.el,
                            delegate: a.cellSelector,
                            trackMouse: !0,
                            renderTo: Ext.getBody(),
                            width: 200,
                            listeners: {
                                beforeshow: function(c) {
                                    var d = c.triggerElement.cellIndex,
                                        e = a.getRecord(c.triggerElement.parentNode),
                                        f;
                                    if (void 0 === e) return !1;
                                    f = e.get("id");
                                    if (0 === d || 1 === d && 1 < e.data.depth) c.update(b.apiRef.getDescription(f).replace(" ",
                                        "&nbsp;"));
                                    else if (2 === d && e.isLeaf() && !0 === e.data.changed) d = b.apiRef.optionInfos[f].defaults, c.update(("Reset to: " + d).replace(" ", "&nbsp;"));
                                    else return !1
                                }
                            }
                        })
                    },
                    cellclick: function(a, c, d, e) {
                        var f = b.apiRef.optionInfos[e.data.id],
                            g = $(c);
                        if (2 === d && !0 === e.data.changed) {
                            a = f.defaults;
                            if ("CSSObject" === f.returnType && "string" == typeof a) try {
                                a = JSON.parse(a)
                            } catch (n) {
                                console.error("EditorAdvancedView.cellClick(), " + a), console.error(n.message)
                            }
                            e.data.changed = !1;
                            e.data.optionValue = a;
                            e.data.cls = "";
                            e.commit();
                            h(e.data.id,
                                a)
                        }
                        1 === d && f && "Color" === f.returnType && (d = function(a) {
                            var b, c = g.find("div");
                            b = null === a ? f.defaults : a.toString();
                            c.text(b);
                            c.css("background-color", b);
                            c.css("color", getForegroundColor(b));
                            null === a && $(this).spectrum("set", b);
                            h(e.data.id, b)
                        }, g.spectrum({
                            color: g.text(),
                            showButtons: !1,
                            allowEmpty: !0,
                            showInitial: !0,
                            showInput: !0,
                            showAlpha: !0,
                            clickoutFiresChange: !0,
                            preferredFormat: "hex",
                            localStorageKey: "cloud.hc.color",
                            move: d,
                            change: d
                        }), window.setTimeout(function() {
                            g.spectrum("show")
                        }))
                    }
                },
                tools: [{
                    xtype: "label",
                    padding: "1 0 0 5",
                    text: "Search options:"
                }, {
                    border: !1,
                    padding: "0 5 0 10",
                    xtype: "combobox",
                    width: "150px",
                    queryMode: "local",
                    store: c.combostore,
                    valueField: "id",
                    displayField: "displayText",
                    triggerAction: "all",
                    typeAhead: !1,
                    listeners: {
                        beforequery: function(a) {
                            a.query = RegExp(a.query, "i");
                            a.forceAll = !0
                        },
                        select: function(a) {
                            var b = c.store.getNodeById(a.value);
                            c.treePanel.expandPath(b.getPath(), null, null, function(a) {
                                a && Ext.Function.defer(function() {
                                        var a = c.treePanel.getView().store.indexOf(b);
                                        c.treePanel.getView().focusRow(a)
                                    },
                                    500)
                            })
                        }
                    }
                }, {
                    html: '<span id="free">Free in Beta</span>',
                    xtype: "panel"
                }]
            });
            c.setPanel(c.treePanel)
        })
    }
    EditorAdvancedView.prototype = {
        getPanel: function() {
            return this.panel
        },
        setPanel: function(a) {
            this.panel = new Ext.Panel({
                id: "editor-tree-view",
                title: this.title,
                layout: {
                    type: "border",
                    align: "stretch"
                },
                items: [a]
            })
        },
        update: function(a) {
            var b = a.listSettings(),
                c, d, e;
            for (c = 0; c < this.allIds.length; c += 1) e = this.allIds[c], (d = this.store.getNodeById(e)) ? a.hasSetting(e) ? (d.data.cls = this.modified_class_name, d.data.optionValue = a.getSetting(e), d.data.changed = !0) : (d.data.cls = void 0, d.data.optionValue = this.apiRef.getDefaultValue(e)) :
                console.log("TreeView, no field editor for " + b[c]);
            this.treePanel.getView().refresh();
            this.currentConfiguration = a
        }
    };
    EditorNS.views.advanced = EditorAdvancedView;

    function EditorLandingPage(a, b) {
        this.init(a, b)
    }
    EditorLandingPage.prototype = {
        init: function(a, b) {
            this.renderTo = a;
            this.editor = b
        },
        createDataPanel: function() {
            var a = this;
            return new Ext.panel.Panel({
                title: "Step 1: Select data",
                border: !1,
                layout: "hbox",
                items: [new Ext.button.Button({
                    xtype: "button",
                    margin: "5",
                    enableToggle: !0,
                    allowDepress: !1,
                    handler: function() {
                        a.editor.activeDataProvider.addBindingFromPrompt()
                    },
                    text: "Select data",
                    width: 90,
                    height: 32
                }), new Ext.button.Button({
                    xtype: "button",
                    margin: "5",
                    enableToggle: !0,
                    allowDepress: !1,
                    handler: function() {
                        console.log("insert sample data");
                        a.editor.activeDataProvider.insertSampleData()
                    },
                    text: "Sample data",
                    width: 90,
                    height: 32
                })],
                cls: "dataPanel",
                bodyStyle: "height:60px;",
                listeners: {
                    afterrender: function(a) {
                        a.header.setHeight(30)
                    }
                }
            })
        },
        createLandingPage: function() {
            var a, b, c;
            c = this.createDataPanel();
            this.iconsPanel = b = new Ext.panel.Panel({
                border: !1,
                header: !1,
                layout: "anchor",
                width: "75%",
                items: [],
                cls: "iconsPanel"
            });
            a = this.createButtons();
            a = new Ext.Panel({
                title: "Step 2: Select chart type",
                cls: "chartType",
                layout: "hbox",
                items: [{
                    header: !1,
                    border: !1,
                    layout: "vbox",
                    width: "25%",
                    cls: "chapters",
                    items: a
                }, {
                    xtype: "splitter"
                }, b],
                listeners: {
                    afterrender: function(a) {
                        a.header.setHeight(30)
                    }
                }
            });
            return new Ext.Panel({
                id: "landing",
                title: '<img alt="" src="./resources/images/logo-white.svg" id="logo"><h1>Highcharts</h1><h3>for Office</h3>',
                cls: "landing",
                plugins: [new Ext.ux.FitToParent(this.renderTo)],
                renderTo: this.renderTo,
                layout: {
                    type: "vbox",
                    align: "stretch"
                },
                items: [c, a],
                overflowY: "auto",
                hideMode: "visibility",
                headerCfg: {
                    tag: "h2",
                    cls: "x-panel-header"
                },
                listeners: {
                    afterrender: function(a) {
                        a.header.setHeight(80)
                    }
                }
            })
        },
        buttonHandler: function(a) {
            var b, c, d;
            if (a.getText() !== this.currentType) {
                this.currentType = a.getText();
                b = this.iconsPanel.items ? this.iconsPanel.items.items : [];
                for (d = 0; d < b.length; d += 1) c = b[d], -1 === c.cls.indexOf(" " + a.getText()) ? c.hide() : c.show()
            }
        },
        setSettings: function(a, b) {
            var c, d, e;
            e = this.editor.chartTypesConfiguration[a][b].config;
            d = new Configuration;
            for (c in e) e.hasOwnProperty(c) && d.setSetting(c, e[c]);
            this.editor.loadConfiguration(d)
        },
        createIconsForType: function(a) {
            var b, c, d, e = this,
                f = function() {
                    e.setSettings(a,
                        this.id)
                },
                g;
            d = e.editor.chartTypesConfiguration[a];
            for (b in d) d.hasOwnProperty(b) && (c = d[b], g = "column" !== a, c = Ext.create("Ext.Img", {
                cls: "icons " + a,
                src: c.urlImg,
                alt: c.title,
                name: c.title,
                id: b,
                listeners: {
                    click: {
                        element: "el",
                        fn: f,
                        config: c.title
                    }
                },
                hidden: g
            }), e.iconsPanel.add(c))
        },
        createButtons: function() {
            var a, b = [],
                c, d = this,
                e = function() {
                    d.buttonHandler.apply(d, arguments)
                };
            for (c in this.editor.chartTypesConfiguration) this.editor.chartTypesConfiguration.hasOwnProperty(c) && (a = new Ext.button.Button({
                xtype: "button",
                margin: "0 5 5 0",
                enableToggle: !0,
                toggleGroup: "1",
                handler: e,
                text: c
            }), b.push(a), this.createIconsForType(c));
            return b
        }
    };

    function Editor() {
        this.init.apply(this, arguments)
    }
    Editor.registerDataProvider = function(a) {
        void 0 === Editor.registeredProviders && (Editor.registeredProviders = []);
        Editor.registeredProviders.push(a)
    };
    Editor.prototype = {
        init: function(a, b, c, d, e) {
            this.apiRef = new ApiRef;
            this.masterConfiguration = null;
            this.views = {};
            this.panelsToViews = {};
            this.communicator = new Communicator(c);
            this.serverConfiguration = c;
            this.elementIds = d;
            this.viewConfigurations = b;
            this.userStatus = e;
            this.loadApiRefAndValidator(b);
            this.loadApiRefOverrides();
            this.loadLang("en");
            this.addDataProviders();
            this.mainPanel = this.createMainPanel();
            this.buildUI(a)
        },
        buildUI: function(a, b) {
            var c, d, e;
            if ("object" === isOfType(a)) c = b, b = this.buildUI(a.ui), void 0 !==
                c ? c.add(b) : this.mainPanel.add(b);
            else if ("array" === isOfType(a)) {
                c = a.pop();
                void 0 !== c.name && (d = c.name, b = void 0 === this["create" + d] ? this.createPanel(c.type, c.id) : this["create" + d](), void 0 !== c.title && (b.title = c.title));
                for (c = 0; c < a.length; c += 1) this.buildUI(a[c], b)
            } else if (void 0 !== b) {
                for (c = 0; c < this.viewConfigurations.length; c += 1) d = this.viewConfigurations[c], d.name === a.toLowerCase() && (this.views[a] = e = new(EditorNS.views[a.toLowerCase()])(d, this), this.panelsToViews[e.getPanel().getId()] = e);
                b.add(e.getPanel())
            }
            return b
        },
        createPanel: function(a, b) {
            var c = this,
                d, e;
            return "tab" === a ? (d = {
                autoApplyWizardStep: function() {
                    return !1
                },
                applyWizardStep: function() {},
                getNextWizardStepCaption: function() {
                    return "Continue to Embed"
                }
            }, e = new Ext.TabPanel({
                id: b,
                margin: "0 0 0 0",
                cls: "view-tabs",
                width: "100%",
                tabBar: {
                    height: 35,
                    padding: "0 0 0 0",
                    defaults: {
                        height: 35,
                        width: 100,
                        margin: "0 10 0 0"
                    }
                },
                listeners: {
                    // tabchange: function(a, b) {
//                         "editor-tree-view" === b.id && c.showToast("Saving disabled", "This page contains functionality that is only available to licensed users, you can try them out but saving will be disabled.",
//                             0, "editor-advanced-tab-contain-licensed-options")
//                     },
                    activate: function(a) {
                        a && !a.getActiveTab() && a.setActiveTab(0)
                    }
                }
            }), c.panelsToViews[b] = d, e) : new Ext.Panel({
                id: b,
                margin: 10,
                layout: {
                    type: "border",
                    align: "stretch"
                }
            })
        },
        createMainPanel: function() {
            var a = this.elementIds.mainEditor;
            return new Ext.Panel({
                renderTo: a,
                layout: {
                    type: "border",
                    align: "stretch"
                },
                style: "opacity: 0;",
                cls: "main-editor",
                plugins: [new Ext.ux.FitToParent(a)]
            })
        },
        createRightPanel: function() {
            return new Ext.Panel({
                border: !1,
                region: "center",
                margin: "5 5 5 0",
                layout: {
                    type: "border"
                },
                cls: "right-panel"
            })
        },
        createEditorTabPanel: function() {
            var a = this;
            Ext.tip.QuickTipManager.init();
            return this.editorTabs = new Ext.TabPanel({
                split: !0,
                width: "42%",
                minWidth: 300,
                region: "west",
                margin: "5 0 5 5",
                cls: "progression-tabs",
                id: "progression-tabs",
                centered: !0,
                tabBar: {
                    cls: "progression-tab-bar",
                    height: 70,
                    padding: "0 0 0 0",
                    defaults: {
                        height: 70
                    }
                },
                listeners: {
                    resize: function(a, c) {
                        c -= $("#button-bar").width();
                        $("#button-bar").css({
                            left: c - 10
                        })
                    },
                    beforetabchange: function() {
                        a.nextWizardStep(!0)
                    },
                    tabchange: function() {
                        a.updateWizardStep()
                    }
                },
                dockedItems: [{
                    cls: "progression-tabs-bottom-toolbar",
                    layout: {
                        pack: "end"
                    },
                    xtype: "toolbar",
                    dock: "bottom",
                    items: [{
                        xtype: "button",
                        id: "wizard.next-button",
                        cls: "heavy-btn",
                        text: "Continue to next step",
                        handler: function() {
                            a.nextWizardStep(!1, !0)
                        }
                    }]
                }]
            })
        },
        nextWizardStep: function(a, b) {
            var c = this.editorTabs.getActiveTab(),
                d, e;
            c && (d = this.editorTabs.items.indexOf(c), e = this.editorTabs.items.length, c = this.panelsToViews[c.getId()], (c.autoApplyWizardStep() || b) && c.applyWizardStep(), !a && d + 1 < e && this.editorTabs.setActiveTab(d + 1))
        },
        updateWizardStep: function() {
            var a = this.editorTabs.getActiveTab(),
                b;
            a && (a = this.panelsToViews[a.getId()], b = Ext.getCmp("wizard.next-button"), b.setText(a.getNextWizardStepCaption()))
        },
        getActiveTabUIIndex: function() {
            return this.editorTabs ? this.editorTabs.items.indexOf(this.editorTabs.getActiveTab()) : 0
        },
        applyActiveTabUIIndex: function(a) {
            this.editorTabs && (this.editorTabs.setActiveTab(a), this.editorTabs.doLayout())
        },
        addDataProviders: function() {
            function a() {
                var a,
                    b;
                e.masterConfiguration.setModified(!0);
                a = e.masterConfiguration.asObjectGraph(!1);
                b = e.masterConfiguration.asTemplateObjectGraph(!1);
                a = Highcharts.merge(b, a);
                e.activeDataProvider.startGetData(a, e.masterConfiguration.asSeriesMappingObjectGraph())
            }

            function b(a, b) {
                e.loadApiRefOverrides(b);
                e.masterConfiguration.setLinkedData(a);
                e.update(e.masterConfiguration)
            }
            var c, d, e = this;
            for (c = 0; c < Editor.registeredProviders.length; c += 1) d = Editor.registeredProviders[c], d.init(), d.addReadyListener(b), d.addChangedListener(a)
        },
        loadViewState: function(a) {
            var b = this,
                c = a.getName() + "/" + a.getVersion();
            b.communicator.getViewState(a, function(a) {
                b.updateViewState(a);
                b.setStatusMessage("done loading view state: " + c + ".")
            }, function() {
                b.setStatusMessage("failed loading view state: " + c + ".")
            })
        },
        showImportInfo: function() {
            $('<div><h4>How the import works</h4><p>Your chart will appear here after adding data to the CSV import on the left.</p><p>Below the chart, a spreadsheet will appear. Once you import data from the left, it is interpreted and added to the spreadsheet. The spreadsheet now serves as the data source for the chart.</p><p>Alternatively, you can <a href="javascript:editor.views.importdata.showGridAndChart()">open the grid</a> and enter data manually.</p></div>').attr({
                id: "import-info",
                "class": "info"
            }).appendTo($(".right-panel"));
            $(".right-panel .x-panel-body").css({
                marginLeft: "-100%",
                transition: "margin-left 500ms"
            })
        },
        load: function(a, b) {
            var c = this,
                d, e, f;
            if ("" === a && !c.communicator.storedInClient()) this.loadEmptyChart(), this.showImportInfo();
            else if (c.setStatusMessage("loading: " + a + "..."), c.communicator.storedInClient()) {
                d = c.communicator.readConfigurationFromClientStorage(a, b);
                e = c.communicator.readViewStateFromClientStorage();
                this.masterConfiguration = d;
                for (f in this.views) this.views.hasOwnProperty(f) &&
                    this.views[f].update(this.masterConfiguration);
                this.updateViewState(e)
            } else c.communicator.get(a, b, function(b) {
                c.loadConfiguration(b);
                c.setStatusMessage("done loading: " + a + ".")
            }, function() {
                c.setStatusMessage("failed loading: " + a + ".")
            })
        },
        loadEmptyChart: function() {
            var a = new Configuration,
                b = new ViewState;
            b.setState("editor--activeDataProviderName", "highcharts.dataprovider.table");
            b.setState("editor--activeDataProviderSettings", {
                csv: ""
            });
            this.loadConfiguration(a, b)
        },
        saveState: function(a, b) {
            var c = this,
                d = a + "/" + b;
            c.setStatusMessage("saving view state: " + d);
            c.communicator.saveViewState(c.getViewState(), a, b, function(a, b, g) {
                c.setStatusMessage("done saving view state: " + d + ".");
                window.location.href = b === g ? c.serverConfiguration.chartsPath + "/" + a : c.serverConfiguration.chartsPath + "/" + a + "/" + b
            }, function() {
                c.setStatusMessage("failed saving view state: " + d + ".")
            })
        },
        save: function() {
            var a = this,
                b = a.masterConfiguration.getName();
            a.setStatusMessage("saving: " + b + "...");
            a.communicator.save(a.masterConfiguration, function(c,
                d) {
                a.saveState(c, d);
                a.setStatusMessage("done saving: " + b + ".")
            }, function() {
                a.setStatusMessage("failed saving: " + b + ".")
            })
        },
        saveDraft: function() {
            var a = this,
                b = a.masterConfiguration.getName();
            a.setStatusMessage("saving: " + b + "...");
            a.communicator.saveDraft(a.masterConfiguration, function(c, d) {
                a.saveState(c, d);
                a.setStatusMessage("done saving: " + b + ".")
            }, function() {
                a.setStatusMessage("failed saving: " + b + ".")
            })
        },
        saveAs: function() {
            var a = this,
                b = a.masterConfiguration.getName();
            a.setStatusMessage("forking: " + b +
                "...");
            a.communicator.saveAs(a.masterConfiguration, function(c, d) {
                a.saveState(c, d);
                a.setStatusMessage("done forking: " + b + " -> " + c + ".")
            }, function() {
                a.setStatusMessage("failed forking: " + b + ".")
            })
        },
        setAsBase: function() {
            var a = this,
                b = a.masterConfiguration.getName(),
                c = a.masterConfiguration.getVersion();
            a.setStatusMessage("setting base of: " + b + " to " + c);
            a.communicator.setAsBase(a.masterConfiguration, function(b, c) {
                a.setStatusMessage("base version for " + b + " is set to " + c + ".");
                window.location.href = a.serverConfiguration.chartsPath +
                    "/" + b
            }, function(c) {
                a.setStatusMessage("failed setting version: " + b + ". " + c);
                "Unauthorized" === c && Ext.Msg.show({
                    title: c,
                    msg: "Base version could not be set on this chart. Only the author of the chart can set the base version. If you are logged in, you can create a fork of the chart and control the base version of that.",
                    buttons: Ext.Msg.OK
                })
            })
        },
        setPrivateToOwner: function(a) {
            var b = this,
                c = b.masterConfiguration.getName();
            b.setStatusMessage("setting private of: " + c + " to " + a);
            b.communicator.setPrivateToOwner(c,
                a,
                function(a, c) {
                    b.setStatusMessage("private value for " + a + " is set to " + c + ".");
                    window.location.href = b.serverConfiguration.chartsPath + "/" + a
                },
                function(a) {
                    b.setStatusMessage("failed setting private: " + c + ". " + a);
                    "Unauthorized" === a && Ext.Msg.show({
                        title: a,
                        msg: "Could not change the private state of this chart. Only the author of the chart can set change it.",
                        buttons: Ext.Msg.OK
                    })
                })
        },
        setHashPrivateToOwner: function(a, b, c) {
            var d = this;
            d.setStatusMessage("setting private of: " + a + " to " + b);
            d.communicator.setPrivateToOwner(a,
                b, c,
                function(b) {
                    d.setStatusMessage("failed setting private: " + a + ". " + b)
                })
        },
        setTitle: function(a, b, c) {
            var d = this;
            d.setStatusMessage("setting title of: " + a + " to " + b);
            d.communicator.setTitle(a, b, function(a, b) {
                d.setStatusMessage("title for " + a + " is set to " + b + ".");
                c && c(a, b)
            }, function(b) {
                d.setStatusMessage("failed setting title: " + a + ". " + b)
            })
        },
        setUserDisplayName: function(a, b, c, d) {
            var e = this;
            e.setStatusMessage("setting display name to: " + b);
            e.communicator.setUserDisplayName(a, b, function(a, b) {
                e.setStatusMessage("title for " +
                    a + " is set to " + b + ".");
                c && c(a, b)
            }, function(a) {
                e.setStatusMessage("failed setting display name. " + a);
                d && d(a)
            })
        },
        setUserEmail: function(a, b, c, d) {
            var e = this;
            e.setStatusMessage("setting email to: " + b);
            e.communicator.setUserEmail(a, b, function(a, b) {
                e.setStatusMessage("email for " + a + " is set to " + b + ".");
                c && c(a, b)
            }, function(a) {
                e.setStatusMessage("failed setting email. " + a);
                d && d(a)
            })
        },
        setUserStartPrivate: function(a, b, c, d) {
            var e = this;
            e.setStatusMessage("setting startPrivate to: " + b);
            e.communicator.setUserStartPrivate(a,
                b,
                function(a, b) {
                    e.setStatusMessage("startPrivate for " + a + " is set to " + b + ".");
                    c && c(a, b)
                },
                function(a) {
                    e.setStatusMessage("failed setting startPrivate. " + a);
                    d && d(a)
                })
        },
        setRememberMe: function(a, b, c, d) {
            var e = this;
            e.setStatusMessage("setting rememberMe to: " + b);
            e.communicator.setRememberMe(a, b, function(a, b) {
                e.setStatusMessage("rememberMe for " + a + " is set to " + b + ".");
                c && c(a, b)
            }, function(a) {
                e.setStatusMessage("failed setting rememberMe. " + a);
                d && d(a)
            })
        },
        listCharts: function(a, b, c) {
            var d = this;
            d.setStatusMessage("listing charts");
            d.communicator.listCharts(a, b, function(a, b) {
                d.setStatusMessage("done.");
                c && c(a, b)
            }, function(a) {
                d.setStatusMessage("failed listing charts: " + a)
            })
        },
        createExport: function(a, b) {
            var c = this;
            c.setStatusMessage("creating export.");
            c.communicator.createExport(a, function(a) {
                c.setStatusMessage("created " + a);
                b && b()
            }, function(a) {
                c.setStatusMessage("failed create export. " + a)
            })
        },
        deleteExport: function(a, b) {
            var c = this;
            c.setStatusMessage("deleting export: " + a);
            c.communicator.deleteExport(a, function() {
                c.setStatusMessage("deleted " +
                    a);
                b && b()
            }, function(b) {
                c.setStatusMessage("failed deleting: " + a + ". " + b)
            })
        },
        listExports: function(a) {
            var b = this;
            b.setStatusMessage("listing exports");
            b.communicator.listExports(function(c, d) {
                b.setStatusMessage("done.");
                a && a(c, d)
            }, function(a) {
                b.setStatusMessage("failed listing exports: " + a)
            })
        },
        listLogins: function(a) {
            var b = this;
            b.setStatusMessage("listing logins");
            b.communicator.listLogins(function(c) {
                b.setStatusMessage("done.");
                a && a(c)
            }, function(a) {
                b.setStatusMessage("failed listing exports: " + a)
            })
        },
        deleteLogin: function(a, b) {
            var c = this;
            c.setStatusMessage("deleting login: " + a);
            c.communicator.deleteLogin(a, function() {
                c.setStatusMessage("deleted " + a);
                b && b()
            }, function(b) {
                c.setStatusMessage("failed deleting: " + a + ". " + b)
            })
        },
        listDeletedCharts: function(a, b, c) {
            var d = this;
            d.setStatusMessage("listing deleted charts");
            d.communicator.listDeletedCharts(a, b, function(a, b) {
                d.setStatusMessage("done.");
                c && c(a, b)
            }, function(a) {
                d.setStatusMessage("failed listing charts: " + a)
            })
        },
        deleteConfiguration: function(a, b) {
            var c =
                this;
            c.setStatusMessage("deleting: " + a);
            c.communicator.deleteConfiguration(a, function() {
                c.setStatusMessage("deleted " + a);
                b && b()
            }, function(b) {
                c.setStatusMessage("failed deleting: " + a + ". " + b)
            })
        },
        undeleteConfiguration: function(a, b) {
            var c = this;
            c.setStatusMessage("undeleting: " + a);
            c.communicator.undeleteConfiguration(a, function() {
                c.setStatusMessage("undeleted " + a);
                b && b()
            }, function(b) {
                c.setStatusMessage("failed undeleting: " + a + ". " + b)
            })
        },
        listLicensedProducts: function(a, b) {
            var c = this;
            c.setStatusMessage("listing products");
            c.communicator.listLicensedProducts(a, function(a, e) {
                c.setStatusMessage("done.");
                b && b(a, e)
            }, function(a) {
                c.setStatusMessage("failed listing products: " + a)
            })
        },
        registerLicense: function(a, b, c, d) {
            var e = this;
            e.setStatusMessage("register license");
            e.communicator.registerLicense(a, b, function(a, b) {
                e.setStatusMessage("done.");
                c && c(a, b)
            }, function(a) {
                e.setStatusMessage("failed register products: " + a);
                d && d(a)
            })
        },
        createOrUpdatePaymentSubscription: function(a, b, c, d) {
            var e = this;
            e.setStatusMessage("creating payment subscription");
            e.communicator.createOrUpdatePaymentSubscription(a, b, function(a, b, d, i) {
                e.setStatusMessage("done.");
                c && c(a, b, d, i)
            }, function(a) {
                e.setStatusMessage("failed create payment subscription: " + a);
                d && d(a)
            })
        },
        getUserSubscription: function(a, b, c) {
            var d = this;
            d.setStatusMessage("get payment subscription");
            d.communicator.getUserSubscription(a, function(a, c, g, h) {
                d.setStatusMessage("done.");
                b && b(a, c, g, h)
            }, function(a) {
                d.setStatusMessage("failed get payment subscription: " + a);
                c && c(a)
            })
        },
        getUserSubscriptionUsage: function(a,
            b, c) {
            var d = this;
            d.setStatusMessage("get subscription usage");
            d.communicator.getUserSubscriptionUsage(a, function(a, c) {
                d.setStatusMessage("done.");
                b && b(a, c)
            }, function(a) {
                d.setStatusMessage("failed get subscription usage: " + a);
                c && c(a)
            })
        },
        getUserAdjustments: function(a, b, c) {
            var d = this;
            d.setStatusMessage("get payment adjustments");
            d.communicator.getUserAdjustments(a, function(a, c, g, h) {
                d.setStatusMessage("done.");
                b && b(a, c, g, h)
            }, function(a) {
                d.setStatusMessage("failed get payment adjustments: " + a);
                c && c(a)
            })
        },
        createOrUpdatePaymentAccount: function(a, b, c, d) {
            var e = this;
            e.setStatusMessage("creating payment account");
            e.communicator.createOrUpdatePaymentAccount(a, b, function(a) {
                e.setStatusMessage("done.");
                c && c(a)
            }, function(a, b) {
                e.setStatusMessage("failed create payment account: " + a);
                d && d(a, b)
            })
        },
        deleteBillingInfo: function(a, b, c) {
            var d = this;
            d.setStatusMessage("deleting billing info");
            d.communicator.deleteBillingInfo(a, function(a) {
                d.setStatusMessage("done.");
                b && b(a)
            }, function(a, b) {
                d.setStatusMessage("failed to delete billing info: " +
                    a);
                c && c(a, b)
            })
        },
        configurationNotSaved: function() {
            return void 0 === this.masterConfiguration.getName() || void 0 === this.masterConfiguration.getVersion() || this.masterConfiguration.isModified()
        },
        showShare: function(a, b) {
            var c, d, e;
            d = void 0 !== a ? a : this.masterConfiguration.getName();
            e = void 0 !== b ? b : this.masterConfiguration.getVersion();
            void 0 === a && void 0 === b && this.configurationNotSaved() ? (d = {
                    title: "Share",
                    minWidth: 300,
                    msg: "The current chart is not saved, to share it you must first save the chart.",
                    buttons: Ext.Msg.OK
                },
                Ext.Msg.show(d)) : (c = new Ext.Window({
                title: "Share",
                width: 700,
                height: 300,
                layout: "fit",
                autoScroll: !1,
                plain: !0,
                modal: !0,
                border: 0,
                items: [{
                    xtype: "component",
                    autoEl: {
                        tag: "iframe",
                        style: "border: 0px;",
                        src: "/share/" + d + "/" + e
                    }
                }],
                buttons: [{
                    text: "OK",
                    handler: function() {
                        c.close()
                    }
                }]
            }), c.show())
        },
        showLogin: function(a) {
            var b = this,
                c, a = a || "login";
            null !== this.masterConfiguration && b.communicator.supportsClientStorage() && (b.communicator.writeConfigurationToClientStorage(this.masterConfiguration), b.communicator.writeViewStateToClientStorage(this.getViewState()),
                window.onbeforeunload = void 0);
            c = new Ext.Window({
                header: !1,
                width: 610,
                height: 400,
                layout: "fit",
                plain: !0,
                modal: !0,
                border: 0,
                items: [{
                    xtype: "component",
                    autoEl: {
                        tag: "iframe",
                        style: "border: 0px;",
                        src: "/auth/" + a
                    }
                }],
                buttons: [{
                    text: "Cancel",
                    handler: function() {
                        if (this.masterConfiguration !== null && b.communicator.supportsClientStorage()) {
                            b.communicator.clearClientStorage();
                            b.addUnloadGuard()
                        }
                        c.close()
                    }
                }]
            });
            c.show()
        },
        showLogout: function() {
            Ext.Msg.show({
                title: "Logout",
                msg: "You are about to log out, click OK to continue.",
                buttons: Ext.Msg.OKCANCEL,
                fn: function(a) {
                    "ok" === a && (window.location.href = "/auth/logout")
                }
            })
        },
        showToast: function(a, b, c, d) {
            function e() {
                var a = document.getElementById("hc-toast-countdown"),
                    b = Math.floor(c + 1 - (Date.now() - h) / 1E3);
                a && 1 <= b && (a.innerHTML = " (closing in " + b + " seconds)")
            }

            function f() {
                void 0 !== d && (g.userStatus.displayedMessageIds.push(d), g.communicator.addMessageDisplayed(d))
            }
            var g = this,
                h = Date.now(),
                i, j;
            if (!(g.userStatus.canSaveAdvancedOptions && "editor-advanced-tab-contain-licensed-options" === d ||
                    d && -1 !== g.userStatus.displayedMessageIds.indexOf(d)))
                if (a = {
                        title: a + '<span id="hc-toast-countdown"></span>',
                        msg: b,
                        buttons: Ext.Msg.OK,
                        fn: f
                    }, c && (a.buttons = [], delete a.fn), j = Ext.Msg.show(a), c) Ext.Function.defer(function() {
                    window.clearInterval(i);
                    i = void 0;
                    j.hide();
                    f()
                }, 1E3 * c), i = window.setInterval(e, 10)
        },
        setStatusMessage: function(a) {
            this.enableStatus && (document.getElementById(this.elementIds.statusId).innerText = a)
        },
        loadConfiguration: function(a, b) {
            var c;
            this.masterConfiguration = a;
            void 0 !== a.getName() ? this.loadViewState(a) :
                this.updateViewState(b);
            for (c in this.views) this.views.hasOwnProperty(c) && this.views[c].update(this.masterConfiguration)
        },
        getQuotaExceeded: function() {
            var a, b = this.userStatus.quotaUsage,
                c = this.userStatus.quotaLimit;
            if (this.userStatus.isAnonymous) return !1; - 1 !== c.chartStorageCount && (a = c.chartStorageCount <= b.chartStorageCount);
            !a && -1 !== c.chartStorageBytes && (a = c.chartStorageBytes <= b.chartStorageBytes);
            return a
        },
        update: function(a, b) {
            var c, d, e, f = !1;
            this.masterConfiguration = a;
            for (c in this.views)
                if (this.views.hasOwnProperty(c) &&
                    "silent" !== b && b !== this.views[c] && !this.views[c].processing) try {
                    this.views[c].processing = !0, this.views[c].update(this.masterConfiguration), this.views[c].processing = !1
                } catch (g) {} finally {
                    this.views[c].processing = !1
                }
                d = a.isModified();
            c = !0;
            !this.userStatus.canSaveAdvancedOptions && a.containsOptionThatRequiresLicense(this.apiRef) && (c = d = !1, f = !0);
            d && (d = !this.getQuotaExceeded());
            if (e = document.getElementById(this.elementIds.saveButton)) e.disabled = !d;
            if (e = document.getElementById(this.elementIds.saveDraftButton)) e.disabled = !d;
            if (d = document.getElementById(this.elementIds.forkButton)) d.disabled = !c, f && (d.title = "You cannot duplicate this chart, it's containing licensed features");
            this.addUnloadGuard()
        },
        addUnloadGuard: function() {
            if (!window.onbeforeunload && this.masterConfiguration && (this.masterConfiguration.isModified() || !this.masterConfiguration.getName())) window.onbeforeunload = function() {
                return "The chart configuration has been modified since loading."
            }
        },
        updateViewState: function(a) {
            var b, c;
            void 0 === a && (a = new ViewState);
            this.updateEditorViewState(a);
            for (b in this.views) this.views.hasOwnProperty(b) && (c = this.views[b], c.updateViewState && c.updateViewState(a));
            (a = Ext.get("loadingMessageDiv")) && a.remove();
            this.mainPanel.getEl().fadeIn({
                from: {
                    opacity: 0
                },
                duration: 200
            })
        },
        getViewState: function() {
            var a = new ViewState,
                b, c;
            this.getEditorViewState(a);
            for (b in this.views) this.views.hasOwnProperty(b) && (c = this.views[b], c.getViewState && c.getViewState(a));
            return a
        },
        updateEditorViewState: function(a) {
            var b;
            b = a.getState("editor--activeTabIndex");
            void 0 === b && (b = 0);
            this.applyActiveTabUIIndex(b);
            b = a.getState("editor--activeDataProviderName");
            a = a.getState("editor--activeDataProviderSettings");
            void 0 === b && void 0 === a && (b = "highcharts.dataprovider.table", a = {
                csv: DataSets.prototype.cityTemperature
            });
            void 0 === a && (a = {});
            b = this.getDataProviderByName(b);
            b.applySettings(a);
            this.setActiveDataProvider(b);
            this.views.data && this.views.data.applyActiveDataProviderUIIndex(this.getDataProviderIndex(b))
        },
        setActiveDataProviderName: function(a) {
            this.setActiveDataProvider(this.getDataProviderByName(a))
        },
        setActiveDataProvider: function(a) {
            var b;
            this.activeDataProvider !== a && (this.activeDataProvider = a, this.activeDataProviderName = a.getName(), b = this.masterConfiguration.asObjectGraph(!1), a = this.masterConfiguration.asTemplateObjectGraph(!1), a = Highcharts.merge(a, b), this.activeDataProvider.startGetData(a, this.masterConfiguration.asSeriesMappingObjectGraph()))
        },
        getDataProviderIndex: function(a) {
            var b;
            for (b = 0; b < Editor.registeredProviders.length; b += 1)
                if (Editor.registeredProviders[b] === a) return b;
            return 0
        },
        getDataProviderByName: function(a) {
            var b;
            for (b = 0; b < Editor.registeredProviders.length; b += 1)
                if (Editor.registeredProviders[b].getName() === a) return Editor.registeredProviders[b];
            return Editor.registeredProviders[0]
        },
        getEditorViewState: function(a) {
            a.setState("editor--activeTabIndex", this.getActiveTabUIIndex());
            a.setState("editor--activeDataProviderName", this.activeDataProvider ? this.activeDataProvider.getName() : void 0);
            a.setState("editor--activeDataProviderSettings", this.activeDataProvider ? this.activeDataProvider.getSettings() : void 0)
        },
        loadApiRefAndValidator: function(a) {
            var b,
                c, d = this.parseOptionNames(a),
                e = [],
                a = this.communicator.getApiInfo();
            for (b = 0; b < a.length; b += 1) c = a[b], this.apiRef.addApiRef(c);
            for (b = 0; b < d.length; b += 1) 0 <= d[b].indexOf("*") && e.push(d[b]);
            this.apiRef.expandMultiOptions(e)
        },
        loadApiRefOverrides: function(a) {
            var b, c, a = a || [];
            c = "[-1";
            for (b = 0; b < a.length; b += 1) c = c + ", " + b;
            c += "]";
            a.unshift("None");
            b = new OptionInfo("series-seriesMapping--label", "Number", "Label column", "Identifies a specific column to use as data labels", !1, "-1", c, !1);
            this.apiRef.addApiRef(b);
            this.apiRef.addEnumDisplayValues("series-seriesMapping--label",
                a);
            b = new OptionInfo("series-seriesMapping--x", "Number", "X axis column", "Identifies a specific column to use as x axis for this series", !1, "-1", c, !1);
            this.apiRef.addApiRef(b);
            this.apiRef.addEnumDisplayValues("series-seriesMapping--x", a)
        },
        loadLang: function(a) {
            var a = this.communicator.getLang(a).enums,
                b;
            for (b in a) a.hasOwnProperty(b) && this.apiRef.addEnumDisplayValues(b, a[b])
        },
        parseOptionNames: function(a) {
            function b(a, c) {
                var d, e;
                if ("[object Array]" === Object.prototype.toString.call(a))
                    for (d = 0; d < a.length; d +=
                        1) e = a[d], !0 === e.array || e.group ? b(e.options, c) : !0 !== e.button && (e = e.id || e, "string" === typeof e ? 0 > c.indexOf(e) && c.push(e) : b(e, c));
                else
                    for (d in a) a.hasOwnProperty(d) && b(a[d], c)
            }
            var c = [],
                d, e;
            for (d = 0; d < a.length; d += 1) e = a[d], ("settings" === e.name || "tree" === e.name) && b(e.options, c);
            return c
        }
    };
    window.Editor = Editor;
    window.EditorNS = EditorNS;
    window.Configuration = Configuration;
    window.DataSets = DataSets;
    window.OutputView = OutputView;
}(window));
(function(Editor) {
    /*
     Highcharts Editor v0.1 (2012-10-29)

     (c) 2009-2011 Highsoft Solutions AS

     License: www.highcharts.com/license
    */
    'use strict';

    function GridDataProvider() {
        this.dataReadyCallback = void 0;
        this.propagateUpdate = !0;
        this.state = {
            nextModelIndex: 0,
            store: void 0,
            modelTemplate: void 0,
            fieldToNameMap: {},
            fieldToTypeMap: {},
            fieldToFormatMap: {}
        };
        this.FieldTypes = {
            STRING: "string",
            NUMBER: "float",
            DATE: "date",
            DATETIME: "datetime"
        };
        this.DATEFORMAT = "Y-m-d";
        this.DATETIMEFORMAT = "Y-m-d H:i:s";
        this.currentSettings = {}
    }
    GridDataProvider.prototype = {
        getTitle: function() {
            return "Data table"
        },
        getName: function() {
            return "highcharts.dataprovider.table"
        },
        init: function() {
            var a = this,
                b;
            void 0 !== window.Ext && (window.Highcharts && window.Highcharts.Data && this.initDateParsing(), Ext.override(Ext.selection.CellModel, {
                onEditorTab: function(b, c) {
                    var d = c.shiftKey ? "left" : "right",
                        f = this.move(d, c);
                    if (f) b.startEditByPosition(f), this.wasEditing = !0;
                    else if ("right" === d && (a.addEmptyRow(), f = this.move(d, c))) b.startEditByPosition(f), this.wasEditing = !0
                }
            }), a.initStore(), a.addEmptySet(), this.gridPanel = new Ext.grid.Panel({
                store: a.state.store,
                columns: [],
                region: "center",
                flex: 1,
                selModel: {
                    selType: "cellmodel"
                },
                plugins: [Ext.create("Ext.grid.plugin.CellEditing", {
                    clicksToEdit: 1
                })],
                cls: "grid-panel",
                dockedItems: [{
                    xtype: "toolbar",
                    items: [{
                        text: '<i class="icon-plus-sign"></i> Add Row',
                        handler: function() {
                            a.addEmptyRow();
                            a.updateChart()
                        }
                    }, {
                        text: '<i class="icon-minus-sign"></i> Remove Current Row',
                        handler: function() {
                            var b = a.getExtPanel().getSelectionModel().getCurrentPosition().row;
                            0 <= b && (a.removeRow(b), a.updateChart())
                        }
                    }, {
                        text: '<i class="icon-columns"></i> Add Column',
                        handler: function() {
                            a.addColumn();
                            a.refreshUI();
                            a.updateChart()
                        }
                    }, {
                        text: '<i class="icon-mail-forward"></i> Export',
                        handler: function() {
                            var b = {
                                prompt: !0,
                                title: "Export text data",
                                minWidth: 600,
                                msg: "CSV representation of grid content",
                                buttons: Ext.Msg.OK,
                                multiline: !0,
                                defaultTextHeight: 300,
                                value: a.exportToFormattedCsv()
                            };
                            Ext.Msg.show(b)
                        }
                    }, {
                        text: '<i class="icon-refresh"></i> Reset',
                        handler: function() {
                            Ext.Msg.show({
                                prompt: !1,
                                title: "Reset data",
                                msg: "Reset to an empty data set?",
                                buttons: Ext.Msg.OKCANCEL,
                                callback: function(b) {
                                    "ok" === b && (a.clear(), a.addEmptySet(), a.refreshUI(), a.updateChart())
                                }
                            })
                        }
                    }]
                }]
            }), b = this.gridPanel.headerCt, b.addListener("menucreate", function(e, c) {
                c.removeAll();
                c.add({
                    text: "Add column before",
                    handler: function() {
                        var d = b.getGridColumns().indexOf(b.getMenu().activeHeader);
                        a.addColumnBefore(d);
                        a.refreshUI();
                        a.updateChart()
                    }
                });
                c.add({
                    text: "Add column after",
                    handler: function() {
                        var d = b.getGridColumns().indexOf(b.getMenu().activeHeader);
                        a.addColumnAfter(d);
                        a.refreshUI();
                        a.updateChart()
                    }
                });
                c.add({
                    text: "Rename column",
                    handler: function() {
                        var d = b.getGridColumns().indexOf(b.getMenu().activeHeader);
                        Ext.Msg.prompt("Rename column", "Enter the new name:", function(b, c) {
                            "ok" === b && (a.renameColumn(d, c), a.refreshUI(), a.updateChart())
                        }, void 0, !1, a.getColumnName(d))
                    }
                });
                c.add({
                    text: "Remove column",
                    handler: function() {
                        var d = b.getGridColumns().indexOf(b.getMenu().activeHeader);
                        0 <= d && (a.removeColumn(d), a.refreshUI(), a.updateChart())
                    }
                });
                c.add({
                    text: "Change type",
                    handler: function() {
                        var d = b.getGridColumns().indexOf(b.getMenu().activeHeader),
                            c = a.getColumnType(d),
                            e = new Ext.form.field.Radio({
                                xtype: "radiofield",
                                fieldLabel: "Number",
                                name: "colType",
                                anchor: "100%",
                                checked: c === a.FieldTypes.NUMBER
                            }),
                            j = new Ext.form.field.Radio({
                                xtype: "radiofield",
                                fieldLabel: "String",
                                name: "colType",
                                anchor: "100%",
                                checked: c === a.FieldTypes.STRING
                            }),
                            g = new Ext.form.field.Radio({
                                xtype: "radiofield",
                                fieldLabel: "Date",
                                name: "colType",
                                anchor: "100%",
                                checked: c === a.FieldTypes.DATE
                            }),
                            i = new Ext.form.field.Radio({
                                xtype: "radiofield",
                                fieldLabel: "Datetime",
                                name: "colType",
                                anchor: "100%",
                                checked: c === a.FieldTypes.DATETIME
                            }),
                            c = Ext.create("Ext.form.Panel", {
                                border: !1,
                                bodyPadding: 5,
                                items: [e, j, g, i]
                            }),
                            m = Ext.create("Ext.window.Window", {
                                title: "Change column type",
                                width: 250,
                                height: 220,
                                minWidth: 250,
                                minHeight: 200,
                                layout: "fit",
                                plain: !0,
                                items: c,
                                modal: !0,
                                buttons: [{
                                    text: "OK",
                                    handler: function() {
                                        var b, c;
                                        e.getValue() ? b = a.FieldTypes.NUMBER : j.getValue() ? b = a.FieldTypes.STRING : g.getValue() ? (b = a.FieldTypes.DATE, c = a.DATEFORMAT) : i.getValue() && (b = a.FieldTypes.DATETIME,
                                            c = a.DATETIMEFORMAT);
                                        m.close();
                                        a.changeColumnType(d, b, c);
                                        a.refreshUI();
                                        a.updateChart()
                                    }
                                }, {
                                    text: "Cancel",
                                    handler: function() {
                                        m.close()
                                    }
                                }]
                            });
                        m.show()
                    }
                });
                c.addListener("beforeshow", function() {
                    b.getGridColumns().indexOf(b.getMenu().activeHeader)
                })
            }), b.addListener("columnmove", function(b, c, d, f) {
                a.moveColumn(d, f);
                a.refreshUI();
                a.updateChart()
            }), a.refreshUI())
        },
        initStore: function() {
            var a = this;
            a.state.modelTemplate = Ext.define("TableModel", {
                extend: "Ext.data.Model",
                fields: []
            });
            a.state.store = new Ext.data.Store({
                model: "TableModel"
            });
            a.state.store.addListener("update", function(b, e, c) {
                c === Ext.data.Model.EDIT && (a.state.store.suspendEvents(), a.updateChart(), a.state.store.resumeEvents())
            })
        },
        initDateParsing: function() {
            var a = {
                "Y-m-d H:i:s": "%Y-%m-%d %H:%M:%S",
                "Y-m-d H": "%Y-%m-%d %H",
                "Y-m-d": "%Y-%m-%d"
            };
            Highcharts.Data.prototype.dateFormats["Y-m-d H:i:s"] = {
                regex: /^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})$/,
                parser: function(a) {
                    return Date.UTC(+a[1], a[2] - 1, +a[3], +a[4], +a[5], +a[6])
                }
            };
            Highcharts.Data.prototype.dateFormats["Y-m-d H"] = {
                regex: /^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2})$/,
                parser: function(a) {
                    return Date.UTC(+a[1], a[2] - 1, +a[3], +a[4])
                }
            };
            Highcharts.Data.prototype.dateFormats["Y-m-d"] = {
                regex: /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/,
                parser: Highcharts.Data.prototype.dateFormats["YYYY-mm-dd"].parser
            };
            Highcharts.wrap(Ext.Date, "format", function(b, e, c) {
                return a[c] ? Highcharts.dateFormat(a[c], e) : b.apply(this, [].slice.call(arguments, 1))
            });
            Highcharts.wrap(Ext.Date, "parse", function(b, e, c) {
                var d, f;
                a[c] ? (d = Highcharts.Data.prototype.dateFormats[c],
                    f = e.match(d.regex), d = d.parser(f), d = new Date(d)) : d = b.apply(this, [].slice.call(arguments, 1));
                return d
            });
            Ext.Date.clearTime = function(a, e) {
                if (e) return Ext.Date.clearTime(Ext.Date.clone(a));
                var c = a.getUTCDate(),
                    d, f;
                a.setUTCHours(0);
                a.setUTCMinutes(0);
                a.setUTCSeconds(0);
                a.setUTCMilliseconds(0);
                if (a.getUTCDate() !== c) {
                    d = 1;
                    for (f = Ext.Date.add(a, Ext.Date.HOUR, d); f.getUTCDate() !== c;) d += 1, f = Ext.Date.add(a, Ext.Date.HOUR, d);
                    a.setUTCDate(c);
                    a.setUTCHours(f.getUTCHours())
                }
                return a
            }
        },
        getExtPanel: function() {
            return this.gridPanel
        },
        addReadyListener: function(a) {
            this.dataReadyCallback = a
        },
        addChangedListener: function(a) {
            this.dataChangedCallback = a
        },
        applySettings: function(a) {
            if ((this.currentSettings = a) && a.csv && this.gridPanel) try {
                this.propagateUpdate = !1, this.importFromCsv(a.csv, a.columnTypes, a.columnFormats)
            } finally {
                this.propagateUpdate = !0
            }
        },
        getSettings: function() {
            var a = this.state.modelTemplate.getFields(),
                b, e = [],
                c = [],
                d;
            for (b = 1; b < a.length; b += 1) d = a[b].name, e.push(this.state.fieldToTypeMap[d]), c.push(this.state.fieldToFormatMap[d]);
            this.currentSettings.columnTypes = e;
            this.currentSettings.columnFormats = c;
            return this.currentSettings
        },
        startGetData: function(a, b) {
            var e = this;
            this.currentSettings && (this.currentSettings.seriesMapping = b);
            this.parseData(function(a, b) {
                e.dataReadyCallback(a, b)
            }, a)
        },
        parseData: function(a, b) {
            function e(a) {
                var b;
                for (b = 0; b < a.length; b += 1) c[b] = a[b][0]
            }
            var c = [],
                d = this.getSettings();
            try {
                Highcharts.data({
                        csv: d.csv,
                        seriesMapping: d.seriesMapping,
                        parsed: e,
                        sort: !0,
                        columnTypes: d.columnTypes,
                        complete: function(b) {
                            a(b, c)
                        }
                    },
                    b)
            } catch (f) {
                console.log(f), a(void 0)
            }
        },
        getUseCategories: function() {
            var a = void 0 !== window.Ext ? Ext.getCmp("editorImportView.useCategories") : null;
            return a ? a.getValue() : !1
        },
        setUseCategories: function(a) {
            var b = void 0 !== window.Ext ? Ext.getCmp("editorImportView.useCategories") : null;
            b && b.setValue(a)
        },
        getSwitchRowsAndColumns: function() {
            var a = void 0 !== window.Ext ? Ext.getCmp("editorImportView.switchRowsAndColumns") : null;
            return a ? a.getValue() : !1
        },
        setSwitchRowsAndColumns: function(a) {
            var b = void 0 !== window.Ext ? Ext.getCmp("editorImportView.switchRowsAndColumns") :
                null;
            b && b.setValue(a)
        },
        getItemDelimiter: function() {
            var a = void 0 !== window.Ext ? Ext.getCmp("editorImportView.itemDelimiter") : null;
            return a ? a.getValue() : !1
        },
        setItemDelimiter: function(a) {
            var b = void 0 !== window.Ext ? Ext.getCmp("editorImportView.itemDelimiter") : null;
            b && b.setValue(a)
        },
        importFromCsv: function(a, b, e, c) {
            var d = arguments,
                f = this,
                h = !b,
                j = f.getUseCategories(),
                g = f.getItemDelimiter(),
                i = /([^a-zA-Z0-9\-_])([0-9]{1,2})[\/\-\.]([0-9]{1,2})[\/\-\.]([0-9]{2,4})([^a-zA-Z0-9\-_])/g,
                m, k, o, p, q = function(a) {
                    var b =
                        (new Date).getFullYear() - 2E3;
                    return a <= b + 20 ? "20" + a : 100 > a ? "19" + a : a
                },
                n = function(a, b) {
                    return a.replace(i, function(a, d, c, e, f, h) {
                        return "dmy" === b ? d + q(f) + "-" + e + "-" + c + h : d + q(f) + "-" + c + "-" + e + h
                    })
                };
            if (h && !j && a.match(i)) {
                for (;
                    (o = i.exec(a)) && !k;) 12 < parseInt(o[2], 10) ? k = "dmy" : 12 < parseInt(o[3], 10) && (k = "mdy");
                if (k) a = n(a, k);
                else {
                    Ext.Msg.show({
                        title: "Ambiguous date format",
                        msg: "We found that some of your data contains dates or times that can be interpreted in multiple ways. What format best describes your dates or times?",
                        buttonText: {
                            ok: "mm/dd/YYYY",
                            cancel: "dd/mm/YYYY"
                        },
                        fn: function(d) {
                            a = "ok" === d ? n(a, "mdy") : n(a, "dmy");
                            Ext.MessageBox.hide();
                            f.importFromCsv(a, b, e, c)
                        }
                    });
                    return
                }
            }
            if (h && !f.chosenItemDelimiter && -1 !== a.indexOf(";")) Ext.Msg.show({
                title: "Values separated by semicolons?",
                msg: "<p>We found semicolons in your data. Are they your value separators?</p><p>(If you regret your choice you can change the <em>Item separator</em> later.)</p>",
                buttonText: {
                    ok: "Yes",
                    cancel: "No"
                },
                fn: function(d) {
                    "ok" === d && f.setItemDelimiter(";");
                    f.chosenItemDelimiter = !0;
                    Ext.MessageBox.hide();
                    Ext.getCmp("editorImportView.itemDelimiter").show();
                    f.importFromCsv(a, b, e, c)
                }
            });
            else {
                h && j && (b = ["string"]);
                m = /^[A-Za-z]+[\- ]+([0-9]{1,2})$/;
                try {
                    Highcharts.data({
                        csv: a,
                        columnTypes: b,
                        itemDelimiter: g,
                        switchRowsAndColumns: f.getSwitchRowsAndColumns(),
                        parsed: function(a) {
                            var c = this;
                            b = [];
                            e = [];
                            h && a.length > a[0].length && !f.getSwitchRowsAndColumns() && !f.hasWarnedAboutRotatedData && (Ext.Msg.show({
                                title: "Horizontal data detected",
                                msg: '<p>We believe Highcharts best displays your data if rows and columns are switched. Highcharts will use the first column as category/x data, and subsequent columns as data series.</p><p>If it doesn\'t give the result you want, you can revert it later by unchecking the "Switch rows and columns" box below the CSV data import box</b>',
                                buttonText: {
                                    ok: "Swith rows and columns",
                                    cancel: "Cancel"
                                },
                                fn: function(a) {
                                    "ok" === a && (f.setSwitchRowsAndColumns(!0), f.importFromCsv.apply(f, d));
                                    Ext.MessageBox.hide()
                                }
                            }), f.hasWarnedAboutRotatedData = !0);
                            $.each(a, function(g, l) {
                                var i, k, n, o, r;
                                if (h && !j) {
                                    for (i = l.length - 1; i > 0; i = i - 1)
                                        if (c.rawColumns[g][i])
                                            if (n = c.rawColumns[g][i].match(m))
                                                if (k) l[i] = c.rawColumns[g][i].replace(n[1], q(n[1]));
                                                else {
                                                    if (n[1] === o) {
                                                        k = true;
                                                        i = a[g].length
                                                    }
                                                    o = n[1];
                                                    delete l.isDatetime;
                                                    delete l.unsorted
                                                }
                                    if (k) {
                                        c.parseColumn(l, g);
                                        l = c.columns[g]
                                    }
                                }
                                if (h &&
                                    !j && l.isDatetime && l.unsorted) {
                                    editor.showToast("Unsorted dates", "Your data appears to be time based but is not sorted, so we used categories on the X axis. To make use of Highcharts' scalable date-time axis, make sure your data is sorted.");
                                    f.setUseCategories(true);
                                    f.importFromCsv.apply(f, d);
                                    p = true;
                                    l = a[g] = c.rawColumns[g]
                                } else if (f.commasInColumns && g > 0) {
                                    r = /([0-9]+),([0-9])/;
                                    $.each(l, function(a, b) {
                                        if (typeof b === "string") {
                                            b = b.replace(/\s/, "");
                                            r.test(b) && (l[a] = parseFloat(b.replace(r, f.commasInColumns ===
                                                "decimals" ? "$1.$2" : "$1$2")))
                                        }
                                    });
                                    l.mixed = false
                                } else if (/_[0-9 ]+,[0-9 ]+_/.test(l.join("_")) && g > 0) {
                                    Ext.Msg.show({
                                        title: "Commas in number columns",
                                        msg: "We found commas in what appears to be numeric columns. What are those?",
                                        buttonText: {
                                            ok: "Thousands separators",
                                            cancel: "Decimal points"
                                        },
                                        fn: function(a) {
                                            f.commasInColumns = a === "ok" ? "thousands" : "decimals";
                                            Ext.MessageBox.hide();
                                            f.importFromCsv.apply(f, d)
                                        }
                                    });
                                    p = true
                                }
                                if (l.isDatetime) {
                                    i = l.length;
                                    for (i = l.length - 1; i > 0; i = i - 1)
                                        if (typeof l[i] === "number" && l[i] % 864E5 !==
                                            0) {
                                            l.isTime = true;
                                            break
                                        }
                                }
                                if (l.isTime) {
                                    b[g] = f.FieldTypes.DATETIME;
                                    e[g] = f.DATETIMEFORMAT
                                } else if (l.isDatetime) {
                                    b[g] = f.FieldTypes.DATE;
                                    e[g] = f.DATEFORMAT
                                } else b[g] = l.isNumeric ? f.FieldTypes.NUMBER : f.FieldTypes.STRING
                            });
                            p || f.importFromColumns(a, b, e)
                        }
                    })
                } catch (s) {
                    console.log(s), f.importFromColumns(void 0)
                }
                c && !p && c()
            }
        },
        importFromColumns: function(a, b, e) {
            var c, d, f = [],
                h, j;
            this.clear();
            if (a) {
                for (c = 0; c < a.length; c += 1) j = h = void 0, b && b[c] && (h = b[c]), e && e[c] && (j = e[c]), void 0 === h && a[c].isDatetime && (h = this.FieldTypes.DATETIME,
                    j = this.DATETIMEFORMAT), void 0 === h && a[c].isNumeric && (h = this.FieldTypes.NUMBER), d = this.addColumn(h), f.push(d), this.state.fieldToNameMap[d] = a[c][0], h && (this.state.fieldToTypeMap[d] = h), j && (this.state.fieldToFormatMap[d] = j);
                b = a[0].length;
                this.state.store.suspendEvents();
                for (e = 1; e < b; e += 1) {
                    d = [];
                    for (c = 0; c < a.length; c += 1) {
                        h = a[c][e];
                        if (this.state.fieldToTypeMap[f[c]] === this.FieldTypes.DATE || this.state.fieldToTypeMap[f[c]] === this.FieldTypes.DATETIME) h = new Date(h);
                        d.push(h)
                    }
                    this.addRow(d)
                }
                this.state.store.resumeEvents();
                this.refreshUI()
            }
        },
        clear: function() {
            this.initStore();
            this.state.nextModelIndex = 0;
            this.state.fieldToNameMap = {};
            this.state.fieldToTypeMap = {};
            this.state.fieldToFormatMap = {}
        },
        addColumn: function(a) {
            var b = this.state.modelTemplate.getFields(),
                e = "c" + this.state.nextModelIndex,
                c = 0 === this.state.nextModelIndex;
            b.push({
                name: e,
                type: void 0 !== a ? a : c ? this.FieldTypes.STRING : this.FieldTypes.NUMBER,
                useNull: !c
            });
            this.state.nextModelIndex += 1;
            this.state.modelTemplate.setFields(b);
            this.fillNewColumnWithDefaultValue(e, null);
            return e
        },
        addColumnBefore: function(a) {
            var b = this.state.modelTemplate.getFields(),
                e = "c" + this.state.nextModelIndex;
            b.splice(a + 1, 0, e);
            this.state.nextModelIndex += 1;
            this.state.modelTemplate.setFields(b);
            this.fillNewColumnWithDefaultValue(e, null);
            return e
        },
        addColumnAfter: function(a) {
            var b = this.state.modelTemplate.getFields(),
                e = "c" + this.state.nextModelIndex;
            b.splice(a + 1 + 1, 0, e);
            this.state.nextModelIndex += 1;
            this.state.modelTemplate.setFields(b);
            this.fillNewColumnWithDefaultValue(e, null);
            return e
        },
        moveColumn: function(a,
            b) {
            var e = this.state.modelTemplate.getFields(),
                c, b = b + 1;
            c = e.splice(a + 1, 1)[0];
            e.splice(b, 0, c);
            this.state.modelTemplate.setFields(e)
        },
        removeColumn: function(a) {
            var b = this.state.modelTemplate.getFields(),
                e = b[a + 1].name;
            b.splice(a + 1, 1);
            this.state.modelTemplate.setFields(b);
            delete this.state.fieldToNameMap[e];
            delete this.state.fieldToTypeMap[e];
            delete this.state.fieldToFormatMap[e]
        },
        getColumnType: function(a) {
            return this.state.fieldToTypeMap[this.state.modelTemplate.getFields()[a + 1].name]
        },
        changeColumnType: function(a,
            b, e) {
            var c = this.state.modelTemplate.getFields(),
                c = c[a + 1],
                d = c.name,
                f = {},
                h = this,
                j, g = this.state.fieldToNameMap[d];
            f.name = d;
            f.type = b;
            f.useNull = c.useNull;
            j = this.state.fieldToFormatMap[d];
            this.removeColumn(a);
            c = this.state.modelTemplate.getFields();
            c.splice(a + 1, 0, f);
            this.state.fieldToNameMap[d] = g;
            this.state.fieldToTypeMap[d] = b;
            this.state.fieldToFormatMap[d] = e;
            this.state.store.suspendEvents();
            this.state.store.each(function(a) {
                var c = a.get(d),
                    c = h.convertValue(c, b, j);
                a.set(d, c)
            });
            this.state.store.resumeEvents()
        },
        convertValue: function(a, b, e) {
            a instanceof Date ? a = b === this.FieldTypes.NUMBER ? a.getTime() : b === this.FieldTypes.STRING ? Ext.util.Format.date(a, e) : a : "number" === typeof a ? a = b === this.FieldTypes.DATE || b === this.FieldTypes.DATETIME ? new Date(a) : b === this.FieldTypes.STRING ? a.toString() : a : "string" === typeof a && (b === this.FieldTypes.DATE || b === this.FieldTypes.DATETIME ? a = new Date(Date.parse(a)) : b === this.FieldTypes.NUMBER && (a = parseFloat(a), isNaN(a) && (a = null)));
            return a
        },
        renameColumn: function(a, b) {
            this.state.fieldToNameMap[this.state.modelTemplate.getFields()[a +
                1].name] = b
        },
        getColumnName: function(a) {
            var b = this.state.modelTemplate.getFields()[a + 1].name;
            return void 0 !== this.state.fieldToNameMap[b] ? this.state.fieldToNameMap[b] : 0 === a ? "Category" : "Series " + a
        },
        addRow: function(a) {
            var b = {},
                e = this.state.modelTemplate.getFields().length,
                c;
            for (c = 0; c < e; c += 1) b["c" + c] = void 0 !== a[c] ? a[c] : null;
            this.state.store.add(b)
        },
        fillNewColumnWithDefaultValue: function(a, b) {
            this.state.store.suspendEvents();
            this.state.store.each(function(e) {
                e.set(a, b)
            });
            this.state.store.resumeEvents()
        },
        addEmptyRow: function() {
            this.addRow([])
        },
        removeRow: function(a) {
            this.state.store.removeAt(a)
        },
        addEmptySet: function() {
            var a;
            for (a = 0; 4 > a; a += 1) this.addColumn();
            for (a = 0; 20 > a; a += 1) this.addEmptyRow()
        },
        getUIColumns: function() {
            var a = this.state.modelTemplate.getFields(),
                b, e = [],
                c, d, f;
            for (c = 1; c < a.length; c += 1) b = a[c], d = this.getColumnName(c - 1), d = {
                text: d,
                dataIndex: b.name,
                editor: "textfield",
                sortable: !1,
                draggable: !0
            }, f = this.state.fieldToTypeMap[b.name], f === this.FieldTypes.DATE || f === this.FieldTypes.DATETIME ? (d.editor = {
                xtype: "datefield",
                format: this.state.fieldToFormatMap[b.name]
            }, d.format = this.state.fieldToFormatMap[b.name], d.tdCls = "datetime", b = new Ext.grid.column.Date(d)) : f === this.FieldTypes.NUMBER ? (d.editor = {
                xtype: "numberfield",
                decimalPrecision: 15
            }, d.format = this.state.fieldToFormatMap[b.name], d.tdCls = "number", d.align = "right", d.hideTrigger = !0, d.keyNavEnabled = !1, d.mouseWheelEnabled = !1, b = new Ext.grid.column.Number(d)) : b = new Ext.grid.column.Column(d), e.push(b);
            return e
        },
        exportToCsv: function(a) {
            var b = this.state.modelTemplate.getFields(),
                e = [],
                c, d, f, h = "";
            c = this.state.store.getRange();
            var j = c.length,
                g, i, m, k;
            if (j) {
                m = g = j - 1;
                for (k = !0; 0 <= g && k;) {
                    m = g;
                    for (d = 1; d < b.length && k; d += 1) k = c[g].get(b[d].name), k = null === k || "" === k || void 0 === k;
                    g -= 1
                }
            } else m = 0;
            if (j) {
                i = b.length - 1;
                j = !0;
                for (d = b.length - 1; 0 < d && j; d -= 1) {
                    g = c.length - 1;
                    for (i = d; 0 <= g && j;) k = c[g].get(b[d].name), j = null === k || "" === k || void 0 === k, g -= 1
                }
            } else i = 0;
            for (d = 1; d < b.length; d += 1) d <= i && (c = this.getColumnName(d - 1), e.push("string" === typeof c ? c.replace(",", "") : c));
            e = e.join(",");
            f = 0;
            this.state.store.each(function(c) {
                if (!(f >
                        m)) {
                    var e = [],
                        g, j;
                    for (d = 1; d < b.length; d += 1) d <= i && (g = c.get(b[d].name), g instanceof Date && (g = g.getTime()), a && (j = a[d - 1]), e.push(j ? j(g) : g));
                    h = h + "\n" + e.join(",");
                    f += 1
                }
            });
            if (0 < f || 1 < b.length) h = e + h;
            return h
        },
        exportToFormattedCsv: function() {
            function a(a, b) {
                return a === f.FieldTypes.DATE || a === f.FieldTypes.DATETIME ? function(a) {
                    return Ext.util.Format.date(new Date(a), b)
                } : a === f.FieldTypes.NUMBER ? Ext.util.Format.numberRenderer(b) : function(a) {
                    return a
                }
            }
            var b = [],
                e, c, d, f = this,
                h = this.state.modelTemplate.getFields();
            for (e =
                1; e < h.length; e += 1) d = h[e].name, c = this.state.fieldToTypeMap[d], d = this.state.fieldToFormatMap[d], b.push(a(c, d));
            return this.exportToCsv(b)
        },
        refreshUI: function() {
            this.getExtPanel().reconfigure(this.state.store, this.getUIColumns())
        },
        updateChart: function() {
            void 0 === this.currentSettings && (this.currentSettings = {});
            this.currentSettings.csv = this.exportToCsv();
            this.propagateUpdate && this.dataChangedCallback && (this.dataChangedCallback(), this.state.store.commitChanges())
        }
    };
    Editor.registerDataProvider(new GridDataProvider);
}(Editor));
(function(Editor) {
    /*
     Highcharts Editor v0.1 (2012-10-29)

     (c) 2009-2011 Highsoft Solutions AS

     License: www.highcharts.com/license
    */
    'use strict';

    function CsvDataProvider() {
        this.dataReadyCallback = void 0;
        this.propagateUpdate = !0
    }
    CsvDataProvider.prototype = {
        getTitle: function() {
            return "CSV data"
        },
        getName: function() {
            return "highcharts.dataprovider.csv"
        },
        init: function() {
            var a = this;
            void 0 !== window.Ext && (this.textArea = new Ext.form.field.TextArea({
                id: "textdata",
                region: "center",
                flex: 1,
                emptyText: "<insert csv data here>"
            }), this.changeHandler = function() {
                void 0 === a.currentSettings && (a.currentSettings = {});
                a.currentSettings.csv = a.textArea.getValue();
                a.propagateUpdate && a.dataChangedCallback && a.dataChangedCallback()
            }, this.textArea.addListener("change",
                this.changeHandler))
        },
        getExtPanel: function() {
            return this.textArea
        },
        addReadyListener: function(a) {
            this.dataReadyCallback = a
        },
        addChangedListener: function(a) {
            this.dataChangedCallback = a
        },
        applySettings: function(a) {
            if ((this.currentSettings = a) && a.csv && this.textArea) try {
                this.propagateUpdate = !1, this.textArea.setValue(a.csv)
            } finally {
                this.propagateUpdate = !0
            }
        },
        getSettings: function() {
            return this.currentSettings
        },
        startGetData: function(a, b) {
            var d = this;
            this.currentSettings && (this.currentSettings.seriesMapping = b);
            this.parseData(function(a,
                b) {
                d.dataReadyCallback(a, b)
            }, a)
        },
        parseData: function(a, b) {
            function d(a) {
                var c;
                for (c = 0; c < a.length; c += 1) e[c] = a[c][0]
            }
            var e = [];
            try {
                Highcharts.data({
                    csv: this.currentSettings.csv,
                    seriesMapping: this.currentSettings.seriesMapping,
                    parsed: d,
                    complete: function(b) {
                        a(b, e)
                    }
                }, b)
            } catch (f) {
                console.log(f), a(void 0)
            }
        }
    };
    Editor.registerDataProvider(new CsvDataProvider);
}(Editor));
(function(Editor) {
    /*
     Highcharts Editor v0.1 (2012-10-29)

     (c) 2009-2011 Highsoft Solutions AS

     License: www.highcharts.com/license
    */
    'use strict';

    function GoogleSpreadsheetDataProvider() {
        this.dataReadyCallback = void 0;
        this.propagateUpdate = !0;
        this.serverConfiguration = {
            spreadsheetHost: "https://spreadsheets.google.com"
        }
    }
    GoogleSpreadsheetDataProvider.prototype = {
        getTitle: function() {
            return "Google Spreadsheet"
        },
        getName: function() {
            return "highcharts.dataprovider.googlespreadsheet"
        },
        init: function() {
            var a = this,
                d;
            void 0 !== window.Ext && (this.keyField = new Ext.form.TextField({
                labelWidth: 200,
                flex: 1,
                fieldLabel: 'Spreadsheet key or URL<br>(<a href="javascript:editor.activeDataProvider.help()">Learn more</a>)',
                name: "googleSpreadsheetKey"
            }), this.valid = new Ext.panel.Panel({
                width: 30,
                padding: 8
            }), this.refreshButton = new Ext.button.Button({
                text: "Update fields",
                margin: "0 13 20 10",
                width: 120,
                handler: function() {
                    a.refreshFields()
                }
            }), this.sheetStore = Ext.create("Ext.data.Store", {
                fields: ["value", "title"],
                data: []
            }), this.sheetField = new Ext.form.ComboBox({
                store: this.sheetStore,
                queryMode: "local",
                displayField: "title",
                valueField: "value",
                fieldLabel: "Sheet",
                labelWidth: 180,
                flex: 1,
                name: "googleSpreadsheetWorksheet"
            }), this.startRowField = new Ext.form.NumberField({
                fieldLabel: "Start row",
                name: "startRow",
                minValue: 0,
                labelWidth: 180,
                flex: 1
            }), this.endRowField = new Ext.form.NumberField({
                fieldLabel: "End row",
                name: "endRow",
                minValue: 0,
                labelWidth: 180,
                flex: 1
            }), this.startColumnField = new Ext.form.NumberField({
                fieldLabel: "Start column",
                name: "startColumn",
                minValue: 0,
                labelWidth: 180,
                flex: 1
            }), this.endColumnField = new Ext.form.NumberField({
                fieldLabel: "End column",
                name: "endColumn",
                minValue: 0,
                labelWidth: 180,
                flex: 1
            }), d = new Ext.container.Container({
                layout: {
                    type: "hbox"
                },
                flex: 1,
                margin: "20 0 0 0",
                items: [this.keyField, this.valid, this.refreshButton]
            }), this.invalid = new Ext.panel.Panel({
                padding: "5 0 15 0"
            }), this.fieldSet = new Ext.form.FieldSet({
                columnWidth: 0.5,
                border: !1,
                defaults: {
                    anchor: "100%"
                },
                layout: "anchor",
                items: [this.desc, d, this.invalid, this.sheetField, this.startRowField, this.endRowField, this.startColumnField, this.endColumnField]
            }), this.changeHandler = function() {
                function b(c, b) {
                    if (a[c]) {
                        var d = a[c].getValue(),
                            e = /^https:\/\/docs\.google\.com\/(?:[a-z]\/[a-zA-Z\.]+\/)?spreadsheet(?:s\/d\/|\/pub\?key=)([a-zA-Z0-9_\-]+[^\/&])/;
                        if (void 0 !== d && "" !== d) {
                            if ("keyField" === c && (e = d.match(e))) d = e[1], a.keyField.setValue(d);
                            a.currentSettings[b] = d
                        }
                    }
                }
                a.propagateUpdate &&
                    (void 0 === a.currentSettings && (a.currentSettings = {}), b("keyField", "googleSpreadsheetKey"), b("sheetField", "googleSpreadsheetWorksheet"), b("startColumnField", "startColumn"), b("endColumnField", "endColumn"), b("startRowField", "startRow"), b("endRowField", "endRow"), a.dataChangedCallback && a.dataChangedCallback())
            }, this.keyField.addListener("change", this.changeHandler), this.sheetField.addListener("change", this.changeHandler), this.startRowField.addListener("change", this.changeHandler), this.endRowField.addListener("change",
                this.changeHandler), this.startColumnField.addListener("change", this.changeHandler), this.endColumnField.addListener("change", this.changeHandler))
        },
        help: function() {
            var a;
            a = new Ext.Window({
                title: "Set up Google Spreadsheet",
                maxWidth: 500,
                layout: "fit",
                autoScroll: !0,
                plain: !0,
                modal: !0,
                border: 0,
                padding: 10,
                items: [{
                    xtype: "panel",
                    autoScroll: !0,
                    cls: "help",
                    html: '<ol><li>In your spreadsheet, go to <em>File</em> -> <em>Publish on the web</em>.</li><li>In the dialog, confirm publishing.</li><li>In the same dialog, copy the <em>Document link</em>.</li><li>In the Highcharts Cloud Editor, paste the link in the <em>Spreadsheet key or URL</em> input field. Your chart should now display.</li><li>Optionally, select the <em>Sheet</em> and select start and end rows and columns.</li></ol><h4>Example</h4><p>We set up a published spreadsheet, with the document link <a target="_blank" href="https://docs.google.com/spreadsheets/d/1ugDDxKV66C1xXy1SVCD-rqgY4jfJOXnN4FG8AV4d2vI/pubhtml">https://docs.google.com/spreadsheets/d/1ugDDxKV66C1xXy1SVCD-rqgY4jfJOXnN4FG8AV4d2vI/pubhtml</a>. From this sheet we created a <a target="_blank" href="http:http://cloud.highcharts.com/charts/ofokyj">chart with default settings</a>.</p><br><br><a target="_blank" href="https://docs.google.com/spreadsheets/d/1ugDDxKV66C1xXy1SVCD-rqgY4jfJOXnN4FG8AV4d2vI/pubhtml"><img src="' +
                        editor.serverConfiguration.resourcesPath + '/images/google-spreadsheet.png" style="width:486px;height:257px" /></a>'
                }],
                buttons: [{
                    text: "OK",
                    handler: function() {
                        a.close()
                    }
                }]
            });
            a.show()
        },
        getExtPanel: function() {
            return this.fieldSet
        },
        addReadyListener: function(a) {
            this.dataReadyCallback = a
        },
        addChangedListener: function(a) {
            this.dataChangedCallback = a
        },
        applySettings: function(a) {
            this.currentSettings = a;
            if (this.keyField) try {
                this.propagateUpdate = !1, this.keyField.setValue(a.googleSpreadsheetKey), this.sheetField.setValue(a.googleSpreadsheetWorksheet),
                    this.startRowField.setValue(a.startRow), this.endRowField.setValue(a.endRow), this.startColumnField.setValue(a.startColumn), this.endColumnField.setValue(a.endColumn)
            } finally {
                this.propagateUpdate = !0
            }
        },
        getSettings: function() {
            return this.currentSettings
        },
        startGetData: function(a, d) {
            var b = this;
            this.currentSettings && (this.currentSettings.seriesMapping = d);
            "" !== this.keyField.getValue() && this.retrieveData(function(a, d) {
                b.dataReadyCallback(a, d)
            }, a)
        },
        retrieveData: function(a, d) {
            function b(a) {
                var c;
                for (c = 0; c < a.length; c +=
                    1) f[c] = a[c][0]
            }
            var c = this,
                f = [];
            clearTimeout(c.timer);
            c.timer = setTimeout(function() {
                c.onError();
                a(void 0)
            }, 2E3);
            this.showLoading();
            try {
                Highcharts.data({
                    seriesMapping: this.currentSettings.seriesMapping,
                    parsed: b,
                    complete: function(b) {
                        clearTimeout(c.timer);
                        c.onSuccess();
                        a(b, f);
                        if (!editor.views.output.chart) c.onError("We found the spreadsheet, but were unable to parse it. If your data grid is not positioned in the top left corner, try setting <em>start row</em> and <em>start column</em> below.")
                    },
                    googleSpreadsheetKey: this.currentSettings.googleSpreadsheetKey,
                    googleSpreadsheetWorksheet: this.currentSettings.googleSpreadsheetWorksheet,
                    startColumn: this.currentSettings.startColumn,
                    endColumn: this.currentSettings.endColumn,
                    startRow: this.currentSettings.startRow,
                    endRow: this.currentSettings.endRow
                }, d)
            } catch (g) {
                a(void 0)
            }
        },
        refreshFields: function() {
            var a = this,
                d = a.currentSettings.googleSpreadsheetKey,
                b;
            a.refreshButton.setDisabled(!0);
            a.getWorksheets(d, function(c) {
                a.sheetStore.removeAll();
                for (b = 0; b < c.getWorksheetCount(); b += 1) a.sheetStore.add({
                    value: c.getWorksheetId(b),
                    title: c.getWorksheetTitle(b) + " (" + c.getWorksheetId(b) + ")"
                });
                a.refreshButton.setDisabled(!1)
            }, function(c) {
                a.refreshButton.setDisabled(!1);
                a.onError(c.responseText)
            })
        },
        showLoading: function() {
            this.valid.update('<i class="icon-spinner icon-spin" style="font-size: 16px"></i>');
            this.valid.setBodyStyle({
                color: "black"
            });
            this.invalid.update("")
        },
        onSuccess: function() {
            this.valid.update('<i class="icon-smile" style="font-size: 16px"></i>');
            this.valid.setBodyStyle({
                color: "green"
            });
            this.invalid.update("")
        },
        onError: function(a) {
            clearTimeout(this.timer);
            a ? (this.invalid.update('<i class="icon-frown" style="font-size: 16px"></i> <span title="' + this.url + '">' + a + "</span>"), this.invalid.setBodyStyle({
                color: "red"
            }), this.valid.update("")) : (this.valid.update('<i class="icon-frown" style="font-size: 16px"></i>'), this.valid.setBodyStyle({
                color: "red"
            }), this.invalid.update(""))
        },
        getWorksheets: function(a, d, b) {
            this.url = this.serverConfiguration.spreadsheetHost + "/feeds/worksheets/" + a + "/public/values?alt=json";
            $.ajax({
                type: "GET",
                url: this.url,
                dataType: "json",
                success: function(a) {
                    d({
                        getWorksheetCount: function() {
                            return a.feed.entry.length
                        },
                        getWorksheetTitle: function(b) {
                            return a.feed.entry[b].title.$t
                        },
                        getWorksheetId: function(b) {
                            b = a.feed.entry[b].id.$t;
                            return b.substring(b.lastIndexOf("/") + 1)
                        },
                        getRowCount: function(b) {
                            return parseInt(a.feed.entry[b].gs$rowCount.$t, 10)
                        },
                        getColumnCount: function(b) {
                            return parseInt(a.feed.entry[b].gs$colCount.$t, 10)
                        }
                    })
                },
                error: function(a) {
                    b(a)
                }
            })
        }
    };
    Editor.registerDataProvider(new GoogleSpreadsheetDataProvider);
}(Editor));
// CodeMirror version 3.1
//
// CodeMirror is the only global var we claim
window.CodeMirror = (function() {
    "use strict";

    // BROWSER SNIFFING

    // Crude, but necessary to handle a number of hard-to-feature-detect
    // bugs and behavior differences.
    var gecko = /gecko\/\d/i.test(navigator.userAgent);
    var ie = /MSIE \d/.test(navigator.userAgent);
    var ie_lt8 = ie && (document.documentMode == null || document.documentMode < 8);
    var ie_lt9 = ie && (document.documentMode == null || document.documentMode < 9);
    var webkit = /WebKit\//.test(navigator.userAgent);
    var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(navigator.userAgent);
    var chrome = /Chrome\//.test(navigator.userAgent);
    var opera = /Opera\//.test(navigator.userAgent);
    var safari = /Apple Computer/.test(navigator.vendor);
    var khtml = /KHTML\//.test(navigator.userAgent);
    var mac_geLion = /Mac OS X 1\d\D([7-9]|\d\d)\D/.test(navigator.userAgent);
    var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(navigator.userAgent);
    var phantom = /PhantomJS/.test(navigator.userAgent);

    var ios = /AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent);
    // This is woefully incomplete. Suggestions for alternative methods welcome.
    var mobile = ios || /Android|webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(navigator.userAgent);
    var mac = ios || /Mac/.test(navigator.platform);
    var windows = /windows/i.test(navigator.platform);

    var opera_version = opera && navigator.userAgent.match(/Version\/(\d*\.\d*)/);
    if (opera_version) opera_version = Number(opera_version[1]);
    // Some browsers use the wrong event properties to signal cmd/ctrl on OS X
    var flipCtrlCmd = mac && (qtwebkit || opera && (opera_version == null || opera_version < 12.11));
    var captureMiddleClick = gecko || (ie && !ie_lt9);

    // Optimize some code when these features are not used
    var sawReadOnlySpans = false,
        sawCollapsedSpans = false;

    // CONSTRUCTOR

    function CodeMirror(place, options) {
        if (!(this instanceof CodeMirror)) return new CodeMirror(place, options);

        this.options = options = options || {};
        // Determine effective options based on given values and defaults.
        for (var opt in defaults)
            if (!options.hasOwnProperty(opt) && defaults.hasOwnProperty(opt))
                options[opt] = defaults[opt];
        setGuttersForLineNumbers(options);

        var docStart = typeof options.value == "string" ? 0 : options.value.first;
        var display = this.display = makeDisplay(place, docStart);
        display.wrapper.CodeMirror = this;
        updateGutters(this);
        if (options.autofocus && !mobile) focusInput(this);

        this.state = {
            keyMaps: [],
            overlays: [],
            modeGen: 0,
            overwrite: false,
            focused: false,
            suppressEdits: false,
            pasteIncoming: false,
            draggingText: false,
            highlight: new Delayed()
        };

        themeChanged(this);
        if (options.lineWrapping)
            this.display.wrapper.className += " CodeMirror-wrap";

        var doc = options.value;
        if (typeof doc == "string") doc = new Doc(options.value, options.mode);
        operation(this, attachDoc)(this, doc);

        // Override magic textarea content restore that IE sometimes does
        // on our hidden textarea on reload
        if (ie) setTimeout(bind(resetInput, this, true), 20);

        registerEventHandlers(this);
        // IE throws unspecified error in certain cases, when
        // trying to access activeElement before onload
        var hasFocus;
        try {
            hasFocus = (document.activeElement == display.input);
        } catch (e) {}
        if (hasFocus || (options.autofocus && !mobile)) setTimeout(bind(onFocus, this), 20);
        else onBlur(this);

        operation(this, function() {
            for (var opt in optionHandlers)
                if (optionHandlers.propertyIsEnumerable(opt))
                    optionHandlers[opt](this, options[opt], Init);
            for (var i = 0; i < initHooks.length; ++i) initHooks[i](this);
        })();
    }

    // DISPLAY CONSTRUCTOR

    function makeDisplay(place, docStart) {
        var d = {};
        var input = d.input = elt("textarea", null, null, "position: absolute; padding: 0; width: 1px; height: 1em; outline: none;");
        if (webkit) input.style.width = "1000px";
        else input.setAttribute("wrap", "off");
        input.setAttribute("autocorrect", "off");
        input.setAttribute("autocapitalize", "off");
        // Wraps and hides input textarea
        d.inputDiv = elt("div", [input], null, "overflow: hidden; position: relative; width: 3px; height: 0px;");
        // The actual fake scrollbars.
        d.scrollbarH = elt("div", [elt("div", null, null, "height: 1px")], "CodeMirror-hscrollbar");
        d.scrollbarV = elt("div", [elt("div", null, null, "width: 1px")], "CodeMirror-vscrollbar");
        d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler");
        // DIVs containing the selection and the actual code
        d.lineDiv = elt("div");
        d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1");
        // Blinky cursor, and element used to ensure cursor fits at the end of a line
        d.cursor = elt("div", "\u00a0", "CodeMirror-cursor");
        // Secondary cursor, shown when on a 'jump' in bi-directional text
        d.otherCursor = elt("div", "\u00a0", "CodeMirror-cursor CodeMirror-secondarycursor");
        // Used to measure text size
        d.measure = elt("div", null, "CodeMirror-measure");
        // Wraps everything that needs to exist inside the vertically-padded coordinate system
        d.lineSpace = elt("div", [d.measure, d.selectionDiv, d.lineDiv, d.cursor, d.otherCursor],
            null, "position: relative; outline: none");
        // Moved around its parent to cover visible view
        d.mover = elt("div", [elt("div", [d.lineSpace], "CodeMirror-lines")], null, "position: relative");
        // Set to the height of the text, causes scrolling
        d.sizer = elt("div", [d.mover], "CodeMirror-sizer");
        // D is needed because behavior of elts with overflow: auto and padding is inconsistent across browsers
        d.heightForcer = elt("div", "\u00a0", null, "position: absolute; height: " + scrollerCutOff + "px");
        // Will contain the gutters, if any
        d.gutters = elt("div", null, "CodeMirror-gutters");
        d.lineGutter = null;
        // Helper element to properly size the gutter backgrounds
        var scrollerInner = elt("div", [d.sizer, d.heightForcer, d.gutters], null, "position: relative; min-height: 100%");
        // Provides scrolling
        d.scroller = elt("div", [scrollerInner], "CodeMirror-scroll");
        d.scroller.setAttribute("tabIndex", "-1");
        // The element in which the editor lives.
        d.wrapper = elt("div", [d.inputDiv, d.scrollbarH, d.scrollbarV,
            d.scrollbarFiller, d.scroller
        ], "CodeMirror");
        // Work around IE7 z-index bug
        if (ie_lt8) {
            d.gutters.style.zIndex = -1;
            d.scroller.style.paddingRight = 0;
        }
        if (place.appendChild) place.appendChild(d.wrapper);
        else place(d.wrapper);

        // Needed to hide big blue blinking cursor on Mobile Safari
        if (ios) input.style.width = "0px";
        if (!webkit) d.scroller.draggable = true;
        // Needed to handle Tab key in KHTML
        if (khtml) {
            d.inputDiv.style.height = "1px";
            d.inputDiv.style.position = "absolute";
        }
        // Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).
        else if (ie_lt8) d.scrollbarH.style.minWidth = d.scrollbarV.style.minWidth = "18px";

        // Current visible range (may be bigger than the view window).
        d.viewOffset = d.lastSizeC = 0;
        d.showingFrom = d.showingTo = docStart;

        // Used to only resize the line number gutter when necessary (when
        // the amount of lines crosses a boundary that makes its width change)
        d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null;
        // See readInput and resetInput
        d.prevInput = "";
        // Set to true when a non-horizontal-scrolling widget is added. As
        // an optimization, widget aligning is skipped when d is false.
        d.alignWidgets = false;
        // Flag that indicates whether we currently expect input to appear
        // (after some event like 'keypress' or 'input') and are polling
        // intensively.
        d.pollingFast = false;
        // Self-resetting timeout for the poller
        d.poll = new Delayed();
        // True when a drag from the editor is active
        d.draggingText = false;

        d.cachedCharWidth = d.cachedTextHeight = null;
        d.measureLineCache = [];
        d.measureLineCachePos = 0;

        // Tracks when resetInput has punted to just putting a short
        // string instead of the (large) selection.
        d.inaccurateSelection = false;

        // Tracks the maximum line length so that the horizontal scrollbar
        // can be kept static when scrolling.
        d.maxLine = null;
        d.maxLineLength = 0;
        d.maxLineChanged = false;

        // Used for measuring wheel scrolling granularity
        d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null;

        return d;
    }

    // STATE UPDATES

    // Used to get the editor into a consistent state again when options change.

    function loadMode(cm) {
        cm.doc.mode = CodeMirror.getMode(cm.options, cm.doc.modeOption);
        cm.doc.iter(function(line) {
            if (line.stateAfter) line.stateAfter = null;
            if (line.styles) line.styles = null;
        });
        cm.doc.frontier = cm.doc.first;
        startWorker(cm, 100);
        cm.state.modeGen++;
        if (cm.curOp) regChange(cm);
    }

    function wrappingChanged(cm) {
        if (cm.options.lineWrapping) {
            cm.display.wrapper.className += " CodeMirror-wrap";
            cm.display.sizer.style.minWidth = "";
        } else {
            cm.display.wrapper.className = cm.display.wrapper.className.replace(" CodeMirror-wrap", "");
            computeMaxLength(cm);
        }
        estimateLineHeights(cm);
        regChange(cm);
        clearCaches(cm);
        setTimeout(function() {
            updateScrollbars(cm.display, cm.doc.height);
        }, 100);
    }

    function estimateHeight(cm) {
        var th = textHeight(cm.display),
            wrapping = cm.options.lineWrapping;
        var perLine = wrapping && Math.max(5, cm.display.scroller.clientWidth / charWidth(cm.display) - 3);
        return function(line) {
            if (lineIsHidden(cm.doc, line))
                return 0;
            else if (wrapping)
                return (Math.ceil(line.text.length / perLine) || 1) * th;
            else
                return th;
        };
    }

    function estimateLineHeights(cm) {
        var doc = cm.doc,
            est = estimateHeight(cm);
        doc.iter(function(line) {
            var estHeight = est(line);
            if (estHeight != line.height) updateLineHeight(line, estHeight);
        });
    }

    function keyMapChanged(cm) {
        var style = keyMap[cm.options.keyMap].style;
        cm.display.wrapper.className = cm.display.wrapper.className.replace(/\s*cm-keymap-\S+/g, "") +
            (style ? " cm-keymap-" + style : "");
    }

    function themeChanged(cm) {
        cm.display.wrapper.className = cm.display.wrapper.className.replace(/\s*cm-s-\S+/g, "") +
            cm.options.theme.replace(/(^|\s)\s*/g, " cm-s-");
        clearCaches(cm);
    }

    function guttersChanged(cm) {
        updateGutters(cm);
        regChange(cm);
    }

    function updateGutters(cm) {
        var gutters = cm.display.gutters,
            specs = cm.options.gutters;
        removeChildren(gutters);
        for (var i = 0; i < specs.length; ++i) {
            var gutterClass = specs[i];
            var gElt = gutters.appendChild(elt("div", null, "CodeMirror-gutter " + gutterClass));
            if (gutterClass == "CodeMirror-linenumbers") {
                cm.display.lineGutter = gElt;
                gElt.style.width = (cm.display.lineNumWidth || 1) + "px";
            }
        }
        gutters.style.display = i ? "" : "none";
    }

    function lineLength(doc, line) {
        if (line.height == 0) return 0;
        var len = line.text.length,
            merged, cur = line;
        while (merged = collapsedSpanAtStart(cur)) {
            var found = merged.find();
            cur = getLine(doc, found.from.line);
            len += found.from.ch - found.to.ch;
        }
        cur = line;
        while (merged = collapsedSpanAtEnd(cur)) {
            var found = merged.find();
            len -= cur.text.length - found.from.ch;
            cur = getLine(doc, found.to.line);
            len += cur.text.length - found.to.ch;
        }
        return len;
    }

    function computeMaxLength(cm) {
        var d = cm.display,
            doc = cm.doc;
        d.maxLine = getLine(doc, doc.first);
        d.maxLineLength = lineLength(doc, d.maxLine);
        d.maxLineChanged = true;
        doc.iter(function(line) {
            var len = lineLength(doc, line);
            if (len > d.maxLineLength) {
                d.maxLineLength = len;
                d.maxLine = line;
            }
        });
    }

    // Make sure the gutters options contains the element
    // "CodeMirror-linenumbers" when the lineNumbers option is true.
    function setGuttersForLineNumbers(options) {
        var found = false;
        for (var i = 0; i < options.gutters.length; ++i) {
            if (options.gutters[i] == "CodeMirror-linenumbers") {
                if (options.lineNumbers) found = true;
                else options.gutters.splice(i--, 1);
            }
        }
        if (!found && options.lineNumbers)
            options.gutters.push("CodeMirror-linenumbers");
    }

    // SCROLLBARS

    // Re-synchronize the fake scrollbars with the actual size of the
    // content. Optionally force a scrollTop.
    function updateScrollbars(d /* display */ , docHeight) {
        var totalHeight = docHeight + 2 * paddingTop(d);
        d.sizer.style.minHeight = d.heightForcer.style.top = totalHeight + "px";
        var scrollHeight = Math.max(totalHeight, d.scroller.scrollHeight);
        var needsH = d.scroller.scrollWidth > d.scroller.clientWidth;
        var needsV = scrollHeight > d.scroller.clientHeight;
        if (needsV) {
            d.scrollbarV.style.display = "block";
            d.scrollbarV.style.bottom = needsH ? scrollbarWidth(d.measure) + "px" : "0";
            d.scrollbarV.firstChild.style.height =
                (scrollHeight - d.scroller.clientHeight + d.scrollbarV.clientHeight) + "px";
        } else d.scrollbarV.style.display = "";
        if (needsH) {
            d.scrollbarH.style.display = "block";
            d.scrollbarH.style.right = needsV ? scrollbarWidth(d.measure) + "px" : "0";
            d.scrollbarH.firstChild.style.width =
                (d.scroller.scrollWidth - d.scroller.clientWidth + d.scrollbarH.clientWidth) + "px";
        } else d.scrollbarH.style.display = "";
        if (needsH && needsV) {
            d.scrollbarFiller.style.display = "block";
            d.scrollbarFiller.style.height = d.scrollbarFiller.style.width = scrollbarWidth(d.measure) + "px";
        } else d.scrollbarFiller.style.display = "";

        if (mac_geLion && scrollbarWidth(d.measure) === 0)
            d.scrollbarV.style.minWidth = d.scrollbarH.style.minHeight = mac_geMountainLion ? "18px" : "12px";
    }

    function visibleLines(display, doc, viewPort) {
        var top = display.scroller.scrollTop,
            height = display.wrapper.clientHeight;
        if (typeof viewPort == "number") top = viewPort;
        else if (viewPort) {
            top = viewPort.top;
            height = viewPort.bottom - viewPort.top;
        }
        top = Math.floor(top - paddingTop(display));
        var bottom = Math.ceil(top + height);
        return {
            from: lineAtHeight(doc, top),
            to: lineAtHeight(doc, bottom)
        };
    }

    // LINE NUMBERS

    function alignHorizontally(cm) {
        var display = cm.display;
        if (!display.alignWidgets && (!display.gutters.firstChild || !cm.options.fixedGutter)) return;
        var comp = compensateForHScroll(display) - display.scroller.scrollLeft + cm.doc.scrollLeft;
        var gutterW = display.gutters.offsetWidth,
            l = comp + "px";
        for (var n = display.lineDiv.firstChild; n; n = n.nextSibling)
            if (n.alignable) {
                for (var i = 0, a = n.alignable; i < a.length; ++i) a[i].style.left = l;
            }
        if (cm.options.fixedGutter)
            display.gutters.style.left = (comp + gutterW) + "px";
    }

    function maybeUpdateLineNumberWidth(cm) {
        if (!cm.options.lineNumbers) return false;
        var doc = cm.doc,
            last = lineNumberFor(cm.options, doc.first + doc.size - 1),
            display = cm.display;
        if (last.length != display.lineNumChars) {
            var test = display.measure.appendChild(elt("div", [elt("div", last)],
                "CodeMirror-linenumber CodeMirror-gutter-elt"));
            var innerW = test.firstChild.offsetWidth,
                padding = test.offsetWidth - innerW;
            display.lineGutter.style.width = "";
            display.lineNumInnerWidth = Math.max(innerW, display.lineGutter.offsetWidth - padding);
            display.lineNumWidth = display.lineNumInnerWidth + padding;
            display.lineNumChars = display.lineNumInnerWidth ? last.length : -1;
            display.lineGutter.style.width = display.lineNumWidth + "px";
            return true;
        }
        return false;
    }

    function lineNumberFor(options, i) {
        return String(options.lineNumberFormatter(i + options.firstLineNumber));
    }

    function compensateForHScroll(display) {
        return getRect(display.scroller).left - getRect(display.sizer).left;
    }

    // DISPLAY DRAWING

    function updateDisplay(cm, changes, viewPort) {
        var oldFrom = cm.display.showingFrom,
            oldTo = cm.display.showingTo;
        var updated = updateDisplayInner(cm, changes, viewPort);
        if (updated) {
            signalLater(cm, "update", cm);
            if (cm.display.showingFrom != oldFrom || cm.display.showingTo != oldTo)
                signalLater(cm, "viewportChange", cm, cm.display.showingFrom, cm.display.showingTo);
        }
        updateSelection(cm);
        updateScrollbars(cm.display, cm.doc.height);

        return updated;
    }

    // Uses a set of changes plus the current scroll position to
    // determine which DOM updates have to be made, and makes the
    // updates.
    function updateDisplayInner(cm, changes, viewPort) {
        var display = cm.display,
            doc = cm.doc;
        if (!display.wrapper.clientWidth) {
            display.showingFrom = display.showingTo = doc.first;
            display.viewOffset = 0;
            return;
        }

        // Compute the new visible window
        // If scrollTop is specified, use that to determine which lines
        // to render instead of the current scrollbar position.
        var visible = visibleLines(display, doc, viewPort);
        // Bail out if the visible area is already rendered and nothing changed.
        if (changes.length == 0 &&
            visible.from > display.showingFrom && visible.to < display.showingTo)
            return;

        if (maybeUpdateLineNumberWidth(cm))
            changes = [{
                from: doc.first,
                to: doc.first + doc.size
            }];
        var gutterW = display.sizer.style.marginLeft = display.gutters.offsetWidth + "px";
        display.scrollbarH.style.left = cm.options.fixedGutter ? gutterW : "0";

        // Used to determine which lines need their line numbers updated
        var positionsChangedFrom = Infinity;
        if (cm.options.lineNumbers)
            for (var i = 0; i < changes.length; ++i)
                if (changes[i].diff) {
                    positionsChangedFrom = changes[i].from;
                    break;
                }

        var end = doc.first + doc.size;
        var from = Math.max(visible.from - cm.options.viewportMargin, doc.first);
        var to = Math.min(end, visible.to + cm.options.viewportMargin);
        if (display.showingFrom < from && from - display.showingFrom < 20) from = Math.max(doc.first, display.showingFrom);
        if (display.showingTo > to && display.showingTo - to < 20) to = Math.min(end, display.showingTo);
        if (sawCollapsedSpans) {
            from = lineNo(visualLine(doc, getLine(doc, from)));
            while (to < end && lineIsHidden(doc, getLine(doc, to))) ++to;
        }

        // Create a range of theoretically intact lines, and punch holes
        // in that using the change info.
        var intact = [{
            from: Math.max(display.showingFrom, doc.first),
            to: Math.min(display.showingTo, end)
        }];
        if (intact[0].from >= intact[0].to) intact = [];
        else intact = computeIntact(intact, changes);
        // When merged lines are present, we might have to reduce the
        // intact ranges because changes in continued fragments of the
        // intact lines do require the lines to be redrawn.
        if (sawCollapsedSpans)
            for (var i = 0; i < intact.length; ++i) {
                var range = intact[i],
                    merged;
                while (merged = collapsedSpanAtEnd(getLine(doc, range.to - 1))) {
                    var newTo = merged.find().from.line;
                    if (newTo > range.from) range.to = newTo;
                    else {
                        intact.splice(i--, 1);
                        break;
                    }
                }
            }

        // Clip off the parts that won't be visible
        var intactLines = 0;
        for (var i = 0; i < intact.length; ++i) {
            var range = intact[i];
            if (range.from < from) range.from = from;
            if (range.to > to) range.to = to;
            if (range.from >= range.to) intact.splice(i--, 1);
            else intactLines += range.to - range.from;
        }
        if (intactLines == to - from && from == display.showingFrom && to == display.showingTo) {
            updateViewOffset(cm);
            return;
        }
        intact.sort(function(a, b) {
            return a.from - b.from;
        });

        var focused = document.activeElement;
        if (intactLines < (to - from) * .7) display.lineDiv.style.display = "none";
        patchDisplay(cm, from, to, intact, positionsChangedFrom);
        display.lineDiv.style.display = "";
        if (document.activeElement != focused && focused.offsetHeight) focused.focus();

        var different = from != display.showingFrom || to != display.showingTo ||
            display.lastSizeC != display.wrapper.clientHeight;
        // This is just a bogus formula that detects when the editor is
        // resized or the font size changes.
        if (different) display.lastSizeC = display.wrapper.clientHeight;
        display.showingFrom = from;
        display.showingTo = to;
        startWorker(cm, 100);

        var prevBottom = display.lineDiv.offsetTop;
        for (var node = display.lineDiv.firstChild, height; node; node = node.nextSibling)
            if (node.lineObj) {
                if (ie_lt8) {
                    var bot = node.offsetTop + node.offsetHeight;
                    height = bot - prevBottom;
                    prevBottom = bot;
                } else {
                    var box = getRect(node);
                    height = box.bottom - box.top;
                }
                var diff = node.lineObj.height - height;
                if (height < 2) height = textHeight(display);
                if (diff > .001 || diff < -.001) {
                    updateLineHeight(node.lineObj, height);
                    var widgets = node.lineObj.widgets;
                    if (widgets)
                        for (var i = 0; i < widgets.length; ++i)
                            widgets[i].height = widgets[i].node.offsetHeight;
                }
            }
        updateViewOffset(cm);

        if (visibleLines(display, doc, viewPort).to > to)
            updateDisplayInner(cm, [], viewPort);
        return true;
    }

    function updateViewOffset(cm) {
        var off = cm.display.viewOffset = heightAtLine(cm, getLine(cm.doc, cm.display.showingFrom));
        // Position the mover div to align with the current virtual scroll position
        cm.display.mover.style.top = off + "px";
    }

    function computeIntact(intact, changes) {
        for (var i = 0, l = changes.length || 0; i < l; ++i) {
            var change = changes[i],
                intact2 = [],
                diff = change.diff || 0;
            for (var j = 0, l2 = intact.length; j < l2; ++j) {
                var range = intact[j];
                if (change.to <= range.from && change.diff) {
                    intact2.push({
                        from: range.from + diff,
                        to: range.to + diff
                    });
                } else if (change.to <= range.from || change.from >= range.to) {
                    intact2.push(range);
                } else {
                    if (change.from > range.from)
                        intact2.push({
                            from: range.from,
                            to: change.from
                        });
                    if (change.to < range.to)
                        intact2.push({
                            from: change.to + diff,
                            to: range.to + diff
                        });
                }
            }
            intact = intact2;
        }
        return intact;
    }

    function getDimensions(cm) {
        var d = cm.display,
            left = {},
            width = {};
        for (var n = d.gutters.firstChild, i = 0; n; n = n.nextSibling, ++i) {
            left[cm.options.gutters[i]] = n.offsetLeft;
            width[cm.options.gutters[i]] = n.offsetWidth;
        }
        return {
            fixedPos: compensateForHScroll(d),
            gutterTotalWidth: d.gutters.offsetWidth,
            gutterLeft: left,
            gutterWidth: width,
            wrapperWidth: d.wrapper.clientWidth
        };
    }

    function patchDisplay(cm, from, to, intact, updateNumbersFrom) {
        var dims = getDimensions(cm);
        var display = cm.display,
            lineNumbers = cm.options.lineNumbers;
        if (!intact.length && (!webkit || !cm.display.currentWheelTarget))
            removeChildren(display.lineDiv);
        var container = display.lineDiv,
            cur = container.firstChild;

        function rm(node) {
            var next = node.nextSibling;
            if (webkit && mac && cm.display.currentWheelTarget == node) {
                node.style.display = "none";
                node.lineObj = null;
            } else {
                node.parentNode.removeChild(node);
            }
            return next;
        }

        var nextIntact = intact.shift(),
            lineN = from;
        cm.doc.iter(from, to, function(line) {
            if (nextIntact && nextIntact.to == lineN) nextIntact = intact.shift();
            if (lineIsHidden(cm.doc, line)) {
                if (line.height != 0) updateLineHeight(line, 0);
                if (line.widgets && cur.previousSibling)
                    for (var i = 0; i < line.widgets.length; ++i)
                        if (line.widgets[i].showIfHidden) {
                            var prev = cur.previousSibling;
                            if (/pre/i.test(prev.nodeName)) {
                                var wrap = elt("div", null, null, "position: relative");
                                prev.parentNode.replaceChild(wrap, prev);
                                wrap.appendChild(prev);
                                prev = wrap;
                            }
                            var wnode = prev.appendChild(elt("div", [line.widgets[i].node], "CodeMirror-linewidget"));
                            positionLineWidget(line.widgets[i], wnode, prev, dims);
                        }
            } else if (nextIntact && nextIntact.from <= lineN && nextIntact.to > lineN) {
                // This line is intact. Skip to the actual node. Update its
                // line number if needed.
                while (cur.lineObj != line) cur = rm(cur);
                if (lineNumbers && updateNumbersFrom <= lineN && cur.lineNumber)
                    setTextContent(cur.lineNumber, lineNumberFor(cm.options, lineN));
                cur = cur.nextSibling;
            } else {
                // For lines with widgets, make an attempt to find and reuse
                // the existing element, so that widgets aren't needlessly
                // removed and re-inserted into the dom
                if (line.widgets)
                    for (var j = 0, search = cur, reuse; search && j < 20; ++j, search = search.nextSibling)
                        if (search.lineObj == line && /div/i.test(search.nodeName)) {
                            reuse = search;
                            break;
                        }
                        // This line needs to be generated.
                var lineNode = buildLineElement(cm, line, lineN, dims, reuse);
                if (lineNode != reuse) {
                    container.insertBefore(lineNode, cur);
                } else {
                    while (cur != reuse) cur = rm(cur);
                    cur = cur.nextSibling;
                }

                lineNode.lineObj = line;
            }
            ++lineN;
        });
        while (cur) cur = rm(cur);
    }

    function buildLineElement(cm, line, lineNo, dims, reuse) {
        var lineElement = lineContent(cm, line);
        var markers = line.gutterMarkers,
            display = cm.display,
            wrap;

        if (!cm.options.lineNumbers && !markers && !line.bgClass && !line.wrapClass && !line.widgets)
            return lineElement;

        // Lines with gutter elements, widgets or a background class need
        // to be wrapped again, and have the extra elements added to the
        // wrapper div

        if (reuse) {
            reuse.alignable = null;
            var isOk = true,
                widgetsSeen = 0;
            for (var n = reuse.firstChild, next; n; n = next) {
                next = n.nextSibling;
                if (!/\bCodeMirror-linewidget\b/.test(n.className)) {
                    reuse.removeChild(n);
                } else {
                    for (var i = 0, first = true; i < line.widgets.length; ++i) {
                        var widget = line.widgets[i],
                            isFirst = false;
                        if (!widget.above) {
                            isFirst = first;
                            first = false;
                        }
                        if (widget.node == n.firstChild) {
                            positionLineWidget(widget, n, reuse, dims);
                            ++widgetsSeen;
                            if (isFirst) reuse.insertBefore(lineElement, n);
                            break;
                        }
                    }
                    if (i == line.widgets.length) {
                        isOk = false;
                        break;
                    }
                }
            }
            if (isOk && widgetsSeen == line.widgets.length) {
                wrap = reuse;
                reuse.className = line.wrapClass || "";
            }
        }
        if (!wrap) {
            wrap = elt("div", null, line.wrapClass, "position: relative");
            wrap.appendChild(lineElement);
        }
        // Kludge to make sure the styled element lies behind the selection (by z-index)
        if (line.bgClass)
            wrap.insertBefore(elt("div", "\u00a0", line.bgClass + " CodeMirror-linebackground"), wrap.firstChild);
        if (cm.options.lineNumbers || markers) {
            var gutterWrap = wrap.insertBefore(elt("div", null, null, "position: absolute; left: " +
                    (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px"),
                wrap.firstChild);
            if (cm.options.fixedGutter)(wrap.alignable || (wrap.alignable = [])).push(gutterWrap);
            if (cm.options.lineNumbers && (!markers || !markers["CodeMirror-linenumbers"]))
                wrap.lineNumber = gutterWrap.appendChild(
                    elt("div", lineNumberFor(cm.options, lineNo),
                        "CodeMirror-linenumber CodeMirror-gutter-elt",
                        "left: " + dims.gutterLeft["CodeMirror-linenumbers"] + "px; width: " + display.lineNumInnerWidth + "px"));
            if (markers)
                for (var k = 0; k < cm.options.gutters.length; ++k) {
                    var id = cm.options.gutters[k],
                        found = markers.hasOwnProperty(id) && markers[id];
                    if (found)
                        gutterWrap.appendChild(elt("div", [found], "CodeMirror-gutter-elt", "left: " +
                            dims.gutterLeft[id] + "px; width: " + dims.gutterWidth[id] + "px"));
                }
        }
        if (ie_lt8) wrap.style.zIndex = 2;
        if (line.widgets && wrap != reuse)
            for (var i = 0, ws = line.widgets; i < ws.length; ++i) {
                var widget = ws[i],
                    node = elt("div", [widget.node], "CodeMirror-linewidget");
                positionLineWidget(widget, node, wrap, dims);
                if (widget.above)
                    wrap.insertBefore(node, cm.options.lineNumbers && line.height != 0 ? gutterWrap : lineElement);
                else
                    wrap.appendChild(node);
                signalLater(widget, "redraw");
            }
        return wrap;
    }

    function positionLineWidget(widget, node, wrap, dims) {
        if (widget.noHScroll) {
            (wrap.alignable || (wrap.alignable = [])).push(node);
            var width = dims.wrapperWidth;
            node.style.left = dims.fixedPos + "px";
            if (!widget.coverGutter) {
                width -= dims.gutterTotalWidth;
                node.style.paddingLeft = dims.gutterTotalWidth + "px";
            }
            node.style.width = width + "px";
        }
        if (widget.coverGutter) {
            node.style.zIndex = 5;
            node.style.position = "relative";
            if (!widget.noHScroll) node.style.marginLeft = -dims.gutterTotalWidth + "px";
        }
    }

    // SELECTION / CURSOR

    function updateSelection(cm) {
        var display = cm.display;
        var collapsed = posEq(cm.doc.sel.from, cm.doc.sel.to);
        if (collapsed || cm.options.showCursorWhenSelecting)
            updateSelectionCursor(cm);
        else
            display.cursor.style.display = display.otherCursor.style.display = "none";
        if (!collapsed)
            updateSelectionRange(cm);
        else
            display.selectionDiv.style.display = "none";

        // Move the hidden textarea near the cursor to prevent scrolling artifacts
        var headPos = cursorCoords(cm, cm.doc.sel.head, "div");
        var wrapOff = getRect(display.wrapper),
            lineOff = getRect(display.lineDiv);
        display.inputDiv.style.top = Math.max(0, Math.min(display.wrapper.clientHeight - 10,
            headPos.top + lineOff.top - wrapOff.top)) + "px";
        display.inputDiv.style.left = Math.max(0, Math.min(display.wrapper.clientWidth - 10,
            headPos.left + lineOff.left - wrapOff.left)) + "px";
    }

    // No selection, plain cursor
    function updateSelectionCursor(cm) {
        var display = cm.display,
            pos = cursorCoords(cm, cm.doc.sel.head, "div");
        display.cursor.style.left = pos.left + "px";
        display.cursor.style.top = pos.top + "px";
        display.cursor.style.height = Math.max(0, pos.bottom - pos.top) * cm.options.cursorHeight + "px";
        display.cursor.style.display = "";

        if (pos.other) {
            display.otherCursor.style.display = "";
            display.otherCursor.style.left = pos.other.left + "px";
            display.otherCursor.style.top = pos.other.top + "px";
            display.otherCursor.style.height = (pos.other.bottom - pos.other.top) * .85 + "px";
        } else {
            display.otherCursor.style.display = "none";
        }
    }

    // Highlight selection
    function updateSelectionRange(cm) {
        var display = cm.display,
            doc = cm.doc,
            sel = cm.doc.sel;
        var fragment = document.createDocumentFragment();
        var clientWidth = display.lineSpace.offsetWidth,
            pl = paddingLeft(cm.display);

        function add(left, top, width, bottom) {
            if (top < 0) top = 0;
            fragment.appendChild(elt("div", null, "CodeMirror-selected", "position: absolute; left: " + left +
                "px; top: " + top + "px; width: " + (width == null ? clientWidth - left : width) +
                "px; height: " + (bottom - top) + "px"));
        }

        function drawForLine(line, fromArg, toArg, retTop) {
            var lineObj = getLine(doc, line);
            var lineLen = lineObj.text.length,
                rVal = retTop ? Infinity : -Infinity;

            function coords(ch) {
                return charCoords(cm, Pos(line, ch), "div", lineObj);
            }

            iterateBidiSections(getOrder(lineObj), fromArg || 0, toArg == null ? lineLen : toArg, function(from, to, dir) {
                var leftPos = coords(dir == "rtl" ? to - 1 : from);
                var rightPos = coords(dir == "rtl" ? from : to - 1);
                var left = leftPos.left,
                    right = rightPos.right;
                if (rightPos.top - leftPos.top > 3) { // Different lines, draw top part
                    add(left, leftPos.top, null, leftPos.bottom);
                    left = pl;
                    if (leftPos.bottom < rightPos.top) add(left, leftPos.bottom, null, rightPos.top);
                }
                if (toArg == null && to == lineLen) right = clientWidth;
                if (fromArg == null && from == 0) left = pl;
                rVal = retTop ? Math.min(rightPos.top, rVal) : Math.max(rightPos.bottom, rVal);
                if (left < pl + 1) left = pl;
                add(left, rightPos.top, right - left, rightPos.bottom);
            });
            return rVal;
        }

        if (sel.from.line == sel.to.line) {
            drawForLine(sel.from.line, sel.from.ch, sel.to.ch);
        } else {
            var fromObj = getLine(doc, sel.from.line);
            var cur = fromObj,
                merged, path = [sel.from.line, sel.from.ch],
                singleLine;
            while (merged = collapsedSpanAtEnd(cur)) {
                var found = merged.find();
                path.push(found.from.ch, found.to.line, found.to.ch);
                if (found.to.line == sel.to.line) {
                    path.push(sel.to.ch);
                    singleLine = true;
                    break;
                }
                cur = getLine(doc, found.to.line);
            }

            // This is a single, merged line
            if (singleLine) {
                for (var i = 0; i < path.length; i += 3)
                    drawForLine(path[i], path[i + 1], path[i + 2]);
            } else {
                var middleTop, middleBot, toObj = getLine(doc, sel.to.line);
                if (sel.from.ch)
                // Draw the first line of selection.
                    middleTop = drawForLine(sel.from.line, sel.from.ch, null, false);
                else
                // Simply include it in the middle block.
                    middleTop = heightAtLine(cm, fromObj) - display.viewOffset;

                if (!sel.to.ch)
                    middleBot = heightAtLine(cm, toObj) - display.viewOffset;
                else
                    middleBot = drawForLine(sel.to.line, collapsedSpanAtStart(toObj) ? null : 0, sel.to.ch, true);

                if (middleTop < middleBot) add(pl, middleTop, null, middleBot);
            }
        }

        removeChildrenAndAdd(display.selectionDiv, fragment);
        display.selectionDiv.style.display = "";
    }

    // Cursor-blinking
    function restartBlink(cm) {
        var display = cm.display;
        clearInterval(display.blinker);
        var on = true;
        display.cursor.style.visibility = display.otherCursor.style.visibility = "";
        display.blinker = setInterval(function() {
            if (!display.cursor.offsetHeight) return;
            display.cursor.style.visibility = display.otherCursor.style.visibility = (on = !on) ? "" : "hidden";
        }, cm.options.cursorBlinkRate);
    }

    // HIGHLIGHT WORKER

    function startWorker(cm, time) {
        if (cm.doc.mode.startState && cm.doc.frontier < cm.display.showingTo)
            cm.state.highlight.set(time, bind(highlightWorker, cm));
    }

    function highlightWorker(cm) {
        var doc = cm.doc;
        if (doc.frontier < doc.first) doc.frontier = doc.first;
        if (doc.frontier >= cm.display.showingTo) return;
        var end = +new Date + cm.options.workTime;
        var state = copyState(doc.mode, getStateBefore(cm, doc.frontier));
        var changed = [],
            prevChange;
        doc.iter(doc.frontier, Math.min(doc.first + doc.size, cm.display.showingTo + 500), function(line) {
            if (doc.frontier >= cm.display.showingFrom) { // Visible
                var oldStyles = line.styles;
                line.styles = highlightLine(cm, line, state);
                var ischange = !oldStyles || oldStyles.length != line.styles.length;
                for (var i = 0; !ischange && i < oldStyles.length; ++i) ischange = oldStyles[i] != line.styles[i];
                if (ischange) {
                    if (prevChange && prevChange.end == doc.frontier) prevChange.end++;
                    else changed.push(prevChange = {
                        start: doc.frontier,
                        end: doc.frontier + 1
                    });
                }
                line.stateAfter = copyState(doc.mode, state);
            } else {
                processLine(cm, line, state);
                line.stateAfter = doc.frontier % 5 == 0 ? copyState(doc.mode, state) : null;
            }
            ++doc.frontier;
            if (+new Date > end) {
                startWorker(cm, cm.options.workDelay);
                return true;
            }
        });
        if (changed.length)
            operation(cm, function() {
                for (var i = 0; i < changed.length; ++i)
                    regChange(this, changed[i].start, changed[i].end);
            })();
    }

    // Finds the line to start with when starting a parse. Tries to
    // find a line with a stateAfter, so that it can start with a
    // valid state. If that fails, it returns the line with the
    // smallest indentation, which tends to need the least context to
    // parse correctly.
    function findStartLine(cm, n) {
        var minindent, minline, doc = cm.doc;
        for (var search = n, lim = n - 100; search > lim; --search) {
            if (search <= doc.first) return doc.first;
            var line = getLine(doc, search - 1);
            if (line.stateAfter) return search;
            var indented = countColumn(line.text, null, cm.options.tabSize);
            if (minline == null || minindent > indented) {
                minline = search - 1;
                minindent = indented;
            }
        }
        return minline;
    }

    function getStateBefore(cm, n) {
        var doc = cm.doc,
            display = cm.display;
        if (!doc.mode.startState) return true;
        var pos = findStartLine(cm, n),
            state = pos > doc.first && getLine(doc, pos - 1).stateAfter;
        if (!state) state = startState(doc.mode);
        else state = copyState(doc.mode, state);
        doc.iter(pos, n, function(line) {
            processLine(cm, line, state);
            var save = pos == n - 1 || pos % 5 == 0 || pos >= display.showingFrom && pos < display.showingTo;
            line.stateAfter = save ? copyState(doc.mode, state) : null;
            ++pos;
        });
        return state;
    }

    // POSITION MEASUREMENT

    function paddingTop(display) {
        return display.lineSpace.offsetTop;
    }

    function paddingLeft(display) {
        var e = removeChildrenAndAdd(display.measure, elt("pre", null, null, "text-align: left")).appendChild(elt("span", "x"));
        return e.offsetLeft;
    }

    function measureChar(cm, line, ch, data) {
        var dir = -1;
        data = data || measureLine(cm, line);

        for (var pos = ch;; pos += dir) {
            var r = data[pos];
            if (r) break;
            if (dir < 0 && pos == 0) dir = 1;
        }
        return {
            left: pos < ch ? r.right : r.left,
            right: pos > ch ? r.left : r.right,
            top: r.top,
            bottom: r.bottom
        };
    }

    function measureLine(cm, line) {
        // First look in the cache
        var display = cm.display,
            cache = cm.display.measureLineCache;
        for (var i = 0; i < cache.length; ++i) {
            var memo = cache[i];
            if (memo.text == line.text && memo.markedSpans == line.markedSpans &&
                display.scroller.clientWidth == memo.width &&
                memo.classes == line.textClass + "|" + line.bgClass + "|" + line.wrapClass)
                return memo.measure;
        }

        var measure = measureLineInner(cm, line);
        // Store result in the cache
        var memo = {
            text: line.text,
            width: display.scroller.clientWidth,
            markedSpans: line.markedSpans,
            measure: measure,
            classes: line.textClass + "|" + line.bgClass + "|" + line.wrapClass
        };
        if (cache.length == 16) cache[++display.measureLineCachePos % 16] = memo;
        else cache.push(memo);
        return measure;
    }

    function measureLineInner(cm, line) {
        var display = cm.display,
            measure = emptyArray(line.text.length);
        var pre = lineContent(cm, line, measure);

        // IE does not cache element positions of inline elements between
        // calls to getBoundingClientRect. This makes the loop below,
        // which gathers the positions of all the characters on the line,
        // do an amount of layout work quadratic to the number of
        // characters. When line wrapping is off, we try to improve things
        // by first subdividing the line into a bunch of inline blocks, so
        // that IE can reuse most of the layout information from caches
        // for those blocks. This does interfere with line wrapping, so it
        // doesn't work when wrapping is on, but in that case the
        // situation is slightly better, since IE does cache line-wrapping
        // information and only recomputes per-line.
        if (ie && !ie_lt8 && !cm.options.lineWrapping && pre.childNodes.length > 100) {
            var fragment = document.createDocumentFragment();
            var chunk = 10,
                n = pre.childNodes.length;
            for (var i = 0, chunks = Math.ceil(n / chunk); i < chunks; ++i) {
                var wrap = elt("div", null, null, "display: inline-block");
                for (var j = 0; j < chunk && n; ++j) {
                    wrap.appendChild(pre.firstChild);
                    --n;
                }
                fragment.appendChild(wrap);
            }
            pre.appendChild(fragment);
        }

        removeChildrenAndAdd(display.measure, pre);

        var outer = getRect(display.lineDiv);
        var vranges = [],
            data = emptyArray(line.text.length),
            maxBot = pre.offsetHeight;
        // Work around an IE7/8 bug where it will sometimes have randomly
        // replaced our pre with a clone at this point.
        if (ie_lt9 && display.measure.first != pre)
            removeChildrenAndAdd(display.measure, pre);

        for (var i = 0, cur; i < measure.length; ++i)
            if (cur = measure[i]) {
                var size = getRect(cur);
                var top = Math.max(0, size.top - outer.top),
                    bot = Math.min(size.bottom - outer.top, maxBot);
                for (var j = 0; j < vranges.length; j += 2) {
                    var rtop = vranges[j],
                        rbot = vranges[j + 1];
                    if (rtop > bot || rbot < top) continue;
                    if (rtop <= top && rbot >= bot ||
                        top <= rtop && bot >= rbot ||
                        Math.min(bot, rbot) - Math.max(top, rtop) >= (bot - top) >> 1) {
                        vranges[j] = Math.min(top, rtop);
                        vranges[j + 1] = Math.max(bot, rbot);
                        break;
                    }
                }
                if (j == vranges.length) vranges.push(top, bot);
                var right = size.right;
                if (cur.measureRight) right = getRect(cur.measureRight).left;
                data[i] = {
                    left: size.left - outer.left,
                    right: right - outer.left,
                    top: j
                };
            }
        for (var i = 0, cur; i < data.length; ++i)
            if (cur = data[i]) {
                var vr = cur.top;
                cur.top = vranges[vr];
                cur.bottom = vranges[vr + 1];
            }
        if (!cm.options.lineWrapping) {
            var last = pre.lastChild;
            if (last.nodeType == 3) last = pre.appendChild(elt("span", "\u200b"));
            data.width = getRect(last).right - outer.left;
        }

        return data;
    }

    function clearCaches(cm) {
        cm.display.measureLineCache.length = cm.display.measureLineCachePos = 0;
        cm.display.cachedCharWidth = cm.display.cachedTextHeight = null;
        cm.display.maxLineChanged = true;
        cm.display.lineNumChars = null;
    }

    // Context is one of "line", "div" (display.lineDiv), "local"/null (editor), or "page"
    function intoCoordSystem(cm, lineObj, rect, context) {
        if (lineObj.widgets)
            for (var i = 0; i < lineObj.widgets.length; ++i)
                if (lineObj.widgets[i].above) {
                    var size = widgetHeight(lineObj.widgets[i]);
                    rect.top += size;
                    rect.bottom += size;
                }
        if (context == "line") return rect;
        if (!context) context = "local";
        var yOff = heightAtLine(cm, lineObj);
        if (context != "local") yOff -= cm.display.viewOffset;
        if (context == "page") {
            var lOff = getRect(cm.display.lineSpace);
            yOff += lOff.top + (window.pageYOffset || (document.documentElement || document.body).scrollTop);
            var xOff = lOff.left + (window.pageXOffset || (document.documentElement || document.body).scrollLeft);
            rect.left += xOff;
            rect.right += xOff;
        }
        rect.top += yOff;
        rect.bottom += yOff;
        return rect;
    }

    function charCoords(cm, pos, context, lineObj) {
        if (!lineObj) lineObj = getLine(cm.doc, pos.line);
        return intoCoordSystem(cm, lineObj, measureChar(cm, lineObj, pos.ch), context);
    }

    function cursorCoords(cm, pos, context, lineObj, measurement) {
        lineObj = lineObj || getLine(cm.doc, pos.line);
        if (!measurement) measurement = measureLine(cm, lineObj);

        function get(ch, right) {
            var m = measureChar(cm, lineObj, ch, measurement);
            if (right) m.left = m.right;
            else m.right = m.left;
            return intoCoordSystem(cm, lineObj, m, context);
        }
        var order = getOrder(lineObj),
            ch = pos.ch;
        if (!order) return get(ch);
        var main, other, linedir = order[0].level;
        for (var i = 0; i < order.length; ++i) {
            var part = order[i],
                rtl = part.level % 2,
                nb, here;
            if (part.from < ch && part.to > ch) return get(ch, rtl);
            var left = rtl ? part.to : part.from,
                right = rtl ? part.from : part.to;
            if (left == ch) {
                // IE returns bogus offsets and widths for edges where the
                // direction flips, but only for the side with the lower
                // level. So we try to use the side with the higher level.
                if (i && part.level < (nb = order[i - 1]).level) here = get(nb.level % 2 ? nb.from : nb.to - 1, true);
                else here = get(rtl && part.from != part.to ? ch - 1 : ch);
                if (rtl == linedir) main = here;
                else other = here;
            } else if (right == ch) {
                var nb = i < order.length - 1 && order[i + 1];
                if (!rtl && nb && nb.from == nb.to) continue;
                if (nb && part.level < nb.level) here = get(nb.level % 2 ? nb.to - 1 : nb.from);
                else here = get(rtl ? ch : ch - 1, true);
                if (rtl == linedir) main = here;
                else other = here;
            }
        }
        if (linedir && !ch) other = get(order[0].to - 1);
        if (!main) return other;
        if (other) main.other = other;
        return main;
    }

    function PosMaybeOutside(line, ch, outside) {
        var pos = new Pos(line, ch);
        if (outside) pos.outside = true;
        return pos;
    }

    // Coords must be lineSpace-local
    function coordsChar(cm, x, y) {
        var doc = cm.doc;
        y += cm.display.viewOffset;
        if (y < 0) return PosMaybeOutside(doc.first, 0, true);
        var lineNo = lineAtHeight(doc, y),
            last = doc.first + doc.size - 1;
        if (lineNo > last)
            return PosMaybeOutside(doc.first + doc.size - 1, getLine(doc, last).text.length, true);
        if (x < 0) x = 0;

        for (;;) {
            var lineObj = getLine(doc, lineNo);
            var found = coordsCharInner(cm, lineObj, lineNo, x, y);
            var merged = collapsedSpanAtEnd(lineObj);
            var mergedPos = merged && merged.find();
            if (merged && found.ch >= mergedPos.from.ch)
                lineNo = mergedPos.to.line;
            else
                return found;
        }
    }

    function coordsCharInner(cm, lineObj, lineNo, x, y) {
        var innerOff = y - heightAtLine(cm, lineObj);
        var wrongLine = false,
            cWidth = cm.display.wrapper.clientWidth;
        var measurement = measureLine(cm, lineObj);

        function getX(ch) {
            var sp = cursorCoords(cm, Pos(lineNo, ch), "line",
                lineObj, measurement);
            wrongLine = true;
            if (innerOff > sp.bottom) return Math.max(0, sp.left - cWidth);
            else if (innerOff < sp.top) return sp.left + cWidth;
            else wrongLine = false;
            return sp.left;
        }

        var bidi = getOrder(lineObj),
            dist = lineObj.text.length;
        var from = lineLeft(lineObj),
            to = lineRight(lineObj);
        var fromX = getX(from),
            fromOutside = wrongLine,
            toX = getX(to),
            toOutside = wrongLine;

        if (x > toX) return PosMaybeOutside(lineNo, to, toOutside);
        // Do a binary search between these bounds.
        for (;;) {
            if (bidi ? to == from || to == moveVisually(lineObj, from, 1) : to - from <= 1) {
                var after = x - fromX < toX - x,
                    ch = after ? from : to;
                while (isExtendingChar.test(lineObj.text.charAt(ch))) ++ch;
                var pos = PosMaybeOutside(lineNo, ch, after ? fromOutside : toOutside);
                pos.after = after;
                return pos;
            }
            var step = Math.ceil(dist / 2),
                middle = from + step;
            if (bidi) {
                middle = from;
                for (var i = 0; i < step; ++i) middle = moveVisually(lineObj, middle, 1);
            }
            var middleX = getX(middle);
            if (middleX > x) {
                to = middle;
                toX = middleX;
                if (toOutside = wrongLine) toX += 1000;
                dist -= step;
            } else {
                from = middle;
                fromX = middleX;
                fromOutside = wrongLine;
                dist = step;
            }
        }
    }

    var measureText;

    function textHeight(display) {
        if (display.cachedTextHeight != null) return display.cachedTextHeight;
        if (measureText == null) {
            measureText = elt("pre");
            // Measure a bunch of lines, for browsers that compute
            // fractional heights.
            for (var i = 0; i < 49; ++i) {
                measureText.appendChild(document.createTextNode("x"));
                measureText.appendChild(elt("br"));
            }
            measureText.appendChild(document.createTextNode("x"));
        }
        removeChildrenAndAdd(display.measure, measureText);
        var height = measureText.offsetHeight / 50;
        if (height > 3) display.cachedTextHeight = height;
        removeChildren(display.measure);
        return height || 1;
    }

    function charWidth(display) {
        if (display.cachedCharWidth != null) return display.cachedCharWidth;
        var anchor = elt("span", "x");
        var pre = elt("pre", [anchor]);
        removeChildrenAndAdd(display.measure, pre);
        var width = anchor.offsetWidth;
        if (width > 2) display.cachedCharWidth = width;
        return width || 10;
    }

    // OPERATIONS

    // Operations are used to wrap changes in such a way that each
    // change won't have to update the cursor and display (which would
    // be awkward, slow, and error-prone), but instead updates are
    // batched and then all combined and executed at once.

    var nextOpId = 0;

    function startOperation(cm) {
        cm.curOp = {
            // An array of ranges of lines that have to be updated. See
            // updateDisplay.
            changes: [],
            updateInput: null,
            userSelChange: null,
            textChanged: null,
            selectionChanged: false,
            updateMaxLine: false,
            updateScrollPos: false,
            id: ++nextOpId
        };
        if (!delayedCallbackDepth++) delayedCallbacks = [];
    }

    function endOperation(cm) {
        var op = cm.curOp,
            doc = cm.doc,
            display = cm.display;
        cm.curOp = null;

        if (op.updateMaxLine) computeMaxLength(cm);
        if (display.maxLineChanged && !cm.options.lineWrapping) {
            var width = measureLine(cm, display.maxLine).width;
            display.sizer.style.minWidth = Math.max(0, width + 3 + scrollerCutOff) + "px";
            display.maxLineChanged = false;
            var maxScrollLeft = Math.max(0, display.sizer.offsetLeft + display.sizer.offsetWidth - display.scroller.clientWidth);
            if (maxScrollLeft < doc.scrollLeft && !op.updateScrollPos)
                setScrollLeft(cm, Math.min(display.scroller.scrollLeft, maxScrollLeft), true);
        }
        var newScrollPos, updated;
        if (op.updateScrollPos) {
            newScrollPos = op.updateScrollPos;
        } else if (op.selectionChanged && display.scroller.clientHeight) { // don't rescroll if not visible
            var coords = cursorCoords(cm, doc.sel.head);
            newScrollPos = calculateScrollPos(cm, coords.left, coords.top, coords.left, coords.bottom);
        }
        if (op.changes.length || newScrollPos && newScrollPos.scrollTop != null)
            updated = updateDisplay(cm, op.changes, newScrollPos && newScrollPos.scrollTop);
        if (!updated && op.selectionChanged) updateSelection(cm);
        if (op.updateScrollPos) {
            display.scroller.scrollTop = display.scrollbarV.scrollTop = doc.scrollTop = newScrollPos.scrollTop;
            display.scroller.scrollLeft = display.scrollbarH.scrollLeft = doc.scrollLeft = newScrollPos.scrollLeft;
            alignHorizontally(cm);
        } else if (newScrollPos) {
            scrollCursorIntoView(cm);
        }
        if (op.selectionChanged) restartBlink(cm);

        if (cm.state.focused && op.updateInput)
            resetInput(cm, op.userSelChange);

        var hidden = op.maybeHiddenMarkers,
            unhidden = op.maybeUnhiddenMarkers;
        if (hidden)
            for (var i = 0; i < hidden.length; ++i)
                if (!hidden[i].lines.length) signal(hidden[i], "hide");
        if (unhidden)
            for (var i = 0; i < unhidden.length; ++i)
                if (unhidden[i].lines.length) signal(unhidden[i], "unhide");

        var delayed;
        if (!--delayedCallbackDepth) {
            delayed = delayedCallbacks;
            delayedCallbacks = null;
        }
        if (op.textChanged)
            signal(cm, "change", cm, op.textChanged);
        if (op.selectionChanged) signal(cm, "cursorActivity", cm);
        if (delayed)
            for (var i = 0; i < delayed.length; ++i) delayed[i]();
    }

    // Wraps a function in an operation. Returns the wrapped function.
    function operation(cm1, f) {
        return function() {
            var cm = cm1 || this,
                withOp = !cm.curOp;
            if (withOp) startOperation(cm);
            try {
                var result = f.apply(cm, arguments);
            } finally {
                if (withOp) endOperation(cm);
            }
            return result;
        };
    }

    function docOperation(f) {
        return function() {
            var withOp = this.cm && !this.cm.curOp,
                result;
            if (withOp) startOperation(this.cm);
            try {
                result = f.apply(this, arguments);
            } finally {
                if (withOp) endOperation(this.cm);
            }
            return result;
        };
    }

    function runInOp(cm, f) {
        var withOp = !cm.curOp,
            result;
        if (withOp) startOperation(cm);
        try {
            result = f();
        } finally {
            if (withOp) endOperation(cm);
        }
        return result;
    }

    function regChange(cm, from, to, lendiff) {
        if (from == null) from = cm.doc.first;
        if (to == null) to = cm.doc.first + cm.doc.size;
        cm.curOp.changes.push({
            from: from,
            to: to,
            diff: lendiff
        });
    }

    // INPUT HANDLING

    function slowPoll(cm) {
        if (cm.display.pollingFast) return;
        cm.display.poll.set(cm.options.pollInterval, function() {
            readInput(cm);
            if (cm.state.focused) slowPoll(cm);
        });
    }

    function fastPoll(cm) {
        var missed = false;
        cm.display.pollingFast = true;

        function p() {
            var changed = readInput(cm);
            if (!changed && !missed) {
                missed = true;
                cm.display.poll.set(60, p);
            } else {
                cm.display.pollingFast = false;
                slowPoll(cm);
            }
        }
        cm.display.poll.set(20, p);
    }

    // prevInput is a hack to work with IME. If we reset the textarea
    // on every change, that breaks IME. So we look for changes
    // compared to the previous content instead. (Modern browsers have
    // events that indicate IME taking place, but these are not widely
    // supported or compatible enough yet to rely on.)
    function readInput(cm) {
        var input = cm.display.input,
            prevInput = cm.display.prevInput,
            doc = cm.doc,
            sel = doc.sel;
        if (!cm.state.focused || hasSelection(input) || isReadOnly(cm)) return false;
        var text = input.value;
        if (text == prevInput && posEq(sel.from, sel.to)) return false;
        // IE enjoys randomly deselecting our input's text when
        // re-focusing. If the selection is gone but the cursor is at the
        // start of the input, that's probably what happened.
        if (ie && text && input.selectionStart === 0) {
            resetInput(cm, true);
            return false;
        }
        var withOp = !cm.curOp;
        if (withOp) startOperation(cm);
        sel.shift = false;
        var same = 0,
            l = Math.min(prevInput.length, text.length);
        while (same < l && prevInput[same] == text[same]) ++same;
        var from = sel.from,
            to = sel.to;
        if (same < prevInput.length)
            from = Pos(from.line, from.ch - (prevInput.length - same));
        else if (cm.state.overwrite && posEq(from, to) && !cm.state.pasteIncoming)
            to = Pos(to.line, Math.min(getLine(doc, to.line).text.length, to.ch + (text.length - same)));
        var updateInput = cm.curOp.updateInput;
        makeChange(cm.doc, {
            from: from,
            to: to,
            text: splitLines(text.slice(same)),
            origin: cm.state.pasteIncoming ? "paste" : "+input"
        }, "end");

        cm.curOp.updateInput = updateInput;
        if (text.length > 1000) input.value = cm.display.prevInput = "";
        else cm.display.prevInput = text;
        if (withOp) endOperation(cm);
        cm.state.pasteIncoming = false;
        return true;
    }

    function resetInput(cm, user) {
        var minimal, selected, doc = cm.doc;
        if (!posEq(doc.sel.from, doc.sel.to)) {
            cm.display.prevInput = "";
            minimal = hasCopyEvent &&
                (doc.sel.to.line - doc.sel.from.line > 100 || (selected = cm.getSelection()).length > 1000);
            if (minimal) cm.display.input.value = "-";
            else cm.display.input.value = selected || cm.getSelection();
            if (cm.state.focused) selectInput(cm.display.input);
        } else if (user) cm.display.prevInput = cm.display.input.value = "";
        cm.display.inaccurateSelection = minimal;
    }

    function focusInput(cm) {
        if (cm.options.readOnly != "nocursor" && (!mobile || document.activeElement != cm.display.input))
            cm.display.input.focus();
    }

    function isReadOnly(cm) {
        return cm.options.readOnly || cm.doc.cantEdit;
    }

    // EVENT HANDLERS

    function registerEventHandlers(cm) {
        var d = cm.display;
        on(d.scroller, "mousedown", operation(cm, onMouseDown));
        on(d.scroller, "dblclick", operation(cm, e_preventDefault));
        on(d.lineSpace, "selectstart", function(e) {
            if (!eventInWidget(d, e)) e_preventDefault(e);
        });
        // Gecko browsers fire contextmenu *after* opening the menu, at
        // which point we can't mess with it anymore. Context menu is
        // handled in onMouseDown for Gecko.
        if (!captureMiddleClick) on(d.scroller, "contextmenu", function(e) {
            onContextMenu(cm, e);
        });

        on(d.scroller, "scroll", function() {
            setScrollTop(cm, d.scroller.scrollTop);
            setScrollLeft(cm, d.scroller.scrollLeft, true);
            signal(cm, "scroll", cm);
        });
        on(d.scrollbarV, "scroll", function() {
            setScrollTop(cm, d.scrollbarV.scrollTop);
        });
        on(d.scrollbarH, "scroll", function() {
            setScrollLeft(cm, d.scrollbarH.scrollLeft);
        });

        on(d.scroller, "mousewheel", function(e) {
            onScrollWheel(cm, e);
        });
        on(d.scroller, "DOMMouseScroll", function(e) {
            onScrollWheel(cm, e);
        });

        function reFocus() {
            if (cm.state.focused) setTimeout(bind(focusInput, cm), 0);
        }
        on(d.scrollbarH, "mousedown", reFocus);
        on(d.scrollbarV, "mousedown", reFocus);
        // Prevent wrapper from ever scrolling
        on(d.wrapper, "scroll", function() {
            d.wrapper.scrollTop = d.wrapper.scrollLeft = 0;
        });

        function onResize() {
            // Might be a text scaling operation, clear size caches.
            d.cachedCharWidth = d.cachedTextHeight = null;
            clearCaches(cm);
            runInOp(cm, bind(regChange, cm));
        }
        on(window, "resize", onResize);
        // Above handler holds on to the editor and its data structures.
        // Here we poll to unregister it when the editor is no longer in
        // the document, so that it can be garbage-collected.
        function unregister() {
            for (var p = d.wrapper.parentNode; p && p != document.body; p = p.parentNode) {}
            if (p) setTimeout(unregister, 5000);
            else off(window, "resize", onResize);
        }
        setTimeout(unregister, 5000);

        on(d.input, "keyup", operation(cm, function(e) {
            if (cm.options.onKeyEvent && cm.options.onKeyEvent(cm, addStop(e))) return;
            if (e.keyCode == 16) cm.doc.sel.shift = false;
        }));
        on(d.input, "input", bind(fastPoll, cm));
        on(d.input, "keydown", operation(cm, onKeyDown));
        on(d.input, "keypress", operation(cm, onKeyPress));
        on(d.input, "focus", bind(onFocus, cm));
        on(d.input, "blur", bind(onBlur, cm));

        function drag_(e) {
            if (cm.options.onDragEvent && cm.options.onDragEvent(cm, addStop(e))) return;
            e_stop(e);
        }
        if (cm.options.dragDrop) {
            on(d.scroller, "dragstart", function(e) {
                onDragStart(cm, e);
            });
            on(d.scroller, "dragenter", drag_);
            on(d.scroller, "dragover", drag_);
            on(d.scroller, "drop", operation(cm, onDrop));
        }
        on(d.scroller, "paste", function(e) {
            if (eventInWidget(d, e)) return;
            focusInput(cm);
            fastPoll(cm);
        });
        on(d.input, "paste", function() {
            cm.state.pasteIncoming = true;
            fastPoll(cm);
        });

        function prepareCopy() {
            if (d.inaccurateSelection) {
                d.prevInput = "";
                d.inaccurateSelection = false;
                d.input.value = cm.getSelection();
                selectInput(d.input);
            }
        }
        on(d.input, "cut", prepareCopy);
        on(d.input, "copy", prepareCopy);

        // Needed to handle Tab key in KHTML
        if (khtml) on(d.sizer, "mouseup", function() {
            if (document.activeElement == d.input) d.input.blur();
            focusInput(cm);
        });
    }

    function eventInWidget(display, e) {
        for (var n = e_target(e); n != display.wrapper; n = n.parentNode) {
            if (!n) return true;
            if (/\bCodeMirror-(?:line)?widget\b/.test(n.className) ||
                n.parentNode == display.sizer && n != display.mover) return true;
        }
    }

    function posFromMouse(cm, e, liberal) {
        var display = cm.display;
        if (!liberal) {
            var target = e_target(e);
            if (target == display.scrollbarH || target == display.scrollbarH.firstChild ||
                target == display.scrollbarV || target == display.scrollbarV.firstChild ||
                target == display.scrollbarFiller) return null;
        }
        var x, y, space = getRect(display.lineSpace);
        // Fails unpredictably on IE[67] when mouse is dragged around quickly.
        try {
            x = e.clientX;
            y = e.clientY;
        } catch (e) {
            return null;
        }
        return coordsChar(cm, x - space.left, y - space.top);
    }

    var lastClick, lastDoubleClick;

    function onMouseDown(e) {
        var cm = this,
            display = cm.display,
            doc = cm.doc,
            sel = doc.sel;
        sel.shift = e.shiftKey;

        if (eventInWidget(display, e)) {
            if (!webkit) {
                display.scroller.draggable = false;
                setTimeout(function() {
                    display.scroller.draggable = true;
                }, 100);
            }
            return;
        }
        if (clickInGutter(cm, e)) return;
        var start = posFromMouse(cm, e);

        switch (e_button(e)) {
            case 3:
                if (captureMiddleClick) onContextMenu.call(cm, cm, e);
                return;
            case 2:
                if (start) extendSelection(cm.doc, start);
                setTimeout(bind(focusInput, cm), 20);
                e_preventDefault(e);
                return;
        }
        // For button 1, if it was clicked inside the editor
        // (posFromMouse returning non-null), we have to adjust the
        // selection.
        if (!start) {
            if (e_target(e) == display.scroller) e_preventDefault(e);
            return;
        }

        if (!cm.state.focused) onFocus(cm);

        var now = +new Date,
            type = "single";
        if (lastDoubleClick && lastDoubleClick.time > now - 400 && posEq(lastDoubleClick.pos, start)) {
            type = "triple";
            e_preventDefault(e);
            setTimeout(bind(focusInput, cm), 20);
            selectLine(cm, start.line);
        } else if (lastClick && lastClick.time > now - 400 && posEq(lastClick.pos, start)) {
            type = "double";
            lastDoubleClick = {
                time: now,
                pos: start
            };
            e_preventDefault(e);
            var word = findWordAt(getLine(doc, start.line).text, start);
            extendSelection(cm.doc, word.from, word.to);
        } else {
            lastClick = {
                time: now,
                pos: start
            };
        }

        var last = start;
        if (cm.options.dragDrop && dragAndDrop && !isReadOnly(cm) && !posEq(sel.from, sel.to) &&
            !posLess(start, sel.from) && !posLess(sel.to, start) && type == "single") {
            var dragEnd = operation(cm, function(e2) {
                if (webkit) display.scroller.draggable = false;
                cm.state.draggingText = false;
                off(document, "mouseup", dragEnd);
                off(display.scroller, "drop", dragEnd);
                if (Math.abs(e.clientX - e2.clientX) + Math.abs(e.clientY - e2.clientY) < 10) {
                    e_preventDefault(e2);
                    extendSelection(cm.doc, start);
                    focusInput(cm);
                }
            });
            // Let the drag handler handle this.
            if (webkit) display.scroller.draggable = true;
            cm.state.draggingText = dragEnd;
            // IE's approach to draggable
            if (display.scroller.dragDrop) display.scroller.dragDrop();
            on(document, "mouseup", dragEnd);
            on(display.scroller, "drop", dragEnd);
            return;
        }
        e_preventDefault(e);
        if (type == "single") extendSelection(cm.doc, clipPos(doc, start));

        var startstart = sel.from,
            startend = sel.to;

        function doSelect(cur) {
            if (type == "single") {
                extendSelection(cm.doc, clipPos(doc, start), cur);
                return;
            }

            startstart = clipPos(doc, startstart);
            startend = clipPos(doc, startend);
            if (type == "double") {
                var word = findWordAt(getLine(doc, cur.line).text, cur);
                if (posLess(cur, startstart)) extendSelection(cm.doc, word.from, startend);
                else extendSelection(cm.doc, startstart, word.to);
            } else if (type == "triple") {
                if (posLess(cur, startstart)) extendSelection(cm.doc, startend, clipPos(doc, Pos(cur.line, 0)));
                else extendSelection(cm.doc, startstart, clipPos(doc, Pos(cur.line + 1, 0)));
            }
        }

        var editorSize = getRect(display.wrapper);
        // Used to ensure timeout re-tries don't fire when another extend
        // happened in the meantime (clearTimeout isn't reliable -- at
        // least on Chrome, the timeouts still happen even when cleared,
        // if the clear happens after their scheduled firing time).
        var counter = 0;

        function extend(e) {
            var curCount = ++counter;
            var cur = posFromMouse(cm, e, true);
            if (!cur) return;
            if (!posEq(cur, last)) {
                if (!cm.state.focused) onFocus(cm);
                last = cur;
                doSelect(cur);
                var visible = visibleLines(display, doc);
                if (cur.line >= visible.to || cur.line < visible.from)
                    setTimeout(operation(cm, function() {
                        if (counter == curCount) extend(e);
                    }), 150);
            } else {
                var outside = e.clientY < editorSize.top ? -20 : e.clientY > editorSize.bottom ? 20 : 0;
                if (outside) setTimeout(operation(cm, function() {
                    if (counter != curCount) return;
                    display.scroller.scrollTop += outside;
                    extend(e);
                }), 50);
            }
        }

        function done(e) {
            counter = Infinity;
            var cur = posFromMouse(cm, e);
            if (cur) doSelect(cur);
            e_preventDefault(e);
            focusInput(cm);
            off(document, "mousemove", move);
            off(document, "mouseup", up);
        }

        var move = operation(cm, function(e) {
            if (!ie && !e_button(e)) done(e);
            else extend(e);
        });
        var up = operation(cm, done);
        on(document, "mousemove", move);
        on(document, "mouseup", up);
    }

    function onDrop(e) {
        var cm = this;
        if (eventInWidget(cm.display, e) || (cm.options.onDragEvent && cm.options.onDragEvent(cm, addStop(e))))
            return;
        e_preventDefault(e);
        var pos = posFromMouse(cm, e, true),
            files = e.dataTransfer.files;
        if (!pos || isReadOnly(cm)) return;
        if (files && files.length && window.FileReader && window.File) {
            var n = files.length,
                text = Array(n),
                read = 0;
            var loadFile = function(file, i) {
                var reader = new FileReader;
                reader.onload = function() {
                    text[i] = reader.result;
                    if (++read == n) {
                        pos = clipPos(cm.doc, pos);
                        replaceRange(cm.doc, text.join(""), pos, "around", "paste");
                    }
                };
                reader.readAsText(file);
            };
            for (var i = 0; i < n; ++i) loadFile(files[i], i);
        } else {
            // Don't do a replace if the drop happened inside of the selected text.
            if (cm.state.draggingText && !(posLess(pos, cm.doc.sel.from) || posLess(cm.doc.sel.to, pos))) {
                cm.state.draggingText(e);
                // Ensure the editor is re-focused
                setTimeout(bind(focusInput, cm), 20);
                return;
            }
            try {
                var text = e.dataTransfer.getData("Text");
                if (text) {
                    var curFrom = cm.doc.sel.from,
                        curTo = cm.doc.sel.to;
                    setSelection(cm.doc, pos, pos);
                    if (cm.state.draggingText) replaceRange(cm.doc, "", curFrom, curTo, "paste");
                    cm.replaceSelection(text, null, "paste");
                    focusInput(cm);
                    onFocus(cm);
                }
            } catch (e) {}
        }
    }

    function clickInGutter(cm, e) {
        var display = cm.display;
        try {
            var mX = e.clientX,
                mY = e.clientY;
        } catch (e) {
            return false;
        }

        if (mX >= Math.floor(getRect(display.gutters).right)) return false;
        e_preventDefault(e);
        if (!hasHandler(cm, "gutterClick")) return true;

        var lineBox = getRect(display.lineDiv);
        if (mY > lineBox.bottom) return true;
        mY -= lineBox.top - display.viewOffset;

        for (var i = 0; i < cm.options.gutters.length; ++i) {
            var g = display.gutters.childNodes[i];
            if (g && getRect(g).right >= mX) {
                var line = lineAtHeight(cm.doc, mY);
                var gutter = cm.options.gutters[i];
                signalLater(cm, "gutterClick", cm, line, gutter, e);
                break;
            }
        }
        return true;
    }

    function onDragStart(cm, e) {
        if (eventInWidget(cm.display, e)) return;

        var txt = cm.getSelection();
        e.dataTransfer.setData("Text", txt);

        // Use dummy image instead of default browsers image.
        // Recent Safari (~6.0.2) have a tendency to segfault when this happens, so we don't do it there.
        if (e.dataTransfer.setDragImage && !safari) {
            var img = elt("img", null, null, "position: fixed; left: 0; top: 0;");
            if (opera) {
                img.width = img.height = 1;
                cm.display.wrapper.appendChild(img);
                // Force a relayout, or Opera won't use our image for some obscure reason
                img._top = img.offsetTop;
            }
            e.dataTransfer.setDragImage(img, 0, 0);
            if (opera) img.parentNode.removeChild(img);
        }
    }

    function setScrollTop(cm, val) {
        if (Math.abs(cm.doc.scrollTop - val) < 2) return;
        cm.doc.scrollTop = val;
        if (!gecko) updateDisplay(cm, [], val);
        if (cm.display.scroller.scrollTop != val) cm.display.scroller.scrollTop = val;
        if (cm.display.scrollbarV.scrollTop != val) cm.display.scrollbarV.scrollTop = val;
        if (gecko) updateDisplay(cm, []);
    }

    function setScrollLeft(cm, val, isScroller) {
        if (isScroller ? val == cm.doc.scrollLeft : Math.abs(cm.doc.scrollLeft - val) < 2) return;
        val = Math.min(val, cm.display.scroller.scrollWidth - cm.display.scroller.clientWidth);
        cm.doc.scrollLeft = val;
        alignHorizontally(cm);
        if (cm.display.scroller.scrollLeft != val) cm.display.scroller.scrollLeft = val;
        if (cm.display.scrollbarH.scrollLeft != val) cm.display.scrollbarH.scrollLeft = val;
    }

    // Since the delta values reported on mouse wheel events are
    // unstandardized between browsers and even browser versions, and
    // generally horribly unpredictable, this code starts by measuring
    // the scroll effect that the first few mouse wheel events have,
    // and, from that, detects the way it can convert deltas to pixel
    // offsets afterwards.
    //
    // The reason we want to know the amount a wheel event will scroll
    // is that it gives us a chance to update the display before the
    // actual scrolling happens, reducing flickering.

    var wheelSamples = 0,
        wheelPixelsPerUnit = null;
    // Fill in a browser-detected starting value on browsers where we
    // know one. These don't have to be accurate -- the result of them
    // being wrong would just be a slight flicker on the first wheel
    // scroll (if it is large enough).
    if (ie) wheelPixelsPerUnit = -.53;
    else if (gecko) wheelPixelsPerUnit = 15;
    else if (chrome) wheelPixelsPerUnit = -.7;
    else if (safari) wheelPixelsPerUnit = -1 / 3;

    function onScrollWheel(cm, e) {
        var dx = e.wheelDeltaX,
            dy = e.wheelDeltaY;
        if (dx == null && e.detail && e.axis == e.HORIZONTAL_AXIS) dx = e.detail;
        if (dy == null && e.detail && e.axis == e.VERTICAL_AXIS) dy = e.detail;
        else if (dy == null) dy = e.wheelDelta;

        // Webkit browsers on OS X abort momentum scrolls when the target
        // of the scroll event is removed from the scrollable element.
        // This hack (see related code in patchDisplay) makes sure the
        // element is kept around.
        if (dy && mac && webkit) {
            for (var cur = e.target; cur != scroll; cur = cur.parentNode) {
                if (cur.lineObj) {
                    cm.display.currentWheelTarget = cur;
                    break;
                }
            }
        }

        var display = cm.display,
            scroll = display.scroller;
        // On some browsers, horizontal scrolling will cause redraws to
        // happen before the gutter has been realigned, causing it to
        // wriggle around in a most unseemly way. When we have an
        // estimated pixels/delta value, we just handle horizontal
        // scrolling entirely here. It'll be slightly off from native, but
        // better than glitching out.
        if (dx && !gecko && !opera && wheelPixelsPerUnit != null) {
            if (dy)
                setScrollTop(cm, Math.max(0, Math.min(scroll.scrollTop + dy * wheelPixelsPerUnit, scroll.scrollHeight - scroll.clientHeight)));
            setScrollLeft(cm, Math.max(0, Math.min(scroll.scrollLeft + dx * wheelPixelsPerUnit, scroll.scrollWidth - scroll.clientWidth)));
            e_preventDefault(e);
            display.wheelStartX = null; // Abort measurement, if in progress
            return;
        }

        if (dy && wheelPixelsPerUnit != null) {
            var pixels = dy * wheelPixelsPerUnit;
            var top = cm.doc.scrollTop,
                bot = top + display.wrapper.clientHeight;
            if (pixels < 0) top = Math.max(0, top + pixels - 50);
            else bot = Math.min(cm.doc.height, bot + pixels + 50);
            updateDisplay(cm, [], {
                top: top,
                bottom: bot
            });
        }

        if (wheelSamples < 20) {
            if (display.wheelStartX == null) {
                display.wheelStartX = scroll.scrollLeft;
                display.wheelStartY = scroll.scrollTop;
                display.wheelDX = dx;
                display.wheelDY = dy;
                setTimeout(function() {
                    if (display.wheelStartX == null) return;
                    var movedX = scroll.scrollLeft - display.wheelStartX;
                    var movedY = scroll.scrollTop - display.wheelStartY;
                    var sample = (movedY && display.wheelDY && movedY / display.wheelDY) ||
                        (movedX && display.wheelDX && movedX / display.wheelDX);
                    display.wheelStartX = display.wheelStartY = null;
                    if (!sample) return;
                    wheelPixelsPerUnit = (wheelPixelsPerUnit * wheelSamples + sample) / (wheelSamples + 1);
                    ++wheelSamples;
                }, 200);
            } else {
                display.wheelDX += dx;
                display.wheelDY += dy;
            }
        }
    }

    function doHandleBinding(cm, bound, dropShift) {
        if (typeof bound == "string") {
            bound = commands[bound];
            if (!bound) return false;
        }
        // Ensure previous input has been read, so that the handler sees a
        // consistent view of the document
        if (cm.display.pollingFast && readInput(cm)) cm.display.pollingFast = false;
        var doc = cm.doc,
            prevShift = doc.sel.shift,
            done = false;
        try {
            if (isReadOnly(cm)) cm.state.suppressEdits = true;
            if (dropShift) doc.sel.shift = false;
            done = bound(cm) != Pass;
        } finally {
            doc.sel.shift = prevShift;
            cm.state.suppressEdits = false;
        }
        return done;
    }

    function allKeyMaps(cm) {
        var maps = cm.state.keyMaps.slice(0);
        maps.push(cm.options.keyMap);
        if (cm.options.extraKeys) maps.unshift(cm.options.extraKeys);
        return maps;
    }

    var maybeTransition;

    function handleKeyBinding(cm, e) {
        // Handle auto keymap transitions
        var startMap = getKeyMap(cm.options.keyMap),
            next = startMap.auto;
        clearTimeout(maybeTransition);
        if (next && !isModifierKey(e)) maybeTransition = setTimeout(function() {
            if (getKeyMap(cm.options.keyMap) == startMap)
                cm.options.keyMap = (next.call ? next.call(null, cm) : next);
        }, 50);

        var name = keyName(e, true),
            handled = false;
        if (!name) return false;
        var keymaps = allKeyMaps(cm);

        if (e.shiftKey) {
            // First try to resolve full name (including 'Shift-'). Failing
            // that, see if there is a cursor-motion command (starting with
            // 'go') bound to the keyname without 'Shift-'.
            handled = lookupKey("Shift-" + name, keymaps, function(b) {
                return doHandleBinding(cm, b, true);
            }) || lookupKey(name, keymaps, function(b) {
                if (typeof b == "string" && /^go[A-Z]/.test(b)) return doHandleBinding(cm, b);
            });
        } else {
            handled = lookupKey(name, keymaps, function(b) {
                return doHandleBinding(cm, b);
            });
        }
        if (handled == "stop") handled = false;

        if (handled) {
            e_preventDefault(e);
            restartBlink(cm);
            if (ie_lt9) {
                e.oldKeyCode = e.keyCode;
                e.keyCode = 0;
            }
        }
        return handled;
    }

    function handleCharBinding(cm, e, ch) {
        var handled = lookupKey("'" + ch + "'", allKeyMaps(cm),
            function(b) {
                return doHandleBinding(cm, b, true);
            });
        if (handled) {
            e_preventDefault(e);
            restartBlink(cm);
        }
        return handled;
    }

    var lastStoppedKey = null;

    function onKeyDown(e) {
        var cm = this;
        if (!cm.state.focused) onFocus(cm);
        if (ie && e.keyCode == 27) {
            e.returnValue = false;
        }
        if (cm.options.onKeyEvent && cm.options.onKeyEvent(cm, addStop(e))) return;
        var code = e.keyCode;
        // IE does strange things with escape.
        cm.doc.sel.shift = code == 16 || e.shiftKey;
        // First give onKeyEvent option a chance to handle this.
        var handled = handleKeyBinding(cm, e);
        if (opera) {
            lastStoppedKey = handled ? code : null;
            // Opera has no cut event... we try to at least catch the key combo
            if (!handled && code == 88 && !hasCopyEvent && (mac ? e.metaKey : e.ctrlKey))
                cm.replaceSelection("");
        }
    }

    function onKeyPress(e) {
        var cm = this;
        if (cm.options.onKeyEvent && cm.options.onKeyEvent(cm, addStop(e))) return;
        var keyCode = e.keyCode,
            charCode = e.charCode;
        if (opera && keyCode == lastStoppedKey) {
            lastStoppedKey = null;
            e_preventDefault(e);
            return;
        }
        if (((opera && (!e.which || e.which < 10)) || khtml) && handleKeyBinding(cm, e)) return;
        var ch = String.fromCharCode(charCode == null ? keyCode : charCode);
        if (this.options.electricChars && this.doc.mode.electricChars &&
            this.options.smartIndent && !isReadOnly(this) &&
            this.doc.mode.electricChars.indexOf(ch) > -1)
            setTimeout(operation(cm, function() {
                indentLine(cm, cm.doc.sel.to.line, "smart");
            }), 75);
        if (handleCharBinding(cm, e, ch)) return;
        fastPoll(cm);
    }

    function onFocus(cm) {
        if (cm.options.readOnly == "nocursor") return;
        if (!cm.state.focused) {
            signal(cm, "focus", cm);
            cm.state.focused = true;
            if (cm.display.wrapper.className.search(/\bCodeMirror-focused\b/) == -1)
                cm.display.wrapper.className += " CodeMirror-focused";
            resetInput(cm, true);
        }
        slowPoll(cm);
        restartBlink(cm);
    }

    function onBlur(cm) {
        if (cm.state.focused) {
            signal(cm, "blur", cm);
            cm.state.focused = false;
            cm.display.wrapper.className = cm.display.wrapper.className.replace(" CodeMirror-focused", "");
        }
        clearInterval(cm.display.blinker);
        setTimeout(function() {
            if (!cm.state.focused) cm.doc.sel.shift = false;
        }, 150);
    }

    var detectingSelectAll;

    function onContextMenu(cm, e) {
        var display = cm.display,
            sel = cm.doc.sel;
        if (eventInWidget(display, e)) return;

        var pos = posFromMouse(cm, e),
            scrollPos = display.scroller.scrollTop;
        if (!pos || opera) return; // Opera is difficult.
        if (posEq(sel.from, sel.to) || posLess(pos, sel.from) || !posLess(pos, sel.to))
            operation(cm, setSelection)(cm.doc, pos, pos);

        var oldCSS = display.input.style.cssText;
        display.inputDiv.style.position = "absolute";
        display.input.style.cssText = "position: fixed; width: 30px; height: 30px; top: " + (e.clientY - 5) +
            "px; left: " + (e.clientX - 5) + "px; z-index: 1000; background: white; outline: none;" +
            "border-width: 0; outline: none; overflow: hidden; opacity: .05; -ms-opacity: .05; filter: alpha(opacity=5);";
        focusInput(cm);
        resetInput(cm, true);
        // Adds "Select all" to context menu in FF
        if (posEq(sel.from, sel.to)) display.input.value = display.prevInput = " ";

        function rehide() {
            display.inputDiv.style.position = "relative";
            display.input.style.cssText = oldCSS;
            if (ie_lt9) display.scrollbarV.scrollTop = display.scroller.scrollTop = scrollPos;
            slowPoll(cm);

            // Try to detect the user choosing select-all 
            if (display.input.selectionStart != null && (!ie || ie_lt9)) {
                clearTimeout(detectingSelectAll);
                var extval = display.input.value = " " + (posEq(sel.from, sel.to) ? "" : display.input.value),
                    i = 0;
                display.prevInput = " ";
                display.input.selectionStart = 1;
                display.input.selectionEnd = extval.length;
                var poll = function() {
                    if (display.prevInput == " " && display.input.selectionStart == 0)
                        operation(cm, commands.selectAll)(cm);
                    else if (i++ < 10) detectingSelectAll = setTimeout(poll, 500);
                    else resetInput(cm);
                };
                detectingSelectAll = setTimeout(poll, 200);
            }
        }

        if (captureMiddleClick) {
            e_stop(e);
            var mouseup = function() {
                off(window, "mouseup", mouseup);
                setTimeout(rehide, 20);
            };
            on(window, "mouseup", mouseup);
        } else {
            setTimeout(rehide, 50);
        }
    }

    // UPDATING

    function changeEnd(change) {
        return Pos(change.from.line + change.text.length - 1,
            lst(change.text).length + (change.text.length == 1 ? change.from.ch : 0));
    }

    // Make sure a position will be valid after the given change.
    function clipPostChange(doc, change, pos) {
        if (!posLess(change.from, pos)) return clipPos(doc, pos);
        var diff = (change.text.length - 1) - (change.to.line - change.from.line);
        if (pos.line > change.to.line + diff) {
            var preLine = pos.line - diff,
                lastLine = doc.first + doc.size - 1;
            if (preLine > lastLine) return Pos(lastLine, getLine(doc, lastLine).text.length);
            return clipToLen(pos, getLine(doc, preLine).text.length);
        }
        if (pos.line == change.to.line + diff)
            return clipToLen(pos, lst(change.text).length + (change.text.length == 1 ? change.from.ch : 0) +
                getLine(doc, change.to.line).text.length - change.to.ch);
        var inside = pos.line - change.from.line;
        return clipToLen(pos, change.text[inside].length + (inside ? 0 : change.from.ch));
    }

    // Hint can be null|"end"|"start"|"around"|{anchor,head}
    function computeSelAfterChange(doc, change, hint) {
        if (hint && typeof hint == "object") // Assumed to be {anchor, head} object
            return {
            anchor: clipPostChange(doc, change, hint.anchor),
            head: clipPostChange(doc, change, hint.head)
        };

        if (hint == "start") return {
            anchor: change.from,
            head: change.from
        };

        var end = changeEnd(change);
        if (hint == "around") return {
            anchor: change.from,
            head: end
        };
        if (hint == "end") return {
            anchor: end,
            head: end
        };

        // hint is null, leave the selection alone as much as possible
        var adjustPos = function(pos) {
            if (posLess(pos, change.from)) return pos;
            if (!posLess(change.to, pos)) return end;

            var line = pos.line + change.text.length - (change.to.line - change.from.line) - 1,
                ch = pos.ch;
            if (pos.line == change.to.line) ch += end.ch - change.to.ch;
            return Pos(line, ch);
        };
        return {
            anchor: adjustPos(doc.sel.anchor),
            head: adjustPos(doc.sel.head)
        };
    }

    function filterChange(doc, change) {
        var obj = {
            canceled: false,
            from: change.from,
            to: change.to,
            text: change.text,
            origin: change.origin,
            update: function(from, to, text, origin) {
                if (from) this.from = clipPos(doc, from);
                if (to) this.to = clipPos(doc, to);
                if (text) this.text = text;
                if (origin !== undefined) this.origin = origin;
            },
            cancel: function() {
                this.canceled = true;
            }
        };
        signal(doc, "beforeChange", doc, obj);
        if (doc.cm) signal(doc.cm, "beforeChange", doc.cm, obj);

        if (obj.canceled) return null;
        return {
            from: obj.from,
            to: obj.to,
            text: obj.text,
            origin: obj.origin
        };
    }

    // Replace the range from from to to by the strings in replacement.
    // change is a {from, to, text [, origin]} object
    function makeChange(doc, change, selUpdate, ignoreReadOnly) {
        if (doc.cm) {
            if (!doc.cm.curOp) return operation(doc.cm, makeChange)(doc, change, selUpdate, ignoreReadOnly);
            if (doc.cm.state.suppressEdits) return;
        }

        if (hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange")) {
            change = filterChange(doc, change);
            if (!change) return;
        }

        // Possibly split or suppress the update based on the presence
        // of read-only spans in its range.
        var split = sawReadOnlySpans && !ignoreReadOnly && removeReadOnlyRanges(doc, change.from, change.to);
        if (split) {
            for (var i = split.length - 1; i >= 1; --i)
                makeChangeNoReadonly(doc, {
                    from: split[i].from,
                    to: split[i].to,
                    text: [""]
                });
            if (split.length)
                makeChangeNoReadonly(doc, {
                    from: split[0].from,
                    to: split[0].to,
                    text: change.text
                }, selUpdate);
        } else {
            makeChangeNoReadonly(doc, change, selUpdate);
        }
    }

    function makeChangeNoReadonly(doc, change, selUpdate) {
        var selAfter = computeSelAfterChange(doc, change, selUpdate);
        addToHistory(doc, change, selAfter, doc.cm ? doc.cm.curOp.id : NaN);

        makeChangeSingleDoc(doc, change, selAfter, stretchSpansOverChange(doc, change));
        var rebased = [];

        linkedDocs(doc, function(doc, sharedHist) {
            if (!sharedHist && indexOf(rebased, doc.history) == -1) {
                rebaseHist(doc.history, change);
                rebased.push(doc.history);
            }
            makeChangeSingleDoc(doc, change, null, stretchSpansOverChange(doc, change));
        });
    }

    function makeChangeFromHistory(doc, type) {
        var hist = doc.history;
        var event = (type == "undo" ? hist.done : hist.undone).pop();
        if (!event) return;
        hist.dirtyCounter += type == "undo" ? -1 : 1;

        var anti = {
            changes: [],
            anchorBefore: event.anchorAfter,
            headBefore: event.headAfter,
            anchorAfter: event.anchorBefore,
            headAfter: event.headBefore
        };
        (type == "undo" ? hist.undone : hist.done).push(anti);

        for (var i = event.changes.length - 1; i >= 0; --i) {
            var change = event.changes[i];
            change.origin = type;
            anti.changes.push(historyChangeFromChange(doc, change));

            var after = i ? computeSelAfterChange(doc, change, null) : {
                anchor: event.anchorBefore,
                head: event.headBefore
            };
            makeChangeSingleDoc(doc, change, after, mergeOldSpans(doc, change));
            var rebased = [];

            linkedDocs(doc, function(doc, sharedHist) {
                if (!sharedHist && indexOf(rebased, doc.history) == -1) {
                    rebaseHist(doc.history, change);
                    rebased.push(doc.history);
                }
                makeChangeSingleDoc(doc, change, null, mergeOldSpans(doc, change));
            });
        }
    }

    function shiftDoc(doc, distance) {
        function shiftPos(pos) {
            return Pos(pos.line + distance, pos.ch);
        }
        doc.first += distance;
        if (doc.cm) regChange(doc.cm, doc.first, doc.first, distance);
        doc.sel.head = shiftPos(doc.sel.head);
        doc.sel.anchor = shiftPos(doc.sel.anchor);
        doc.sel.from = shiftPos(doc.sel.from);
        doc.sel.to = shiftPos(doc.sel.to);
    }

    function makeChangeSingleDoc(doc, change, selAfter, spans) {
        if (doc.cm && !doc.cm.curOp)
            return operation(doc.cm, makeChangeSingleDoc)(doc, change, selAfter, spans);

        if (change.to.line < doc.first) {
            shiftDoc(doc, change.text.length - 1 - (change.to.line - change.from.line));
            return;
        }
        if (change.from.line > doc.lastLine()) return;

        // Clip the change to the size of this doc
        if (change.from.line < doc.first) {
            var shift = change.text.length - 1 - (doc.first - change.from.line);
            shiftDoc(doc, shift);
            change = {
                from: Pos(doc.first, 0),
                to: Pos(change.to.line + shift, change.to.ch),
                text: [lst(change.text)],
                origin: change.origin
            };
        }
        var last = doc.lastLine();
        if (change.to.line > last) {
            change = {
                from: change.from,
                to: Pos(last, getLine(doc, last).text.length),
                text: [change.text[0]],
                origin: change.origin
            };
        }

        if (!selAfter) selAfter = computeSelAfterChange(doc, change, null);
        if (doc.cm) makeChangeSingleDocInEditor(doc.cm, change, spans, selAfter);
        else updateDoc(doc, change, spans, selAfter);
    }

    function makeChangeSingleDocInEditor(cm, change, spans, selAfter) {
        var doc = cm.doc,
            display = cm.display,
            from = change.from,
            to = change.to;

        var recomputeMaxLength = false,
            checkWidthStart = from.line;
        if (!cm.options.lineWrapping) {
            checkWidthStart = lineNo(visualLine(doc, getLine(doc, from.line)));
            doc.iter(checkWidthStart, to.line + 1, function(line) {
                if (line == display.maxLine) {
                    recomputeMaxLength = true;
                    return true;
                }
            });
        }

        updateDoc(doc, change, spans, selAfter, estimateHeight(cm));

        if (!cm.options.lineWrapping) {
            doc.iter(checkWidthStart, from.line + change.text.length, function(line) {
                var len = lineLength(doc, line);
                if (len > display.maxLineLength) {
                    display.maxLine = line;
                    display.maxLineLength = len;
                    display.maxLineChanged = true;
                    recomputeMaxLength = false;
                }
            });
            if (recomputeMaxLength) cm.curOp.updateMaxLine = true;
        }

        // Adjust frontier, schedule worker
        doc.frontier = Math.min(doc.frontier, from.line);
        startWorker(cm, 400);

        var lendiff = change.text.length - (to.line - from.line) - 1;
        // Remember that these lines changed, for updating the display
        regChange(cm, from.line, to.line + 1, lendiff);
        if (hasHandler(cm, "change")) {
            var changeObj = {
                from: from,
                to: to,
                text: change.text,
                origin: change.origin
            };
            if (cm.curOp.textChanged) {
                for (var cur = cm.curOp.textChanged; cur.next; cur = cur.next) {}
                cur.next = changeObj;
            } else cm.curOp.textChanged = changeObj;
        }
    }

    function replaceRange(doc, code, from, to, origin) {
        if (!to) to = from;
        if (posLess(to, from)) {
            var tmp = to;
            to = from;
            from = tmp;
        }
        if (typeof code == "string") code = splitLines(code);
        makeChange(doc, {
            from: from,
            to: to,
            text: code,
            origin: origin
        }, null);
    }

    // POSITION OBJECT

    function Pos(line, ch) {
        if (!(this instanceof Pos)) return new Pos(line, ch);
        this.line = line;
        this.ch = ch;
    }
    CodeMirror.Pos = Pos;

    function posEq(a, b) {
        return a.line == b.line && a.ch == b.ch;
    }

    function posLess(a, b) {
        return a.line < b.line || (a.line == b.line && a.ch < b.ch);
    }

    function copyPos(x) {
        return Pos(x.line, x.ch);
    }

    // SELECTION

    function clipLine(doc, n) {
        return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1));
    }

    function clipPos(doc, pos) {
        if (pos.line < doc.first) return Pos(doc.first, 0);
        var last = doc.first + doc.size - 1;
        if (pos.line > last) return Pos(last, getLine(doc, last).text.length);
        return clipToLen(pos, getLine(doc, pos.line).text.length);
    }

    function clipToLen(pos, linelen) {
        var ch = pos.ch;
        if (ch == null || ch > linelen) return Pos(pos.line, linelen);
        else if (ch < 0) return Pos(pos.line, 0);
        else return pos;
    }

    function isLine(doc, l) {
        return l >= doc.first && l < doc.first + doc.size;
    }

    // If shift is held, this will move the selection anchor. Otherwise,
    // it'll set the whole selection.
    function extendSelection(doc, pos, other, bias) {
        if (doc.sel.shift || doc.sel.extend) {
            var anchor = doc.sel.anchor;
            if (other) {
                var posBefore = posLess(pos, anchor);
                if (posBefore != posLess(other, anchor)) {
                    anchor = pos;
                    pos = other;
                } else if (posBefore != posLess(pos, other)) {
                    pos = other;
                }
            }
            setSelection(doc, anchor, pos, bias);
        } else {
            setSelection(doc, pos, other || pos, bias);
        }
        if (doc.cm) doc.cm.curOp.userSelChange = true;
    }

    function filterSelectionChange(doc, anchor, head) {
        var obj = {
            anchor: anchor,
            head: head
        };
        signal(doc, "beforeSelectionChange", doc, obj);
        if (doc.cm) signal(doc.cm, "beforeSelectionChange", doc.cm, obj);
        obj.anchor = clipPos(doc, obj.anchor);
        obj.head = clipPos(doc, obj.head);
        return obj;
    }

    // Update the selection. Last two args are only used by
    // updateDoc, since they have to be expressed in the line
    // numbers before the update.
    function setSelection(doc, anchor, head, bias, checkAtomic) {
        if (!checkAtomic && hasHandler(doc, "beforeSelectionChange") || doc.cm && hasHandler(doc.cm, "beforeSelectionChange")) {
            var filtered = filterSelectionChange(doc, anchor, head);
            head = filtered.head;
            anchor = filtered.anchor;
        }

        var sel = doc.sel;
        sel.goalColumn = null;
        // Skip over atomic spans.
        if (checkAtomic || !posEq(anchor, sel.anchor))
            anchor = skipAtomic(doc, anchor, bias, checkAtomic != "push");
        if (checkAtomic || !posEq(head, sel.head))
            head = skipAtomic(doc, head, bias, checkAtomic != "push");

        if (posEq(sel.anchor, anchor) && posEq(sel.head, head)) return;

        sel.anchor = anchor;
        sel.head = head;
        var inv = posLess(head, anchor);
        sel.from = inv ? head : anchor;
        sel.to = inv ? anchor : head;

        if (doc.cm)
            doc.cm.curOp.updateInput = doc.cm.curOp.selectionChanged = true;

        signalLater(doc, "cursorActivity", doc);
    }

    function reCheckSelection(cm) {
        setSelection(cm.doc, cm.doc.sel.from, cm.doc.sel.to, null, "push");
    }

    function skipAtomic(doc, pos, bias, mayClear) {
        var flipped = false,
            curPos = pos;
        var dir = bias || 1;
        doc.cantEdit = false;
        search: for (;;) {
            var line = getLine(doc, curPos.line),
                toClear;
            if (line.markedSpans) {
                for (var i = 0; i < line.markedSpans.length; ++i) {
                    var sp = line.markedSpans[i],
                        m = sp.marker;
                    if ((sp.from == null || (m.inclusiveLeft ? sp.from <= curPos.ch : sp.from < curPos.ch)) &&
                        (sp.to == null || (m.inclusiveRight ? sp.to >= curPos.ch : sp.to > curPos.ch))) {
                        if (mayClear && m.clearOnEnter) {
                            (toClear || (toClear = [])).push(m);
                            continue;
                        } else if (!m.atomic) continue;
                        var newPos = m.find()[dir < 0 ? "from" : "to"];
                        if (posEq(newPos, curPos)) {
                            newPos.ch += dir;
                            if (newPos.ch < 0) {
                                if (newPos.line > doc.first) newPos = clipPos(doc, Pos(newPos.line - 1));
                                else newPos = null;
                            } else if (newPos.ch > line.text.length) {
                                if (newPos.line < doc.first + doc.size - 1) newPos = Pos(newPos.line + 1, 0);
                                else newPos = null;
                            }
                            if (!newPos) {
                                if (flipped) {
                                    // Driven in a corner -- no valid cursor position found at all
                                    // -- try again *with* clearing, if we didn't already
                                    if (!mayClear) return skipAtomic(doc, pos, bias, true);
                                    // Otherwise, turn off editing until further notice, and return the start of the doc
                                    doc.cantEdit = true;
                                    return Pos(doc.first, 0);
                                }
                                flipped = true;
                                newPos = pos;
                                dir = -dir;
                            }
                        }
                        curPos = newPos;
                        continue search;
                    }
                }
                if (toClear)
                    for (var i = 0; i < toClear.length; ++i) toClear[i].clear();
            }
            return curPos;
        }
    }

    // SCROLLING

    function scrollCursorIntoView(cm) {
        var coords = scrollPosIntoView(cm, cm.doc.sel.head);
        if (!cm.state.focused) return;
        var display = cm.display,
            box = getRect(display.sizer),
            doScroll = null;
        if (coords.top + box.top < 0) doScroll = true;
        else if (coords.bottom + box.top > (window.innerHeight || document.documentElement.clientHeight)) doScroll = false;
        if (doScroll != null && !phantom) {
            var hidden = display.cursor.style.display == "none";
            if (hidden) {
                display.cursor.style.display = "";
                display.cursor.style.left = coords.left + "px";
                display.cursor.style.top = (coords.top - display.viewOffset) + "px";
            }
            display.cursor.scrollIntoView(doScroll);
            if (hidden) display.cursor.style.display = "none";
        }
    }

    function scrollPosIntoView(cm, pos) {
        for (;;) {
            var changed = false,
                coords = cursorCoords(cm, pos);
            var scrollPos = calculateScrollPos(cm, coords.left, coords.top, coords.left, coords.bottom);
            var startTop = cm.doc.scrollTop,
                startLeft = cm.doc.scrollLeft;
            if (scrollPos.scrollTop != null) {
                setScrollTop(cm, scrollPos.scrollTop);
                if (Math.abs(cm.doc.scrollTop - startTop) > 1) changed = true;
            }
            if (scrollPos.scrollLeft != null) {
                setScrollLeft(cm, scrollPos.scrollLeft);
                if (Math.abs(cm.doc.scrollLeft - startLeft) > 1) changed = true;
            }
            if (!changed) return coords;
        }
    }

    function scrollIntoView(cm, x1, y1, x2, y2) {
        var scrollPos = calculateScrollPos(cm, x1, y1, x2, y2);
        if (scrollPos.scrollTop != null) setScrollTop(cm, scrollPos.scrollTop);
        if (scrollPos.scrollLeft != null) setScrollLeft(cm, scrollPos.scrollLeft);
    }

    function calculateScrollPos(cm, x1, y1, x2, y2) {
        var display = cm.display,
            pt = paddingTop(display);
        y1 += pt;
        y2 += pt;
        var screen = display.scroller.clientHeight - scrollerCutOff,
            screentop = display.scroller.scrollTop,
            result = {};
        var docBottom = cm.doc.height + 2 * pt;
        var atTop = y1 < pt + 10,
            atBottom = y2 + pt > docBottom - 10;
        if (y1 < screentop) result.scrollTop = atTop ? 0 : Math.max(0, y1);
        else if (y2 > screentop + screen) result.scrollTop = (atBottom ? docBottom : y2) - screen;

        var screenw = display.scroller.clientWidth - scrollerCutOff,
            screenleft = display.scroller.scrollLeft;
        x1 += display.gutters.offsetWidth;
        x2 += display.gutters.offsetWidth;
        var gutterw = display.gutters.offsetWidth;
        var atLeft = x1 < gutterw + 10;
        if (x1 < screenleft + gutterw || atLeft) {
            if (atLeft) x1 = 0;
            result.scrollLeft = Math.max(0, x1 - 10 - gutterw);
        } else if (x2 > screenw + screenleft - 3) {
            result.scrollLeft = x2 + 10 - screenw;
        }
        return result;
    }

    // API UTILITIES

    function indentLine(cm, n, how, aggressive) {
        var doc = cm.doc;
        if (!how) how = "add";
        if (how == "smart") {
            if (!cm.doc.mode.indent) how = "prev";
            else var state = getStateBefore(cm, n);
        }

        var tabSize = cm.options.tabSize;
        var line = getLine(doc, n),
            curSpace = countColumn(line.text, null, tabSize);
        var curSpaceString = line.text.match(/^\s*/)[0],
            indentation;
        if (how == "smart") {
            indentation = cm.doc.mode.indent(state, line.text.slice(curSpaceString.length), line.text);
            if (indentation == Pass) {
                if (!aggressive) return;
                how = "prev";
            }
        }
        if (how == "prev") {
            if (n > doc.first) indentation = countColumn(getLine(doc, n - 1).text, null, tabSize);
            else indentation = 0;
        } else if (how == "add") {
            indentation = curSpace + cm.options.indentUnit;
        } else if (how == "subtract") {
            indentation = curSpace - cm.options.indentUnit;
        }
        indentation = Math.max(0, indentation);

        var indentString = "",
            pos = 0;
        if (cm.options.indentWithTabs)
            for (var i = Math.floor(indentation / tabSize); i; --i) {
                pos += tabSize;
                indentString += "\t";
            }
        if (pos < indentation) indentString += spaceStr(indentation - pos);

        if (indentString != curSpaceString)
            replaceRange(cm.doc, indentString, Pos(n, 0), Pos(n, curSpaceString.length), "+input");
        line.stateAfter = null;
    }

    function changeLine(cm, handle, op) {
        var no = handle,
            line = handle,
            doc = cm.doc;
        if (typeof handle == "number") line = getLine(doc, clipLine(doc, handle));
        else no = lineNo(handle);
        if (no == null) return null;
        if (op(line, no)) regChange(cm, no, no + 1);
        else return null;
        return line;
    }

    function findPosH(doc, pos, dir, unit, visually) {
        var line = pos.line,
            ch = pos.ch;
        var lineObj = getLine(doc, line);
        var possible = true;

        function findNextLine() {
            var l = line + dir;
            if (l < doc.first || l >= doc.first + doc.size) return (possible = false);
            line = l;
            return lineObj = getLine(doc, l);
        }

        function moveOnce(boundToLine) {
            var next = (visually ? moveVisually : moveLogically)(lineObj, ch, dir, true);
            if (next == null) {
                if (!boundToLine && findNextLine()) {
                    if (visually) ch = (dir < 0 ? lineRight : lineLeft)(lineObj);
                    else ch = dir < 0 ? lineObj.text.length : 0;
                } else return (possible = false);
            } else ch = next;
            return true;
        }

        if (unit == "char") moveOnce();
        else if (unit == "column") moveOnce(true);
        else if (unit == "word") {
            var sawWord = false;
            for (;;) {
                if (dir < 0)
                    if (!moveOnce()) break;
                if (isWordChar(lineObj.text.charAt(ch))) sawWord = true;
                else if (sawWord) {
                    if (dir < 0) {
                        dir = 1;
                        moveOnce();
                    }
                    break;
                }
                if (dir > 0)
                    if (!moveOnce()) break;
            }
        }
        var result = skipAtomic(doc, Pos(line, ch), dir, true);
        if (!possible) result.hitSide = true;
        return result;
    }

    function findPosV(cm, pos, dir, unit) {
        var doc = cm.doc,
            x = pos.left,
            y;
        if (unit == "page") {
            var pageSize = Math.min(cm.display.wrapper.clientHeight, window.innerHeight || document.documentElement.clientHeight);
            y = pos.top + dir * pageSize;
        } else if (unit == "line") {
            y = dir > 0 ? pos.bottom + 3 : pos.top - 3;
        }
        for (;;) {
            var target = coordsChar(cm, x, y);
            if (!target.outside) break;
            if (dir < 0 ? y <= 0 : y >= doc.height) {
                target.hitSide = true;
                break;
            }
            y += dir * 5;
        }
        return target;
    }

    function findWordAt(line, pos) {
        var start = pos.ch,
            end = pos.ch;
        if (line) {
            if (pos.after === false || end == line.length) --start;
            else ++end;
            var startChar = line.charAt(start);
            var check = isWordChar(startChar) ? isWordChar :
                /\s/.test(startChar) ? function(ch) {
                    return /\s/.test(ch);
                } :
                function(ch) {
                    return !/\s/.test(ch) && !isWordChar(ch);
                };
            while (start > 0 && check(line.charAt(start - 1))) --start;
            while (end < line.length && check(line.charAt(end))) ++end;
        }
        return {
            from: Pos(pos.line, start),
            to: Pos(pos.line, end)
        };
    }

    function selectLine(cm, line) {
        extendSelection(cm.doc, Pos(line, 0), clipPos(cm.doc, Pos(line + 1, 0)));
    }

    // PROTOTYPE

    // The publicly visible API. Note that operation(null, f) means
    // 'wrap f in an operation, performed on its `this` parameter'

    CodeMirror.prototype = {
        focus: function() {
            window.focus();
            focusInput(this);
            onFocus(this);
            fastPoll(this);
        },

        setOption: function(option, value) {
            var options = this.options,
                old = options[option];
            if (options[option] == value && option != "mode") return;
            options[option] = value;
            if (optionHandlers.hasOwnProperty(option))
                operation(this, optionHandlers[option])(this, value, old);
        },

        getOption: function(option) {
            return this.options[option];
        },
        getDoc: function() {
            return this.doc;
        },

        addKeyMap: function(map) {
            this.state.keyMaps.push(map);
        },
        removeKeyMap: function(map) {
            var maps = this.state.keyMaps;
            for (var i = 0; i < maps.length; ++i)
                if ((typeof map == "string" ? maps[i].name : maps[i]) == map) {
                    maps.splice(i, 1);
                    return true;
                }
        },

        addOverlay: operation(null, function(spec, options) {
            var mode = spec.token ? spec : CodeMirror.getMode(this.options, spec);
            if (mode.startState) throw new Error("Overlays may not be stateful.");
            this.state.overlays.push({
                mode: mode,
                modeSpec: spec,
                opaque: options && options.opaque
            });
            this.state.modeGen++;
            regChange(this);
        }),
        removeOverlay: operation(null, function(spec) {
            var overlays = this.state.overlays;
            for (var i = 0; i < overlays.length; ++i) {
                if (overlays[i].modeSpec == spec) {
                    overlays.splice(i, 1);
                    this.state.modeGen++;
                    regChange(this);
                    return;
                }
            }
        }),

        indentLine: operation(null, function(n, dir, aggressive) {
            if (typeof dir != "string") {
                if (dir == null) dir = this.options.smartIndent ? "smart" : "prev";
                else dir = dir ? "add" : "subtract";
            }
            if (isLine(this.doc, n)) indentLine(this, n, dir, aggressive);
        }),
        indentSelection: operation(null, function(how) {
            var sel = this.doc.sel;
            if (posEq(sel.from, sel.to)) return indentLine(this, sel.from.line, how);
            var e = sel.to.line - (sel.to.ch ? 0 : 1);
            for (var i = sel.from.line; i <= e; ++i) indentLine(this, i, how);
        }),

        // Fetch the parser token for a given character. Useful for hacks
        // that want to inspect the mode state (say, for completion).
        getTokenAt: function(pos) {
            var doc = this.doc;
            pos = clipPos(doc, pos);
            var state = getStateBefore(this, pos.line),
                mode = this.doc.mode;
            var line = getLine(doc, pos.line);
            var stream = new StringStream(line.text, this.options.tabSize);
            while (stream.pos < pos.ch && !stream.eol()) {
                stream.start = stream.pos;
                var style = mode.token(stream, state);
            }
            return {
                start: stream.start,
                end: stream.pos,
                string: stream.current(),
                className: style || null, // Deprecated, use 'type' instead
                type: style || null,
                state: state
            };
        },

        getStateAfter: function(line) {
            var doc = this.doc;
            line = clipLine(doc, line == null ? doc.first + doc.size - 1 : line);
            return getStateBefore(this, line + 1);
        },

        cursorCoords: function(start, mode) {
            var pos, sel = this.doc.sel;
            if (start == null) pos = sel.head;
            else if (typeof start == "object") pos = clipPos(this.doc, start);
            else pos = start ? sel.from : sel.to;
            return cursorCoords(this, pos, mode || "page");
        },

        charCoords: function(pos, mode) {
            return charCoords(this, clipPos(this.doc, pos), mode || "page");
        },

        coordsChar: function(coords) {
            var off = getRect(this.display.lineSpace);
            var scrollY = window.pageYOffset || (document.documentElement || document.body).scrollTop;
            var scrollX = window.pageXOffset || (document.documentElement || document.body).scrollLeft;
            return coordsChar(this, coords.left - off.left - scrollX, coords.top - off.top - scrollY);
        },

        defaultTextHeight: function() {
            return textHeight(this.display);
        },

        setGutterMarker: operation(null, function(line, gutterID, value) {
            return changeLine(this, line, function(line) {
                var markers = line.gutterMarkers || (line.gutterMarkers = {});
                markers[gutterID] = value;
                if (!value && isEmpty(markers)) line.gutterMarkers = null;
                return true;
            });
        }),

        clearGutter: operation(null, function(gutterID) {
            var cm = this,
                doc = cm.doc,
                i = doc.first;
            doc.iter(function(line) {
                if (line.gutterMarkers && line.gutterMarkers[gutterID]) {
                    line.gutterMarkers[gutterID] = null;
                    regChange(cm, i, i + 1);
                    if (isEmpty(line.gutterMarkers)) line.gutterMarkers = null;
                }
                ++i;
            });
        }),

        addLineClass: operation(null, function(handle, where, cls) {
            return changeLine(this, handle, function(line) {
                var prop = where == "text" ? "textClass" : where == "background" ? "bgClass" : "wrapClass";
                if (!line[prop]) line[prop] = cls;
                else if (new RegExp("\\b" + cls + "\\b").test(line[prop])) return false;
                else line[prop] += " " + cls;
                return true;
            });
        }),

        removeLineClass: operation(null, function(handle, where, cls) {
            return changeLine(this, handle, function(line) {
                var prop = where == "text" ? "textClass" : where == "background" ? "bgClass" : "wrapClass";
                var cur = line[prop];
                if (!cur) return false;
                else if (cls == null) line[prop] = null;
                else {
                    var upd = cur.replace(new RegExp("^" + cls + "\\b\\s*|\\s*\\b" + cls + "\\b"), "");
                    if (upd == cur) return false;
                    line[prop] = upd || null;
                }
                return true;
            });
        }),

        addLineWidget: operation(null, function(handle, node, options) {
            return addLineWidget(this, handle, node, options);
        }),

        removeLineWidget: function(widget) {
            widget.clear();
        },

        lineInfo: function(line) {
            if (typeof line == "number") {
                if (!isLine(this.doc, line)) return null;
                var n = line;
                line = getLine(this.doc, line);
                if (!line) return null;
            } else {
                var n = lineNo(line);
                if (n == null) return null;
            }
            return {
                line: n,
                handle: line,
                text: line.text,
                gutterMarkers: line.gutterMarkers,
                textClass: line.textClass,
                bgClass: line.bgClass,
                wrapClass: line.wrapClass,
                widgets: line.widgets
            };
        },

        getViewport: function() {
            return {
                from: this.display.showingFrom,
                to: this.display.showingTo
            };
        },

        addWidget: function(pos, node, scroll, vert, horiz) {
            var display = this.display;
            pos = cursorCoords(this, clipPos(this.doc, pos));
            var top = pos.bottom,
                left = pos.left;
            node.style.position = "absolute";
            display.sizer.appendChild(node);
            if (vert == "over") {
                top = pos.top;
            } else if (vert == "above" || vert == "near") {
                var vspace = Math.max(display.wrapper.clientHeight, this.doc.height),
                    hspace = Math.max(display.sizer.clientWidth, display.lineSpace.clientWidth);
                // Default to positioning above (if specified and possible); otherwise default to positioning below
                if ((vert == 'above' || pos.bottom + node.offsetHeight > vspace) && pos.top > node.offsetHeight)
                    top = pos.top - node.offsetHeight;
                else if (pos.bottom + node.offsetHeight <= vspace)
                    top = pos.bottom;
                if (left + node.offsetWidth > hspace)
                    left = hspace - node.offsetWidth;
            }
            node.style.top = (top + paddingTop(display)) + "px";
            node.style.left = node.style.right = "";
            if (horiz == "right") {
                left = display.sizer.clientWidth - node.offsetWidth;
                node.style.right = "0px";
            } else {
                if (horiz == "left") left = 0;
                else if (horiz == "middle") left = (display.sizer.clientWidth - node.offsetWidth) / 2;
                node.style.left = left + "px";
            }
            if (scroll)
                scrollIntoView(this, left, top, left + node.offsetWidth, top + node.offsetHeight);
        },

        triggerOnKeyDown: operation(null, onKeyDown),

        execCommand: function(cmd) {
            return commands[cmd](this);
        },

        findPosH: function(from, amount, unit, visually) {
            var dir = 1;
            if (amount < 0) {
                dir = -1;
                amount = -amount;
            }
            for (var i = 0, cur = clipPos(this.doc, from); i < amount; ++i) {
                cur = findPosH(this.doc, cur, dir, unit, visually);
                if (cur.hitSide) break;
            }
            return cur;
        },

        moveH: operation(null, function(dir, unit) {
            var sel = this.doc.sel,
                pos;
            if (sel.shift || sel.extend || posEq(sel.from, sel.to))
                pos = findPosH(this.doc, sel.head, dir, unit, this.options.rtlMoveVisually);
            else
                pos = dir < 0 ? sel.from : sel.to;
            extendSelection(this.doc, pos, pos, dir);
        }),

        deleteH: operation(null, function(dir, unit) {
            var sel = this.doc.sel;
            if (!posEq(sel.from, sel.to)) replaceRange(this.doc, "", sel.from, sel.to, "+delete");
            else replaceRange(this.doc, "", sel.from, findPosH(this.doc, sel.head, dir, unit, false), "+delete");
            this.curOp.userSelChange = true;
        }),

        findPosV: function(from, amount, unit, goalColumn) {
            var dir = 1,
                x = goalColumn;
            if (amount < 0) {
                dir = -1;
                amount = -amount;
            }
            for (var i = 0, cur = clipPos(this.doc, from); i < amount; ++i) {
                var coords = cursorCoords(this, cur, "div");
                if (x == null) x = coords.left;
                else coords.left = x;
                cur = findPosV(this, coords, dir, unit);
                if (cur.hitSide) break;
            }
            return cur;
        },

        moveV: operation(null, function(dir, unit) {
            var sel = this.doc.sel;
            var pos = cursorCoords(this, sel.head, "div");
            if (sel.goalColumn != null) pos.left = sel.goalColumn;
            var target = findPosV(this, pos, dir, unit);

            if (unit == "page")
                this.display.scrollbarV.scrollTop += charCoords(this, target, "div").top - pos.top;
            extendSelection(this.doc, target, target, dir);
            sel.goalColumn = pos.left;
        }),

        toggleOverwrite: function() {
            if (this.state.overwrite = !this.state.overwrite)
                this.display.cursor.className += " CodeMirror-overwrite";
            else
                this.display.cursor.className = this.display.cursor.className.replace(" CodeMirror-overwrite", "");
        },

        scrollTo: operation(null, function(x, y) {
            this.curOp.updateScrollPos = {
                scrollLeft: x,
                scrollTop: y
            };
        }),
        getScrollInfo: function() {
            var scroller = this.display.scroller,
                co = scrollerCutOff;
            return {
                left: scroller.scrollLeft,
                top: scroller.scrollTop,
                height: scroller.scrollHeight - co,
                width: scroller.scrollWidth - co,
                clientHeight: scroller.clientHeight - co,
                clientWidth: scroller.clientWidth - co
            };
        },

        scrollIntoView: function(pos) {
            if (typeof pos == "number") pos = Pos(pos, 0);
            if (!pos || pos.line != null) {
                pos = pos ? clipPos(this.doc, pos) : this.doc.sel.head;
                scrollPosIntoView(this, pos);
            } else {
                scrollIntoView(this, pos.left, pos.top, pos.right, pos.bottom);
            }
        },

        setSize: function(width, height) {
            function interpret(val) {
                return typeof val == "number" || /^\d+$/.test(String(val)) ? val + "px" : val;
            }
            if (width != null) this.display.wrapper.style.width = interpret(width);
            if (height != null) this.display.wrapper.style.height = interpret(height);
            this.refresh();
        },

        on: function(type, f) {
            on(this, type, f);
        },
        off: function(type, f) {
            off(this, type, f);
        },

        operation: function(f) {
            return runInOp(this, f);
        },

        refresh: operation(null, function() {
            clearCaches(this);
            this.curOp.updateScrollPos = {
                scrollTop: this.doc.scrollTop,
                scrollLeft: this.doc.scrollLeft
            };
            regChange(this);
        }),

        swapDoc: operation(null, function(doc) {
            var old = this.doc;
            old.cm = null;
            attachDoc(this, doc);
            clearCaches(this);
            this.curOp.updateScrollPos = {
                scrollTop: doc.scrollTop,
                scrollLeft: doc.scrollLeft
            };
            return old;
        }),

        getInputField: function() {
            return this.display.input;
        },
        getWrapperElement: function() {
            return this.display.wrapper;
        },
        getScrollerElement: function() {
            return this.display.scroller;
        },
        getGutterElement: function() {
            return this.display.gutters;
        }
    };

    // OPTION DEFAULTS

    var optionHandlers = CodeMirror.optionHandlers = {};

    // The default configuration options.
    var defaults = CodeMirror.defaults = {};

    function option(name, deflt, handle, notOnInit) {
        CodeMirror.defaults[name] = deflt;
        if (handle) optionHandlers[name] =
            notOnInit ? function(cm, val, old) {
                if (old != Init) handle(cm, val, old);
            } : handle;
    }

    var Init = CodeMirror.Init = {
        toString: function() {
            return "CodeMirror.Init";
        }
    };

    // These two are, on init, called from the constructor because they
    // have to be initialized before the editor can start at all.
    option("value", "", function(cm, val) {
        cm.setValue(val);
    }, true);
    option("mode", null, function(cm, val) {
        cm.doc.modeOption = val;
        loadMode(cm);
    }, true);

    option("indentUnit", 2, loadMode, true);
    option("indentWithTabs", false);
    option("smartIndent", true);
    option("tabSize", 4, function(cm) {
        loadMode(cm);
        clearCaches(cm);
        regChange(cm);
    }, true);
    option("electricChars", true);
    option("rtlMoveVisually", !windows);

    option("theme", "default", function(cm) {
        themeChanged(cm);
        guttersChanged(cm);
    }, true);
    option("keyMap", "default", keyMapChanged);
    option("extraKeys", null);

    option("onKeyEvent", null);
    option("onDragEvent", null);

    option("lineWrapping", false, wrappingChanged, true);
    option("gutters", [], function(cm) {
        setGuttersForLineNumbers(cm.options);
        guttersChanged(cm);
    }, true);
    option("fixedGutter", true, function(cm, val) {
        cm.display.gutters.style.left = val ? compensateForHScroll(cm.display) + "px" : "0";
        cm.refresh();
    }, true);
    option("lineNumbers", false, function(cm) {
        setGuttersForLineNumbers(cm.options);
        guttersChanged(cm);
    }, true);
    option("firstLineNumber", 1, guttersChanged, true);
    option("lineNumberFormatter", function(integer) {
        return integer;
    }, guttersChanged, true);
    option("showCursorWhenSelecting", false, updateSelection, true);

    option("readOnly", false, function(cm, val) {
        if (val == "nocursor") {
            onBlur(cm);
            cm.display.input.blur();
        } else if (!val) resetInput(cm, true);
    });
    option("dragDrop", true);

    option("cursorBlinkRate", 530);
    option("cursorHeight", 1);
    option("workTime", 100);
    option("workDelay", 100);
    option("flattenSpans", true);
    option("pollInterval", 100);
    option("undoDepth", 40, function(cm, val) {
        cm.doc.history.undoDepth = val;
    });
    option("viewportMargin", 10, function(cm) {
        cm.refresh();
    }, true);

    option("tabindex", null, function(cm, val) {
        cm.display.input.tabIndex = val || "";
    });
    option("autofocus", null);

    // MODE DEFINITION AND QUERYING

    // Known modes, by name and by MIME
    var modes = CodeMirror.modes = {},
        mimeModes = CodeMirror.mimeModes = {};

    CodeMirror.defineMode = function(name, mode) {
        if (!CodeMirror.defaults.mode && name != "null") CodeMirror.defaults.mode = name;
        if (arguments.length > 2) {
            mode.dependencies = [];
            for (var i = 2; i < arguments.length; ++i) mode.dependencies.push(arguments[i]);
        }
        modes[name] = mode;
    };

    CodeMirror.defineMIME = function(mime, spec) {
        mimeModes[mime] = spec;
    };

    CodeMirror.resolveMode = function(spec) {
        if (typeof spec == "string" && mimeModes.hasOwnProperty(spec))
            spec = mimeModes[spec];
        else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec))
            return CodeMirror.resolveMode("application/xml");
        if (typeof spec == "string") return {
            name: spec
        };
        else return spec || {
            name: "null"
        };
    };

    CodeMirror.getMode = function(options, spec) {
        spec = CodeMirror.resolveMode(spec);
        var mfactory = modes[spec.name];
        if (!mfactory) return CodeMirror.getMode(options, "text/plain");
        var modeObj = mfactory(options, spec);
        if (modeExtensions.hasOwnProperty(spec.name)) {
            var exts = modeExtensions[spec.name];
            for (var prop in exts) {
                if (!exts.hasOwnProperty(prop)) continue;
                if (modeObj.hasOwnProperty(prop)) modeObj["_" + prop] = modeObj[prop];
                modeObj[prop] = exts[prop];
            }
        }
        modeObj.name = spec.name;
        return modeObj;
    };

    CodeMirror.defineMode("null", function() {
        return {
            token: function(stream) {
                stream.skipToEnd();
            }
        };
    });
    CodeMirror.defineMIME("text/plain", "null");

    var modeExtensions = CodeMirror.modeExtensions = {};
    CodeMirror.extendMode = function(mode, properties) {
        var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {});
        copyObj(properties, exts);
    };

    // EXTENSIONS

    CodeMirror.defineExtension = function(name, func) {
        CodeMirror.prototype[name] = func;
    };

    CodeMirror.defineOption = option;

    var initHooks = [];
    CodeMirror.defineInitHook = function(f) {
        initHooks.push(f);
    };

    // MODE STATE HANDLING

    // Utility functions for working with state. Exported because modes
    // sometimes need to do this.
    function copyState(mode, state) {
        if (state === true) return state;
        if (mode.copyState) return mode.copyState(state);
        var nstate = {};
        for (var n in state) {
            var val = state[n];
            if (val instanceof Array) val = val.concat([]);
            nstate[n] = val;
        }
        return nstate;
    }
    CodeMirror.copyState = copyState;

    function startState(mode, a1, a2) {
        return mode.startState ? mode.startState(a1, a2) : true;
    }
    CodeMirror.startState = startState;

    CodeMirror.innerMode = function(mode, state) {
        while (mode.innerMode) {
            var info = mode.innerMode(state);
            state = info.state;
            mode = info.mode;
        }
        return info || {
            mode: mode,
            state: state
        };
    };

    // STANDARD COMMANDS

    var commands = CodeMirror.commands = {
        selectAll: function(cm) {
            cm.setSelection(Pos(cm.firstLine(), 0), Pos(cm.lastLine()));
        },
        killLine: function(cm) {
            var from = cm.getCursor(true),
                to = cm.getCursor(false),
                sel = !posEq(from, to);
            if (!sel && cm.getLine(from.line).length == from.ch)
                cm.replaceRange("", from, Pos(from.line + 1, 0), "+delete");
            else cm.replaceRange("", from, sel ? to : Pos(from.line), "+delete");
        },
        deleteLine: function(cm) {
            var l = cm.getCursor().line;
            cm.replaceRange("", Pos(l, 0), Pos(l), "+delete");
        },
        undo: function(cm) {
            cm.undo();
        },
        redo: function(cm) {
            cm.redo();
        },
        goDocStart: function(cm) {
            cm.extendSelection(Pos(cm.firstLine(), 0));
        },
        goDocEnd: function(cm) {
            cm.extendSelection(Pos(cm.lastLine()));
        },
        goLineStart: function(cm) {
            cm.extendSelection(lineStart(cm, cm.getCursor().line));
        },
        goLineStartSmart: function(cm) {
            var cur = cm.getCursor(),
                start = lineStart(cm, cur.line);
            var line = cm.getLineHandle(start.line);
            var order = getOrder(line);
            if (!order || order[0].level == 0) {
                var firstNonWS = Math.max(0, line.text.search(/\S/));
                var inWS = cur.line == start.line && cur.ch <= firstNonWS && cur.ch;
                cm.extendSelection(Pos(start.line, inWS ? 0 : firstNonWS));
            } else cm.extendSelection(start);
        },
        goLineEnd: function(cm) {
            cm.extendSelection(lineEnd(cm, cm.getCursor().line));
        },
        goLineUp: function(cm) {
            cm.moveV(-1, "line");
        },
        goLineDown: function(cm) {
            cm.moveV(1, "line");
        },
        goPageUp: function(cm) {
            cm.moveV(-1, "page");
        },
        goPageDown: function(cm) {
            cm.moveV(1, "page");
        },
        goCharLeft: function(cm) {
            cm.moveH(-1, "char");
        },
        goCharRight: function(cm) {
            cm.moveH(1, "char");
        },
        goColumnLeft: function(cm) {
            cm.moveH(-1, "column");
        },
        goColumnRight: function(cm) {
            cm.moveH(1, "column");
        },
        goWordLeft: function(cm) {
            cm.moveH(-1, "word");
        },
        goWordRight: function(cm) {
            cm.moveH(1, "word");
        },
        delCharBefore: function(cm) {
            cm.deleteH(-1, "char");
        },
        delCharAfter: function(cm) {
            cm.deleteH(1, "char");
        },
        delWordBefore: function(cm) {
            cm.deleteH(-1, "word");
        },
        delWordAfter: function(cm) {
            cm.deleteH(1, "word");
        },
        indentAuto: function(cm) {
            cm.indentSelection("smart");
        },
        indentMore: function(cm) {
            cm.indentSelection("add");
        },
        indentLess: function(cm) {
            cm.indentSelection("subtract");
        },
        insertTab: function(cm) {
            cm.replaceSelection("\t", "end", "+input");
        },
        defaultTab: function(cm) {
            if (cm.somethingSelected()) cm.indentSelection("add");
            else cm.replaceSelection("\t", "end", "+input");
        },
        transposeChars: function(cm) {
            var cur = cm.getCursor(),
                line = cm.getLine(cur.line);
            if (cur.ch > 0 && cur.ch < line.length - 1)
                cm.replaceRange(line.charAt(cur.ch) + line.charAt(cur.ch - 1),
                    Pos(cur.line, cur.ch - 1), Pos(cur.line, cur.ch + 1));
        },
        newlineAndIndent: function(cm) {
            operation(cm, function() {
                cm.replaceSelection("\n", "end", "+input");
                cm.indentLine(cm.getCursor().line, null, true);
            })();
        },
        toggleOverwrite: function(cm) {
            cm.toggleOverwrite();
        }
    };

    // STANDARD KEYMAPS

    var keyMap = CodeMirror.keyMap = {};
    keyMap.basic = {
        "Left": "goCharLeft",
        "Right": "goCharRight",
        "Up": "goLineUp",
        "Down": "goLineDown",
        "End": "goLineEnd",
        "Home": "goLineStartSmart",
        "PageUp": "goPageUp",
        "PageDown": "goPageDown",
        "Delete": "delCharAfter",
        "Backspace": "delCharBefore",
        "Tab": "defaultTab",
        "Shift-Tab": "indentAuto",
        "Enter": "newlineAndIndent",
        "Insert": "toggleOverwrite"
    };
    // Note that the save and find-related commands aren't defined by
    // default. Unknown commands are simply ignored.
    keyMap.pcDefault = {
        "Ctrl-A": "selectAll",
        "Ctrl-D": "deleteLine",
        "Ctrl-Z": "undo",
        "Shift-Ctrl-Z": "redo",
        "Ctrl-Y": "redo",
        "Ctrl-Home": "goDocStart",
        "Alt-Up": "goDocStart",
        "Ctrl-End": "goDocEnd",
        "Ctrl-Down": "goDocEnd",
        "Ctrl-Left": "goWordLeft",
        "Ctrl-Right": "goWordRight",
        "Alt-Left": "goLineStart",
        "Alt-Right": "goLineEnd",
        "Ctrl-Backspace": "delWordBefore",
        "Ctrl-Delete": "delWordAfter",
        "Ctrl-S": "save",
        "Ctrl-F": "find",
        "Ctrl-G": "findNext",
        "Shift-Ctrl-G": "findPrev",
        "Shift-Ctrl-F": "replace",
        "Shift-Ctrl-R": "replaceAll",
        "Ctrl-[": "indentLess",
        "Ctrl-]": "indentMore",
        fallthrough: "basic"
    };
    keyMap.macDefault = {
        "Cmd-A": "selectAll",
        "Cmd-D": "deleteLine",
        "Cmd-Z": "undo",
        "Shift-Cmd-Z": "redo",
        "Cmd-Y": "redo",
        "Cmd-Up": "goDocStart",
        "Cmd-End": "goDocEnd",
        "Cmd-Down": "goDocEnd",
        "Alt-Left": "goWordLeft",
        "Alt-Right": "goWordRight",
        "Cmd-Left": "goLineStart",
        "Cmd-Right": "goLineEnd",
        "Alt-Backspace": "delWordBefore",
        "Ctrl-Alt-Backspace": "delWordAfter",
        "Alt-Delete": "delWordAfter",
        "Cmd-S": "save",
        "Cmd-F": "find",
        "Cmd-G": "findNext",
        "Shift-Cmd-G": "findPrev",
        "Cmd-Alt-F": "replace",
        "Shift-Cmd-Alt-F": "replaceAll",
        "Cmd-[": "indentLess",
        "Cmd-]": "indentMore",
        fallthrough: ["basic", "emacsy"]
    };
    keyMap["default"] = mac ? keyMap.macDefault : keyMap.pcDefault;
    keyMap.emacsy = {
        "Ctrl-F": "goCharRight",
        "Ctrl-B": "goCharLeft",
        "Ctrl-P": "goLineUp",
        "Ctrl-N": "goLineDown",
        "Alt-F": "goWordRight",
        "Alt-B": "goWordLeft",
        "Ctrl-A": "goLineStart",
        "Ctrl-E": "goLineEnd",
        "Ctrl-V": "goPageDown",
        "Shift-Ctrl-V": "goPageUp",
        "Ctrl-D": "delCharAfter",
        "Ctrl-H": "delCharBefore",
        "Alt-D": "delWordAfter",
        "Alt-Backspace": "delWordBefore",
        "Ctrl-K": "killLine",
        "Ctrl-T": "transposeChars"
    };

    // KEYMAP DISPATCH

    function getKeyMap(val) {
        if (typeof val == "string") return keyMap[val];
        else return val;
    }

    function lookupKey(name, maps, handle) {
        function lookup(map) {
            map = getKeyMap(map);
            var found = map[name];
            if (found === false) return "stop";
            if (found != null && handle(found)) return true;
            if (map.nofallthrough) return "stop";

            var fallthrough = map.fallthrough;
            if (fallthrough == null) return false;
            if (Object.prototype.toString.call(fallthrough) != "[object Array]")
                return lookup(fallthrough);
            for (var i = 0, e = fallthrough.length; i < e; ++i) {
                var done = lookup(fallthrough[i]);
                if (done) return done;
            }
            return false;
        }

        for (var i = 0; i < maps.length; ++i) {
            var done = lookup(maps[i]);
            if (done) return done;
        }
    }

    function isModifierKey(event) {
        var name = keyNames[event.keyCode];
        return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod";
    }

    function keyName(event, noShift) {
        var name = keyNames[event.keyCode];
        if (name == null || event.altGraphKey) return false;
        if (event.altKey) name = "Alt-" + name;
        if (flipCtrlCmd ? event.metaKey : event.ctrlKey) name = "Ctrl-" + name;
        if (flipCtrlCmd ? event.ctrlKey : event.metaKey) name = "Cmd-" + name;
        if (!noShift && event.shiftKey) name = "Shift-" + name;
        return name;
    }
    CodeMirror.lookupKey = lookupKey;
    CodeMirror.isModifierKey = isModifierKey;
    CodeMirror.keyName = keyName;

    // FROMTEXTAREA

    CodeMirror.fromTextArea = function(textarea, options) {
        if (!options) options = {};
        options.value = textarea.value;
        if (!options.tabindex && textarea.tabindex)
            options.tabindex = textarea.tabindex;
        // Set autofocus to true if this textarea is focused, or if it has
        // autofocus and no other element is focused.
        if (options.autofocus == null) {
            var hasFocus = document.body;
            // doc.activeElement occasionally throws on IE
            try {
                hasFocus = document.activeElement;
            } catch (e) {}
            options.autofocus = hasFocus == textarea ||
                textarea.getAttribute("autofocus") != null && hasFocus == document.body;
        }

        function save() {
            textarea.value = cm.getValue();
        }
        if (textarea.form) {
            // Deplorable hack to make the submit method do the right thing.
            on(textarea.form, "submit", save);
            var form = textarea.form,
                realSubmit = form.submit;
            try {
                var wrappedSubmit = form.submit = function() {
                    save();
                    form.submit = realSubmit;
                    form.submit();
                    form.submit = wrappedSubmit;
                };
            } catch (e) {}
        }

        textarea.style.display = "none";
        var cm = CodeMirror(function(node) {
            textarea.parentNode.insertBefore(node, textarea.nextSibling);
        }, options);
        cm.save = save;
        cm.getTextArea = function() {
            return textarea;
        };
        cm.toTextArea = function() {
            save();
            textarea.parentNode.removeChild(cm.getWrapperElement());
            textarea.style.display = "";
            if (textarea.form) {
                off(textarea.form, "submit", save);
                if (typeof textarea.form.submit == "function")
                    textarea.form.submit = realSubmit;
            }
        };
        return cm;
    };

    // STRING STREAM

    // Fed to the mode parsers, provides helper functions to make
    // parsers more succinct.

    // The character stream used by a mode's parser.
    function StringStream(string, tabSize) {
        this.pos = this.start = 0;
        this.string = string;
        this.tabSize = tabSize || 8;
    }

    StringStream.prototype = {
        eol: function() {
            return this.pos >= this.string.length;
        },
        sol: function() {
            return this.pos == 0;
        },
        peek: function() {
            return this.string.charAt(this.pos) || undefined;
        },
        next: function() {
            if (this.pos < this.string.length)
                return this.string.charAt(this.pos++);
        },
        eat: function(match) {
            var ch = this.string.charAt(this.pos);
            if (typeof match == "string") var ok = ch == match;
            else var ok = ch && (match.test ? match.test(ch) : match(ch));
            if (ok) {
                ++this.pos;
                return ch;
            }
        },
        eatWhile: function(match) {
            var start = this.pos;
            while (this.eat(match)) {}
            return this.pos > start;
        },
        eatSpace: function() {
            var start = this.pos;
            while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) ++this.pos;
            return this.pos > start;
        },
        skipToEnd: function() {
            this.pos = this.string.length;
        },
        skipTo: function(ch) {
            var found = this.string.indexOf(ch, this.pos);
            if (found > -1) {
                this.pos = found;
                return true;
            }
        },
        backUp: function(n) {
            this.pos -= n;
        },
        column: function() {
            return countColumn(this.string, this.start, this.tabSize);
        },
        indentation: function() {
            return countColumn(this.string, null, this.tabSize);
        },
        match: function(pattern, consume, caseInsensitive) {
            if (typeof pattern == "string") {
                var cased = function(str) {
                    return caseInsensitive ? str.toLowerCase() : str;
                };
                if (cased(this.string).indexOf(cased(pattern), this.pos) == this.pos) {
                    if (consume !== false) this.pos += pattern.length;
                    return true;
                }
            } else {
                var match = this.string.slice(this.pos).match(pattern);
                if (match && match.index > 0) return null;
                if (match && consume !== false) this.pos += match[0].length;
                return match;
            }
        },
        current: function() {
            return this.string.slice(this.start, this.pos);
        }
    };
    CodeMirror.StringStream = StringStream;

    // TEXTMARKERS

    function TextMarker(doc, type) {
        this.lines = [];
        this.type = type;
        this.doc = doc;
    }
    CodeMirror.TextMarker = TextMarker;

    TextMarker.prototype.clear = function() {
        if (this.explicitlyCleared) return;
        var cm = this.doc.cm,
            withOp = cm && !cm.curOp;
        if (withOp) startOperation(cm);
        var min = null,
            max = null;
        for (var i = 0; i < this.lines.length; ++i) {
            var line = this.lines[i];
            var span = getMarkedSpanFor(line.markedSpans, this);
            if (span.to != null) max = lineNo(line);
            line.markedSpans = removeMarkedSpan(line.markedSpans, span);
            if (span.from != null)
                min = lineNo(line);
            else if (this.collapsed && !lineIsHidden(this.doc, line) && cm)
                updateLineHeight(line, textHeight(cm.display));
        }
        if (cm && this.collapsed && !cm.options.lineWrapping)
            for (var i = 0; i < this.lines.length; ++i) {
                var visual = visualLine(cm.doc, this.lines[i]),
                    len = lineLength(cm.doc, visual);
                if (len > cm.display.maxLineLength) {
                    cm.display.maxLine = visual;
                    cm.display.maxLineLength = len;
                    cm.display.maxLineChanged = true;
                }
            }

        if (min != null && cm) regChange(cm, min, max + 1);
        this.lines.length = 0;
        this.explicitlyCleared = true;
        if (this.collapsed && this.doc.cantEdit) {
            this.doc.cantEdit = false;
            if (cm) reCheckSelection(cm);
        }
        if (withOp) endOperation(cm);
        signalLater(this, "clear");
    };

    TextMarker.prototype.find = function() {
        var from, to;
        for (var i = 0; i < this.lines.length; ++i) {
            var line = this.lines[i];
            var span = getMarkedSpanFor(line.markedSpans, this);
            if (span.from != null || span.to != null) {
                var found = lineNo(line);
                if (span.from != null) from = Pos(found, span.from);
                if (span.to != null) to = Pos(found, span.to);
            }
        }
        if (this.type == "bookmark") return from;
        return from && {
            from: from,
            to: to
        };
    };

    TextMarker.prototype.getOptions = function(copyWidget) {
        var repl = this.replacedWith;
        return {
            className: this.className,
            inclusiveLeft: this.inclusiveLeft,
            inclusiveRight: this.inclusiveRight,
            atomic: this.atomic,
            collapsed: this.collapsed,
            clearOnEnter: this.clearOnEnter,
            replacedWith: copyWidget ? repl && repl.cloneNode(true) : repl,
            readOnly: this.readOnly,
            startStyle: this.startStyle,
            endStyle: this.endStyle
        };
    };

    TextMarker.prototype.attachLine = function(line) {
        if (!this.lines.length && this.doc.cm) {
            var op = this.doc.cm.curOp;
            if (!op.maybeHiddenMarkers || indexOf(op.maybeHiddenMarkers, this) == -1)
                (op.maybeUnhiddenMarkers || (op.maybeUnhiddenMarkers = [])).push(this);
        }
        this.lines.push(line);
    };
    TextMarker.prototype.detachLine = function(line) {
        this.lines.splice(indexOf(this.lines, line), 1);
        if (!this.lines.length && this.doc.cm) {
            var op = this.doc.cm.curOp;
            (op.maybeHiddenMarkers || (op.maybeHiddenMarkers = [])).push(this);
        }
    };

    function markText(doc, from, to, options, type) {
        if (options && options.shared) return markTextShared(doc, from, to, options, type);
        if (doc.cm && !doc.cm.curOp) return operation(doc.cm, markText)(doc, from, to, options, type);

        var marker = new TextMarker(doc, type);
        if (type == "range" && !posLess(from, to)) return marker;
        if (options) copyObj(options, marker);
        if (marker.replacedWith) {
            marker.collapsed = true;
            marker.replacedWith = elt("span", [marker.replacedWith], "CodeMirror-widget");
        }
        if (marker.collapsed) sawCollapsedSpans = true;

        var curLine = from.line,
            size = 0,
            collapsedAtStart, collapsedAtEnd, cm = doc.cm,
            updateMaxLine;
        doc.iter(curLine, to.line + 1, function(line) {
            if (cm && marker.collapsed && !cm.options.lineWrapping && visualLine(doc, line) == cm.display.maxLine)
                updateMaxLine = true;
            var span = {
                from: null,
                to: null,
                marker: marker
            };
            size += line.text.length;
            if (curLine == from.line) {
                span.from = from.ch;
                size -= from.ch;
            }
            if (curLine == to.line) {
                span.to = to.ch;
                size -= line.text.length - to.ch;
            }
            if (marker.collapsed) {
                if (curLine == to.line) collapsedAtEnd = collapsedSpanAt(line, to.ch);
                if (curLine == from.line) collapsedAtStart = collapsedSpanAt(line, from.ch);
                else updateLineHeight(line, 0);
            }
            addMarkedSpan(line, span);
            ++curLine;
        });
        if (marker.collapsed) doc.iter(from.line, to.line + 1, function(line) {
            if (lineIsHidden(doc, line)) updateLineHeight(line, 0);
        });

        if (marker.readOnly) {
            sawReadOnlySpans = true;
            if (doc.history.done.length || doc.history.undone.length)
                doc.clearHistory();
        }
        if (marker.collapsed) {
            if (collapsedAtStart != collapsedAtEnd)
                throw new Error("Inserting collapsed marker overlapping an existing one");
            marker.size = size;
            marker.atomic = true;
        }
        if (cm) {
            if (updateMaxLine) cm.curOp.updateMaxLine = true;
            if (marker.className || marker.startStyle || marker.endStyle || marker.collapsed)
                regChange(cm, from.line, to.line + 1);
            if (marker.atomic) reCheckSelection(cm);
        }
        return marker;
    }

    // SHARED TEXTMARKERS

    function SharedTextMarker(markers, primary) {
        this.markers = markers;
        this.primary = primary;
        for (var i = 0, me = this; i < markers.length; ++i) {
            markers[i].parent = this;
            on(markers[i], "clear", function() {
                me.clear();
            });
        }
    }
    CodeMirror.SharedTextMarker = SharedTextMarker;

    SharedTextMarker.prototype.clear = function() {
        if (this.explicitlyCleared) return;
        this.explicitlyCleared = true;
        for (var i = 0; i < this.markers.length; ++i)
            this.markers[i].clear();
        signalLater(this, "clear");
    };
    SharedTextMarker.prototype.find = function() {
        return this.primary.find();
    };
    SharedTextMarker.prototype.getOptions = function(copyWidget) {
        var inner = this.primary.getOptions(copyWidget);
        inner.shared = true;
        return inner;
    };

    function markTextShared(doc, from, to, options, type) {
        options = copyObj(options);
        options.shared = false;
        var markers = [markText(doc, from, to, options, type)],
            primary = markers[0];
        linkedDocs(doc, function(doc) {
            markers.push(markText(doc, clipPos(doc, from), clipPos(doc, to), options, type));
            for (var i = 0; i < doc.linked.length; ++i)
                if (doc.linked[i].isParent) return;
            primary = lst(markers);
        });
        return new SharedTextMarker(markers, primary);
    }

    // TEXTMARKER SPANS

    function getMarkedSpanFor(spans, marker) {
        if (spans)
            for (var i = 0; i < spans.length; ++i) {
                var span = spans[i];
                if (span.marker == marker) return span;
            }
    }

    function removeMarkedSpan(spans, span) {
        for (var r, i = 0; i < spans.length; ++i)
            if (spans[i] != span)(r || (r = [])).push(spans[i]);
        return r;
    }

    function addMarkedSpan(line, span) {
        line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span];
        span.marker.attachLine(line);
    }

    function markedSpansBefore(old, startCh, isInsert) {
        if (old)
            for (var i = 0, nw; i < old.length; ++i) {
                var span = old[i],
                    marker = span.marker;
                var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh);
                if (startsBefore || marker.type == "bookmark" && span.from == startCh && (!isInsert || !span.marker.insertLeft)) {
                    var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh);
                    (nw || (nw = [])).push({
                        from: span.from,
                        to: endsAfter ? null : span.to,
                        marker: marker
                    });
                }
            }
        return nw;
    }

    function markedSpansAfter(old, endCh, isInsert) {
        if (old)
            for (var i = 0, nw; i < old.length; ++i) {
                var span = old[i],
                    marker = span.marker;
                var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh);
                if (endsAfter || marker.type == "bookmark" && span.from == endCh && (!isInsert || span.marker.insertLeft)) {
                    var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh);
                    (nw || (nw = [])).push({
                        from: startsBefore ? null : span.from - endCh,
                        to: span.to == null ? null : span.to - endCh,
                        marker: marker
                    });
                }
            }
        return nw;
    }

    function stretchSpansOverChange(doc, change) {
        var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans;
        var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans;
        if (!oldFirst && !oldLast) return null;

        var startCh = change.from.ch,
            endCh = change.to.ch,
            isInsert = posEq(change.from, change.to);
        // Get the spans that 'stick out' on both sides
        var first = markedSpansBefore(oldFirst, startCh, isInsert);
        var last = markedSpansAfter(oldLast, endCh, isInsert);

        // Next, merge those two ends
        var sameLine = change.text.length == 1,
            offset = lst(change.text).length + (sameLine ? startCh : 0);
        if (first) {
            // Fix up .to properties of first
            for (var i = 0; i < first.length; ++i) {
                var span = first[i];
                if (span.to == null) {
                    var found = getMarkedSpanFor(last, span.marker);
                    if (!found) span.to = startCh;
                    else if (sameLine) span.to = found.to == null ? null : found.to + offset;
                }
            }
        }
        if (last) {
            // Fix up .from in last (or move them into first in case of sameLine)
            for (var i = 0; i < last.length; ++i) {
                var span = last[i];
                if (span.to != null) span.to += offset;
                if (span.from == null) {
                    var found = getMarkedSpanFor(first, span.marker);
                    if (!found) {
                        span.from = offset;
                        if (sameLine)(first || (first = [])).push(span);
                    }
                } else {
                    span.from += offset;
                    if (sameLine)(first || (first = [])).push(span);
                }
            }
        }

        var newMarkers = [first];
        if (!sameLine) {
            // Fill gap with whole-line-spans
            var gap = change.text.length - 2,
                gapMarkers;
            if (gap > 0 && first)
                for (var i = 0; i < first.length; ++i)
                    if (first[i].to == null)
                        (gapMarkers || (gapMarkers = [])).push({
                            from: null,
                            to: null,
                            marker: first[i].marker
                        });
            for (var i = 0; i < gap; ++i)
                newMarkers.push(gapMarkers);
            newMarkers.push(last);
        }
        return newMarkers;
    }

    function mergeOldSpans(doc, change) {
        var old = getOldSpans(doc, change);
        var stretched = stretchSpansOverChange(doc, change);
        if (!old) return stretched;
        if (!stretched) return old;

        for (var i = 0; i < old.length; ++i) {
            var oldCur = old[i],
                stretchCur = stretched[i];
            if (oldCur && stretchCur) {
                spans: for (var j = 0; j < stretchCur.length; ++j) {
                    var span = stretchCur[j];
                    for (var k = 0; k < oldCur.length; ++k)
                        if (oldCur[k].marker == span.marker) continue spans;
                    oldCur.push(span);
                }
            } else if (stretchCur) {
                old[i] = stretchCur;
            }
        }
        return old;
    }

    function removeReadOnlyRanges(doc, from, to) {
        var markers = null;
        doc.iter(from.line, to.line + 1, function(line) {
            if (line.markedSpans)
                for (var i = 0; i < line.markedSpans.length; ++i) {
                    var mark = line.markedSpans[i].marker;
                    if (mark.readOnly && (!markers || indexOf(markers, mark) == -1))
                        (markers || (markers = [])).push(mark);
                }
        });
        if (!markers) return null;
        var parts = [{
            from: from,
            to: to
        }];
        for (var i = 0; i < markers.length; ++i) {
            var mk = markers[i],
                m = mk.find();
            for (var j = 0; j < parts.length; ++j) {
                var p = parts[j];
                if (posLess(p.to, m.from) || posLess(m.to, p.from)) continue;
                var newParts = [j, 1];
                if (posLess(p.from, m.from) || !mk.inclusiveLeft && posEq(p.from, m.from))
                    newParts.push({
                        from: p.from,
                        to: m.from
                    });
                if (posLess(m.to, p.to) || !mk.inclusiveRight && posEq(p.to, m.to))
                    newParts.push({
                        from: m.to,
                        to: p.to
                    });
                parts.splice.apply(parts, newParts);
                j += newParts.length - 1;
            }
        }
        return parts;
    }

    function collapsedSpanAt(line, ch) {
        var sps = sawCollapsedSpans && line.markedSpans,
            found;
        if (sps)
            for (var sp, i = 0; i < sps.length; ++i) {
                sp = sps[i];
                if (!sp.marker.collapsed) continue;
                if ((sp.from == null || sp.from < ch) &&
                    (sp.to == null || sp.to > ch) &&
                    (!found || found.width < sp.marker.width))
                    found = sp.marker;
            }
        return found;
    }

    function collapsedSpanAtStart(line) {
        return collapsedSpanAt(line, -1);
    }

    function collapsedSpanAtEnd(line) {
        return collapsedSpanAt(line, line.text.length + 1);
    }

    function visualLine(doc, line) {
        var merged;
        while (merged = collapsedSpanAtStart(line))
            line = getLine(doc, merged.find().from.line);
        return line;
    }

    function lineIsHidden(doc, line) {
        var sps = sawCollapsedSpans && line.markedSpans;
        if (sps)
            for (var sp, i = 0; i < sps.length; ++i) {
                sp = sps[i];
                if (!sp.marker.collapsed) continue;
                if (sp.from == null) return true;
                if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp))
                    return true;
            }
    }

    function lineIsHiddenInner(doc, line, span) {
        if (span.to == null) {
            var end = span.marker.find().to,
                endLine = getLine(doc, end.line);
            return lineIsHiddenInner(doc, endLine, getMarkedSpanFor(endLine.markedSpans, span.marker));
        }
        if (span.marker.inclusiveRight && span.to == line.text.length)
            return true;
        for (var sp, i = 0; i < line.markedSpans.length; ++i) {
            sp = line.markedSpans[i];
            if (sp.marker.collapsed && sp.from == span.to &&
                (sp.marker.inclusiveLeft || span.marker.inclusiveRight) &&
                lineIsHiddenInner(doc, line, sp)) return true;
        }
    }

    function detachMarkedSpans(line) {
        var spans = line.markedSpans;
        if (!spans) return;
        for (var i = 0; i < spans.length; ++i)
            spans[i].marker.detachLine(line);
        line.markedSpans = null;
    }

    function attachMarkedSpans(line, spans) {
        if (!spans) return;
        for (var i = 0; i < spans.length; ++i)
            spans[i].marker.attachLine(line);
        line.markedSpans = spans;
    }

    // LINE WIDGETS

    var LineWidget = CodeMirror.LineWidget = function(cm, node, options) {
        for (var opt in options)
            if (options.hasOwnProperty(opt))
                this[opt] = options[opt];
        this.cm = cm;
        this.node = node;
    };

    function widgetOperation(f) {
        return function() {
            var withOp = !this.cm.curOp;
            if (withOp) startOperation(this.cm);
            try {
                var result = f.apply(this, arguments);
            } finally {
                if (withOp) endOperation(this.cm);
            }
            return result;
        };
    }
    LineWidget.prototype.clear = widgetOperation(function() {
        var ws = this.line.widgets,
            no = lineNo(this.line);
        if (no == null || !ws) return;
        for (var i = 0; i < ws.length; ++i)
            if (ws[i] == this) ws.splice(i--, 1);
        if (!ws.length) this.line.widgets = null;
        updateLineHeight(this.line, Math.max(0, this.line.height - widgetHeight(this)));
        regChange(this.cm, no, no + 1);
    });
    LineWidget.prototype.changed = widgetOperation(function() {
        var oldH = this.height;
        this.height = null;
        var diff = widgetHeight(this) - oldH;
        if (!diff) return;
        updateLineHeight(this.line, this.line.height + diff);
        var no = lineNo(this.line);
        regChange(this.cm, no, no + 1);
    });

    function widgetHeight(widget) {
        if (widget.height != null) return widget.height;
        if (!widget.node.parentNode || widget.node.parentNode.nodeType != 1)
            removeChildrenAndAdd(widget.cm.display.measure, elt("div", [widget.node], null, "position: relative"));
        return widget.height = widget.node.offsetHeight;
    }

    function addLineWidget(cm, handle, node, options) {
        var widget = new LineWidget(cm, node, options);
        if (widget.noHScroll) cm.display.alignWidgets = true;
        changeLine(cm, handle, function(line) {
            (line.widgets || (line.widgets = [])).push(widget);
            widget.line = line;
            if (!lineIsHidden(cm.doc, line) || widget.showIfHidden) {
                var aboveVisible = heightAtLine(cm, line) < cm.display.scroller.scrollTop;
                updateLineHeight(line, line.height + widgetHeight(widget));
                if (aboveVisible)
                    cm.curOp.updateScrollPos = {
                        scrollTop: cm.doc.scrollTop + widget.height,
                        scrollLeft: cm.doc.scrollLeft
                    };
            }
            return true;
        });
        return widget;
    }

    // LINE DATA STRUCTURE

    // Line objects. These hold state related to a line, including
    // highlighting info (the styles array).
    function makeLine(text, markedSpans, estimateHeight) {
        var line = {
            text: text
        };
        attachMarkedSpans(line, markedSpans);
        line.height = estimateHeight ? estimateHeight(line) : 1;
        return line;
    }

    function updateLine(line, text, markedSpans, estimateHeight) {
        line.text = text;
        if (line.stateAfter) line.stateAfter = null;
        if (line.styles) line.styles = null;
        if (line.order != null) line.order = null;
        detachMarkedSpans(line);
        attachMarkedSpans(line, markedSpans);
        var estHeight = estimateHeight ? estimateHeight(line) : 1;
        if (estHeight != line.height) updateLineHeight(line, estHeight);
        signalLater(line, "change");
    }

    function cleanUpLine(line) {
        line.parent = null;
        detachMarkedSpans(line);
    }

    // Run the given mode's parser over a line, update the styles
    // array, which contains alternating fragments of text and CSS
    // classes.
    function runMode(cm, text, mode, state, f) {
        var flattenSpans = cm.options.flattenSpans;
        var curText = "",
            curStyle = null;
        var stream = new StringStream(text, cm.options.tabSize);
        if (text == "" && mode.blankLine) mode.blankLine(state);
        while (!stream.eol()) {
            var style = mode.token(stream, state);
            if (stream.pos > 5000) {
                flattenSpans = false;
                // Webkit seems to refuse to render text nodes longer than 57444 characters
                stream.pos = Math.min(text.length, stream.start + 50000);
                style = null;
            }
            var substr = stream.current();
            stream.start = stream.pos;
            if (!flattenSpans || curStyle != style) {
                if (curText) f(curText, curStyle);
                curText = substr;
                curStyle = style;
            } else curText = curText + substr;
        }
        if (curText) f(curText, curStyle);
    }

    function highlightLine(cm, line, state) {
        // A styles array always starts with a number identifying the
        // mode/overlays that it is based on (for easy invalidation).
        var st = [cm.state.modeGen];
        // Compute the base array of styles
        runMode(cm, line.text, cm.doc.mode, state, function(txt, style) {
            st.push(txt, style);
        });

        // Run overlays, adjust style array.
        for (var o = 0; o < cm.state.overlays.length; ++o) {
            var overlay = cm.state.overlays[o],
                i = 1;
            runMode(cm, line.text, overlay.mode, true, function(txt, style) {
                var start = i,
                    len = txt.length;
                // Ensure there's a token end at the current position, and that i points at it
                while (len) {
                    var cur = st[i],
                        len_ = cur.length;
                    if (len_ <= len) {
                        len -= len_;
                    } else {
                        st.splice(i, 1, cur.slice(0, len), st[i + 1], cur.slice(len));
                        len = 0;
                    }
                    i += 2;
                }
                if (!style) return;
                if (overlay.opaque) {
                    st.splice(start, i - start, txt, style);
                    i = start + 2;
                } else {
                    for (; start < i; start += 2) {
                        var cur = st[start + 1];
                        st[start + 1] = cur ? cur + " " + style : style;
                    }
                }
            });
        }

        return st;
    }

    function getLineStyles(cm, line) {
        if (!line.styles || line.styles[0] != cm.state.modeGen)
            line.styles = highlightLine(cm, line, line.stateAfter = getStateBefore(cm, lineNo(line)));
        return line.styles;
    }

    // Lightweight form of highlight -- proceed over this line and
    // update state, but don't save a style array.
    function processLine(cm, line, state) {
        var mode = cm.doc.mode;
        var stream = new StringStream(line.text, cm.options.tabSize);
        if (line.text == "" && mode.blankLine) mode.blankLine(state);
        while (!stream.eol() && stream.pos <= 5000) {
            mode.token(stream, state);
            stream.start = stream.pos;
        }
    }

    var styleToClassCache = {};

    function styleToClass(style) {
        if (!style) return null;
        return styleToClassCache[style] ||
            (styleToClassCache[style] = "cm-" + style.replace(/ +/g, " cm-"));
    }

    function lineContent(cm, realLine, measure) {
        var merged, line = realLine,
            lineBefore, sawBefore, simple = true;
        while (merged = collapsedSpanAtStart(line)) {
            simple = false;
            line = getLine(cm.doc, merged.find().from.line);
            if (!lineBefore) lineBefore = line;
        }

        var builder = {
            pre: elt("pre"),
            col: 0,
            pos: 0,
            display: !measure,
            measure: null,
            addedOne: false,
            cm: cm
        };
        if (line.textClass) builder.pre.className = line.textClass;

        do {
            builder.measure = line == realLine && measure;
            builder.pos = 0;
            builder.addToken = builder.measure ? buildTokenMeasure : buildToken;
            if (measure && sawBefore && line != realLine && !builder.addedOne) {
                measure[0] = builder.pre.appendChild(zeroWidthElement(cm.display.measure));
                builder.addedOne = true;
            }
            var next = insertLineContent(line, builder, getLineStyles(cm, line));
            sawBefore = line == lineBefore;
            if (next) {
                line = getLine(cm.doc, next.to.line);
                simple = false;
            }
        } while (next);

        if (measure && !builder.addedOne)
            measure[0] = builder.pre.appendChild(simple ? elt("span", "\u00a0") : zeroWidthElement(cm.display.measure));
        if (!builder.pre.firstChild && !lineIsHidden(cm.doc, realLine))
            builder.pre.appendChild(document.createTextNode("\u00a0"));

        var order;
        // Work around problem with the reported dimensions of single-char
        // direction spans on IE (issue #1129). See also the comment in
        // cursorCoords.
        if (measure && ie && (order = getOrder(line))) {
            var l = order.length - 1;
            if (order[l].from == order[l].to) --l;
            var last = order[l],
                prev = order[l - 1];
            if (last.from + 1 == last.to && prev && last.level < prev.level) {
                var span = measure[builder.pos - 1];
                if (span) span.parentNode.insertBefore(span.measureRight = zeroWidthElement(cm.display.measure),
                    span.nextSibling);
            }
        }

        return builder.pre;
    }

    var tokenSpecialChars = /[\t\u0000-\u0019\u200b\u2028\u2029\uFEFF]/g;

    function buildToken(builder, text, style, startStyle, endStyle) {
        if (!text) return;
        if (!tokenSpecialChars.test(text)) {
            builder.col += text.length;
            var content = document.createTextNode(text);
        } else {
            var content = document.createDocumentFragment(),
                pos = 0;
            while (true) {
                tokenSpecialChars.lastIndex = pos;
                var m = tokenSpecialChars.exec(text);
                var skipped = m ? m.index - pos : text.length - pos;
                if (skipped) {
                    content.appendChild(document.createTextNode(text.slice(pos, pos + skipped)));
                    builder.col += skipped;
                }
                if (!m) break;
                pos += skipped + 1;
                if (m[0] == "\t") {
                    var tabSize = builder.cm.options.tabSize,
                        tabWidth = tabSize - builder.col % tabSize;
                    content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"));
                    builder.col += tabWidth;
                } else {
                    var token = elt("span", "\u2022", "cm-invalidchar");
                    token.title = "\\u" + m[0].charCodeAt(0).toString(16);
                    content.appendChild(token);
                    builder.col += 1;
                }
            }
        }
        if (style || startStyle || endStyle || builder.measure) {
            var fullStyle = style || "";
            if (startStyle) fullStyle += startStyle;
            if (endStyle) fullStyle += endStyle;
            return builder.pre.appendChild(elt("span", [content], fullStyle));
        }
        builder.pre.appendChild(content);
    }

    function buildTokenMeasure(builder, text, style, startStyle, endStyle) {
        for (var i = 0; i < text.length; ++i) {
            var ch = text.charAt(i),
                start = i == 0;
            if (ch >= "\ud800" && ch < "\udbff" && i < text.length - 1) {
                ch = text.slice(i, i + 2);
                ++i;
            } else if (i && builder.cm.options.lineWrapping &&
                spanAffectsWrapping.test(text.slice(i - 1, i + 1))) {
                builder.pre.appendChild(elt("wbr"));
            }
            builder.measure[builder.pos] =
                buildToken(builder, ch, style,
                    start && startStyle, i == text.length - 1 && endStyle);
            builder.pos += ch.length;
        }
        if (text.length) builder.addedOne = true;
    }

    function buildCollapsedSpan(builder, size, widget) {
        if (widget) {
            if (!builder.display) widget = widget.cloneNode(true);
            builder.pre.appendChild(widget);
            if (builder.measure && size) {
                builder.measure[builder.pos] = widget;
                builder.addedOne = true;
            }
        }
        builder.pos += size;
    }

    // Outputs a number of spans to make up a line, taking highlighting
    // and marked text into account.
    function insertLineContent(line, builder, styles) {
        var spans = line.markedSpans;
        if (!spans) {
            for (var i = 1; i < styles.length; i += 2)
                builder.addToken(builder, styles[i], styleToClass(styles[i + 1]));
            return;
        }

        var allText = line.text,
            len = allText.length;
        var pos = 0,
            i = 1,
            text = "",
            style;
        var nextChange = 0,
            spanStyle, spanEndStyle, spanStartStyle, collapsed;
        for (;;) {
            if (nextChange == pos) { // Update current marker set
                spanStyle = spanEndStyle = spanStartStyle = "";
                collapsed = null;
                nextChange = Infinity;
                var foundBookmark = null;
                for (var j = 0; j < spans.length; ++j) {
                    var sp = spans[j],
                        m = sp.marker;
                    if (sp.from <= pos && (sp.to == null || sp.to > pos)) {
                        if (sp.to != null && nextChange > sp.to) {
                            nextChange = sp.to;
                            spanEndStyle = "";
                        }
                        if (m.className) spanStyle += " " + m.className;
                        if (m.startStyle && sp.from == pos) spanStartStyle += " " + m.startStyle;
                        if (m.endStyle && sp.to == nextChange) spanEndStyle += " " + m.endStyle;
                        if (m.collapsed && (!collapsed || collapsed.marker.width < m.width))
                            collapsed = sp;
                    } else if (sp.from > pos && nextChange > sp.from) {
                        nextChange = sp.from;
                    }
                    if (m.type == "bookmark" && sp.from == pos && m.replacedWith)
                        foundBookmark = m.replacedWith;
                }
                if (collapsed && (collapsed.from || 0) == pos) {
                    buildCollapsedSpan(builder, (collapsed.to == null ? len : collapsed.to) - pos,
                        collapsed.from != null && collapsed.marker.replacedWith);
                    if (collapsed.to == null) return collapsed.marker.find();
                }
                if (foundBookmark && !collapsed) buildCollapsedSpan(builder, 0, foundBookmark);
            }
            if (pos >= len) break;

            var upto = Math.min(len, nextChange);
            while (true) {
                if (text) {
                    var end = pos + text.length;
                    if (!collapsed) {
                        var tokenText = end > upto ? text.slice(0, upto - pos) : text;
                        builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle,
                            spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "");
                    }
                    if (end >= upto) {
                        text = text.slice(upto - pos);
                        pos = upto;
                        break;
                    }
                    pos = end;
                    spanStartStyle = "";
                }
                text = styles[i++];
                style = styleToClass(styles[i++]);
            }
        }
    }

    // DOCUMENT DATA STRUCTURE

    function updateDoc(doc, change, markedSpans, selAfter, estimateHeight) {
        function spansFor(n) {
            return markedSpans ? markedSpans[n] : null;
        }

        var from = change.from,
            to = change.to,
            text = change.text;
        var firstLine = getLine(doc, from.line),
            lastLine = getLine(doc, to.line);
        var lastText = lst(text),
            lastSpans = spansFor(text.length - 1),
            nlines = to.line - from.line;

        // First adjust the line structure
        if (from.ch == 0 && to.ch == 0 && lastText == "") {
            // This is a whole-line replace. Treated specially to make
            // sure line objects move the way they are supposed to.
            for (var i = 0, e = text.length - 1, added = []; i < e; ++i)
                added.push(makeLine(text[i], spansFor(i), estimateHeight));
            updateLine(lastLine, lastLine.text, lastSpans, estimateHeight);
            if (nlines) doc.remove(from.line, nlines);
            if (added.length) doc.insert(from.line, added);
        } else if (firstLine == lastLine) {
            if (text.length == 1) {
                updateLine(firstLine, firstLine.text.slice(0, from.ch) + lastText + firstLine.text.slice(to.ch),
                    lastSpans, estimateHeight);
            } else {
                for (var added = [], i = 1, e = text.length - 1; i < e; ++i)
                    added.push(makeLine(text[i], spansFor(i), estimateHeight));
                added.push(makeLine(lastText + firstLine.text.slice(to.ch), lastSpans, estimateHeight));
                updateLine(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0), estimateHeight);
                doc.insert(from.line + 1, added);
            }
        } else if (text.length == 1) {
            updateLine(firstLine, firstLine.text.slice(0, from.ch) + text[0] + lastLine.text.slice(to.ch),
                spansFor(0), estimateHeight);
            doc.remove(from.line + 1, nlines);
        } else {
            updateLine(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0), estimateHeight);
            updateLine(lastLine, lastText + lastLine.text.slice(to.ch), lastSpans, estimateHeight);
            for (var i = 1, e = text.length - 1, added = []; i < e; ++i)
                added.push(makeLine(text[i], spansFor(i), estimateHeight));
            if (nlines > 1) doc.remove(from.line + 1, nlines - 1);
            doc.insert(from.line + 1, added);
        }

        signalLater(doc, "change", doc, change);
        setSelection(doc, selAfter.anchor, selAfter.head, null, true);
    }

    function LeafChunk(lines) {
        this.lines = lines;
        this.parent = null;
        for (var i = 0, e = lines.length, height = 0; i < e; ++i) {
            lines[i].parent = this;
            height += lines[i].height;
        }
        this.height = height;
    }

    LeafChunk.prototype = {
        chunkSize: function() {
            return this.lines.length;
        },
        removeInner: function(at, n) {
            for (var i = at, e = at + n; i < e; ++i) {
                var line = this.lines[i];
                this.height -= line.height;
                cleanUpLine(line);
                signalLater(line, "delete");
            }
            this.lines.splice(at, n);
        },
        collapse: function(lines) {
            lines.splice.apply(lines, [lines.length, 0].concat(this.lines));
        },
        insertInner: function(at, lines, height) {
            this.height += height;
            this.lines = this.lines.slice(0, at).concat(lines).concat(this.lines.slice(at));
            for (var i = 0, e = lines.length; i < e; ++i) lines[i].parent = this;
        },
        iterN: function(at, n, op) {
            for (var e = at + n; at < e; ++at)
                if (op(this.lines[at])) return true;
        }
    };

    function BranchChunk(children) {
        this.children = children;
        var size = 0,
            height = 0;
        for (var i = 0, e = children.length; i < e; ++i) {
            var ch = children[i];
            size += ch.chunkSize();
            height += ch.height;
            ch.parent = this;
        }
        this.size = size;
        this.height = height;
        this.parent = null;
    }

    BranchChunk.prototype = {
        chunkSize: function() {
            return this.size;
        },
        removeInner: function(at, n) {
            this.size -= n;
            for (var i = 0; i < this.children.length; ++i) {
                var child = this.children[i],
                    sz = child.chunkSize();
                if (at < sz) {
                    var rm = Math.min(n, sz - at),
                        oldHeight = child.height;
                    child.removeInner(at, rm);
                    this.height -= oldHeight - child.height;
                    if (sz == rm) {
                        this.children.splice(i--, 1);
                        child.parent = null;
                    }
                    if ((n -= rm) == 0) break;
                    at = 0;
                } else at -= sz;
            }
            if (this.size - n < 25) {
                var lines = [];
                this.collapse(lines);
                this.children = [new LeafChunk(lines)];
                this.children[0].parent = this;
            }
        },
        collapse: function(lines) {
            for (var i = 0, e = this.children.length; i < e; ++i) this.children[i].collapse(lines);
        },
        insertInner: function(at, lines, height) {
            this.size += lines.length;
            this.height += height;
            for (var i = 0, e = this.children.length; i < e; ++i) {
                var child = this.children[i],
                    sz = child.chunkSize();
                if (at <= sz) {
                    child.insertInner(at, lines, height);
                    if (child.lines && child.lines.length > 50) {
                        while (child.lines.length > 50) {
                            var spilled = child.lines.splice(child.lines.length - 25, 25);
                            var newleaf = new LeafChunk(spilled);
                            child.height -= newleaf.height;
                            this.children.splice(i + 1, 0, newleaf);
                            newleaf.parent = this;
                        }
                        this.maybeSpill();
                    }
                    break;
                }
                at -= sz;
            }
        },
        maybeSpill: function() {
            if (this.children.length <= 10) return;
            var me = this;
            do {
                var spilled = me.children.splice(me.children.length - 5, 5);
                var sibling = new BranchChunk(spilled);
                if (!me.parent) { // Become the parent node
                    var copy = new BranchChunk(me.children);
                    copy.parent = me;
                    me.children = [copy, sibling];
                    me = copy;
                } else {
                    me.size -= sibling.size;
                    me.height -= sibling.height;
                    var myIndex = indexOf(me.parent.children, me);
                    me.parent.children.splice(myIndex + 1, 0, sibling);
                }
                sibling.parent = me.parent;
            } while (me.children.length > 10);
            me.parent.maybeSpill();
        },
        iterN: function(at, n, op) {
            for (var i = 0, e = this.children.length; i < e; ++i) {
                var child = this.children[i],
                    sz = child.chunkSize();
                if (at < sz) {
                    var used = Math.min(n, sz - at);
                    if (child.iterN(at, used, op)) return true;
                    if ((n -= used) == 0) break;
                    at = 0;
                } else at -= sz;
            }
        }
    };

    var nextDocId = 0;
    var Doc = CodeMirror.Doc = function(text, mode, firstLine) {
        if (!(this instanceof Doc)) return new Doc(text, mode, firstLine);
        if (firstLine == null) firstLine = 0;

        BranchChunk.call(this, [new LeafChunk([makeLine("", null)])]);
        this.first = firstLine;
        this.scrollTop = this.scrollLeft = 0;
        this.cantEdit = false;
        this.history = makeHistory();
        this.frontier = firstLine;
        var start = Pos(firstLine, 0);
        this.sel = {
            from: start,
            to: start,
            head: start,
            anchor: start,
            shift: false,
            extend: false,
            goalColumn: null
        };
        this.id = ++nextDocId;
        this.modeOption = mode;

        if (typeof text == "string") text = splitLines(text);
        updateDoc(this, {
            from: start,
            to: start,
            text: text
        }, null, {
            head: start,
            anchor: start
        });
    };

    Doc.prototype = createObj(BranchChunk.prototype, {
        iter: function(from, to, op) {
            if (op) this.iterN(from - this.first, to - from, op);
            else this.iterN(this.first, this.first + this.size, from);
        },

        insert: function(at, lines) {
            var height = 0;
            for (var i = 0, e = lines.length; i < e; ++i) height += lines[i].height;
            this.insertInner(at - this.first, lines, height);
        },
        remove: function(at, n) {
            this.removeInner(at - this.first, n);
        },

        getValue: function(lineSep) {
            var lines = getLines(this, this.first, this.first + this.size);
            if (lineSep === false) return lines;
            return lines.join(lineSep || "\n");
        },
        setValue: function(code) {
            var top = Pos(this.first, 0),
                last = this.first + this.size - 1;
            makeChange(this, {
                from: top,
                to: Pos(last, getLine(this, last).text.length),
                text: splitLines(code),
                origin: "setValue"
            }, {
                head: top,
                anchor: top
            }, true);
        },
        replaceRange: function(code, from, to, origin) {
            from = clipPos(this, from);
            to = to ? clipPos(this, to) : from;
            replaceRange(this, code, from, to, origin);
        },
        getRange: function(from, to, lineSep) {
            var lines = getBetween(this, clipPos(this, from), clipPos(this, to));
            if (lineSep === false) return lines;
            return lines.join(lineSep || "\n");
        },

        getLine: function(line) {
            var l = this.getLineHandle(line);
            return l && l.text;
        },
        setLine: function(line, text) {
            if (isLine(this, line))
                replaceRange(this, text, Pos(line, 0), clipPos(this, Pos(line)));
        },
        removeLine: function(line) {
            if (isLine(this, line))
                replaceRange(this, "", Pos(line, 0), clipPos(this, Pos(line + 1, 0)));
        },

        getLineHandle: function(line) {
            if (isLine(this, line)) return getLine(this, line);
        },
        getLineNumber: function(line) {
            return lineNo(line);
        },

        lineCount: function() {
            return this.size;
        },
        firstLine: function() {
            return this.first;
        },
        lastLine: function() {
            return this.first + this.size - 1;
        },

        clipPos: function(pos) {
            return clipPos(this, pos);
        },

        getCursor: function(start) {
            var sel = this.sel,
                pos;
            if (start == null || start == "head") pos = sel.head;
            else if (start == "anchor") pos = sel.anchor;
            else if (start == "end" || start === false) pos = sel.to;
            else pos = sel.from;
            return copyPos(pos);
        },
        somethingSelected: function() {
            return !posEq(this.sel.head, this.sel.anchor);
        },

        setCursor: docOperation(function(line, ch, extend) {
            var pos = clipPos(this, typeof line == "number" ? Pos(line, ch || 0) : line);
            if (extend) extendSelection(this, pos);
            else setSelection(this, pos, pos);
        }),
        setSelection: docOperation(function(anchor, head) {
            setSelection(this, clipPos(this, anchor), clipPos(this, head || anchor));
        }),
        extendSelection: docOperation(function(from, to) {
            extendSelection(this, clipPos(this, from), to && clipPos(this, to));
        }),

        getSelection: function(lineSep) {
            return this.getRange(this.sel.from, this.sel.to, lineSep);
        },
        replaceSelection: function(code, collapse, origin) {
            makeChange(this, {
                from: this.sel.from,
                to: this.sel.to,
                text: splitLines(code),
                origin: origin
            }, collapse || "around");
        },
        undo: docOperation(function() {
            makeChangeFromHistory(this, "undo");
        }),
        redo: docOperation(function() {
            makeChangeFromHistory(this, "redo");
        }),

        setExtending: function(val) {
            this.sel.extend = val;
        },

        historySize: function() {
            var hist = this.history;
            return {
                undo: hist.done.length,
                redo: hist.undone.length
            };
        },
        clearHistory: function() {
            this.history = makeHistory();
        },

        markClean: function() {
            this.history.dirtyCounter = 0;
            this.history.lastOp = this.history.lastOrigin = null;
        },
        isClean: function() {
            return this.history.dirtyCounter == 0;
        },

        getHistory: function() {
            return {
                done: copyHistoryArray(this.history.done),
                undone: copyHistoryArray(this.history.undone)
            };
        },
        setHistory: function(histData) {
            var hist = this.history = makeHistory();
            hist.done = histData.done.slice(0);
            hist.undone = histData.undone.slice(0);
        },

        markText: function(from, to, options) {
            return markText(this, clipPos(this, from), clipPos(this, to), options, "range");
        },
        setBookmark: function(pos, options) {
            var realOpts = {
                replacedWith: options && (options.nodeType == null ? options.widget : options),
                insertLeft: options && options.insertLeft
            };
            pos = clipPos(this, pos);
            return markText(this, pos, pos, realOpts, "bookmark");
        },
        findMarksAt: function(pos) {
            pos = clipPos(this, pos);
            var markers = [],
                spans = getLine(this, pos.line).markedSpans;
            if (spans)
                for (var i = 0; i < spans.length; ++i) {
                    var span = spans[i];
                    if ((span.from == null || span.from <= pos.ch) &&
                        (span.to == null || span.to >= pos.ch))
                        markers.push(span.marker.parent || span.marker);
                }
            return markers;
        },
        getAllMarks: function() {
            var markers = [];
            this.iter(function(line) {
                var sps = line.markedSpans;
                if (sps)
                    for (var i = 0; i < sps.length; ++i)
                        if (sps[i].from != null) markers.push(sps[i].marker);
            });
            return markers;
        },

        posFromIndex: function(off) {
            var ch, lineNo = this.first;
            this.iter(function(line) {
                var sz = line.text.length + 1;
                if (sz > off) {
                    ch = off;
                    return true;
                }
                off -= sz;
                ++lineNo;
            });
            return clipPos(this, Pos(lineNo, ch));
        },
        indexFromPos: function(coords) {
            coords = clipPos(this, coords);
            var index = coords.ch;
            if (coords.line < this.first || coords.ch < 0) return 0;
            this.iter(this.first, coords.line, function(line) {
                index += line.text.length + 1;
            });
            return index;
        },

        copy: function(copyHistory) {
            var doc = new Doc(getLines(this, this.first, this.first + this.size), this.modeOption, this.first);
            doc.scrollTop = this.scrollTop;
            doc.scrollLeft = this.scrollLeft;
            doc.sel = {
                from: this.sel.from,
                to: this.sel.to,
                head: this.sel.head,
                anchor: this.sel.anchor,
                shift: this.sel.shift,
                extend: false,
                goalColumn: this.sel.goalColumn
            };
            if (copyHistory) {
                doc.history.undoDepth = this.history.undoDepth;
                doc.setHistory(this.getHistory());
            }
            return doc;
        },

        linkedDoc: function(options) {
            if (!options) options = {};
            var from = this.first,
                to = this.first + this.size;
            if (options.from != null && options.from > from) from = options.from;
            if (options.to != null && options.to < to) to = options.to;
            var copy = new Doc(getLines(this, from, to), options.mode || this.modeOption, from);
            if (options.sharedHist) copy.history = this.history;
            (this.linked || (this.linked = [])).push({
                doc: copy,
                sharedHist: options.sharedHist
            });
            copy.linked = [{
                doc: this,
                isParent: true,
                sharedHist: options.sharedHist
            }];
            return copy;
        },
        unlinkDoc: function(other) {
            if (other instanceof CodeMirror) other = other.doc;
            if (this.linked)
                for (var i = 0; i < this.linked.length; ++i) {
                    var link = this.linked[i];
                    if (link.doc != other) continue;
                    this.linked.splice(i, 1);
                    other.unlinkDoc(this);
                    break;
                }
                // If the histories were shared, split them again
            if (other.history == this.history) {
                var splitIds = [other.id];
                linkedDocs(other, function(doc) {
                    splitIds.push(doc.id);
                }, true);
                other.history = makeHistory();
                other.history.done = copyHistoryArray(this.history.done, splitIds);
                other.history.undone = copyHistoryArray(this.history.undone, splitIds);
            }
        },
        iterLinkedDocs: function(f) {
            linkedDocs(this, f);
        },

        getMode: function() {
            return this.mode;
        },
        getEditor: function() {
            return this.cm;
        }
    });

    Doc.prototype.eachLine = Doc.prototype.iter;

    // The Doc methods that should be available on CodeMirror instances
    var dontDelegate = "iter insert remove copy getEditor".split(" ");
    for (var prop in Doc.prototype)
        if (Doc.prototype.hasOwnProperty(prop) && indexOf(dontDelegate, prop) < 0)
            CodeMirror.prototype[prop] = (function(method) {
                return function() {
                    return method.apply(this.doc, arguments);
                };
            })(Doc.prototype[prop]);

    function linkedDocs(doc, f, sharedHistOnly) {
        function propagate(doc, skip, sharedHist) {
            if (doc.linked)
                for (var i = 0; i < doc.linked.length; ++i) {
                    var rel = doc.linked[i];
                    if (rel.doc == skip) continue;
                    var shared = sharedHist && rel.sharedHist;
                    if (sharedHistOnly && !shared) continue;
                    f(rel.doc, shared);
                    propagate(rel.doc, doc, shared);
                }
        }
        propagate(doc, null, true);
    }

    function attachDoc(cm, doc) {
        if (doc.cm) throw new Error("This document is already in use.");
        cm.doc = doc;
        doc.cm = cm;
        estimateLineHeights(cm);
        loadMode(cm);
        if (!cm.options.lineWrapping) computeMaxLength(cm);
        cm.options.mode = doc.modeOption;
        regChange(cm);
    }

    // LINE UTILITIES

    function getLine(chunk, n) {
        n -= chunk.first;
        while (!chunk.lines) {
            for (var i = 0;; ++i) {
                var child = chunk.children[i],
                    sz = child.chunkSize();
                if (n < sz) {
                    chunk = child;
                    break;
                }
                n -= sz;
            }
        }
        return chunk.lines[n];
    }

    function getBetween(doc, start, end) {
        var out = [],
            n = start.line;
        doc.iter(start.line, end.line + 1, function(line) {
            var text = line.text;
            if (n == end.line) text = text.slice(0, end.ch);
            if (n == start.line) text = text.slice(start.ch);
            out.push(text);
            ++n;
        });
        return out;
    }

    function getLines(doc, from, to) {
        var out = [];
        doc.iter(from, to, function(line) {
            out.push(line.text);
        });
        return out;
    }

    function updateLineHeight(line, height) {
        var diff = height - line.height;
        for (var n = line; n; n = n.parent) n.height += diff;
    }

    function lineNo(line) {
        if (line.parent == null) return null;
        var cur = line.parent,
            no = indexOf(cur.lines, line);
        for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
            for (var i = 0;; ++i) {
                if (chunk.children[i] == cur) break;
                no += chunk.children[i].chunkSize();
            }
        }
        return no + cur.first;
    }

    function lineAtHeight(chunk, h) {
        var n = chunk.first;
        outer: do {
            for (var i = 0, e = chunk.children.length; i < e; ++i) {
                var child = chunk.children[i],
                    ch = child.height;
                if (h < ch) {
                    chunk = child;
                    continue outer;
                }
                h -= ch;
                n += child.chunkSize();
            }
            return n;
        } while (!chunk.lines);
        for (var i = 0, e = chunk.lines.length; i < e; ++i) {
            var line = chunk.lines[i],
                lh = line.height;
            if (h < lh) break;
            h -= lh;
        }
        return n + i;
    }

    function heightAtLine(cm, lineObj) {
        lineObj = visualLine(cm.doc, lineObj);

        var h = 0,
            chunk = lineObj.parent;
        for (var i = 0; i < chunk.lines.length; ++i) {
            var line = chunk.lines[i];
            if (line == lineObj) break;
            else h += line.height;
        }
        for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
            for (var i = 0; i < p.children.length; ++i) {
                var cur = p.children[i];
                if (cur == chunk) break;
                else h += cur.height;
            }
        }
        return h;
    }

    function getOrder(line) {
        var order = line.order;
        if (order == null) order = line.order = bidiOrdering(line.text);
        return order;
    }

    // HISTORY

    function makeHistory() {
        return {
            // Arrays of history events. Doing something adds an event to
            // done and clears undo. Undoing moves events from done to
            // undone, redoing moves them in the other direction.
            done: [],
            undone: [],
            undoDepth: Infinity,
            // Used to track when changes can be merged into a single undo
            // event
            lastTime: 0,
            lastOp: null,
            lastOrigin: null,
            // Used by the isClean() method
            dirtyCounter: 0
        };
    }

    function attachLocalSpans(doc, change, from, to) {
        var existing = change["spans_" + doc.id],
            n = 0;
        doc.iter(Math.max(doc.first, from), Math.min(doc.first + doc.size, to), function(line) {
            if (line.markedSpans)
                (existing || (existing = change["spans_" + doc.id] = {}))[n] = line.markedSpans;
            ++n;
        });
    }

    function historyChangeFromChange(doc, change) {
        var histChange = {
            from: change.from,
            to: changeEnd(change),
            text: getBetween(doc, change.from, change.to)
        };
        attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
        linkedDocs(doc, function(doc) {
            attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
        }, true);
        return histChange;
    }

    function addToHistory(doc, change, selAfter, opId) {
        var hist = doc.history;
        hist.undone.length = 0;
        var time = +new Date,
            cur = lst(hist.done);

        if (cur &&
            (hist.lastOp == opId ||
                hist.lastOrigin == change.origin && change.origin &&
                ((change.origin.charAt(0) == "+" && hist.lastTime > time - 600) || change.origin.charAt(0) == "*"))) {
            // Merge this change into the last event
            var last = lst(cur.changes);
            if (posEq(change.from, change.to) && posEq(change.from, last.to)) {
                // Optimized case for simple insertion -- don't want to add
                // new changesets for every character typed
                last.to = changeEnd(change);
            } else {
                // Add new sub-event
                cur.changes.push(historyChangeFromChange(doc, change));
            }
            cur.anchorAfter = selAfter.anchor;
            cur.headAfter = selAfter.head;
        } else {
            // Can not be merged, start a new event.
            cur = {
                changes: [historyChangeFromChange(doc, change)],
                anchorBefore: doc.sel.anchor,
                headBefore: doc.sel.head,
                anchorAfter: selAfter.anchor,
                headAfter: selAfter.head
            };
            hist.done.push(cur);
            while (hist.done.length > hist.undoDepth)
                hist.done.shift();
            if (hist.dirtyCounter < 0)
            // The user has made a change after undoing past the last clean state. 
            // We can never get back to a clean state now until markClean() is called.
                hist.dirtyCounter = NaN;
            else
                hist.dirtyCounter++;
        }
        hist.lastTime = time;
        hist.lastOp = opId;
        hist.lastOrigin = change.origin;
    }

    function removeClearedSpans(spans) {
        if (!spans) return null;
        for (var i = 0, out; i < spans.length; ++i) {
            if (spans[i].marker.explicitlyCleared) {
                if (!out) out = spans.slice(0, i);
            } else if (out) out.push(spans[i]);
        }
        return !out ? spans : out.length ? out : null;
    }

    function getOldSpans(doc, change) {
        var found = change["spans_" + doc.id];
        if (!found) return null;
        for (var i = 0, nw = []; i < change.text.length; ++i)
            nw.push(removeClearedSpans(found[i]));
        return nw;
    }

    // Used both to provide a JSON-safe object in .getHistory, and, when
    // detaching a document, to split the history in two
    function copyHistoryArray(events, newGroup) {
        for (var i = 0, copy = []; i < events.length; ++i) {
            var event = events[i],
                changes = event.changes,
                newChanges = [];
            copy.push({
                changes: newChanges,
                anchorBefore: event.anchorBefore,
                headBefore: event.headBefore,
                anchorAfter: event.anchorAfter,
                headAfter: event.headAfter
            });
            for (var j = 0; j < changes.length; ++j) {
                var change = changes[j],
                    m;
                newChanges.push({
                    from: change.from,
                    to: change.to,
                    text: change.text
                });
                if (newGroup)
                    for (var prop in change)
                        if (m = prop.match(/^spans_(\d+)$/)) {
                            if (indexOf(newGroup, Number(m[1])) > -1) {
                                lst(newChanges)[prop] = change[prop];
                                delete change[prop];
                            }
                        }
            }
        }
        return copy;
    }

    // Rebasing/resetting history to deal with externally-sourced changes

    function rebaseHistSel(pos, from, to, diff) {
        if (to < pos.line) {
            pos.line += diff;
        } else if (from < pos.line) {
            pos.line = from;
            pos.ch = 0;
        }
    }

    // Tries to rebase an array of history events given a change in the
    // document. If the change touches the same lines as the event, the
    // event, and everything 'behind' it, is discarded. If the change is
    // before the event, the event's positions are updated. Uses a
    // copy-on-write scheme for the positions, to avoid having to
    // reallocate them all on every rebase, but also avoid problems with
    // shared position objects being unsafely updated.
    function rebaseHistArray(array, from, to, diff) {
        for (var i = 0; i < array.length; ++i) {
            var sub = array[i],
                ok = true;
            for (var j = 0; j < sub.changes.length; ++j) {
                var cur = sub.changes[j];
                if (!sub.copied) {
                    cur.from = copyPos(cur.from);
                    cur.to = copyPos(cur.to);
                }
                if (to < cur.from.line) {
                    cur.from.line += diff;
                    cur.to.line += diff;
                } else if (from <= cur.to.line) {
                    ok = false;
                    break;
                }
            }
            if (!sub.copied) {
                sub.anchorBefore = copyPos(sub.anchorBefore);
                sub.headBefore = copyPos(sub.headBefore);
                sub.anchorAfter = copyPos(sub.anchorAfter);
                sub.readAfter = copyPos(sub.headAfter);
                sub.copied = true;
            }
            if (!ok) {
                array.splice(0, i + 1);
                i = 0;
            } else {
                rebaseHistSel(sub.anchorBefore);
                rebaseHistSel(sub.headBefore);
                rebaseHistSel(sub.anchorAfter);
                rebaseHistSel(sub.headAfter);
            }
        }
    }

    function rebaseHist(hist, change) {
        var from = change.from.line,
            to = change.to.line,
            diff = change.text.length - (to - from) - 1;
        rebaseHistArray(hist.done, from, to, diff);
        rebaseHistArray(hist.undone, from, to, diff);
    }

    // EVENT OPERATORS

    function stopMethod() {
            e_stop(this);
        }
        // Ensure an event has a stop method.
    function addStop(event) {
        if (!event.stop) event.stop = stopMethod;
        return event;
    }

    function e_preventDefault(e) {
        if (e.preventDefault) e.preventDefault();
        else e.returnValue = false;
    }

    function e_stopPropagation(e) {
        if (e.stopPropagation) e.stopPropagation();
        else e.cancelBubble = true;
    }

    function e_stop(e) {
        e_preventDefault(e);
        e_stopPropagation(e);
    }
    CodeMirror.e_stop = e_stop;
    CodeMirror.e_preventDefault = e_preventDefault;
    CodeMirror.e_stopPropagation = e_stopPropagation;

    function e_target(e) {
        return e.target || e.srcElement;
    }

    function e_button(e) {
        var b = e.which;
        if (b == null) {
            if (e.button & 1) b = 1;
            else if (e.button & 2) b = 3;
            else if (e.button & 4) b = 2;
        }
        if (mac && e.ctrlKey && b == 1) b = 3;
        return b;
    }

    // EVENT HANDLING

    function on(emitter, type, f) {
        if (emitter.addEventListener)
            emitter.addEventListener(type, f, false);
        else if (emitter.attachEvent)
            emitter.attachEvent("on" + type, f);
        else {
            var map = emitter._handlers || (emitter._handlers = {});
            var arr = map[type] || (map[type] = []);
            arr.push(f);
        }
    }

    function off(emitter, type, f) {
        if (emitter.removeEventListener)
            emitter.removeEventListener(type, f, false);
        else if (emitter.detachEvent)
            emitter.detachEvent("on" + type, f);
        else {
            var arr = emitter._handlers && emitter._handlers[type];
            if (!arr) return;
            for (var i = 0; i < arr.length; ++i)
                if (arr[i] == f) {
                    arr.splice(i, 1);
                    break;
                }
        }
    }

    function signal(emitter, type /*, values...*/ ) {
        var arr = emitter._handlers && emitter._handlers[type];
        if (!arr) return;
        var args = Array.prototype.slice.call(arguments, 2);
        for (var i = 0; i < arr.length; ++i) arr[i].apply(null, args);
    }

    var delayedCallbacks, delayedCallbackDepth = 0;

    function signalLater(emitter, type /*, values...*/ ) {
        var arr = emitter._handlers && emitter._handlers[type];
        if (!arr) return;
        var args = Array.prototype.slice.call(arguments, 2);
        if (!delayedCallbacks) {
            ++delayedCallbackDepth;
            delayedCallbacks = [];
            setTimeout(fireDelayed, 0);
        }

        function bnd(f) {
            return function() {
                f.apply(null, args);
            };
        };
        for (var i = 0; i < arr.length; ++i)
            delayedCallbacks.push(bnd(arr[i]));
    }

    function fireDelayed() {
        --delayedCallbackDepth;
        var delayed = delayedCallbacks;
        delayedCallbacks = null;
        for (var i = 0; i < delayed.length; ++i) delayed[i]();
    }

    function hasHandler(emitter, type) {
        var arr = emitter._handlers && emitter._handlers[type];
        return arr && arr.length > 0;
    }

    CodeMirror.on = on;
    CodeMirror.off = off;
    CodeMirror.signal = signal;

    // MISC UTILITIES

    // Number of pixels added to scroller and sizer to hide scrollbar
    var scrollerCutOff = 30;

    // Returned or thrown by various protocols to signal 'I'm not
    // handling this'.
    var Pass = CodeMirror.Pass = {
        toString: function() {
            return "CodeMirror.Pass";
        }
    };

    function Delayed() {
        this.id = null;
    }
    Delayed.prototype = {
        set: function(ms, f) {
            clearTimeout(this.id);
            this.id = setTimeout(f, ms);
        }
    };

    // Counts the column offset in a string, taking tabs into account.
    // Used mostly to find indentation.
    function countColumn(string, end, tabSize) {
        if (end == null) {
            end = string.search(/[^\s\u00a0]/);
            if (end == -1) end = string.length;
        }
        for (var i = 0, n = 0; i < end; ++i) {
            if (string.charAt(i) == "\t") n += tabSize - (n % tabSize);
            else ++n;
        }
        return n;
    }
    CodeMirror.countColumn = countColumn;

    var spaceStrs = [""];

    function spaceStr(n) {
        while (spaceStrs.length <= n)
            spaceStrs.push(lst(spaceStrs) + " ");
        return spaceStrs[n];
    }

    function lst(arr) {
        return arr[arr.length - 1];
    }

    function selectInput(node) {
        if (ios) { // Mobile Safari apparently has a bug where select() is broken.
            node.selectionStart = 0;
            node.selectionEnd = node.value.length;
        } else node.select();
    }

    function indexOf(collection, elt) {
        if (collection.indexOf) return collection.indexOf(elt);
        for (var i = 0, e = collection.length; i < e; ++i)
            if (collection[i] == elt) return i;
        return -1;
    }

    function createObj(base, props) {
        function Obj() {}
        Obj.prototype = base;
        var inst = new Obj();
        if (props) copyObj(props, inst);
        return inst;
    }

    function copyObj(obj, target) {
        if (!target) target = {};
        for (var prop in obj)
            if (obj.hasOwnProperty(prop)) target[prop] = obj[prop];
        return target;
    }

    function emptyArray(size) {
        for (var a = [], i = 0; i < size; ++i) a.push(undefined);
        return a;
    }

    function bind(f) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function() {
            return f.apply(null, args);
        };
    }

    var nonASCIISingleCaseWordChar = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc]/;

    function isWordChar(ch) {
        return /\w/.test(ch) || ch > "\x80" &&
            (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch));
    }

    function isEmpty(obj) {
        for (var n in obj)
            if (obj.hasOwnProperty(n) && obj[n]) return false;
        return true;
    }

    var isExtendingChar = /[\u0300-\u036F\u0483-\u0487\u0488-\u0489\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED\uA66F\uA670-\uA672\uA674-\uA67D\uA69F\udc00-\udfff]/;

    // DOM UTILITIES

    function elt(tag, content, className, style) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (style) e.style.cssText = style;
        if (typeof content == "string") setTextContent(e, content);
        else if (content)
            for (var i = 0; i < content.length; ++i) e.appendChild(content[i]);
        return e;
    }

    function removeChildren(e) {
        // IE will break all parent-child relations in subnodes when setting innerHTML
        if (!ie) e.innerHTML = "";
        else
            while (e.firstChild) e.removeChild(e.firstChild);
        return e;
    }

    function removeChildrenAndAdd(parent, e) {
        return removeChildren(parent).appendChild(e);
    }

    function setTextContent(e, str) {
        if (ie_lt9) {
            e.innerHTML = "";
            e.appendChild(document.createTextNode(str));
        } else e.textContent = str;
    }

    function getRect(node) {
        return node.getBoundingClientRect();
    }
    CodeMirror.replaceGetRect = function(f) {
        getRect = f;
    };

    // FEATURE DETECTION

    // Detect drag-and-drop
    var dragAndDrop = function() {
        // There is *some* kind of drag-and-drop support in IE6-8, but I
        // couldn't get it to work yet.
        if (ie_lt9) return false;
        var div = elt('div');
        return "draggable" in div || "dragDrop" in div;
    }();

    // For a reason I have yet to figure out, some browsers disallow
    // word wrapping between certain characters *only* if a new inline
    // element is started between them. This makes it hard to reliably
    // measure the position of things, since that requires inserting an
    // extra span. This terribly fragile set of regexps matches the
    // character combinations that suffer from this phenomenon on the
    // various browsers.
    var spanAffectsWrapping = /^$/; // Won't match any two-character string
    if (gecko) spanAffectsWrapping = /$'/;
    else if (safari) spanAffectsWrapping = /\-[^ \-?]|\?[^ !'\"\),.\-\/:;\?\]\}]/;
    else if (chrome) spanAffectsWrapping = /\-[^ \-\.?]|\?[^ \-\.?\]\}:;!'\"\),\/]|[\.!\"#&%\)*+,:;=>\]|\}~][\(\{\[<]|\$'/;

    var knownScrollbarWidth;

    function scrollbarWidth(measure) {
        if (knownScrollbarWidth != null) return knownScrollbarWidth;
        var test = elt("div", null, null, "width: 50px; height: 50px; overflow-x: scroll");
        removeChildrenAndAdd(measure, test);
        if (test.offsetWidth)
            knownScrollbarWidth = test.offsetHeight - test.clientHeight;
        return knownScrollbarWidth || 0;
    }

    var zwspSupported;

    function zeroWidthElement(measure) {
        if (zwspSupported == null) {
            var test = elt("span", "\u200b");
            removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]));
            if (measure.firstChild.offsetHeight != 0)
                zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !ie_lt8;
        }
        if (zwspSupported) return elt("span", "\u200b");
        else return elt("span", "\u00a0", null, "display: inline-block; width: 1px; margin-right: -1px");
    }

    // See if "".split is the broken IE version, if so, provide an
    // alternative way to split lines.
    var splitLines = "\n\nb".split(/\n/).length != 3 ? function(string) {
        var pos = 0,
            result = [],
            l = string.length;
        while (pos <= l) {
            var nl = string.indexOf("\n", pos);
            if (nl == -1) nl = string.length;
            var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl);
            var rt = line.indexOf("\r");
            if (rt != -1) {
                result.push(line.slice(0, rt));
                pos += rt + 1;
            } else {
                result.push(line);
                pos = nl + 1;
            }
        }
        return result;
    } : function(string) {
        return string.split(/\r\n?|\n/);
    };
    CodeMirror.splitLines = splitLines;

    var hasSelection = window.getSelection ? function(te) {
        try {
            return te.selectionStart != te.selectionEnd;
        } catch (e) {
            return false;
        }
    } : function(te) {
        try {
            var range = te.ownerDocument.selection.createRange();
        } catch (e) {}
        if (!range || range.parentElement() != te) return false;
        return range.compareEndPoints("StartToEnd", range) != 0;
    };

    var hasCopyEvent = (function() {
        var e = elt("div");
        if ("oncopy" in e) return true;
        e.setAttribute("oncopy", "return;");
        return typeof e.oncopy == 'function';
    })();

    // KEY NAMING

    var keyNames = {
        3: "Enter",
        8: "Backspace",
        9: "Tab",
        13: "Enter",
        16: "Shift",
        17: "Ctrl",
        18: "Alt",
        19: "Pause",
        20: "CapsLock",
        27: "Esc",
        32: "Space",
        33: "PageUp",
        34: "PageDown",
        35: "End",
        36: "Home",
        37: "Left",
        38: "Up",
        39: "Right",
        40: "Down",
        44: "PrintScrn",
        45: "Insert",
        46: "Delete",
        59: ";",
        91: "Mod",
        92: "Mod",
        93: "Mod",
        109: "-",
        107: "=",
        127: "Delete",
        186: ";",
        187: "=",
        188: ",",
        189: "-",
        190: ".",
        191: "/",
        192: "`",
        219: "[",
        220: "\\",
        221: "]",
        222: "'",
        63276: "PageUp",
        63277: "PageDown",
        63275: "End",
        63273: "Home",
        63234: "Left",
        63232: "Up",
        63235: "Right",
        63233: "Down",
        63302: "Insert",
        63272: "Delete"
    };
    CodeMirror.keyNames = keyNames;
    (function() {
        // Number keys
        for (var i = 0; i < 10; i++) keyNames[i + 48] = String(i);
        // Alphabetic keys
        for (var i = 65; i <= 90; i++) keyNames[i] = String.fromCharCode(i);
        // Function keys
        for (var i = 1; i <= 12; i++) keyNames[i + 111] = keyNames[i + 63235] = "F" + i;
    })();

    // BIDI HELPERS

    function iterateBidiSections(order, from, to, f) {
        if (!order) return f(from, to, "ltr");
        for (var i = 0; i < order.length; ++i) {
            var part = order[i];
            if (part.from < to && part.to > from || from == to && part.to == from)
                f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr");
        }
    }

    function bidiLeft(part) {
        return part.level % 2 ? part.to : part.from;
    }

    function bidiRight(part) {
        return part.level % 2 ? part.from : part.to;
    }

    function lineLeft(line) {
        var order = getOrder(line);
        return order ? bidiLeft(order[0]) : 0;
    }

    function lineRight(line) {
        var order = getOrder(line);
        if (!order) return line.text.length;
        return bidiRight(lst(order));
    }

    function lineStart(cm, lineN) {
        var line = getLine(cm.doc, lineN);
        var visual = visualLine(cm.doc, line);
        if (visual != line) lineN = lineNo(visual);
        var order = getOrder(visual);
        var ch = !order ? 0 : order[0].level % 2 ? lineRight(visual) : lineLeft(visual);
        return Pos(lineN, ch);
    }

    function lineEnd(cm, lineN) {
        var merged, line;
        while (merged = collapsedSpanAtEnd(line = getLine(cm.doc, lineN)))
            lineN = merged.find().to.line;
        var order = getOrder(line);
        var ch = !order ? line.text.length : order[0].level % 2 ? lineLeft(line) : lineRight(line);
        return Pos(lineN, ch);
    }

    // This is somewhat involved. It is needed in order to move
    // 'visually' through bi-directional text -- i.e., pressing left
    // should make the cursor go left, even when in RTL text. The
    // tricky part is the 'jumps', where RTL and LTR text touch each
    // other. This often requires the cursor offset to move more than
    // one unit, in order to visually move one unit.
    function moveVisually(line, start, dir, byUnit) {
        var bidi = getOrder(line);
        if (!bidi) return moveLogically(line, start, dir, byUnit);
        var moveOneUnit = byUnit ? function(pos, dir) {
            do pos += dir;
            while (pos > 0 && isExtendingChar.test(line.text.charAt(pos)));
            return pos;
        } : function(pos, dir) {
            return pos + dir;
        };
        var linedir = bidi[0].level;
        for (var i = 0; i < bidi.length; ++i) {
            var part = bidi[i],
                sticky = part.level % 2 == linedir;
            if ((part.from < start && part.to > start) ||
                (sticky && (part.from == start || part.to == start))) break;
        }
        var target = moveOneUnit(start, part.level % 2 ? -dir : dir);

        while (target != null) {
            if (part.level % 2 == linedir) {
                if (target < part.from || target > part.to) {
                    part = bidi[i += dir];
                    target = part && (dir > 0 == part.level % 2 ? moveOneUnit(part.to, -1) : moveOneUnit(part.from, 1));
                } else break;
            } else {
                if (target == bidiLeft(part)) {
                    part = bidi[--i];
                    target = part && bidiRight(part);
                } else if (target == bidiRight(part)) {
                    part = bidi[++i];
                    target = part && bidiLeft(part);
                } else break;
            }
        }

        return target < 0 || target > line.text.length ? null : target;
    }

    function moveLogically(line, start, dir, byUnit) {
        var target = start + dir;
        if (byUnit)
            while (target > 0 && isExtendingChar.test(line.text.charAt(target))) target += dir;
        return target < 0 || target > line.text.length ? null : target;
    }

    // Bidirectional ordering algorithm
    // See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
    // that this (partially) implements.

    // One-char codes used for character types:
    // L (L):   Left-to-Right
    // R (R):   Right-to-Left
    // r (AL):  Right-to-Left Arabic
    // 1 (EN):  European Number
    // + (ES):  European Number Separator
    // % (ET):  European Number Terminator
    // n (AN):  Arabic Number
    // , (CS):  Common Number Separator
    // m (NSM): Non-Spacing Mark
    // b (BN):  Boundary Neutral
    // s (B):   Paragraph Separator
    // t (S):   Segment Separator
    // w (WS):  Whitespace
    // N (ON):  Other Neutrals

    // Returns null if characters are ordered as they appear
    // (left-to-right), or an array of sections ({from, to, level}
    // objects) in the order in which they occur visually.
    var bidiOrdering = (function() {
        // Character types for codepoints 0 to 0xff
        var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLL";
        // Character types for codepoints 0x600 to 0x6ff
        var arabicTypes = "rrrrrrrrrrrr,rNNmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmrrrrrrrnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmNmmmmrrrrrrrrrrrrrrrrrr";

        function charType(code) {
            if (code <= 0xff) return lowTypes.charAt(code);
            else if (0x590 <= code && code <= 0x5f4) return "R";
            else if (0x600 <= code && code <= 0x6ff) return arabicTypes.charAt(code - 0x600);
            else if (0x700 <= code && code <= 0x8ac) return "r";
            else return "L";
        }

        var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
        var isNeutral = /[stwN]/,
            isStrong = /[LRr]/,
            countsAsLeft = /[Lb1n]/,
            countsAsNum = /[1n]/;
        // Browsers seem to always treat the boundaries of block elements as being L.
        var outerType = "L";

        return function(str) {
            if (!bidiRE.test(str)) return false;
            var len = str.length,
                types = [];
            for (var i = 0, type; i < len; ++i)
                types.push(type = charType(str.charCodeAt(i)));

            // W1. Examine each non-spacing mark (NSM) in the level run, and
            // change the type of the NSM to the type of the previous
            // character. If the NSM is at the start of the level run, it will
            // get the type of sor.
            for (var i = 0, prev = outerType; i < len; ++i) {
                var type = types[i];
                if (type == "m") types[i] = prev;
                else prev = type;
            }

            // W2. Search backwards from each instance of a European number
            // until the first strong type (R, L, AL, or sor) is found. If an
            // AL is found, change the type of the European number to Arabic
            // number.
            // W3. Change all ALs to R.
            for (var i = 0, cur = outerType; i < len; ++i) {
                var type = types[i];
                if (type == "1" && cur == "r") types[i] = "n";
                else if (isStrong.test(type)) {
                    cur = type;
                    if (type == "r") types[i] = "R";
                }
            }

            // W4. A single European separator between two European numbers
            // changes to a European number. A single common separator between
            // two numbers of the same type changes to that type.
            for (var i = 1, prev = types[0]; i < len - 1; ++i) {
                var type = types[i];
                if (type == "+" && prev == "1" && types[i + 1] == "1") types[i] = "1";
                else if (type == "," && prev == types[i + 1] &&
                    (prev == "1" || prev == "n")) types[i] = prev;
                prev = type;
            }

            // W5. A sequence of European terminators adjacent to European
            // numbers changes to all European numbers.
            // W6. Otherwise, separators and terminators change to Other
            // Neutral.
            for (var i = 0; i < len; ++i) {
                var type = types[i];
                if (type == ",") types[i] = "N";
                else if (type == "%") {
                    for (var end = i + 1; end < len && types[end] == "%"; ++end) {}
                    var replace = (i && types[i - 1] == "!") || (end < len - 1 && types[end] == "1") ? "1" : "N";
                    for (var j = i; j < end; ++j) types[j] = replace;
                    i = end - 1;
                }
            }

            // W7. Search backwards from each instance of a European number
            // until the first strong type (R, L, or sor) is found. If an L is
            // found, then change the type of the European number to L.
            for (var i = 0, cur = outerType; i < len; ++i) {
                var type = types[i];
                if (cur == "L" && type == "1") types[i] = "L";
                else if (isStrong.test(type)) cur = type;
            }

            // N1. A sequence of neutrals takes the direction of the
            // surrounding strong text if the text on both sides has the same
            // direction. European and Arabic numbers act as if they were R in
            // terms of their influence on neutrals. Start-of-level-run (sor)
            // and end-of-level-run (eor) are used at level run boundaries.
            // N2. Any remaining neutrals take the embedding direction.
            for (var i = 0; i < len; ++i) {
                if (isNeutral.test(types[i])) {
                    for (var end = i + 1; end < len && isNeutral.test(types[end]); ++end) {}
                    var before = (i ? types[i - 1] : outerType) == "L";
                    var after = (end < len - 1 ? types[end] : outerType) == "L";
                    var replace = before || after ? "L" : "R";
                    for (var j = i; j < end; ++j) types[j] = replace;
                    i = end - 1;
                }
            }

            // Here we depart from the documented algorithm, in order to avoid
            // building up an actual levels array. Since there are only three
            // levels (0, 1, 2) in an implementation that doesn't take
            // explicit embedding into account, we can build up the order on
            // the fly, without following the level-based algorithm.
            var order = [],
                m;
            for (var i = 0; i < len;) {
                if (countsAsLeft.test(types[i])) {
                    var start = i;
                    for (++i; i < len && countsAsLeft.test(types[i]); ++i) {}
                    order.push({
                        from: start,
                        to: i,
                        level: 0
                    });
                } else {
                    var pos = i,
                        at = order.length;
                    for (++i; i < len && types[i] != "L"; ++i) {}
                    for (var j = pos; j < i;) {
                        if (countsAsNum.test(types[j])) {
                            if (pos < j) order.splice(at, 0, {
                                from: pos,
                                to: j,
                                level: 1
                            });
                            var nstart = j;
                            for (++j; j < i && countsAsNum.test(types[j]); ++j) {}
                            order.splice(at, 0, {
                                from: nstart,
                                to: j,
                                level: 2
                            });
                            pos = j;
                        } else ++j;
                    }
                    if (pos < i) order.splice(at, 0, {
                        from: pos,
                        to: i,
                        level: 1
                    });
                }
            }
            if (order[0].level == 1 && (m = str.match(/^\s+/))) {
                order[0].from = m[0].length;
                order.unshift({
                    from: 0,
                    to: m[0].length,
                    level: 0
                });
            }
            if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
                lst(order).to -= m[0].length;
                order.push({
                    from: len - m[0].length,
                    to: len,
                    level: 0
                });
            }
            if (order[0].level != lst(order).level)
                order.push({
                    from: len,
                    to: len,
                    level: order[0].level
                });

            return order;
        };
    })();

    // THE END

    CodeMirror.version = "3.1";

    return CodeMirror;
})();
/**
 * @version: 1.0 Alpha-1
 * @author: Coolite Inc. http://www.coolite.com/
 * @date: 2008-05-13
 * @copyright: Copyright (c) 2006-2008, Coolite Inc. (http://www.coolite.com/). All rights reserved.
 * @license: Licensed under The MIT License. See license.txt and http://www.datejs.com/license/. 
 * @website: http://www.datejs.com/
 */
Date.CultureInfo = {
    name: "en-US",
    englishName: "English (United States)",
    nativeName: "English (United States)",
    dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    abbreviatedDayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    shortestDayNames: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    firstLetterDayNames: ["S", "M", "T", "W", "T", "F", "S"],
    monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    abbreviatedMonthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    amDesignator: "AM",
    pmDesignator: "PM",
    firstDayOfWeek: 0,
    twoDigitYearMax: 2029,
    dateElementOrder: "mdy",
    formatPatterns: {
        shortDate: "M/d/yyyy",
        longDate: "dddd, MMMM dd, yyyy",
        shortTime: "h:mm tt",
        longTime: "h:mm:ss tt",
        fullDateTime: "dddd, MMMM dd, yyyy h:mm:ss tt",
        sortableDateTime: "yyyy-MM-ddTHH:mm:ss",
        universalSortableDateTime: "yyyy-MM-dd HH:mm:ssZ",
        rfc1123: "ddd, dd MMM yyyy HH:mm:ss GMT",
        monthDay: "MMMM dd",
        yearMonth: "MMMM, yyyy"
    },
    regexPatterns: {
        jan: /^jan(uary)?/i,
        feb: /^feb(ruary)?/i,
        mar: /^mar(ch)?/i,
        apr: /^apr(il)?/i,
        may: /^may/i,
        jun: /^jun(e)?/i,
        jul: /^jul(y)?/i,
        aug: /^aug(ust)?/i,
        sep: /^sep(t(ember)?)?/i,
        oct: /^oct(ober)?/i,
        nov: /^nov(ember)?/i,
        dec: /^dec(ember)?/i,
        sun: /^su(n(day)?)?/i,
        mon: /^mo(n(day)?)?/i,
        tue: /^tu(e(s(day)?)?)?/i,
        wed: /^we(d(nesday)?)?/i,
        thu: /^th(u(r(s(day)?)?)?)?/i,
        fri: /^fr(i(day)?)?/i,
        sat: /^sa(t(urday)?)?/i,
        future: /^next/i,
        past: /^last|past|prev(ious)?/i,
        add: /^(\+|aft(er)?|from|hence)/i,
        subtract: /^(\-|bef(ore)?|ago)/i,
        yesterday: /^yes(terday)?/i,
        today: /^t(od(ay)?)?/i,
        tomorrow: /^tom(orrow)?/i,
        now: /^n(ow)?/i,
        millisecond: /^ms|milli(second)?s?/i,
        second: /^sec(ond)?s?/i,
        minute: /^mn|min(ute)?s?/i,
        hour: /^h(our)?s?/i,
        week: /^w(eek)?s?/i,
        month: /^m(onth)?s?/i,
        day: /^d(ay)?s?/i,
        year: /^y(ear)?s?/i,
        shortMeridian: /^(a|p)/i,
        longMeridian: /^(a\.?m?\.?|p\.?m?\.?)/i,
        timezone: /^((e(s|d)t|c(s|d)t|m(s|d)t|p(s|d)t)|((gmt)?\s*(\+|\-)\s*\d\d\d\d?)|gmt|utc)/i,
        ordinalSuffix: /^\s*(st|nd|rd|th)/i,
        timeContext: /^\s*(\:|a(?!u|p)|p)/i
    },
    timezones: [{
        name: "UTC",
        offset: "-000"
    }, {
        name: "GMT",
        offset: "-000"
    }, {
        name: "EST",
        offset: "-0500"
    }, {
        name: "EDT",
        offset: "-0400"
    }, {
        name: "CST",
        offset: "-0600"
    }, {
        name: "CDT",
        offset: "-0500"
    }, {
        name: "MST",
        offset: "-0700"
    }, {
        name: "MDT",
        offset: "-0600"
    }, {
        name: "PST",
        offset: "-0800"
    }, {
        name: "PDT",
        offset: "-0700"
    }]
};
(function() {
    var $D = Date,
        $P = $D.prototype,
        $C = $D.CultureInfo,
        p = function(s, l) {
            if (!l) {
                l = 2;
            }
            return ("000" + s).slice(l * -1);
        };
    $P.clearTime = function() {
        this.setHours(0);
        this.setMinutes(0);
        this.setSeconds(0);
        this.setMilliseconds(0);
        return this;
    };
    $P.setTimeToNow = function() {
        var n = new Date();
        this.setHours(n.getHours());
        this.setMinutes(n.getMinutes());
        this.setSeconds(n.getSeconds());
        this.setMilliseconds(n.getMilliseconds());
        return this;
    };
    $D.today = function() {
        return new Date().clearTime();
    };
    $D.compare = function(date1, date2) {
        if (isNaN(date1) || isNaN(date2)) {
            throw new Error(date1 + " - " + date2);
        } else if (date1 instanceof Date && date2 instanceof Date) {
            return (date1 < date2) ? -1 : (date1 > date2) ? 1 : 0;
        } else {
            throw new TypeError(date1 + " - " + date2);
        }
    };
    $D.equals = function(date1, date2) {
        return (date1.compareTo(date2) === 0);
    };
    $D.getDayNumberFromName = function(name) {
        var n = $C.dayNames,
            m = $C.abbreviatedDayNames,
            o = $C.shortestDayNames,
            s = name.toLowerCase();
        for (var i = 0; i < n.length; i++) {
            if (n[i].toLowerCase() == s || m[i].toLowerCase() == s || o[i].toLowerCase() == s) {
                return i;
            }
        }
        return -1;
    };
    $D.getMonthNumberFromName = function(name) {
        var n = $C.monthNames,
            m = $C.abbreviatedMonthNames,
            s = name.toLowerCase();
        for (var i = 0; i < n.length; i++) {
            if (n[i].toLowerCase() == s || m[i].toLowerCase() == s) {
                return i;
            }
        }
        return -1;
    };
    $D.isLeapYear = function(year) {
        return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0);
    };
    $D.getDaysInMonth = function(year, month) {
        return [31, ($D.isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
    };
    $D.getTimezoneAbbreviation = function(offset) {
        var z = $C.timezones,
            p;
        for (var i = 0; i < z.length; i++) {
            if (z[i].offset === offset) {
                return z[i].name;
            }
        }
        return null;
    };
    $D.getTimezoneOffset = function(name) {
        var z = $C.timezones,
            p;
        for (var i = 0; i < z.length; i++) {
            if (z[i].name === name.toUpperCase()) {
                return z[i].offset;
            }
        }
        return null;
    };
    $P.clone = function() {
        return new Date(this.getTime());
    };
    $P.compareTo = function(date) {
        return Date.compare(this, date);
    };
    $P.equals = function(date) {
        return Date.equals(this, date || new Date());
    };
    $P.between = function(start, end) {
        return this.getTime() >= start.getTime() && this.getTime() <= end.getTime();
    };
    $P.isAfter = function(date) {
        return this.compareTo(date || new Date()) === 1;
    };
    $P.isBefore = function(date) {
        return (this.compareTo(date || new Date()) === -1);
    };
    $P.isToday = function() {
        return this.isSameDay(new Date());
    };
    $P.isSameDay = function(date) {
        return this.clone().clearTime().equals(date.clone().clearTime());
    };
    $P.addMilliseconds = function(value) {
        this.setMilliseconds(this.getMilliseconds() + value);
        return this;
    };
    $P.addSeconds = function(value) {
        return this.addMilliseconds(value * 1000);
    };
    $P.addMinutes = function(value) {
        return this.addMilliseconds(value * 60000);
    };
    $P.addHours = function(value) {
        return this.addMilliseconds(value * 3600000);
    };
    $P.addDays = function(value) {
        this.setDate(this.getDate() + value);
        return this;
    };
    $P.addWeeks = function(value) {
        return this.addDays(value * 7);
    };
    $P.addMonths = function(value) {
        var n = this.getDate();
        this.setDate(1);
        this.setMonth(this.getMonth() + value);
        this.setDate(Math.min(n, $D.getDaysInMonth(this.getFullYear(), this.getMonth())));
        return this;
    };
    $P.addYears = function(value) {
        return this.addMonths(value * 12);
    };
    $P.add = function(config) {
        if (typeof config == "number") {
            this._orient = config;
            return this;
        }
        var x = config;
        if (x.milliseconds) {
            this.addMilliseconds(x.milliseconds);
        }
        if (x.seconds) {
            this.addSeconds(x.seconds);
        }
        if (x.minutes) {
            this.addMinutes(x.minutes);
        }
        if (x.hours) {
            this.addHours(x.hours);
        }
        if (x.weeks) {
            this.addWeeks(x.weeks);
        }
        if (x.months) {
            this.addMonths(x.months);
        }
        if (x.years) {
            this.addYears(x.years);
        }
        if (x.days) {
            this.addDays(x.days);
        }
        return this;
    };
    var $y, $m, $d;
    $P.getWeek = function() {
        var a, b, c, d, e, f, g, n, s, w;
        $y = (!$y) ? this.getFullYear() : $y;
        $m = (!$m) ? this.getMonth() + 1 : $m;
        $d = (!$d) ? this.getDate() : $d;
        if ($m <= 2) {
            a = $y - 1;
            b = (a / 4 | 0) - (a / 100 | 0) + (a / 400 | 0);
            c = ((a - 1) / 4 | 0) - ((a - 1) / 100 | 0) + ((a - 1) / 400 | 0);
            s = b - c;
            e = 0;
            f = $d - 1 + (31 * ($m - 1));
        } else {
            a = $y;
            b = (a / 4 | 0) - (a / 100 | 0) + (a / 400 | 0);
            c = ((a - 1) / 4 | 0) - ((a - 1) / 100 | 0) + ((a - 1) / 400 | 0);
            s = b - c;
            e = s + 1;
            f = $d + ((153 * ($m - 3) + 2) / 5) + 58 + s;
        }
        g = (a + b) % 7;
        d = (f + g - e) % 7;
        n = (f + 3 - d) | 0;
        if (n < 0) {
            w = 53 - ((g - s) / 5 | 0);
        } else if (n > 364 + s) {
            w = 1;
        } else {
            w = (n / 7 | 0) + 1;
        }
        $y = $m = $d = null;
        return w;
    };
    $P.getISOWeek = function() {
        $y = this.getUTCFullYear();
        $m = this.getUTCMonth() + 1;
        $d = this.getUTCDate();
        return p(this.getWeek());
    };
    $P.setWeek = function(n) {
        return this.moveToDayOfWeek(1).addWeeks(n - this.getWeek());
    };
    $D._validate = function(n, min, max, name) {
        if (typeof n == "undefined") {
            return false;
        } else if (typeof n != "number") {
            throw new TypeError(n + " is not a Number.");
        } else if (n < min || n > max) {
            throw new RangeError(n + " is not a valid value for " + name + ".");
        }
        return true;
    };
    $D.validateMillisecond = function(value) {
        return $D._validate(value, 0, 999, "millisecond");
    };
    $D.validateSecond = function(value) {
        return $D._validate(value, 0, 59, "second");
    };
    $D.validateMinute = function(value) {
        return $D._validate(value, 0, 59, "minute");
    };
    $D.validateHour = function(value) {
        return $D._validate(value, 0, 23, "hour");
    };
    $D.validateDay = function(value, year, month) {
        return $D._validate(value, 1, $D.getDaysInMonth(year, month), "day");
    };
    $D.validateMonth = function(value) {
        return $D._validate(value, 0, 11, "month");
    };
    $D.validateYear = function(value) {
        return $D._validate(value, 0, 9999, "year");
    };
    $P.set = function(config) {
        if ($D.validateMillisecond(config.millisecond)) {
            this.addMilliseconds(config.millisecond - this.getMilliseconds());
        }
        if ($D.validateSecond(config.second)) {
            this.addSeconds(config.second - this.getSeconds());
        }
        if ($D.validateMinute(config.minute)) {
            this.addMinutes(config.minute - this.getMinutes());
        }
        if ($D.validateHour(config.hour)) {
            this.addHours(config.hour - this.getHours());
        }
        if ($D.validateMonth(config.month)) {
            this.addMonths(config.month - this.getMonth());
        }
        if ($D.validateYear(config.year)) {
            this.addYears(config.year - this.getFullYear());
        }
        if ($D.validateDay(config.day, this.getFullYear(), this.getMonth())) {
            this.addDays(config.day - this.getDate());
        }
        if (config.timezone) {
            this.setTimezone(config.timezone);
        }
        if (config.timezoneOffset) {
            this.setTimezoneOffset(config.timezoneOffset);
        }
        if (config.week && $D._validate(config.week, 0, 53, "week")) {
            this.setWeek(config.week);
        }
        return this;
    };
    $P.moveToFirstDayOfMonth = function() {
        return this.set({
            day: 1
        });
    };
    $P.moveToLastDayOfMonth = function() {
        return this.set({
            day: $D.getDaysInMonth(this.getFullYear(), this.getMonth())
        });
    };
    $P.moveToNthOccurrence = function(dayOfWeek, occurrence) {
        var shift = 0;
        if (occurrence > 0) {
            shift = occurrence - 1;
        } else if (occurrence === -1) {
            this.moveToLastDayOfMonth();
            if (this.getDay() !== dayOfWeek) {
                this.moveToDayOfWeek(dayOfWeek, -1);
            }
            return this;
        }
        return this.moveToFirstDayOfMonth().addDays(-1).moveToDayOfWeek(dayOfWeek, +1).addWeeks(shift);
    };
    $P.moveToDayOfWeek = function(dayOfWeek, orient) {
        var diff = (dayOfWeek - this.getDay() + 7 * (orient || +1)) % 7;
        return this.addDays((diff === 0) ? diff += 7 * (orient || +1) : diff);
    };
    $P.moveToMonth = function(month, orient) {
        var diff = (month - this.getMonth() + 12 * (orient || +1)) % 12;
        return this.addMonths((diff === 0) ? diff += 12 * (orient || +1) : diff);
    };
    $P.getOrdinalNumber = function() {
        return Math.ceil((this.clone().clearTime() - new Date(this.getFullYear(), 0, 1)) / 86400000) + 1;
    };
    $P.getTimezone = function() {
        return $D.getTimezoneAbbreviation(this.getUTCOffset());
    };
    $P.setTimezoneOffset = function(offset) {
        var here = this.getTimezoneOffset(),
            there = Number(offset) * -6 / 10;
        return this.addMinutes(there - here);
    };
    $P.setTimezone = function(offset) {
        return this.setTimezoneOffset($D.getTimezoneOffset(offset));
    };
    $P.hasDaylightSavingTime = function() {
        return (Date.today().set({
            month: 0,
            day: 1
        }).getTimezoneOffset() !== Date.today().set({
            month: 6,
            day: 1
        }).getTimezoneOffset());
    };
    $P.isDaylightSavingTime = function() {
        return (this.hasDaylightSavingTime() && new Date().getTimezoneOffset() === Date.today().set({
            month: 6,
            day: 1
        }).getTimezoneOffset());
    };
    $P.getUTCOffset = function() {
        var n = this.getTimezoneOffset() * -10 / 6,
            r;
        if (n < 0) {
            r = (n - 10000).toString();
            return r.charAt(0) + r.substr(2);
        } else {
            r = (n + 10000).toString();
            return "+" + r.substr(1);
        }
    };
    $P.getElapsed = function(date) {
        return (date || new Date()) - this;
    };
    if (!$P.toISOString) {
        $P.toISOString = function() {
            function f(n) {
                return n < 10 ? '0' + n : n;
            }
            return '"' + this.getUTCFullYear() + '-' +
                f(this.getUTCMonth() + 1) + '-' +
                f(this.getUTCDate()) + 'T' +
                f(this.getUTCHours()) + ':' +
                f(this.getUTCMinutes()) + ':' +
                f(this.getUTCSeconds()) + 'Z"';
        };
    }
    $P._toString = $P.toString;
    $P.toString = function(format) {
        var x = this;
        if (format && format.length == 1) {
            var c = $C.formatPatterns;
            x.t = x.toString;
            switch (format) {
                case "d":
                    return x.t(c.shortDate);
                case "D":
                    return x.t(c.longDate);
                case "F":
                    return x.t(c.fullDateTime);
                case "m":
                    return x.t(c.monthDay);
                case "r":
                    return x.t(c.rfc1123);
                case "s":
                    return x.t(c.sortableDateTime);
                case "t":
                    return x.t(c.shortTime);
                case "T":
                    return x.t(c.longTime);
                case "u":
                    return x.t(c.universalSortableDateTime);
                case "y":
                    return x.t(c.yearMonth);
            }
        }
        var ord = function(n) {
            switch (n * 1) {
                case 1:
                case 21:
                case 31:
                    return "st";
                case 2:
                case 22:
                    return "nd";
                case 3:
                case 23:
                    return "rd";
                default:
                    return "th";
            }
        };
        return format ? format.replace(/(\\)?(dd?d?d?|MM?M?M?|yy?y?y?|hh?|HH?|mm?|ss?|tt?|S)/g, function(m) {
            if (m.charAt(0) === "\\") {
                return m.replace("\\", "");
            }
            x.h = x.getHours;
            switch (m) {
                case "hh":
                    return p(x.h() < 13 ? (x.h() === 0 ? 12 : x.h()) : (x.h() - 12));
                case "h":
                    return x.h() < 13 ? (x.h() === 0 ? 12 : x.h()) : (x.h() - 12);
                case "HH":
                    return p(x.h());
                case "H":
                    return x.h();
                case "mm":
                    return p(x.getMinutes());
                case "m":
                    return x.getMinutes();
                case "ss":
                    return p(x.getSeconds());
                case "s":
                    return x.getSeconds();
                case "yyyy":
                    return p(x.getFullYear(), 4);
                case "yy":
                    return p(x.getFullYear());
                case "dddd":
                    return $C.dayNames[x.getDay()];
                case "ddd":
                    return $C.abbreviatedDayNames[x.getDay()];
                case "dd":
                    return p(x.getDate());
                case "d":
                    return x.getDate();
                case "MMMM":
                    return $C.monthNames[x.getMonth()];
                case "MMM":
                    return $C.abbreviatedMonthNames[x.getMonth()];
                case "MM":
                    return p((x.getMonth() + 1));
                case "M":
                    return x.getMonth() + 1;
                case "t":
                    return x.h() < 12 ? $C.amDesignator.substring(0, 1) : $C.pmDesignator.substring(0, 1);
                case "tt":
                    return x.h() < 12 ? $C.amDesignator : $C.pmDesignator;
                case "S":
                    return ord(x.getDate());
                default:
                    return m;
            }
        }) : this._toString();
    };
}());
(function() {
    var $D = Date,
        $P = $D.prototype,
        $C = $D.CultureInfo,
        $N = Number.prototype;
    $P._orient = +1;
    $P._nth = null;
    $P._is = false;
    $P._same = false;
    $P._isSecond = false;
    $N._dateElement = "day";
    $P.next = function() {
        this._orient = +1;
        return this;
    };
    $D.next = function() {
        return $D.today().next();
    };
    $P.last = $P.prev = $P.previous = function() {
        this._orient = -1;
        return this;
    };
    $D.last = $D.prev = $D.previous = function() {
        return $D.today().last();
    };
    $P.is = function() {
        this._is = true;
        return this;
    };
    $P.same = function() {
        this._same = true;
        this._isSecond = false;
        return this;
    };
    $P.today = function() {
        return this.same().day();
    };
    $P.weekday = function() {
        if (this._is) {
            this._is = false;
            return (!this.is().sat() && !this.is().sun());
        }
        return false;
    };
    $P.at = function(time) {
        return (typeof time === "string") ? $D.parse(this.toString("d") + " " + time) : this.set(time);
    };
    $N.fromNow = $N.after = function(date) {
        var c = {};
        c[this._dateElement] = this;
        return ((!date) ? new Date() : date.clone()).add(c);
    };
    $N.ago = $N.before = function(date) {
        var c = {};
        c[this._dateElement] = this * -1;
        return ((!date) ? new Date() : date.clone()).add(c);
    };
    var dx = ("sunday monday tuesday wednesday thursday friday saturday").split(/\s/),
        mx = ("january february march april may june july august september october november december").split(/\s/),
        px = ("Millisecond Second Minute Hour Day Week Month Year").split(/\s/),
        pxf = ("Milliseconds Seconds Minutes Hours Date Week Month FullYear").split(/\s/),
        nth = ("final first second third fourth fifth").split(/\s/),
        de;
    $P.toObject = function() {
        var o = {};
        for (var i = 0; i < px.length; i++) {
            o[px[i].toLowerCase()] = this["get" + pxf[i]]();
        }
        return o;
    };
    $D.fromObject = function(config) {
        config.week = null;
        return Date.today().set(config);
    };
    var df = function(n) {
        return function() {
            if (this._is) {
                this._is = false;
                return this.getDay() == n;
            }
            if (this._nth !== null) {
                if (this._isSecond) {
                    this.addSeconds(this._orient * -1);
                }
                this._isSecond = false;
                var ntemp = this._nth;
                this._nth = null;
                var temp = this.clone().moveToLastDayOfMonth();
                this.moveToNthOccurrence(n, ntemp);
                if (this > temp) {
                    throw new RangeError($D.getDayName(n) + " does not occur " + ntemp + " times in the month of " + $D.getMonthName(temp.getMonth()) + " " + temp.getFullYear() + ".");
                }
                return this;
            }
            return this.moveToDayOfWeek(n, this._orient);
        };
    };
    var sdf = function(n) {
        return function() {
            var t = $D.today(),
                shift = n - t.getDay();
            if (n === 0 && $C.firstDayOfWeek === 1 && t.getDay() !== 0) {
                shift = shift + 7;
            }
            return t.addDays(shift);
        };
    };
    for (var i = 0; i < dx.length; i++) {
        $D[dx[i].toUpperCase()] = $D[dx[i].toUpperCase().substring(0, 3)] = i;
        $D[dx[i]] = $D[dx[i].substring(0, 3)] = sdf(i);
        $P[dx[i]] = $P[dx[i].substring(0, 3)] = df(i);
    }
    var mf = function(n) {
        return function() {
            if (this._is) {
                this._is = false;
                return this.getMonth() === n;
            }
            return this.moveToMonth(n, this._orient);
        };
    };
    var smf = function(n) {
        return function() {
            return $D.today().set({
                month: n,
                day: 1
            });
        };
    };
    for (var j = 0; j < mx.length; j++) {
        $D[mx[j].toUpperCase()] = $D[mx[j].toUpperCase().substring(0, 3)] = j;
        $D[mx[j]] = $D[mx[j].substring(0, 3)] = smf(j);
        $P[mx[j]] = $P[mx[j].substring(0, 3)] = mf(j);
    }
    var ef = function(j) {
        return function() {
            if (this._isSecond) {
                this._isSecond = false;
                return this;
            }
            if (this._same) {
                this._same = this._is = false;
                var o1 = this.toObject(),
                    o2 = (arguments[0] || new Date()).toObject(),
                    v = "",
                    k = j.toLowerCase();
                for (var m = (px.length - 1); m > -1; m--) {
                    v = px[m].toLowerCase();
                    if (o1[v] != o2[v]) {
                        return false;
                    }
                    if (k == v) {
                        break;
                    }
                }
                return true;
            }
            if (j.substring(j.length - 1) != "s") {
                j += "s";
            }
            return this["add" + j](this._orient);
        };
    };
    var nf = function(n) {
        return function() {
            this._dateElement = n;
            return this;
        };
    };
    for (var k = 0; k < px.length; k++) {
        de = px[k].toLowerCase();
        $P[de] = $P[de + "s"] = ef(px[k]);
        $N[de] = $N[de + "s"] = nf(de);
    }
    $P._ss = ef("Second");
    var nthfn = function(n) {
        return function(dayOfWeek) {
            if (this._same) {
                return this._ss(arguments[0]);
            }
            if (dayOfWeek || dayOfWeek === 0) {
                return this.moveToNthOccurrence(dayOfWeek, n);
            }
            this._nth = n;
            if (n === 2 && (dayOfWeek === undefined || dayOfWeek === null)) {
                this._isSecond = true;
                return this.addSeconds(this._orient);
            }
            return this;
        };
    };
    for (var l = 0; l < nth.length; l++) {
        $P[nth[l]] = (l === 0) ? nthfn(-1) : nthfn(l);
    }
}());
(function() {
    Date.Parsing = {
        Exception: function(s) {
            this.message = "Parse error at '" + s.substring(0, 10) + " ...'";
        }
    };
    var $P = Date.Parsing;
    var _ = $P.Operators = {
        rtoken: function(r) {
            return function(s) {
                var mx = s.match(r);
                if (mx) {
                    return ([mx[0], s.substring(mx[0].length)]);
                } else {
                    throw new $P.Exception(s);
                }
            };
        },
        token: function(s) {
            return function(s) {
                return _.rtoken(new RegExp("^\s*" + s + "\s*"))(s);
            };
        },
        stoken: function(s) {
            return _.rtoken(new RegExp("^" + s));
        },
        until: function(p) {
            return function(s) {
                var qx = [],
                    rx = null;
                while (s.length) {
                    try {
                        rx = p.call(this, s);
                    } catch (e) {
                        qx.push(rx[0]);
                        s = rx[1];
                        continue;
                    }
                    break;
                }
                return [qx, s];
            };
        },
        many: function(p) {
            return function(s) {
                var rx = [],
                    r = null;
                while (s.length) {
                    try {
                        r = p.call(this, s);
                    } catch (e) {
                        return [rx, s];
                    }
                    rx.push(r[0]);
                    s = r[1];
                }
                return [rx, s];
            };
        },
        optional: function(p) {
            return function(s) {
                var r = null;
                try {
                    r = p.call(this, s);
                } catch (e) {
                    return [null, s];
                }
                return [r[0], r[1]];
            };
        },
        not: function(p) {
            return function(s) {
                try {
                    p.call(this, s);
                } catch (e) {
                    return [null, s];
                }
                throw new $P.Exception(s);
            };
        },
        ignore: function(p) {
            return p ? function(s) {
                var r = null;
                r = p.call(this, s);
                return [null, r[1]];
            } : null;
        },
        product: function() {
            var px = arguments[0],
                qx = Array.prototype.slice.call(arguments, 1),
                rx = [];
            for (var i = 0; i < px.length; i++) {
                rx.push(_.each(px[i], qx));
            }
            return rx;
        },
        cache: function(rule) {
            var cache = {},
                r = null;
            return function(s) {
                try {
                    r = cache[s] = (cache[s] || rule.call(this, s));
                } catch (e) {
                    r = cache[s] = e;
                }
                if (r instanceof $P.Exception) {
                    throw r;
                } else {
                    return r;
                }
            };
        },
        any: function() {
            var px = arguments;
            return function(s) {
                var r = null;
                for (var i = 0; i < px.length; i++) {
                    if (px[i] == null) {
                        continue;
                    }
                    try {
                        r = (px[i].call(this, s));
                    } catch (e) {
                        r = null;
                    }
                    if (r) {
                        return r;
                    }
                }
                throw new $P.Exception(s);
            };
        },
        each: function() {
            var px = arguments;
            return function(s) {
                var rx = [],
                    r = null;
                for (var i = 0; i < px.length; i++) {
                    if (px[i] == null) {
                        continue;
                    }
                    try {
                        r = (px[i].call(this, s));
                    } catch (e) {
                        throw new $P.Exception(s);
                    }
                    rx.push(r[0]);
                    s = r[1];
                }
                return [rx, s];
            };
        },
        all: function() {
            var px = arguments,
                _ = _;
            return _.each(_.optional(px));
        },
        sequence: function(px, d, c) {
            d = d || _.rtoken(/^\s*/);
            c = c || null;
            if (px.length == 1) {
                return px[0];
            }
            return function(s) {
                var r = null,
                    q = null;
                var rx = [];
                for (var i = 0; i < px.length; i++) {
                    try {
                        r = px[i].call(this, s);
                    } catch (e) {
                        break;
                    }
                    rx.push(r[0]);
                    try {
                        q = d.call(this, r[1]);
                    } catch (ex) {
                        q = null;
                        break;
                    }
                    s = q[1];
                }
                if (!r) {
                    throw new $P.Exception(s);
                }
                if (q) {
                    throw new $P.Exception(q[1]);
                }
                if (c) {
                    try {
                        r = c.call(this, r[1]);
                    } catch (ey) {
                        throw new $P.Exception(r[1]);
                    }
                }
                return [rx, (r ? r[1] : s)];
            };
        },
        between: function(d1, p, d2) {
            d2 = d2 || d1;
            var _fn = _.each(_.ignore(d1), p, _.ignore(d2));
            return function(s) {
                var rx = _fn.call(this, s);
                return [
                    [rx[0][0], r[0][2]], rx[1]
                ];
            };
        },
        list: function(p, d, c) {
            d = d || _.rtoken(/^\s*/);
            c = c || null;
            return (p instanceof Array ? _.each(_.product(p.slice(0, -1), _.ignore(d)), p.slice(-1), _.ignore(c)) : _.each(_.many(_.each(p, _.ignore(d))), px, _.ignore(c)));
        },
        set: function(px, d, c) {
            d = d || _.rtoken(/^\s*/);
            c = c || null;
            return function(s) {
                var r = null,
                    p = null,
                    q = null,
                    rx = null,
                    best = [
                        [], s
                    ],
                    last = false;
                for (var i = 0; i < px.length; i++) {
                    q = null;
                    p = null;
                    r = null;
                    last = (px.length == 1);
                    try {
                        r = px[i].call(this, s);
                    } catch (e) {
                        continue;
                    }
                    rx = [
                        [r[0]], r[1]
                    ];
                    if (r[1].length > 0 && !last) {
                        try {
                            q = d.call(this, r[1]);
                        } catch (ex) {
                            last = true;
                        }
                    } else {
                        last = true;
                    }
                    if (!last && q[1].length === 0) {
                        last = true;
                    }
                    if (!last) {
                        var qx = [];
                        for (var j = 0; j < px.length; j++) {
                            if (i != j) {
                                qx.push(px[j]);
                            }
                        }
                        p = _.set(qx, d).call(this, q[1]);
                        if (p[0].length > 0) {
                            rx[0] = rx[0].concat(p[0]);
                            rx[1] = p[1];
                        }
                    }
                    if (rx[1].length < best[1].length) {
                        best = rx;
                    }
                    if (best[1].length === 0) {
                        break;
                    }
                }
                if (best[0].length === 0) {
                    return best;
                }
                if (c) {
                    try {
                        q = c.call(this, best[1]);
                    } catch (ey) {
                        throw new $P.Exception(best[1]);
                    }
                    best[1] = q[1];
                }
                return best;
            };
        },
        forward: function(gr, fname) {
            return function(s) {
                return gr[fname].call(this, s);
            };
        },
        replace: function(rule, repl) {
            return function(s) {
                var r = rule.call(this, s);
                return [repl, r[1]];
            };
        },
        process: function(rule, fn) {
            return function(s) {
                var r = rule.call(this, s);
                return [fn.call(this, r[0]), r[1]];
            };
        },
        min: function(min, rule) {
            return function(s) {
                var rx = rule.call(this, s);
                if (rx[0].length < min) {
                    throw new $P.Exception(s);
                }
                return rx;
            };
        }
    };
    var _generator = function(op) {
        return function() {
            var args = null,
                rx = [];
            if (arguments.length > 1) {
                args = Array.prototype.slice.call(arguments);
            } else if (arguments[0] instanceof Array) {
                args = arguments[0];
            }
            if (args) {
                for (var i = 0, px = args.shift(); i < px.length; i++) {
                    args.unshift(px[i]);
                    rx.push(op.apply(null, args));
                    args.shift();
                    return rx;
                }
            } else {
                return op.apply(null, arguments);
            }
        };
    };
    var gx = "optional not ignore cache".split(/\s/);
    for (var i = 0; i < gx.length; i++) {
        _[gx[i]] = _generator(_[gx[i]]);
    }
    var _vector = function(op) {
        return function() {
            if (arguments[0] instanceof Array) {
                return op.apply(null, arguments[0]);
            } else {
                return op.apply(null, arguments);
            }
        };
    };
    var vx = "each any all".split(/\s/);
    for (var j = 0; j < vx.length; j++) {
        _[vx[j]] = _vector(_[vx[j]]);
    }
}());
(function() {
    var $D = Date,
        $P = $D.prototype,
        $C = $D.CultureInfo;
    var flattenAndCompact = function(ax) {
        var rx = [];
        for (var i = 0; i < ax.length; i++) {
            if (ax[i] instanceof Array) {
                rx = rx.concat(flattenAndCompact(ax[i]));
            } else {
                if (ax[i]) {
                    rx.push(ax[i]);
                }
            }
        }
        return rx;
    };
    $D.Grammar = {};
    $D.Translator = {
        hour: function(s) {
            return function() {
                this.hour = Number(s);
            };
        },
        minute: function(s) {
            return function() {
                this.minute = Number(s);
            };
        },
        second: function(s) {
            return function() {
                this.second = Number(s);
            };
        },
        meridian: function(s) {
            return function() {
                this.meridian = s.slice(0, 1).toLowerCase();
            };
        },
        timezone: function(s) {
            return function() {
                var n = s.replace(/[^\d\+\-]/g, "");
                if (n.length) {
                    this.timezoneOffset = Number(n);
                } else {
                    this.timezone = s.toLowerCase();
                }
            };
        },
        day: function(x) {
            var s = x[0];
            return function() {
                this.day = Number(s.match(/\d+/)[0]);
            };
        },
        month: function(s) {
            return function() {
                this.month = (s.length == 3) ? "jan feb mar apr may jun jul aug sep oct nov dec".indexOf(s) / 4 : Number(s) - 1;
            };
        },
        year: function(s) {
            return function() {
                var n = Number(s);
                this.year = ((s.length > 2) ? n : (n + (((n + 2000) < $C.twoDigitYearMax) ? 2000 : 1900)));
            };
        },
        rday: function(s) {
            return function() {
                switch (s) {
                    case "yesterday":
                        this.days = -1;
                        break;
                    case "tomorrow":
                        this.days = 1;
                        break;
                    case "today":
                        this.days = 0;
                        break;
                    case "now":
                        this.days = 0;
                        this.now = true;
                        break;
                }
            };
        },
        finishExact: function(x) {
            x = (x instanceof Array) ? x : [x];
            for (var i = 0; i < x.length; i++) {
                if (x[i]) {
                    x[i].call(this);
                }
            }
            var now = new Date();
            if ((this.hour || this.minute) && (!this.month && !this.year && !this.day)) {
                this.day = now.getDate();
            }
            if (!this.year) {
                this.year = now.getFullYear();
            }
            if (!this.month && this.month !== 0) {
                this.month = now.getMonth();
            }
            if (!this.day) {
                this.day = 1;
            }
            if (!this.hour) {
                this.hour = 0;
            }
            if (!this.minute) {
                this.minute = 0;
            }
            if (!this.second) {
                this.second = 0;
            }
            if (this.meridian && this.hour) {
                if (this.meridian == "p" && this.hour < 12) {
                    this.hour = this.hour + 12;
                } else if (this.meridian == "a" && this.hour == 12) {
                    this.hour = 0;
                }
            }
            if (this.day > $D.getDaysInMonth(this.year, this.month)) {
                throw new RangeError(this.day + " is not a valid value for days.");
            }
            var r = new Date(this.year, this.month, this.day, this.hour, this.minute, this.second);
            if (this.timezone) {
                r.set({
                    timezone: this.timezone
                });
            } else if (this.timezoneOffset) {
                r.set({
                    timezoneOffset: this.timezoneOffset
                });
            }
            return r;
        },
        finish: function(x) {
            x = (x instanceof Array) ? flattenAndCompact(x) : [x];
            if (x.length === 0) {
                return null;
            }
            for (var i = 0; i < x.length; i++) {
                if (typeof x[i] == "function") {
                    x[i].call(this);
                }
            }
            var today = $D.today();
            if (this.now && !this.unit && !this.operator) {
                return new Date();
            } else if (this.now) {
                today = new Date();
            }
            var expression = !!(this.days && this.days !== null || this.orient || this.operator);
            var gap, mod, orient;
            orient = ((this.orient == "past" || this.operator == "subtract") ? -1 : 1);
            if (!this.now && "hour minute second".indexOf(this.unit) != -1) {
                today.setTimeToNow();
            }
            if (this.month || this.month === 0) {
                if ("year day hour minute second".indexOf(this.unit) != -1) {
                    this.value = this.month + 1;
                    this.month = null;
                    expression = true;
                }
            }
            if (!expression && this.weekday && !this.day && !this.days) {
                var temp = Date[this.weekday]();
                this.day = temp.getDate();
                if (!this.month) {
                    this.month = temp.getMonth();
                }
                this.year = temp.getFullYear();
            }
            if (expression && this.weekday && this.unit != "month") {
                this.unit = "day";
                gap = ($D.getDayNumberFromName(this.weekday) - today.getDay());
                mod = 7;
                this.days = gap ? ((gap + (orient * mod)) % mod) : (orient * mod);
            }
            if (this.month && this.unit == "day" && this.operator) {
                this.value = (this.month + 1);
                this.month = null;
            }
            if (this.value != null && this.month != null && this.year != null) {
                this.day = this.value * 1;
            }
            if (this.month && !this.day && this.value) {
                today.set({
                    day: this.value * 1
                });
                if (!expression) {
                    this.day = this.value * 1;
                }
            }
            if (!this.month && this.value && this.unit == "month" && !this.now) {
                this.month = this.value;
                expression = true;
            }
            if (expression && (this.month || this.month === 0) && this.unit != "year") {
                this.unit = "month";
                gap = (this.month - today.getMonth());
                mod = 12;
                this.months = gap ? ((gap + (orient * mod)) % mod) : (orient * mod);
                this.month = null;
            }
            if (!this.unit) {
                this.unit = "day";
            }
            if (!this.value && this.operator && this.operator !== null && this[this.unit + "s"] && this[this.unit + "s"] !== null) {
                this[this.unit + "s"] = this[this.unit + "s"] + ((this.operator == "add") ? 1 : -1) + (this.value || 0) * orient;
            } else if (this[this.unit + "s"] == null || this.operator != null) {
                if (!this.value) {
                    this.value = 1;
                }
                this[this.unit + "s"] = this.value * orient;
            }
            if (this.meridian && this.hour) {
                if (this.meridian == "p" && this.hour < 12) {
                    this.hour = this.hour + 12;
                } else if (this.meridian == "a" && this.hour == 12) {
                    this.hour = 0;
                }
            }
            if (this.weekday && !this.day && !this.days) {
                var temp = Date[this.weekday]();
                this.day = temp.getDate();
                if (temp.getMonth() !== today.getMonth()) {
                    this.month = temp.getMonth();
                }
            }
            if ((this.month || this.month === 0) && !this.day) {
                this.day = 1;
            }
            if (!this.orient && !this.operator && this.unit == "week" && this.value && !this.day && !this.month) {
                return Date.today().setWeek(this.value);
            }
            if (expression && this.timezone && this.day && this.days) {
                this.day = this.days;
            }
            return (expression) ? today.add(this) : today.set(this);
        }
    };
    var _ = $D.Parsing.Operators,
        g = $D.Grammar,
        t = $D.Translator,
        _fn;
    g.datePartDelimiter = _.rtoken(/^([\s\-\.\,\/\x27]+)/);
    g.timePartDelimiter = _.stoken(":");
    g.whiteSpace = _.rtoken(/^\s*/);
    g.generalDelimiter = _.rtoken(/^(([\s\,]|at|@|on)+)/);
    var _C = {};
    g.ctoken = function(keys) {
        var fn = _C[keys];
        if (!fn) {
            var c = $C.regexPatterns;
            var kx = keys.split(/\s+/),
                px = [];
            for (var i = 0; i < kx.length; i++) {
                px.push(_.replace(_.rtoken(c[kx[i]]), kx[i]));
            }
            fn = _C[keys] = _.any.apply(null, px);
        }
        return fn;
    };
    g.ctoken2 = function(key) {
        return _.rtoken($C.regexPatterns[key]);
    };
    g.h = _.cache(_.process(_.rtoken(/^(0[0-9]|1[0-2]|[1-9])/), t.hour));
    g.hh = _.cache(_.process(_.rtoken(/^(0[0-9]|1[0-2])/), t.hour));
    g.H = _.cache(_.process(_.rtoken(/^([0-1][0-9]|2[0-3]|[0-9])/), t.hour));
    g.HH = _.cache(_.process(_.rtoken(/^([0-1][0-9]|2[0-3])/), t.hour));
    g.m = _.cache(_.process(_.rtoken(/^([0-5][0-9]|[0-9])/), t.minute));
    g.mm = _.cache(_.process(_.rtoken(/^[0-5][0-9]/), t.minute));
    g.s = _.cache(_.process(_.rtoken(/^([0-5][0-9]|[0-9])/), t.second));
    g.ss = _.cache(_.process(_.rtoken(/^[0-5][0-9]/), t.second));
    g.hms = _.cache(_.sequence([g.H, g.m, g.s], g.timePartDelimiter));
    g.t = _.cache(_.process(g.ctoken2("shortMeridian"), t.meridian));
    g.tt = _.cache(_.process(g.ctoken2("longMeridian"), t.meridian));
    g.z = _.cache(_.process(_.rtoken(/^((\+|\-)\s*\d\d\d\d)|((\+|\-)\d\d\:?\d\d)/), t.timezone));
    g.zz = _.cache(_.process(_.rtoken(/^((\+|\-)\s*\d\d\d\d)|((\+|\-)\d\d\:?\d\d)/), t.timezone));
    g.zzz = _.cache(_.process(g.ctoken2("timezone"), t.timezone));
    g.timeSuffix = _.each(_.ignore(g.whiteSpace), _.set([g.tt, g.zzz]));
    g.time = _.each(_.optional(_.ignore(_.stoken("T"))), g.hms, g.timeSuffix);
    g.d = _.cache(_.process(_.each(_.rtoken(/^([0-2]\d|3[0-1]|\d)/), _.optional(g.ctoken2("ordinalSuffix"))), t.day));
    g.dd = _.cache(_.process(_.each(_.rtoken(/^([0-2]\d|3[0-1])/), _.optional(g.ctoken2("ordinalSuffix"))), t.day));
    g.ddd = g.dddd = _.cache(_.process(g.ctoken("sun mon tue wed thu fri sat"), function(s) {
        return function() {
            this.weekday = s;
        };
    }));
    g.M = _.cache(_.process(_.rtoken(/^(1[0-2]|0\d|\d)/), t.month));
    g.MM = _.cache(_.process(_.rtoken(/^(1[0-2]|0\d)/), t.month));
    g.MMM = g.MMMM = _.cache(_.process(g.ctoken("jan feb mar apr may jun jul aug sep oct nov dec"), t.month));
    g.y = _.cache(_.process(_.rtoken(/^(\d\d?)/), t.year));
    g.yy = _.cache(_.process(_.rtoken(/^(\d\d)/), t.year));
    g.yyy = _.cache(_.process(_.rtoken(/^(\d\d?\d?\d?)/), t.year));
    g.yyyy = _.cache(_.process(_.rtoken(/^(\d\d\d\d)/), t.year));
    _fn = function() {
        return _.each(_.any.apply(null, arguments), _.not(g.ctoken2("timeContext")));
    };
    g.day = _fn(g.d, g.dd);
    g.month = _fn(g.M, g.MMM);
    g.year = _fn(g.yyyy, g.yy);
    g.orientation = _.process(g.ctoken("past future"), function(s) {
        return function() {
            this.orient = s;
        };
    });
    g.operator = _.process(g.ctoken("add subtract"), function(s) {
        return function() {
            this.operator = s;
        };
    });
    g.rday = _.process(g.ctoken("yesterday tomorrow today now"), t.rday);
    g.unit = _.process(g.ctoken("second minute hour day week month year"), function(s) {
        return function() {
            this.unit = s;
        };
    });
    g.value = _.process(_.rtoken(/^\d\d?(st|nd|rd|th)?/), function(s) {
        return function() {
            this.value = s.replace(/\D/g, "");
        };
    });
    g.expression = _.set([g.rday, g.operator, g.value, g.unit, g.orientation, g.ddd, g.MMM]);
    _fn = function() {
        return _.set(arguments, g.datePartDelimiter);
    };
    g.mdy = _fn(g.ddd, g.month, g.day, g.year);
    g.ymd = _fn(g.ddd, g.year, g.month, g.day);
    g.dmy = _fn(g.ddd, g.day, g.month, g.year);
    g.date = function(s) {
        return ((g[$C.dateElementOrder] || g.mdy).call(this, s));
    };
    g.format = _.process(_.many(_.any(_.process(_.rtoken(/^(dd?d?d?|MM?M?M?|yy?y?y?|hh?|HH?|mm?|ss?|tt?|zz?z?)/), function(fmt) {
        if (g[fmt]) {
            return g[fmt];
        } else {
            throw $D.Parsing.Exception(fmt);
        }
    }), _.process(_.rtoken(/^[^dMyhHmstz]+/), function(s) {
        return _.ignore(_.stoken(s));
    }))), function(rules) {
        return _.process(_.each.apply(null, rules), t.finishExact);
    });
    var _F = {};
    var _get = function(f) {
        return _F[f] = (_F[f] || g.format(f)[0]);
    };
    g.formats = function(fx) {
        if (fx instanceof Array) {
            var rx = [];
            for (var i = 0; i < fx.length; i++) {
                rx.push(_get(fx[i]));
            }
            return _.any.apply(null, rx);
        } else {
            return _get(fx);
        }
    };
    g._formats = g.formats(["\"yyyy-MM-ddTHH:mm:ssZ\"", "yyyy-MM-ddTHH:mm:ssZ", "yyyy-MM-ddTHH:mm:ssz", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mmZ", "yyyy-MM-ddTHH:mmz", "yyyy-MM-ddTHH:mm", "ddd, MMM dd, yyyy H:mm:ss tt", "ddd MMM d yyyy HH:mm:ss zzz", "MMddyyyy", "ddMMyyyy", "Mddyyyy", "ddMyyyy", "Mdyyyy", "dMyyyy", "yyyy", "Mdyy", "dMyy", "d"]);
    g._start = _.process(_.set([g.date, g.time, g.expression], g.generalDelimiter, g.whiteSpace), t.finish);
    g.start = function(s) {
        try {
            var r = g._formats.call({}, s);
            if (r[1].length === 0) {
                return r;
            }
        } catch (e) {}
        return g._start.call({}, s);
    };
    $D._parse = $D.parse;
    $D.parse = function(s) {
        var r = null;
        if (!s) {
            return null;
        }
        if (s instanceof Date) {
            return s;
        }
        try {
            r = $D.Grammar.start.call({}, s.replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1"));
        } catch (e) {
            return null;
        }
        return ((r[1].length === 0) ? r[0] : null);
    };
    $D.getParseFunction = function(fx) {
        var fn = $D.Grammar.formats(fx);
        return function(s) {
            var r = null;
            try {
                r = fn.call({}, s);
            } catch (e) {
                return null;
            }
            return ((r[1].length === 0) ? r[0] : null);
        };
    };
    $D.parseExact = function(s, fx) {
        return $D.getParseFunction(fx)(s);
    };
}()); // the tagRangeFinder function is
//   Copyright (C) 2011 by Daniel Glazman <daniel@glazman.org>
// released under the MIT license (../../LICENSE) like the rest of CodeMirror
CodeMirror.tagRangeFinder = function(cm, start) {
    var nameStartChar = "A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
    var nameChar = nameStartChar + "\-\:\.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
    var xmlNAMERegExp = new RegExp("^[" + nameStartChar + "][" + nameChar + "]*");

    var lineText = cm.getLine(start.line);
    var found = false;
    var tag = null;
    var pos = start.ch;
    while (!found) {
        pos = lineText.indexOf("<", pos);
        if (-1 == pos) // no tag on line
            return;
        if (pos + 1 < lineText.length && lineText[pos + 1] == "/") { // closing tag
            pos++;
            continue;
        }
        // ok we seem to have a start tag
        if (!lineText.substr(pos + 1).match(xmlNAMERegExp)) { // not a tag name...
            pos++;
            continue;
        }
        var gtPos = lineText.indexOf(">", pos + 1);
        if (-1 == gtPos) { // end of start tag not in line
            var l = start.line + 1;
            var foundGt = false;
            var lastLine = cm.lineCount();
            while (l < lastLine && !foundGt) {
                var lt = cm.getLine(l);
                gtPos = lt.indexOf(">");
                if (-1 != gtPos) { // found a >
                    foundGt = true;
                    var slash = lt.lastIndexOf("/", gtPos);
                    if (-1 != slash && slash < gtPos) {
                        var str = lineText.substr(slash, gtPos - slash + 1);
                        if (!str.match(/\/\s*\>/)) // yep, that's the end of empty tag
                            return;
                    }
                }
                l++;
            }
            found = true;
        } else {
            var slashPos = lineText.lastIndexOf("/", gtPos);
            if (-1 == slashPos) { // cannot be empty tag
                found = true;
                // don't continue
            } else { // empty tag?
                // check if really empty tag
                var str = lineText.substr(slashPos, gtPos - slashPos + 1);
                if (!str.match(/\/\s*\>/)) { // finally not empty
                    found = true;
                    // don't continue
                }
            }
        }
        if (found) {
            var subLine = lineText.substr(pos + 1);
            tag = subLine.match(xmlNAMERegExp);
            if (tag) {
                // we have an element name, wooohooo !
                tag = tag[0];
                // do we have the close tag on same line ???
                if (-1 != lineText.indexOf("</" + tag + ">", pos)) // yep
                {
                    found = false;
                }
                // we don't, so we have a candidate...
            } else
                found = false;
        }
        if (!found)
            pos++;
    }

    if (found) {
        var startTag = "(\\<\\/" + tag + "\\>)|(\\<" + tag + "\\>)|(\\<" + tag + "\\s)|(\\<" + tag + "$)";
        var startTagRegExp = new RegExp(startTag);
        var endTag = "</" + tag + ">";
        var depth = 1;
        var l = start.line + 1;
        var lastLine = cm.lineCount();
        while (l < lastLine) {
            lineText = cm.getLine(l);
            var match = lineText.match(startTagRegExp);
            if (match) {
                for (var i = 0; i < match.length; i++) {
                    if (match[i] == endTag)
                        depth--;
                    else
                        depth++;
                    if (!depth) return {
                        from: CodeMirror.Pos(start.line, gtPos + 1),
                        to: CodeMirror.Pos(l, match.index)
                    };
                }
            }
            l++;
        }
        return;
    }
};

CodeMirror.braceRangeFinder = function(cm, start) {
    var line = start.line,
        lineText = cm.getLine(line);
    var at = lineText.length,
        startChar, tokenType;
    for (;;) {
        var found = lineText.lastIndexOf("{", at);
        if (found < start.ch) break;
        tokenType = cm.getTokenAt(CodeMirror.Pos(line, found + 1)).type;
        if (!/^(comment|string)/.test(tokenType)) {
            startChar = found;
            break;
        }
        at = found - 1;
    }
    if (startChar == null || lineText.lastIndexOf("}") > startChar) return;
    var count = 1,
        lastLine = cm.lineCount(),
        end, endCh;
    outer: for (var i = line + 1; i < lastLine; ++i) {
        var text = cm.getLine(i),
            pos = 0;
        for (;;) {
            var nextOpen = text.indexOf("{", pos),
                nextClose = text.indexOf("}", pos);
            if (nextOpen < 0) nextOpen = text.length;
            if (nextClose < 0) nextClose = text.length;
            pos = Math.min(nextOpen, nextClose);
            if (pos == text.length) break;
            if (cm.getTokenAt(CodeMirror.Pos(i, pos + 1)).type == tokenType) {
                if (pos == nextOpen) ++count;
                else if (!--count) {
                    end = i;
                    endCh = pos;
                    break outer;
                }
            }
            ++pos;
        }
    }
    if (end == null || end == line + 1) return;
    return {
        from: CodeMirror.Pos(line, startChar + 1),
        to: CodeMirror.Pos(end, endCh)
    };
};

CodeMirror.indentRangeFinder = function(cm, start) {
    var tabSize = cm.getOption("tabSize"),
        firstLine = cm.getLine(start.line);
    var myIndent = CodeMirror.countColumn(firstLine, null, tabSize);
    for (var i = start.line + 1, end = cm.lineCount(); i < end; ++i) {
        var curLine = cm.getLine(i);
        if (CodeMirror.countColumn(curLine, null, tabSize) < myIndent &&
            CodeMirror.countColumn(cm.getLine(i - 1), null, tabSize) > myIndent)
            return {
                from: CodeMirror.Pos(start.line, firstLine.length),
                to: CodeMirror.Pos(i, curLine.length)
            };
    }
};

CodeMirror.newFoldFunction = function(rangeFinder, widget) {
    if (widget == null) widget = "\u2194";
    if (typeof widget == "string") {
        var text = document.createTextNode(widget);
        widget = document.createElement("span");
        widget.appendChild(text);
        widget.className = "CodeMirror-foldmarker";
    }

    return function(cm, pos) {
        if (typeof pos == "number") pos = CodeMirror.Pos(pos, 0);
        var range = rangeFinder(cm, pos);
        if (!range) return;

        var present = cm.findMarksAt(range.from),
            cleared = 0;
        for (var i = 0; i < present.length; ++i) {
            if (present[i].__isFold) {
                ++cleared;
                present[i].clear();
            }
        }
        if (cleared) return;

        var myWidget = widget.cloneNode(true);
        CodeMirror.on(myWidget, "mousedown", function() {
            myRange.clear();
        });
        var myRange = cm.markText(range.from, range.to, {
            replacedWith: myWidget,
            clearOnEnter: true,
            __isFold: true
        });
    };
};
/**
 * Method copied from above braceRangeFinder, but matches brackets instead.
 */
CodeMirror.bracketRangeFinder = function(cm, start) {
    var line = start.line,
        lineText = cm.getLine(line);
    var at = lineText.length,
        startChar, tokenType;
    for (;;) {
        var found = lineText.lastIndexOf("[", at);
        if (found < start.ch) break;
        tokenType = cm.getTokenAt(CodeMirror.Pos(line, found + 1)).type;
        if (!/^(comment|string)/.test(tokenType)) {
            startChar = found;
            break;
        }
        at = found - 1;
    }
    if (startChar == null || lineText.lastIndexOf("]") > startChar) return;
    var count = 1,
        lastLine = cm.lineCount(),
        end, endCh;
    outer: for (var i = line + 1; i < lastLine; ++i) {
        var text = cm.getLine(i),
            pos = 0;
        for (;;) {
            var nextOpen = text.indexOf("[", pos),
                nextClose = text.indexOf("]", pos);
            if (nextOpen < 0) nextOpen = text.length;
            if (nextClose < 0) nextClose = text.length;
            pos = Math.min(nextOpen, nextClose);
            if (pos == text.length) break;
            if (cm.getTokenAt(CodeMirror.Pos(i, pos + 1)).type == tokenType) {
                if (pos == nextOpen) ++count;
                else if (!--count) {
                    end = i;
                    endCh = pos;
                    break outer;
                }
            }
            ++pos;
        }
    }
    if (end == null || end == line + 1) return;
    return {
        from: CodeMirror.Pos(line, startChar + 1),
        to: CodeMirror.Pos(end, endCh)
    };
};
// TODO actually recognize syntax of TypeScript constructs

CodeMirror.defineMode("javascript", function(config, parserConfig) {
    var indentUnit = config.indentUnit;
    var jsonMode = parserConfig.json;
    var isTS = parserConfig.typescript;

    // Tokenizer

    var keywords = function() {
        function kw(type) {
            return {
                type: type,
                style: "keyword"
            };
        }
        var A = kw("keyword a"),
            B = kw("keyword b"),
            C = kw("keyword c");
        var operator = kw("operator"),
            atom = {
                type: "atom",
                style: "atom"
            };

        var jsKeywords = {
            "if": A,
            "while": A,
            "with": A,
            "else": B,
            "do": B,
            "try": B,
            "finally": B,
            "return": C,
            "break": C,
            "continue": C,
            "new": C,
            "delete": C,
            "throw": C,
            "var": kw("var"),
            "const": kw("var"),
            "let": kw("var"),
            "function": kw("function"),
            "catch": kw("catch"),
            "for": kw("for"),
            "switch": kw("switch"),
            "case": kw("case"),
            "default": kw("default"),
            "in": operator,
            "typeof": operator,
            "instanceof": operator,
            "true": atom,
            "false": atom,
            "null": atom,
            "undefined": atom,
            "NaN": atom,
            "Infinity": atom
        };

        // Extend the 'normal' keywords with the TypeScript language extensions
        if (isTS) {
            var type = {
                type: "variable",
                style: "variable-3"
            };
            var tsKeywords = {
                // object-like things
                "interface": kw("interface"),
                "class": kw("class"),
                "extends": kw("extends"),
                "constructor": kw("constructor"),

                // scope modifiers
                "public": kw("public"),
                "private": kw("private"),
                "protected": kw("protected"),
                "static": kw("static"),

                "super": kw("super"),

                // types
                "string": type,
                "number": type,
                "bool": type,
                "any": type
            };

            for (var attr in tsKeywords) {
                jsKeywords[attr] = tsKeywords[attr];
            }
        }

        return jsKeywords;
    }();

    var isOperatorChar = /[+\-*&%=<>!?|]/;

    function chain(stream, state, f) {
        state.tokenize = f;
        return f(stream, state);
    }

    function nextUntilUnescaped(stream, end) {
        var escaped = false,
            next;
        while ((next = stream.next()) != null) {
            if (next == end && !escaped)
                return false;
            escaped = !escaped && next == "\\";
        }
        return escaped;
    }

    // Used as scratch variables to communicate multiple values without
    // consing up tons of objects.
    var type, content;

    function ret(tp, style, cont) {
        type = tp;
        content = cont;
        return style;
    }

    function jsTokenBase(stream, state) {
        var ch = stream.next();
        if (ch == '"' || ch == "'")
            return chain(stream, state, jsTokenString(ch));
        else if (/[\[\]{}\(\),;\:\.]/.test(ch))
            return ret(ch);
        else if (ch == "0" && stream.eat(/x/i)) {
            stream.eatWhile(/[\da-f]/i);
            return ret("number", "number");
        } else if (/\d/.test(ch) || ch == "-" && stream.eat(/\d/)) {
            stream.match(/^\d*(?:\.\d*)?(?:[eE][+\-]?\d+)?/);
            return ret("number", "number");
        } else if (ch == "/") {
            if (stream.eat("*")) {
                return chain(stream, state, jsTokenComment);
            } else if (stream.eat("/")) {
                stream.skipToEnd();
                return ret("comment", "comment");
            } else if (state.lastType == "operator" || state.lastType == "keyword c" ||
                /^[\[{}\(,;:]$/.test(state.lastType)) {
                nextUntilUnescaped(stream, "/");
                stream.eatWhile(/[gimy]/); // 'y' is "sticky" option in Mozilla
                return ret("regexp", "string-2");
            } else {
                stream.eatWhile(isOperatorChar);
                return ret("operator", null, stream.current());
            }
        } else if (ch == "#") {
            stream.skipToEnd();
            return ret("error", "error");
        } else if (isOperatorChar.test(ch)) {
            stream.eatWhile(isOperatorChar);
            return ret("operator", null, stream.current());
        } else {
            stream.eatWhile(/[\w\$_]/);
            var word = stream.current(),
                known = keywords.propertyIsEnumerable(word) && keywords[word];
            return (known && state.lastType != ".") ? ret(known.type, known.style, word) :
                ret("variable", "variable", word);
        }
    }

    function jsTokenString(quote) {
        return function(stream, state) {
            if (!nextUntilUnescaped(stream, quote))
                state.tokenize = jsTokenBase;
            return ret("string", "string");
        };
    }

    function jsTokenComment(stream, state) {
        var maybeEnd = false,
            ch;
        while (ch = stream.next()) {
            if (ch == "/" && maybeEnd) {
                state.tokenize = jsTokenBase;
                break;
            }
            maybeEnd = (ch == "*");
        }
        return ret("comment", "comment");
    }

    // Parser

    var atomicTypes = {
        "atom": true,
        "number": true,
        "variable": true,
        "string": true,
        "regexp": true
    };

    function JSLexical(indented, column, type, align, prev, info) {
        this.indented = indented;
        this.column = column;
        this.type = type;
        this.prev = prev;
        this.info = info;
        if (align != null) this.align = align;
    }

    function inScope(state, varname) {
        for (var v = state.localVars; v; v = v.next)
            if (v.name == varname) return true;
    }

    function parseJS(state, style, type, content, stream) {
        var cc = state.cc;
        // Communicate our context to the combinators.
        // (Less wasteful than consing up a hundred closures on every call.)
        cx.state = state;
        cx.stream = stream;
        cx.marked = null, cx.cc = cc;

        if (!state.lexical.hasOwnProperty("align"))
            state.lexical.align = true;

        while (true) {
            var combinator = cc.length ? cc.pop() : jsonMode ? expression : statement;
            if (combinator(type, content)) {
                while (cc.length && cc[cc.length - 1].lex)
                    cc.pop()();
                if (cx.marked) return cx.marked;
                if (type == "variable" && inScope(state, content)) return "variable-2";
                return style;
            }
        }
    }

    // Combinator utils

    var cx = {
        state: null,
        column: null,
        marked: null,
        cc: null
    };

    function pass() {
        for (var i = arguments.length - 1; i >= 0; i--) cx.cc.push(arguments[i]);
    }

    function cont() {
        pass.apply(null, arguments);
        return true;
    }

    function register(varname) {
        function inList(list) {
            for (var v = list; v; v = v.next)
                if (v.name == varname) return true;
            return false;
        }
        var state = cx.state;
        if (state.context) {
            cx.marked = "def";
            if (inList(state.localVars)) return;
            state.localVars = {
                name: varname,
                next: state.localVars
            };
        } else {
            if (inList(state.globalVars)) return;
            state.globalVars = {
                name: varname,
                next: state.globalVars
            };
        }
    }

    // Combinators

    var defaultVars = {
        name: "this",
        next: {
            name: "arguments"
        }
    };

    function pushcontext() {
        cx.state.context = {
            prev: cx.state.context,
            vars: cx.state.localVars
        };
        cx.state.localVars = defaultVars;
    }

    function popcontext() {
        cx.state.localVars = cx.state.context.vars;
        cx.state.context = cx.state.context.prev;
    }

    function pushlex(type, info) {
        var result = function() {
            var state = cx.state;
            state.lexical = new JSLexical(state.indented, cx.stream.column(), type, null, state.lexical, info);
        };
        result.lex = true;
        return result;
    }

    function poplex() {
        var state = cx.state;
        if (state.lexical.prev) {
            if (state.lexical.type == ")")
                state.indented = state.lexical.indented;
            state.lexical = state.lexical.prev;
        }
    }
    poplex.lex = true;

    function expect(wanted) {
        return function(type) {
            if (type == wanted) return cont();
            else if (wanted == ";") return pass();
            else return cont(arguments.callee);
        };
    }

    function statement(type) {
        if (type == "var") return cont(pushlex("vardef"), vardef1, expect(";"), poplex);
        if (type == "keyword a") return cont(pushlex("form"), expression, statement, poplex);
        if (type == "keyword b") return cont(pushlex("form"), statement, poplex);
        if (type == "{") return cont(pushlex("}"), block, poplex);
        if (type == ";") return cont();
        if (type == "function") return cont(functiondef);
        if (type == "for") return cont(pushlex("form"), expect("("), pushlex(")"), forspec1, expect(")"),
            poplex, statement, poplex);
        if (type == "variable") return cont(pushlex("stat"), maybelabel);
        if (type == "switch") return cont(pushlex("form"), expression, pushlex("}", "switch"), expect("{"),
            block, poplex, poplex);
        if (type == "case") return cont(expression, expect(":"));
        if (type == "default") return cont(expect(":"));
        if (type == "catch") return cont(pushlex("form"), pushcontext, expect("("), funarg, expect(")"),
            statement, poplex, popcontext);
        return pass(pushlex("stat"), expression, expect(";"), poplex);
    }

    function expression(type) {
        if (atomicTypes.hasOwnProperty(type)) return cont(maybeoperator);
        if (type == "function") return cont(functiondef);
        if (type == "keyword c") return cont(maybeexpression);
        if (type == "(") return cont(pushlex(")"), maybeexpression, expect(")"), poplex, maybeoperator);
        if (type == "operator") return cont(expression);
        if (type == "[") return cont(pushlex("]"), commasep(expression, "]"), poplex, maybeoperator);
        if (type == "{") return cont(pushlex("}"), commasep(objprop, "}"), poplex, maybeoperator);
        return cont();
    }

    function maybeexpression(type) {
        if (type.match(/[;\}\)\],]/)) return pass();
        return pass(expression);
    }

    function maybeoperator(type, value) {
        if (type == "operator") {
            if (/\+\+|--/.test(value)) return cont(maybeoperator);
            if (value == "?") return cont(expression, expect(":"), expression);
            return cont(expression);
        }
        if (type == ";") return;
        if (type == "(") return cont(pushlex(")"), commasep(expression, ")"), poplex, maybeoperator);
        if (type == ".") return cont(property, maybeoperator);
        if (type == "[") return cont(pushlex("]"), expression, expect("]"), poplex, maybeoperator);
    }

    function maybelabel(type) {
        if (type == ":") return cont(poplex, statement);
        return pass(maybeoperator, expect(";"), poplex);
    }

    function property(type) {
        if (type == "variable") {
            cx.marked = "property";
            return cont();
        }
    }

    function objprop(type) {
        if (type == "variable") cx.marked = "property";
        else if (type == "number" || type == "string") cx.marked = type + " property";
        if (atomicTypes.hasOwnProperty(type)) return cont(expect(":"), expression);
    }

    function commasep(what, end) {
        function proceed(type) {
            if (type == ",") return cont(what, proceed);
            if (type == end) return cont();
            return cont(expect(end));
        }
        return function(type) {
            if (type == end) return cont();
            else return pass(what, proceed);
        };
    }

    function block(type) {
        if (type == "}") return cont();
        return pass(statement, block);
    }

    function maybetype(type) {
        if (type == ":") return cont(typedef);
        return pass();
    }

    function typedef(type) {
        if (type == "variable") {
            cx.marked = "variable-3";
            return cont();
        }
        return pass();
    }

    function vardef1(type, value) {
        if (type == "variable") {
            register(value);
            return isTS ? cont(maybetype, vardef2) : cont(vardef2);
        }
        return pass();
    }

    function vardef2(type, value) {
        if (value == "=") return cont(expression, vardef2);
        if (type == ",") return cont(vardef1);
    }

    function forspec1(type) {
        if (type == "var") return cont(vardef1, expect(";"), forspec2);
        if (type == ";") return cont(forspec2);
        if (type == "variable") return cont(formaybein);
        return cont(forspec2);
    }

    function formaybein(_type, value) {
        if (value == "in") return cont(expression);
        return cont(maybeoperator, forspec2);
    }

    function forspec2(type, value) {
        if (type == ";") return cont(forspec3);
        if (value == "in") return cont(expression);
        return cont(expression, expect(";"), forspec3);
    }

    function forspec3(type) {
        if (type != ")") cont(expression);
    }

    function functiondef(type, value) {
        if (type == "variable") {
            register(value);
            return cont(functiondef);
        }
        if (type == "(") return cont(pushlex(")"), pushcontext, commasep(funarg, ")"), poplex, statement, popcontext);
    }

    function funarg(type, value) {
        if (type == "variable") {
            register(value);
            return isTS ? cont(maybetype) : cont();
        }
    }

    // Interface

    return {
        startState: function(basecolumn) {
            return {
                tokenize: jsTokenBase,
                lastType: null,
                cc: [],
                lexical: new JSLexical((basecolumn || 0) - indentUnit, 0, "block", false),
                localVars: parserConfig.localVars,
                globalVars: parserConfig.globalVars,
                context: parserConfig.localVars && {
                    vars: parserConfig.localVars
                },
                indented: 0
            };
        },

        token: function(stream, state) {
            if (stream.sol()) {
                if (!state.lexical.hasOwnProperty("align"))
                    state.lexical.align = false;
                state.indented = stream.indentation();
            }
            if (stream.eatSpace()) return null;
            var style = state.tokenize(stream, state);
            if (type == "comment") return style;
            state.lastType = type;
            return parseJS(state, style, type, content, stream);
        },

        indent: function(state, textAfter) {
            if (state.tokenize == jsTokenComment) return CodeMirror.Pass;
            if (state.tokenize != jsTokenBase) return 0;
            var firstChar = textAfter && textAfter.charAt(0),
                lexical = state.lexical;
            if (lexical.type == "stat" && firstChar == "}") lexical = lexical.prev;
            var type = lexical.type,
                closing = firstChar == type;
            if (type == "vardef") return lexical.indented + (state.lastType == "operator" || state.lastType == "," ? 4 : 0);
            else if (type == "form" && firstChar == "{") return lexical.indented;
            else if (type == "form") return lexical.indented + indentUnit;
            else if (type == "stat")
                return lexical.indented + (state.lastType == "operator" || state.lastType == "," ? indentUnit : 0);
            else if (lexical.info == "switch" && !closing)
                return lexical.indented + (/^(?:case|default)\b/.test(textAfter) ? indentUnit : 2 * indentUnit);
            else if (lexical.align) return lexical.column + (closing ? 0 : 1);
            else return lexical.indented + (closing ? 0 : indentUnit);
        },

        electricChars: ":{}",

        jsonMode: jsonMode
    };
});

CodeMirror.defineMIME("text/javascript", "javascript");
CodeMirror.defineMIME("text/ecmascript", "javascript");
CodeMirror.defineMIME("application/javascript", "javascript");
CodeMirror.defineMIME("application/ecmascript", "javascript");
CodeMirror.defineMIME("application/json", {
    name: "javascript",
    json: true
});
CodeMirror.defineMIME("text/typescript", {
    name: "javascript",
    typescript: true
});
CodeMirror.defineMIME("application/typescript", {
    name: "javascript",
    typescript: true
});
/*
 * Add SVG tab backgrounds to tab panel
 */
/*function getTabPath(tabPanel, box, startBend, endBend, smoothness, topLining) {
 	var top = box.y + 0.5,
		bottom = top + box.height - 1,
		padding = tabPanel.tabBar.padding,
		left = box.x + parseInt(padding ? padding.split(' ')[3] : 0),
		barWidth = tabPanel.body.dom.offsetWidth,
		sideCorrection = topLining ? 1.5 : 0.5;

	return path = [
		'M', sideCorrection, bottom,
		'L', left - startBend, bottom,
		'C', left - startBend + smoothness, bottom,
			left + endBend - smoothness, top,
			left + endBend, top,
		'L', left + box.width - endBend, top,
		'C', left + box.width - endBend + smoothness, top,
			left + box.width + startBend - smoothness, bottom,
			left + box.width + startBend, bottom,
		'L', barWidth - sideCorrection, bottom,
		barWidth - sideCorrection, bottom + 6,
		sideCorrection, bottom + 6,
		'Z'
	];

 }
*/
function getArrowTabPath(tabPanel, left, width, pos) {
    var padding = tabPanel.tabBar.padding;

    var path = [
        'M', left, 32,
        'L', left + width - 6, 32
    ];
    if (pos < 1) {
        path.push('L', left + width - 3, 35);
    }
    path.push(
        'L', left + width - 6, 38,
        'L', left, 38
    );
    if (pos > 0) {
        path.push('L', left + 2, 35);
    }
    path.push('z');
    return path;
}

function arrowTabBackground(tabPanel) {
        var ren,
            activeI = $.inArray(tabPanel.activeTab, tabPanel.items.items);

        // Initialize SVG tab graphics
        if (!tabPanel.svgRenderer) {
            var $paper = $('<div>')
                .css({
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: tabPanel.tabBar.height || 26,
                    width: 1000,
                    zIndex: 1
                })
                .appendTo($('#' + tabPanel.getId() + ' .x-tab-bar'));

            tabPanel.svgRenderer = new Highcharts.Renderer(
                $paper[0],
                1000,
                tabPanel.tabBar.height || 26
            );
        }

        ren = tabPanel.svgRenderer;

        $.each(tabPanel.items.items, function(i, tab) {
            var isActive = (tab === tabPanel.activeTab),
                fill = '#d6d1d1',
                len = tabPanel.items.items.length,
                zIndex = len - 1 - i,
                path,
                tabId;



            if (isActive) {
                fill = '#31436b';
                zIndex = tabPanel.items.items.length;
            } else if (i < activeI) {
                fill = '#a4edba';
            }

            path = getArrowTabPath(tabPanel, tab.tab.el.dom.offsetLeft, tab.tab.el.dom.offsetWidth, i / (len - 1))

            if (!tab.svgGroup) {
                tab.svgGroup = ren.g()
                    .attr({
                        zIndex: zIndex
                    })
                    .add();

                tab.svgTab = ren.path(path)
                    .attr({
                        fill: fill
                    })
                    .add(tab.svgGroup);

            } else { // update
                tab.svgGroup.attr({
                    zIndex: zIndex
                });
                tab.svgTab.attr({
                    d: path,
                    fill: fill
                });
            }
        });

    }
    /*
     function tabPanelBackground(tabPanel) {
    	var ren;
    	// Initialize SVG tab graphics
    	if (!tabPanel.svgRenderer) {
    		var $paper = $('<div>')
    			.css({
    				position: 'absolute',
    				top: 0,
    				left: 0,
    				height: tabPanel.tabBar.height || 26,
    				width: 2000,
    				zIndex: 1
    			})
    			.appendTo($('#' + tabPanel.getId() + ' .x-tab-bar'));

    		tabPanel.svgRenderer = new Highcharts.Renderer(
    			$paper[0],
    			2000,
    			tabPanel.tabBar.height || 26
    		);
    	}
    	ren = tabPanel.svgRenderer;

    	$.each(tabPanel.items.items, function (i, tab) {
    		var isActive = (tab === tabPanel.activeTab || (tabPanel.activeTab === undefined && i === 0)),
    			fill = {
    				linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
    				stops: [
    					[0, '#e7e7e7'],
    					[1, '#c8c8c8']
    				]
    			},
    			zIndex = tabPanel.items.items.length - 1 - i;

    		if (isActive) {
    			fill = 'white';
    			zIndex = tabPanel.items.items.length;
    		}

    		var path = getTabPath(tabPanel, tab.tab.lastBox, 10, 8, 8),
    			linePath = getTabPath(tabPanel, Highcharts.extend(tab.tab.lastBox, { y: 1 }), 9, 9, 8, true);

    		if (!tab.svgGroup) {
    			tab.svgGroup = ren.g()
    				.attr({
    					zIndex: zIndex
    				})
    				.add();

    			tab.svgTab = ren.path(path)
    				.attr({
    					fill: fill,
    					stroke: '#999999',
    					'stroke-width': 1
    				})
    				.add(tab.svgGroup);

    			tab.svgLine = ren.path(linePath) // thin white line inside
    				.attr({
    					stroke: 'white',
    					'stroke-width': 1
    				})
    				.add(tab.svgGroup)

    		} else { // update
    			tab.svgGroup.attr({
    				zIndex: zIndex
    			});
    			tab.svgTab.attr({
    				d: path,
    				fill: fill
    			});
    			tab.svgLine.attr({
    				d: linePath
    			});
    		}
    		// Setting the zIndex alone doesn't do the trick. Bug in Highcharts.Renderer?
    		if (isActive) {
    			tab.svgGroup.toFront();
    		}
    	});
    }
    */
    // Extend the Ext tab panel
Ext.tab.Panel.prototype.afterRender = function() {
    Ext.tab.Panel.superclass.afterRender.call(this);
    this.addListener('afterlayout', function() {
        if (this.hasCls('progression-tabs')) {
            arrowTabBackground(this);
        }
    });
};